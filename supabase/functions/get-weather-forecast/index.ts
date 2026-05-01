import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getNwsZoneMapping, getAvgWfos } from '../_shared/nws-zone-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NAC_API_BASE = 'https://api.avalanche.org/v2/public';
const NWS_API_BASE = 'https://api.weather.gov';

const nacHeaders = {
  'User-Agent': '(kaiconsulting.lovable.app, kaimyers@alaskapacific.edu)',
  'Accept': 'application/json',
};

const nwsHeaders = {
  'User-Agent': '(AvalancheComparison/1.0, kaimyers@alaskapacific.edu)',
  'Accept': 'application/geo+json',
};

// Zone ID → Center ID mapping
const ZONE_CENTER_MAP: Record<string, string> = {
  // BAC
  'bridgeport': 'BAC',
  // BTAC
  'salt-river-wyoming-ranges': 'BTAC',
  'snake-river-range': 'BTAC',
  'tetons': 'BTAC',
  'togwotee-pass': 'BTAC',
  // CAC
  'cordova': 'CAC',
  // CAIC
  'caic-northern-san-juan': 'CAIC',
  'caic-sangre-de-cristo': 'CAIC',
  'caic-southern-san-juan': 'CAIC',
  'caic-park-range': 'CAIC',
  'caic-front-range-north': 'CAIC',
  'caic-vail-summit-county': 'CAIC',
  'caic-front-range-boulder': 'CAIC',
  'caic-grand-mesa-west-elk': 'CAIC',
  'caic-elk-mountains': 'CAIC',
  'caic-sawatch-range': 'CAIC',
  'caic-front-range-south': 'CAIC',
  // CAAC
  'douglas-island': 'CAAC',
  'juneau-mainland': 'CAAC',
  // CNFAIC
  'turnagain-girdwood': 'CNFAIC',
  'summit': 'CNFAIC',
  'seward': 'CNFAIC',
  'chugach-state-park': 'CNFAIC',
  // COAA
  'central-cascades': 'COAA',
  'newberry': 'COAA',
  // EARAC
  'earac-north': 'EARAC',
  'earac-south': 'EARAC',
  // ESAC
  'eastside-region': 'ESAC',
  // EWYAIX
  'big-horns': 'EWYAIX',
  'sierra-madre': 'EWYAIX',
  'snowy-range': 'EWYAIX',
  // FAC
  'flathead-range-glacier-np': 'FAC',
  'swan-range': 'FAC',
  'whitefish-range': 'FAC',
  // GNFAC
  'bridger-range': 'GNFAC',
  'cooke-city': 'GNFAC',
  'island-park': 'GNFAC',
  'lionhead-area': 'GNFAC',
  'northern-gallatin-range': 'GNFAC',
  'northern-madison-range': 'GNFAC',
  'southern-gallatin-range': 'GNFAC',
  'southern-madison-range': 'GNFAC',
  // HAC
  'haines-lutak': 'HAC',
  'haines-transitional': 'HAC',
  'haines-chilkat-pass': 'HAC',
  // HPAC
  'hatcher-pass': 'HPAC',
  // IPAC
  'east-cabinet-mountains': 'IPAC',
  'purcell-mountains': 'IPAC',
  'selkirk-mountains': 'IPAC',
  'silver-valley-bitterroot-mountains': 'IPAC',
  'west-cabinet-mountains': 'IPAC',
  // KPAC
  'san-francisco-peaks': 'KPAC',
  // MSAC
  'mount-shasta': 'MSAC',
  // MWAC
  'presidential-range': 'MWAC',
  // NWAC
  'east-slopes-central': 'NWAC',
  'east-slopes-north': 'NWAC',
  'east-slopes-south': 'NWAC',
  'mt-hood': 'NWAC',
  'olympics': 'NWAC',
  'snoqualmie-pass': 'NWAC',
  'stevens-pass': 'NWAC',
  'west-slopes-central': 'NWAC',
  'west-slopes-north': 'NWAC',
  'west-slopes-south': 'NWAC',
  // PAC
  'salmon-river-mountains': 'PAC',
  'west-mountains': 'PAC',
  // SAC
  'central-sierra-nevada': 'SAC',
  // SNFAC
  'banner-summit': 'SNFAC',
  'galena-summit-eastern-mtns': 'SNFAC',
  'sawtooth-western-smoky-mtns': 'SNFAC',
  'soldier-wood-river-valley-mtns': 'SNFAC',
  // SOAIX
  'southern-oregon': 'SOAIX',
  // TAC
  'northern-new-mexico': 'TAC',
  // UAC
  'abajos': 'UAC',
  'logan': 'UAC',
  'moab': 'UAC',
  'ogden': 'UAC',
  'provo': 'UAC',
  'salt-lake': 'UAC',
  'skyline': 'UAC',
  'southwest': 'UAC',
  'uintas': 'UAC',
  // VAC
  'valdez-maritime': 'VAC',
  'valdez-intermountain': 'VAC',
  'valdez-continental': 'VAC',
  // WAC
  'blues': 'WAC',
  'elkhorns': 'WAC',
  'northern-wallowas': 'WAC',
  'southern-wallowas': 'WAC',
  // WCMAC
  'bitterroot': 'WCMAC',
  'rattlesnake': 'WCMAC',
  'seeley-lake': 'WCMAC',
};

// Strip HTML but preserve paragraph structure
function stripHtmlPreserveBreaks(html: string | null | undefined): string | null {
  if (!html) return null;
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/th>/gi, ' | ')
    .replace(/<\/td>/gi, ' | ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&deg;/g, '°')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .split('\n').map(line => line.trim()).join('\n')
    .trim() || null;
}

// ─── Text Parsing Helpers ────────────────────────────────────────────────────

/** Parse temperature from zone forecast text. Returns first number from "Highs 35 to 47" or "Lows 13 to 23" */
function parseTemperature(text: string): number | null {
  // Match "Highs 35 to 47", "Lows around 23", "Highs in the lower 30s", etc.
  const rangeMatch = text.match(/(?:highs?|lows?)\s+(?:around\s+|near\s+)?(\d+)/i);
  if (rangeMatch) return parseInt(rangeMatch[1], 10);
  // Match "Highs in the lower/mid/upper 30s"
  const approxMatch = text.match(/(?:highs?|lows?)\s+in the\s+(?:lower|mid|upper)\s+(\d+)s/i);
  if (approxMatch) {
    const base = parseInt(approxMatch[1], 10);
    const qualifier = text.match(/(?:lower|mid|upper)/i)?.[0]?.toLowerCase();
    if (qualifier === 'lower') return base + 2;
    if (qualifier === 'mid') return base + 5;
    if (qualifier === 'upper') return base + 8;
    return base + 5;
  }
  return null;
}

/** Parse wind from zone forecast text. Returns { direction, speed } */
function parseWind(text: string): { direction: string; speed: string } | null {
  // Match "Northwest winds 10 to 15 mph" or "West winds around 10 mph"
  const windMatch = text.match(/(north|south|east|west|northwest|northeast|southwest|southeast|n|s|e|w|nw|ne|sw|se)\w*\s+winds?\s+([\d][\w\s]+?mph)/i);
  if (windMatch) {
    const dirMap: Record<string, string> = {
      'north': 'N', 'south': 'S', 'east': 'E', 'west': 'W',
      'northwest': 'NW', 'northeast': 'NE', 'southwest': 'SW', 'southeast': 'SE',
      'northwesterly': 'NW', 'northeasterly': 'NE', 'southwesterly': 'SW', 'southeasterly': 'SE',
    };
    const rawDir = windMatch[1].toLowerCase();
    const direction = dirMap[rawDir] || rawDir.toUpperCase().slice(0, 2);
    return { direction, speed: windMatch[2].trim() };
  }
  // Match "winds 10 to 15 mph" without direction
  const speedOnly = text.match(/winds?\s+([\d][\w\s]+?mph)/i);
  if (speedOnly) {
    return { direction: '', speed: speedOnly[1].trim() };
  }
  return null;
}

/** Extract first sentence as short forecast */
function extractShortForecast(text: string): string {
  const firstSentence = text.match(/^([^.!]+[.!])/);
  return firstSentence ? firstSentence[1].trim() : text.slice(0, 60);
}

/** Determine if a period name represents daytime */
function isDaytimePeriod(name: string): boolean {
  const lower = name.toLowerCase();
  return !lower.includes('night') && !lower.includes('tonight') && !lower.includes('overnight');
}

// ─── NAC Weather ─────────────────────────────────────────────────────────────

async function fetchNacWeather(centerId: string): Promise<{
  discussion: string | null;
  tables: any[];
  publishedTime: string | null;
} | null> {
  try {
    const url = `${NAC_API_BASE}/product?type=weather&center_id=${centerId}`;
    console.log(`Fetching NAC weather for ${centerId}`);
    const response = await fetch(url, { headers: nacHeaders });

    if (!response.ok) {
      console.log(`NAC weather returned ${response.status} for ${centerId}`);
      return null;
    }

    const data = await response.json();

    if (!data.weather_discussion && (!data.weather_data || data.weather_data.length === 0)) {
      console.log(`No weather data in response for ${centerId}`);
      return null;
    }

    return {
      discussion: stripHtmlPreserveBreaks(data.weather_discussion),
      tables: Array.isArray(data.weather_data) ? data.weather_data : [],
      publishedTime: data.published_time || null,
    };
  } catch (error) {
    console.error(`Error fetching NAC weather for ${centerId}:`, error);
    return null;
  }
}

// ─── NWS Zone Forecast ───────────────────────────────────────────────────────

/** Fetch NWS zone forecast — returns mountain-specific weather for a named forecast zone */
async function fetchNwsZoneForecast(forecastZone: string): Promise<{
  periods: Array<{
    name: string;
    temperature: number;
    temperatureUnit: string;
    windSpeed: string;
    windDirection: string;
    shortForecast: string;
    detailedForecast: string;
    isDaytime: boolean;
  }>;
  forecastZone: string;
  forecastZoneName: string | null;
  forecastPageUrl: string;
} | null> {
  try {
    const url = `${NWS_API_BASE}/zones/forecast/${forecastZone}/forecast`;
    console.log(`Fetching NWS zone forecast: ${url}`);
    const resp = await fetch(url, { headers: nwsHeaders });

    if (!resp.ok) {
      console.log(`NWS zone forecast returned ${resp.status} for ${forecastZone}`);
      return null;
    }

    const data = await resp.json();
    const rawPeriods = data.properties?.periods || [];

    // Parse structured fields from the text-only zone forecast
    const periods = rawPeriods.slice(0, 8).map((p: any) => {
      const text = p.detailedForecast || '';
      const temp = parseTemperature(text);
      const wind = parseWind(text);
      const daytime = isDaytimePeriod(p.name || '');

      return {
        name: p.name,
        temperature: temp ?? 0,
        temperatureUnit: 'F',
        windSpeed: wind?.speed || '',
        windDirection: wind?.direction || '',
        shortForecast: extractShortForecast(text),
        detailedForecast: text,
        isDaytime: daytime,
      };
    });

    // Get zone name from the zone metadata
    let forecastZoneName: string | null = null;
    try {
      const zoneUrl = `${NWS_API_BASE}/zones/forecast/${forecastZone}`;
      const zoneResp = await fetch(zoneUrl, { headers: nwsHeaders });
      if (zoneResp.ok) {
        const zoneData = await zoneResp.json();
        forecastZoneName = zoneData.properties?.name || null;
      }
    } catch {
      // Non-critical, just log
      console.log(`Could not fetch zone name for ${forecastZone}`);
    }

    const forecastPageUrl = `https://forecast.weather.gov/MapClick.php?zoneid=${forecastZone}`;

    return {
      periods,
      forecastZone,
      forecastZoneName,
      forecastPageUrl,
    };
  } catch (error) {
    console.error(`Error fetching NWS zone forecast for ${forecastZone}:`, error);
    return null;
  }
}

// ─── NWS AVG (Avalanche Weather Guidance) ────────────────────────────────────

/** Parse AVG product text into structured parts */
function parseAvgProduct(text: string): {
  discussion: string | null;
  locations: Array<{ name: string; elevationBand: string; tableText: string }>;
} {
  // Extract the .DISCUSSION... section
  let discussion: string | null = null;
  const discussionMatch = text.match(/\.DISCUSSION\.\.\.\s*\n([\s\S]*?)(?=\n\s*\n\s*\.\.\.)/);
  if (discussionMatch) {
    discussion = discussionMatch[1].replace(/\s+/g, ' ').trim();
  }

  // Extract location sections: ...Location Name (elevation)...
  const locations: Array<{ name: string; elevationBand: string; tableText: string }> = [];
  const sectionRegex = /\.\.\.([^.]+?)(\([^)]+\))?\.\.\.\s*\n([\s\S]*?)(?=\n\s*\.\.\.|$)/g;
  let match;
  while ((match = sectionRegex.exec(text)) !== null) {
    const rawName = match[1].trim();
    const elevationBand = match[2]?.trim() || '';
    const tableText = match[3].trim();

    // Skip the DISCUSSION section
    if (rawName === 'DISCUSSION') continue;

    locations.push({
      name: rawName,
      elevationBand,
      tableText,
    });
  }

  return { discussion, locations };
}

/** Map AVG location names to avalanche zone IDs.
 * Returns all locations whose name matches keywords for a given zone. */
const AVG_ZONE_KEYWORDS: Record<string, string[]> = {
  // Alaska - CNFAIC
  'turnagain-girdwood': ['Turnagain', 'Girdwood', 'Penguin Ridge', 'Portage Valley', 'Placer Valley'],
  'summit': ['Summit Lake', 'Grandview'],
  'seward': ['Lost Lake', 'Seward Area', 'Eastern Kenai'],
  'chugach-state-park': ['Chugach Front Range', 'Indian'],
  // Alaska - HPAC
  'hatcher-pass': ['Hatcher Pass'],
  // Alaska - VAC
  'valdez-maritime': ['Valdez Coastal'],
  'valdez-intermountain': ['Thompson Pass Mid', 'Thompson Pass Low Elev', 'Thompson Pass Upper Elev'],
  'valdez-continental': ['Thompson Pass.*Continental'],
  // Alaska - CAC
  'cordova': ['Cordova'],
  // Alaska - EARAC
  'earac-north': ['Northern Chugach'],
  'earac-south': ['Northern Chugach'],
};

function getAvgLocationsForZone(
  zoneId: string,
  locations: Array<{ name: string; elevationBand: string; tableText: string }>
): Array<{ name: string; elevationBand: string; tableText: string }> {
  const keywords = AVG_ZONE_KEYWORDS[zoneId];
  if (!keywords) return [];

  return locations.filter(loc => {
    const fullName = loc.name + ' ' + loc.elevationBand;
    return keywords.some(kw => {
      if (kw.includes('*')) {
        // Regex-style matching
        const regex = new RegExp(kw, 'i');
        return regex.test(fullName);
      }
      return fullName.toLowerCase().includes(kw.toLowerCase());
    });
  });
}

/** Fetch the most recent AVG product from a WFO */
async function fetchAvgProduct(wfo: string): Promise<{
  discussion: string | null;
  locations: Array<{ name: string; elevationBand: string; tableText: string }>;
  fullText: string;
  issuedTime: string;
  wfo: string;
} | null> {
  try {
    // Step 1: Get list of recent AVG products for this WFO
    const listUrl = `${NWS_API_BASE}/products/types/AVG/locations/${wfo}`;
    console.log(`Fetching AVG product list: ${listUrl}`);
    const listResp = await fetch(listUrl, { headers: nwsHeaders });

    if (!listResp.ok) {
      console.log(`AVG product list returned ${listResp.status} for ${wfo}`);
      return null;
    }

    const listData = await listResp.json();
    const products = listData['@graph'] || [];

    if (products.length === 0) {
      console.log(`No AVG products available for WFO ${wfo}`);
      return null;
    }

    // Step 2: Fetch the most recent product
    const latestId = products[0].id || products[0]['@id']?.split('/').pop();
    if (!latestId) {
      console.log(`Could not extract AVG product ID for ${wfo}`);
      return null;
    }

    const productUrl = `${NWS_API_BASE}/products/${latestId}`;
    console.log(`Fetching AVG product: ${productUrl}`);
    const productResp = await fetch(productUrl, { headers: nwsHeaders });

    if (!productResp.ok) {
      console.log(`AVG product returned ${productResp.status} for ${latestId}`);
      return null;
    }

    const productData = await productResp.json();
    const text = productData.productText || '';
    const issuedTime = productData.issuanceTime || products[0].issuanceTime || '';

    if (!text) {
      console.log(`Empty AVG product text for ${wfo}`);
      return null;
    }

    const parsed = parseAvgProduct(text);
    console.log(`Parsed AVG for ${wfo}: discussion=${!!parsed.discussion}, locations=${parsed.locations.length}`);

    return {
      discussion: parsed.discussion,
      locations: parsed.locations,
      fullText: text,
      issuedTime,
      wfo,
    };
  } catch (error) {
    console.error(`Error fetching AVG for WFO ${wfo}:`, error);
    return null;
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const zoneIds: string[] = body?.zoneIds || [];

    if (zoneIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No zone IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching weather forecasts for ${zoneIds.length} zones`);

    // Group zones by center
    const centerZones = new Map<string, string[]>();
    for (const zoneId of zoneIds) {
      const centerId = ZONE_CENTER_MAP[zoneId];
      if (centerId) {
        if (!centerZones.has(centerId)) centerZones.set(centerId, []);
        centerZones.get(centerId)!.push(zoneId);
      } else {
        console.log(`Unknown zone: ${zoneId}`);
      }
    }

    const centerIds = Array.from(centerZones.keys());
    console.log(`Unique centers: ${centerIds.join(', ')}`);

    // ── Phase 1: Fetch NAC weather products for all centers in parallel ──
    const nacResults = await Promise.all(
      centerIds.map(async (centerId) => {
        const data = await fetchNacWeather(centerId);
        return { centerId, data };
      })
    );

    const centerWeather: Record<string, any> = {};
    const centersWithNacWeather = new Set<string>();

    for (const { centerId, data } of nacResults) {
      if (data) {
        centerWeather[centerId] = data;
        centersWithNacWeather.add(centerId);
      }
    }

    console.log(`NAC weather available for: ${Array.from(centersWithNacWeather).join(', ') || 'none'}`);

    // ── Phase 2: Fetch NWS zone forecasts for ALL zones ─────────────────
    // Zone forecasts are always fetched (mountain-specific, per-zone) regardless
    // of NAC availability. NAC provides the forecaster discussion; NWS provides
    // the actual mountain weather forecast for the specific NWS zone.
    const zoneNwsForecasts: Record<string, any> = {};

    // Deduplicate NWS zone IDs — multiple avy zones may map to the same NWS zone
    const nwsZoneToAvyZones = new Map<string, string[]>();
    for (const zoneId of zoneIds) {
      const mapping = getNwsZoneMapping(zoneId);
      if (mapping) {
        if (!nwsZoneToAvyZones.has(mapping.forecastZone)) {
          nwsZoneToAvyZones.set(mapping.forecastZone, []);
        }
        nwsZoneToAvyZones.get(mapping.forecastZone)!.push(zoneId);
      } else {
        console.log(`No NWS zone mapping for: ${zoneId}`);
      }
    }

    console.log(`Fetching NWS zone forecasts for ${nwsZoneToAvyZones.size} unique NWS zones`);

    const nwsPromises = Array.from(nwsZoneToAvyZones.entries()).map(
      async ([nwsZone, avyZoneIds]) => {
        const forecast = await fetchNwsZoneForecast(nwsZone);
        if (forecast) {
          for (const avyZoneId of avyZoneIds) {
            zoneNwsForecasts[avyZoneId] = {
              periods: forecast.periods,
              // Keep 'gridpoint' field name for backward compat, but now shows zone info
              gridpoint: `${forecast.forecastZone}${forecast.forecastZoneName ? ` — ${forecast.forecastZoneName}` : ''}`,
              forecastZone: forecast.forecastZone,
              forecastPageUrl: forecast.forecastPageUrl,
            };
          }
          console.log(`NWS zone forecast for ${nwsZone}: ${forecast.periods.length} periods → ${avyZoneIds.join(', ')}`);
        }
      }
    );

    await Promise.all(nwsPromises);

    // ── Phase 3: Fetch AVG products for relevant WFOs ───────────────────
    // AVG products are parsed into: discussion (shared summary) + per-zone locations
    const centerAvgDiscussions: Record<string, { discussion: string; issuedTime: string; wfo: string }> = {};
    const zoneAvgLocations: Record<string, Array<{ name: string; elevationBand: string; tableText: string }>> = {};

    // Collect unique WFOs needed
    const wfosNeeded = new Set<string>();
    for (const centerId of centerIds) {
      const wfos = getAvgWfos(centerId);
      for (const wfo of wfos) {
        wfosNeeded.add(wfo);
      }
    }

    console.log(`Fetching AVG products from ${wfosNeeded.size} WFOs: ${Array.from(wfosNeeded).join(', ')}`);

    const avgResults = await Promise.all(
      Array.from(wfosNeeded).map(async (wfo) => {
        const product = await fetchAvgProduct(wfo);
        return { wfo, product };
      })
    );

    // Map AVG products back to centers and zones
    const wfoToAvg = new Map<string, any>();
    for (const { wfo, product } of avgResults) {
      if (product) {
        wfoToAvg.set(wfo, product);
      }
    }

    for (const centerId of centerIds) {
      const wfos = getAvgWfos(centerId);

      for (const wfo of wfos) {
        const avgData = wfoToAvg.get(wfo);
        if (!avgData) continue;

        // Store the discussion once per center (first WFO with a discussion wins)
        if (avgData.discussion && !centerAvgDiscussions[centerId]) {
          centerAvgDiscussions[centerId] = {
            discussion: avgData.discussion,
            issuedTime: avgData.issuedTime,
            wfo: avgData.wfo,
          };
        }

        // Extract per-zone AVG location sections
        const zonesForCenter = centerZones.get(centerId) || [];
        for (const zoneId of zonesForCenter) {
          const zoneLocations = getAvgLocationsForZone(zoneId, avgData.locations);
          if (zoneLocations.length > 0) {
            zoneAvgLocations[zoneId] = zoneLocations;
          }
        }
      }
    }

    console.log(`Weather fetch complete. NAC: ${centersWithNacWeather.size} centers, NWS zones: ${Object.keys(zoneNwsForecasts).length}, AVG discussions: ${Object.keys(centerAvgDiscussions).length}, AVG zone locations: ${Object.keys(zoneAvgLocations).length}`);

    return new Response(
      JSON.stringify({
        success: true,
        centerWeather,
        zoneNwsForecasts,
        centerAvgDiscussions,
        zoneAvgLocations,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-weather-forecast:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
