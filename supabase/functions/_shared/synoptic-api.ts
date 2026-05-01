/**
 * Synoptic Data API Client
 * Fetches real-time weather station observations from Synoptic (formerly MesoWest)
 * Replaces SNOTEL-only reportGenerator with unified access to all station networks
 * (SNOTEL, RAWS, ski area, DOT, avalanche center stations)
 */

// Cache for weather data (30 minute TTL)
const WEATHER_CACHE = new Map<string, {
  data: StationObservation | null;
  fetchedAt: Date;
}>();

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const SYNOPTIC_BASE = 'https://api.synopticdata.com/v2';
const SYNOPTIC_VARS = 'air_temp,snow_depth,precip_accum,snow_water_equiv,wind_speed,wind_direction,wind_gust';

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
    hourlyPrecip24hr?: TempDataPoint[]; // incremental precip per hour, last 24h (inches)
    hourlyPrecip72hr?: TempDataPoint[]; // incremental precip per hour, last 72h (inches)
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
    speedCurrent: number | null;       // most recent speed (mph)
    speedAvg24hr: number | null;       // 24hr average (mph)
    speedMax24hr: number | null;       // 24hr max gust (mph)
    speedAvg72hr: number | null;       // 72hr average (mph)
    speedMax72hr: number | null;       // 72hr max gust (mph)
    direction: string | null;          // most recent direction
    direction24hr: string | null;      // predominant 24hr direction
    direction72hr: string | null;      // predominant 72hr direction
    hourlySpeed24hr?: TempDataPoint[];  // hourly speed (mph), last 24h
    hourlySpeed72hr?: TempDataPoint[];  // hourly speed (mph), last 72h
    hourlyGust24hr?: TempDataPoint[];   // hourly gust (mph), last 24h
    hourlyGust72hr?: TempDataPoint[];   // hourly gust (mph), last 72h
  } | null; // null if station doesn't have wind sensors
  dataQuality: 'good' | 'partial' | 'poor';
}

interface TimeseriesData {
  timestamps: string[];
  values: Map<string, (number | null)[]>;
}

/**
 * Fetch weather observations for a station via Synoptic API
 */
export async function fetchStationObservations(
  stationId: string,
  stationName: string,
  elevation: number
): Promise<StationObservation | null> {
  // Check cache first
  const cached = WEATHER_CACHE.get(stationId);
  if (cached && (Date.now() - cached.fetchedAt.getTime()) < CACHE_TTL_MS) {
    console.log(`Cache hit for ${stationId}`);
    return cached.data;
  }

  const token = Deno.env.get('SYNOPTIC_API_TOKEN');
  if (!token) {
    console.error('SYNOPTIC_API_TOKEN not configured');
    return null;
  }

  try {
    // Fetch last 168 hours (7 days) of data
    const end = new Date();
    const start = new Date(end.getTime() - 168 * 60 * 60 * 1000);
    const startStr = formatDateParam(start);
    const endStr = formatDateParam(end);

    console.log(`Fetching Synoptic data for ${stationId} (${stationName})`);

    const url = `${SYNOPTIC_BASE}/stations/timeseries?token=${token}&stid=${stationId}&vars=${SYNOPTIC_VARS}&units=english&start=${startStr}&end=${endStr}&obtimezone=utc`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Synoptic API error: ${response.status} for ${stationId}`);
      return null;
    }

    const data = await response.json();

    if (data.SUMMARY?.RESPONSE_CODE !== 1) {
      console.error(`Synoptic API error for ${stationId}: ${data.SUMMARY?.RESPONSE_MESSAGE}`);
      return null;
    }

    const station = data.STATION?.[0];
    if (!station) {
      console.error(`No station data for ${stationId}`);
      return null;
    }

    const obs = station.OBSERVATIONS || {};
    const timestamps = obs.date_time || [];

    // Build timeseries data map
    const tsData: TimeseriesData = {
      timestamps,
      values: new Map(),
    };

    // Map Synoptic field names to our internal element codes
    const fieldMap: Record<string, string> = {
      'air_temp_set_1': 'TOBS',
      'snow_depth_set_1': 'SNWD',
      'precip_accum_set_1': 'PREC',
      'snow_water_equiv_set_1': 'WTEQ',
      'wind_speed_set_1': 'WSPD',
      'wind_direction_set_1': 'WDIR',
      'wind_gust_set_1': 'WSPDX',
    };

    for (const [synField, code] of Object.entries(fieldMap)) {
      if (obs[synField]) {
        tsData.values.set(code, obs[synField]);
      }
    }

    console.log(`Synoptic ${stationId}: ${timestamps.length} timestamps, elements: ${Array.from(tsData.values.keys()).join(', ')}`);

    const observation = buildObservation(tsData, stationId, stationName, elevation);

    // Cache the result
    WEATHER_CACHE.set(stationId, {
      data: observation,
      fetchedAt: new Date(),
    });

    return observation;
  } catch (error) {
    console.error(`Error fetching Synoptic data for ${stationId}:`, error);
    return null;
  }
}

/**
 * Build StationObservation from timeseries data
 */
function buildObservation(
  ts: TimeseriesData,
  stationId: string,
  stationName: string,
  elevation: number
): StationObservation {
  const { timestamps, values } = ts;
  const len = timestamps.length;

  // Helper to get values for an element, filtering nulls for calculations
  const getVals = (code: string): (number | null)[] => values.get(code) || [];

  const tobsVals = getVals('TOBS');
  const snwdVals = getVals('SNWD');
  const precVals = getVals('PREC');
  const wteqVals = getVals('WTEQ');
  const wspdVals = getVals('WSPD');
  const wdirVals = getVals('WDIR');
  const wspdxVals = getVals('WSPDX');

  // Latest values
  const latestTimestamp = len > 0 ? timestamps[len - 1] : new Date().toISOString();
  const snowDepth = lastNonNull(snwdVals);
  const precCurrent = lastNonNull(precVals);
  const sweCurrent = lastNonNull(wteqVals);
  const tempCurrent = lastNonNull(tobsVals);

  // Historical lookback values (hourly data, so index offset = hours)
  const snowDepth24hrAgo = valueAtOffset(snwdVals, -24);
  const snowDepth72hrAgo = valueAtOffset(snwdVals, -72);
  const snowDepth7dayAgo = valueAtOffset(snwdVals, -168);

  const prec24hrAgo = valueAtOffset(precVals, -24);
  const prec48hrAgo = valueAtOffset(precVals, -48);
  const prec72hrAgo = valueAtOffset(precVals, -72);
  const prec7dayAgo = valueAtOffset(precVals, -168);

  const swe24hrAgo = valueAtOffset(wteqVals, -24);
  const swe72hrAgo = valueAtOffset(wteqVals, -72);

  // Snow change calculations
  const snowNew24hr = safeSubtract(snowDepth, snowDepth24hrAgo);
  const snowNew72hr = safeSubtract(snowDepth, snowDepth72hrAgo);
  const snowNew7day = safeSubtract(snowDepth, snowDepth7dayAgo);

  // Precip accumulation (PREC is cumulative, so we subtract)
  const precip24hr = safeSubtract(precCurrent, prec24hrAgo);
  const precip48hr = safeSubtract(precCurrent, prec48hrAgo);
  const precip72hr = safeSubtract(precCurrent, prec72hrAgo);
  const precip7day = safeSubtract(precCurrent, prec7dayAgo);

  // Snow percentage (SWE change / snow depth change)
  const sweNew24hr = safeSubtract(sweCurrent, swe24hrAgo);
  const snowPercentage24hr = (snowNew24hr !== null && sweNew24hr !== null && sweNew24hr > 0 && snowNew24hr !== null && snowNew24hr > 0)
    ? Math.round((sweNew24hr / snowNew24hr) * 100)
    : null;
  const sweNew72hr = safeSubtract(sweCurrent, swe72hrAgo);
  const snowPercentage72hr = (snowNew72hr !== null && sweNew72hr !== null && sweNew72hr > 0 && snowNew72hr !== null && snowNew72hr > 0)
    ? Math.round((sweNew72hr / snowNew72hr) * 100)
    : null;

  // Temperature metrics
  const temp24hrAgo = valueAtOffset(tobsVals, -24);
  let trend: 'warming' | 'cooling' | 'stable' | null = null;
  if (tempCurrent !== null && temp24hrAgo !== null) {
    const diff = tempCurrent - temp24hrAgo;
    if (diff > 3) trend = 'warming';
    else if (diff < -3) trend = 'cooling';
    else trend = 'stable';
  }

  // Wind data
  const hasWindData = wspdVals.some(v => v !== null) || wspdxVals.some(v => v !== null);

  // Data quality
  const hasSnowData = snwdVals.some(v => v !== null) || precVals.some(v => v !== null);
  const hasTempData = tobsVals.some(v => v !== null);
  const dataQuality: 'good' | 'partial' | 'poor' = (hasSnowData && hasTempData)
    ? 'good'
    : (hasSnowData || hasTempData)
      ? 'partial'
      : 'poor';

  return {
    stationTriplet: stationId, // Using Synoptic STID as the identifier
    stationName,
    elevation,
    timestamp: latestTimestamp,
    snow: {
      depth: snowDepth,
      depth24hrChange: snowNew24hr,
      depth72hrChange: snowNew72hr,
      depth7dayChange: snowNew7day,
      precip24hr,
      precip72hr,
      precip48hr,
      precip7day,
      swe: sweCurrent,
      snowPercentage24hr,
      snowPercentage72hr,
      hourlyPrecip24hr: hourlyIncrements(precVals, timestamps, 24),
      hourlyPrecip72hr: hourlyIncrements(precVals, timestamps, 72),
    },
    temperature: {
      current: tempCurrent,
      high24hr: maxOfLast(tobsVals, 24),
      low24hr: minOfLast(tobsVals, 24),
      high72hr: maxOfLast(tobsVals, 72),
      low72hr: minOfLast(tobsVals, 72),
      avg24hr: avgOfLast(tobsVals, 24),
      avg72hr: avgOfLast(tobsVals, 72),
      trend,
      hourly24hr: hourlyPoints(tobsVals, timestamps, 24),
      hourly72hr: hourlyPoints(tobsVals, timestamps, 72),
    },
    wind: hasWindData ? {
      speedCurrent: lastNonNull(wspdVals),
      speedAvg24hr: avgOfLast(wspdVals, 24),
      speedMax24hr: maxOfLast(wspdxVals.length > 0 ? wspdxVals : wspdVals, 24),
      speedAvg72hr: avgOfLast(wspdVals, 72),
      speedMax72hr: maxOfLast(wspdxVals.length > 0 ? wspdxVals : wspdVals, 72),
      direction: getWindDirection(lastNonNull(wdirVals)),
      direction24hr: predominantWindDir(wdirVals, 24),
      direction72hr: predominantWindDir(wdirVals, 72),
      hourlySpeed24hr: hourlyPoints(wspdVals, timestamps, 24),
      hourlySpeed72hr: hourlyPoints(wspdVals, timestamps, 72),
      hourlyGust24hr: hourlyPoints(wspdxVals.length > 0 ? wspdxVals : wspdVals, timestamps, 24),
      hourlyGust72hr: hourlyPoints(wspdxVals.length > 0 ? wspdxVals : wspdVals, timestamps, 72),
    } : null,
    dataQuality,
  };
}

// ── Helpers ──

function formatDateParam(d: Date): string {
  return d.toISOString().replace(/[-:T]/g, '').slice(0, 12);
}

function lastNonNull(vals: (number | null)[]): number | null {
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] !== null) return vals[i];
  }
  return null;
}

function valueAtOffset(vals: (number | null)[], offset: number): number | null {
  const idx = vals.length + offset;
  if (idx < 0 || idx >= vals.length) return null;
  return vals[idx];
}

function safeSubtract(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Math.round((a - b) * 100) / 100;
}

function maxOfLast(vals: (number | null)[], hours: number): number | null {
  const slice = vals.slice(-hours);
  const valid = slice.filter((v): v is number => v !== null);
  return valid.length > 0 ? Math.max(...valid) : null;
}

function minOfLast(vals: (number | null)[], hours: number): number | null {
  const slice = vals.slice(-hours);
  const valid = slice.filter((v): v is number => v !== null);
  return valid.length > 0 ? Math.min(...valid) : null;
}

function avgOfLast(vals: (number | null)[], hours: number): number | null {
  const slice = vals.slice(-hours);
  const valid = slice.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

/**
 * Build hourly increments from a cumulative running total (e.g., precip_accum
 * which only resets at the seasonal start). Returns positive deltas only;
 * sensor resets / negative diffs become 0.
 */
function hourlyIncrements(
  vals: (number | null)[],
  timestamps: string[],
  hours: number,
  precision = 2,
): TempDataPoint[] {
  const startIdx = Math.max(1, vals.length - hours);
  const sampleInterval = hours <= 24 ? 1 : 2;
  const points: TempDataPoint[] = [];
  let prev = vals[startIdx - 1];
  for (let i = startIdx; i < vals.length; i += sampleInterval) {
    const cur = vals[i];
    if (cur !== null && prev !== null) {
      const diff = cur - prev;
      const delta = diff > 0 ? diff : 0;
      points.push({
        timestamp: timestamps[i],
        value: Math.round(delta * Math.pow(10, precision)) / Math.pow(10, precision),
      });
      prev = cur;
    } else if (cur !== null) {
      // First valid reading after a gap — start a new baseline
      prev = cur;
    }
  }
  return points;
}

function hourlyPoints(vals: (number | null)[], timestamps: string[], hours: number): TempDataPoint[] {
  const startIdx = Math.max(0, vals.length - hours);
  const sampleInterval = hours <= 24 ? 1 : 2;
  const points: TempDataPoint[] = [];

  for (let i = startIdx; i < vals.length; i += sampleInterval) {
    if (vals[i] !== null) {
      points.push({ timestamp: timestamps[i], value: Math.round(vals[i]!) });
    }
  }

  // Always include the most recent
  if (vals.length > 0 && vals[vals.length - 1] !== null) {
    const lastTs = timestamps[timestamps.length - 1];
    if (!points.length || points[points.length - 1].timestamp !== lastTs) {
      points.push({ timestamp: lastTs, value: Math.round(vals[vals.length - 1]!) });
    }
  }

  return points;
}

function getWindDirection(degrees: number | null): string | null {
  if (degrees === null) return null;
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return directions[Math.round(degrees / 45) % 8];
}

function predominantWindDir(vals: (number | null)[], hours: number): string | null {
  const slice = vals.slice(-hours);
  const valid = slice.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;

  const radians = valid.map(v => v * Math.PI / 180);
  const avgSin = radians.reduce((s, r) => s + Math.sin(r), 0) / radians.length;
  const avgCos = radians.reduce((s, r) => s + Math.cos(r), 0) / radians.length;
  const avgDeg = (Math.atan2(avgSin, avgCos) * 180 / Math.PI + 360) % 360;
  return getWindDirection(avgDeg);
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
