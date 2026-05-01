/**
 * SNOTEL reportGenerator CSV API Client
 * Fetches real-time weather station observations from USDA NRCS reportGenerator
 * Using CSV endpoint for real-time data (no 24hr lag like AWDB REST API)
 */

import { ELEMENT_CODES } from './weather-station-config.ts';

const REPORT_GENERATOR_BASE_URL = 'https://wcc.sc.egov.usda.gov/reportGenerator';

// Cache for weather data (30 minute TTL)
const WEATHER_CACHE = new Map<string, {
  data: StationObservation | null;
  fetchedAt: Date;
}>();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes (SNOTEL updates hourly)

export interface TempDataPoint {
  timestamp: string;
  value: number;
}

export interface StationObservation {
  stationTriplet: string;
  stationName: string;
  elevation: number; // station elevation in feet
  timestamp: string; // ISO 8601 timestamp of most recent observation
  snow: {
    depth: number | null;              // current snow depth (inches)
    depth24hrChange: number | null;    // change in last 24hr (inches)
    depth72hrChange: number | null;    // change in last 72hr (inches)
    depth7dayChange: number | null;    // change in last 7 days (inches)
    precip24hr: number | null;         // precipitation in last 24hr (inches)
    precip72hr: number | null;         // precipitation in last 72hr (inches)
    precip48hr: number | null;         // precipitation in last 48hr (inches)
    precip7day: number | null;         // precipitation in last 7 days (inches)
    swe: number | null;                // snow water equivalent (inches)
    snowPercentage24hr: number | null; // snow percentage for 24hr (from SWE)
    snowPercentage72hr: number | null; // snow percentage for 72hr (from SWE)
  };
  temperature: {
    current: number | null;            // most recent temp (°F)
    high24hr: number | null;           // 24hr high (°F)
    low24hr: number | null;            // 24hr low (°F)
    high72hr: number | null;           // 72hr high (°F)
    low72hr: number | null;            // 72hr low (°F)
    avg24hr: number | null;            // 24hr average (°F)
    avg72hr: number | null;            // 72hr average (°F)
    trend: 'warming' | 'cooling' | 'stable' | null;
    hourly24hr: TempDataPoint[];       // hourly temps for last 24hr (for sparkline)
    hourly72hr: TempDataPoint[];       // hourly temps for last 72hr (for sparkline)
  };
  wind: {
    speedAvg24hr: number | null;       // 24hr average (mph)
    speedMax24hr: number | null;       // 24hr max (mph)
    speedAvg72hr: number | null;       // 72hr average (mph)
    speedMax72hr: number | null;       // 72hr max (mph)
    direction: string | null;          // predominant direction (most recent)
    direction24hr: string | null;      // predominant 24hr direction
    direction72hr: string | null;      // predominant 72hr direction
  } | null; // null if station doesn't have wind sensors
  dataQuality: 'good' | 'partial' | 'poor';
}

interface AWDBDataPoint {
  date: string;
  value: number;
}

interface AWDBElement {
  elementCode: string;
  storedUnitCode: string;
  values: AWDBDataPoint[];
}

interface AWDBResponse {
  stationTriplet: string;
  data: {
    stationElement: {
      elementCode: string;
      storedUnitCode: string;
    };
    values: AWDBDataPoint[];
  }[];
}

/**
 * Fetch weather observations for a station
 */
export async function fetchStationObservations(
  stationTriplet: string,
  stationName: string,
  elevation: number
): Promise<StationObservation | null> {
  // Check cache first
  const cached = WEATHER_CACHE.get(stationTriplet);
  if (cached && (Date.now() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
    console.log(`Cache hit for ${stationTriplet}`);
    return cached.data;
  }

  try {
    // Fetch last 168 hours (7 days) to ensure we have enough data for all metrics
    const hoursBack = 168; // 7 days = 168 hours

    console.log(`Fetching SNOTEL HOURLY data for ${stationTriplet} (last ${hoursBack} hours)`);

    // Build reportGenerator CSV URL
    // Format: /view_csv/customSingleStationReport/hourly/{triplet}|id=""|name/{hoursBack},0/ELEMENT::value,...
    const elements = 'TOBS::value,SNWD::value,PREC::value,WTEQ::value,WSPD::value,WSPDX::value,WDIR::value';
    const encodedTriplet = encodeURIComponent(`${stationTriplet}|id=""|name`);
    const url = `${REPORT_GENERATOR_BASE_URL}/view_csv/customSingleStationReport/hourly/${encodedTriplet}/-${hoursBack},0/${elements}`;

    console.log(`SNOTEL reportGenerator URL: ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`reportGenerator API error: ${response.status} for ${stationTriplet}`);
      return null;
    }

    const csvText = await response.text();
    console.log(`SNOTEL CSV response length: ${csvText.length} characters`);

    // Parse CSV data into AWDB-compatible format
    const awdbData = parseCSVToAWDB(csvText, stationTriplet);

    if (!awdbData || awdbData.data.length === 0) {
      console.error(`No data returned for ${stationTriplet}`);
      return null;
    }

    console.log(`Parsed CSV into ${awdbData.data.length} elements`);

    // Parse and aggregate data
    const observation = parseAWDBResponse(awdbData, stationName, elevation);
    console.log(`Parsed observation for ${stationName}:`, JSON.stringify({
      timestamp: observation.timestamp,
      depth: observation.snow.depth,
      depth24hrChange: observation.snow.depth24hrChange,
      depth72hrChange: observation.snow.depth72hrChange,
      temp: observation.temperature.current,
      tempTrend: observation.temperature.trend,
      precip24hr: observation.snow.precip24hr,
      precip72hr: observation.snow.precip72hr,
      avg24hr: observation.temperature.avg24hr,
      avg72hr: observation.temperature.avg72hr,
    }));
    console.log(`=== END PARSING ${stationName} ===\n`);

    // Cache the result
    WEATHER_CACHE.set(stationTriplet, {
      data: observation,
      fetchedAt: new Date(),
    });

    return observation;
  } catch (error) {
    console.error(`Error fetching SNOTEL data for ${stationTriplet}:`, error);
    return null;
  }
}

/**
 * Parse CSV data from reportGenerator into AWDB-compatible format
 */
function parseCSVToAWDB(csvText: string, stationTriplet: string): AWDBResponse {
  // Parse CSV lines, skipping comments (lines starting with #)
  const lines = csvText.split('\n').filter(line =>
    line.trim() && !line.trim().startsWith('#')
  );

  // Data arrays for each element
  const tobsData: AWDBDataPoint[] = [];
  const snwdData: AWDBDataPoint[] = [];
  const precData: AWDBDataPoint[] = [];
  const wteqData: AWDBDataPoint[] = [];

  // Parse each data row
  // Format: YYYY-MM-DD HH:MM,TOBS,SNWD,PREC,WTEQ
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length !== 5) continue; // Skip invalid lines

    const timestamp = parts[0].trim();
    const tobs = parseFloat(parts[1]);
    const snwd = parseFloat(parts[2]);
    const prec = parseFloat(parts[3]);
    const wteq = parseFloat(parts[4]);

    // Convert timestamp to ISO 8601 format
    const isoTimestamp = timestamp.replace(' ', 'T') + ':00.000Z';

    // Add to arrays if valid
    if (!isNaN(tobs)) tobsData.push({ date: isoTimestamp, value: tobs });
    if (!isNaN(snwd)) snwdData.push({ date: isoTimestamp, value: snwd });
    if (!isNaN(prec)) precData.push({ date: isoTimestamp, value: prec });
    if (!isNaN(wteq)) wteqData.push({ date: isoTimestamp, value: wteq });
  }

  // Return in AWDB-compatible format
  return {
    stationTriplet,
    data: [
      {
        stationElement: { elementCode: 'TOBS', storedUnitCode: 'degF' },
        values: tobsData,
      },
      {
        stationElement: { elementCode: 'SNWD', storedUnitCode: 'in' },
        values: snwdData,
      },
      {
        stationElement: { elementCode: 'PREC', storedUnitCode: 'in' },
        values: precData,
      },
      {
        stationElement: { elementCode: 'WTEQ', storedUnitCode: 'in' },
        values: wteqData,
      },
    ],
  };
}

/**
 * Parse AWDB API response into our observation format
 */
function parseAWDBResponse(
  response: AWDBResponse,
  stationName: string,
  elevation: number
): StationObservation {
  // Extract element data
  const elements = new Map<string, AWDBDataPoint[]>();
  console.log(`\n=== PARSING SNOTEL DATA FOR ${stationName} ===`);
  for (const item of response.data) {
    const code = item.stationElement.elementCode;
    elements.set(code, item.values || []);
    console.log(`Element ${code}: ${item.values?.length || 0} data points`);
  }

  // Get most recent timestamp
  const allValues = response.data.flatMap(d => d.values || []);
  const latestDate = allValues.length > 0
    ? allValues[allValues.length - 1].date
    : new Date().toISOString();

  // Calculate snow metrics (hourly data - look back 24 and 72 hours)
  const snwdValues = elements.get('SNWD') || [];
  const precValues = elements.get('PREC') || [];
  const wteqValues = elements.get('WTEQ') || [];

  const snowDepth = getLatestValue(snwdValues);
  const snowDepth24hrAgo = getValue(snwdValues, -24);  // 24 hours back
  const snowDepth72hrAgo = getValue(snwdValues, -72);  // 72 hours back
  const snowDepth7dayAgo = getValue(snwdValues, -168); // 7 days = 168 hours

  const precCurrent = getLatestValue(precValues);
  const prec24hrAgo = getValue(precValues, -24);
  const prec48hrAgo = getValue(precValues, -48);
  const prec72hrAgo = getValue(precValues, -72);
  const prec7dayAgo = getValue(precValues, -168);

  const sweCurrent = getLatestValue(wteqValues);
  const swe24hrAgo = getValue(wteqValues, -24);
  const swe72hrAgo = getValue(wteqValues, -72);

  // Log data availability
  console.log(`\nDATA AVAILABILITY CHECK:`);
  console.log(`- Temperature (TOBS) values: ${elements.get('TOBS')?.length || 0} points`);
  console.log(`- Precipitation (PREC) values: ${precValues.length} points`);
  console.log(`- Snow depth (SNWD) values: ${snwdValues.length} points`);
  console.log(`- SWE (WTEQ) values: ${wteqValues.length} points`);

  // Check 24hr lookback values
  console.log(`\n24HR LOOKBACK VALUES:`);
  console.log(`- Temperature 24hr ago: ${getValue(elements.get('TOBS') || [], -24)}`);
  console.log(`- Precipitation 24hr ago: ${prec24hrAgo}`);
  console.log(`- Snow depth 24hr ago: ${snowDepth24hrAgo}`);

  // Check 72hr lookback values
  console.log(`\n72HR LOOKBACK VALUES:`);
  console.log(`- Temperature 72hr ago: ${getValue(elements.get('TOBS') || [], -72)}`);
  console.log(`- Precipitation 72hr ago: ${prec72hrAgo}`);
  console.log(`- Snow depth 72hr ago: ${snowDepth72hrAgo}`);

  // Calculate snow percentage (snow depth / SWE * 100)
  // Typical range: 5-20% (heavy wet) to 10-30% (average) to 20-40% (light powder)
  const snowNew24hr = snowDepth !== null && snowDepth24hrAgo !== null ? snowDepth - snowDepth24hrAgo : null;
  const sweNew24hr = sweCurrent !== null && swe24hrAgo !== null ? sweCurrent - swe24hrAgo : null;
  const snowPercentage24hr = (snowNew24hr !== null && sweNew24hr !== null && sweNew24hr > 0)
    ? Math.round((sweNew24hr / snowNew24hr) * 100)
    : null;

  const snowNew72hr = snowDepth !== null && snowDepth72hrAgo !== null ? snowDepth - snowDepth72hrAgo : null;
  const sweNew72hr = sweCurrent !== null && swe72hrAgo !== null ? sweCurrent - swe72hrAgo : null;
  const snowPercentage72hr = (snowNew72hr !== null && sweNew72hr !== null && sweNew72hr > 0)
    ? Math.round((sweNew72hr / snowNew72hr) * 100)
    : null;

  // Calculate temperature metrics
  const tobsValues = elements.get('TOBS') || [];
  const tmaxValues = elements.get('TMAX') || [];
  const tminValues = elements.get('TMIN') || [];

  const tempCurrent = getLatestValue(tobsValues);
  const temp24hrAgo = getValue(tobsValues, -24);

  // Calculate trend
  let trend: 'warming' | 'cooling' | 'stable' | null = null;
  if (tempCurrent !== null && temp24hrAgo !== null) {
    const diff = tempCurrent - temp24hrAgo;
    if (diff > 3) trend = 'warming';
    else if (diff < -3) trend = 'cooling';
    else trend = 'stable';
  }

  // Log temperature trend calculation
  console.log(`\nTEMPERATURE TREND CALCULATION:`);
  console.log(`- Current temp: ${tempCurrent}`);
  console.log(`- Temp 24hr ago: ${temp24hrAgo}`);
  console.log(`- Calculated trend: ${trend || 'NULL (missing data!)'}`);

  // Wind data (many stations don't have this)
  const wspdValues = elements.get('WSPD') || [];
  const wspdxValues = elements.get('WSPDX') || [];
  const wdirValues = elements.get('WDIR') || [];

  const hasWindData = wspdValues.length > 0 || wspdxValues.length > 0;

  // Determine data quality
  const hasSnowData = snwdValues.length > 0 || precValues.length > 0;
  const hasTempData = tobsValues.length > 0;
  const dataQuality = (hasSnowData && hasTempData)
    ? 'good'
    : (hasSnowData || hasTempData)
      ? 'partial'
      : 'poor';

  // Log precipitation calculations
  console.log(`\nPRECIPITATION CALCULATIONS:`);
  console.log(`- Current precip: ${precCurrent}`);
  console.log(`- Precip 24hr ago: ${prec24hrAgo}`);
  console.log(`- Precip 72hr ago: ${prec72hrAgo}`);
  console.log(`- 24hr accumulation: ${precCurrent !== null && prec24hrAgo !== null ? precCurrent - prec24hrAgo : 'NULL'}`);
  console.log(`- 72hr accumulation: ${precCurrent !== null && prec72hrAgo !== null ? precCurrent - prec72hrAgo : 'NULL'}`);

  return {
    stationTriplet: response.stationTriplet,
    stationName,
    elevation,
    timestamp: latestDate,
    snow: {
      depth: snowDepth,
      depth24hrChange: snowNew24hr,
      depth72hrChange: snowNew72hr,
      depth7dayChange: snowDepth !== null && snowDepth7dayAgo !== null
        ? snowDepth - snowDepth7dayAgo
        : null,
      precip24hr: precCurrent !== null && prec24hrAgo !== null
        ? precCurrent - prec24hrAgo
        : null,
      precip72hr: precCurrent !== null && prec72hrAgo !== null
        ? precCurrent - prec72hrAgo
        : null,
      precip48hr: precCurrent !== null && prec48hrAgo !== null
        ? precCurrent - prec48hrAgo
        : null,
      precip7day: precCurrent !== null && prec7dayAgo !== null
        ? precCurrent - prec7dayAgo
        : null,
      swe: sweCurrent,
      snowPercentage24hr,
      snowPercentage72hr,
    },
    temperature: {
      current: tempCurrent,
      high24hr: getMax(tobsValues, 24),  // Last 24 hours
      low24hr: getMin(tobsValues, 24),
      high72hr: getMax(tobsValues, 72),  // Last 72 hours
      low72hr: getMin(tobsValues, 72),
      avg24hr: getAvg(tobsValues, 24),
      avg72hr: getAvg(tobsValues, 72),
      trend,
      hourly24hr: getHourlyData(tobsValues, 24),
      hourly72hr: getHourlyData(tobsValues, 72),
    },
    wind: hasWindData ? {
      speedAvg24hr: getAvg(wspdValues, 24),
      speedMax24hr: getMax(wspdxValues, 24),
      speedAvg72hr: getAvg(wspdValues, 72),
      speedMax72hr: getMax(wspdxValues, 72),
      direction: getWindDirection(getLatestValue(wdirValues)),
      direction24hr: getPredominantWindDirection(wdirValues, 24),
      direction72hr: getPredominantWindDirection(wdirValues, 72),
    } : null,
    dataQuality,
  };
}

/**
 * Helper: Get latest value from time series
 */
function getLatestValue(values: AWDBDataPoint[]): number | null {
  if (values.length === 0) return null;
  return values[values.length - 1].value;
}

/**
 * Helper: Get value at offset from latest (negative offset)
 */
function getValue(values: AWDBDataPoint[], offset: number): number | null {
  if (values.length === 0) return null;
  const index = values.length + offset; // offset is negative
  if (index < 0) return null;
  return values[index]?.value ?? null;
}

/**
 * Helper: Get max value over last N days
 */
function getMax(values: AWDBDataPoint[], days: number): number | null {
  if (values.length === 0) return null;
  const recentValues = values.slice(-days);
  if (recentValues.length === 0) return null;
  return Math.max(...recentValues.map(v => v.value));
}

/**
 * Helper: Get min value over last N days
 */
function getMin(values: AWDBDataPoint[], days: number): number | null {
  if (values.length === 0) return null;
  const recentValues = values.slice(-days);
  if (recentValues.length === 0) return null;
  return Math.min(...recentValues.map(v => v.value));
}

/**
 * Helper: Get average value over last N days
 */
function getAvg(values: AWDBDataPoint[], days: number): number | null {
  if (values.length === 0) return null;
  const recentValues = values.slice(-days);
  if (recentValues.length === 0) return null;
  const sum = recentValues.reduce((acc, v) => acc + v.value, 0);
  return Math.round(sum / recentValues.length);
}

/**
 * Helper: Get hourly data points for sparkline
 */
function getHourlyData(values: AWDBDataPoint[], hours: number): TempDataPoint[] {
  if (values.length === 0) return [];
  const recentValues = values.slice(-hours);
  if (recentValues.length === 0) return [];
  
  // Sample every hour for 24hr, every 2 hours for 72hr (smoother lines)
  const sampleInterval = hours <= 24 ? 1 : 2;
  const sampled: TempDataPoint[] = [];
  
  for (let i = 0; i < recentValues.length; i += sampleInterval) {
    sampled.push({
      timestamp: recentValues[i].date,
      value: Math.round(recentValues[i].value),
    });
  }
  
  // Always include the most recent value
  if (recentValues.length > 0 && sampled[sampled.length - 1]?.timestamp !== recentValues[recentValues.length - 1].date) {
    sampled.push({
      timestamp: recentValues[recentValues.length - 1].date,
      value: Math.round(recentValues[recentValues.length - 1].value),
    });
  }
  
  return sampled;
}

/**
 * Helper: Convert wind direction degrees to cardinal direction
 */
function getWindDirection(degrees: number | null): string | null {
  if (degrees === null) return null;

  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

/**
 * Helper: Get predominant wind direction over last N hours
 */
function getPredominantWindDirection(values: AWDBDataPoint[], hours: number): string | null {
  if (values.length === 0) return null;
  const recentValues = values.slice(-hours);
  if (recentValues.length === 0) return null;

  // Calculate average direction (handling circular nature of degrees)
  const radians = recentValues.map(v => v.value * Math.PI / 180);
  const avgSin = radians.reduce((sum, r) => sum + Math.sin(r), 0) / radians.length;
  const avgCos = radians.reduce((sum, r) => sum + Math.cos(r), 0) / radians.length;
  const avgDegrees = Math.atan2(avgSin, avgCos) * 180 / Math.PI;
  const normalizedDegrees = (avgDegrees + 360) % 360;

  return getWindDirection(normalizedDegrees);
}

/**
 * Helper: Format date as YYYY-MM-DD
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Fetch observations for multiple stations
 */
export async function fetchMultipleStations(
  stations: Array<{ triplet: string; name: string; elevation: number }>
): Promise<StationObservation[]> {
  const results = await Promise.all(
    stations.map(s => fetchStationObservations(s.triplet, s.name, s.elevation))
  );

  return results.filter((r): r is StationObservation => r !== null);
}
