import { supabase } from "../supabase";

export type DangerRating =
  | "LOW"
  | "MODERATE"
  | "CONSIDERABLE"
  | "HIGH"
  | "EXTREME"
  | "NO_RATING";

export interface ZoneFreshness {
  issueDate: string | null;
  expiresDate: string | null;
  ageHours: number | null;
  hoursUntilExpiry: number | null;
  status: "current" | "recent" | "expiring" | "expired" | "unknown";
}

export interface ElevationDanger {
  alpine: DangerRating;
  treeline: DangerRating;
  belowTreeline: DangerRating;
}

export interface DayForecast {
  date: string;
  danger: ElevationDanger;
}

export interface WeatherSnapshot {
  snow: string;
  wind: string;
  temps: string;
}

export interface TempDataPoint {
  timestamp: string;
  value: number;
}

export interface AspectElevation {
  elevation: string;
  aspects: string[];
}

export interface AvalancheProblem {
  name: string;
  likelihood: string | null;
  size: { min: number; max: number } | null;
  aspects: AspectElevation[];
  discussion: string | null;
  // Generic explainer of what THIS problem TYPE is (NAC's problem_description).
  // Same text every time you see "Storm Slab" — useful for new users.
  problemDescription?: string | null;
  // NAC ships an icon URL per problem. Optional — UAC/scrape paths don't have it.
  iconUrl?: string | null;
}

export interface WeatherObservation {
  stationTriplet: string;
  stationName: string;
  elevation: number;
  timestamp: string;
  snow: {
    depth: number | null;
    depth24hrChange: number | null;
    depth72hrChange: number | null;
    depth7dayChange: number | null;
    precip24hr: number | null;
    precip72hr: number | null;
    precip48hr: number | null;
    precip7day: number | null;
    swe: number | null;
    snowPercentage24hr: number | null;
    snowPercentage72hr: number | null;
    hourlyPrecip24hr?: TempDataPoint[];
    hourlyPrecip72hr?: TempDataPoint[];
  };
  temperature: {
    current: number | null;
    high24hr: number | null;
    low24hr: number | null;
    high72hr: number | null;
    low72hr: number | null;
    avg24hr: number | null;
    avg72hr: number | null;
    trend: "warming" | "cooling" | "stable" | null;
    hourly24hr?: TempDataPoint[];
    hourly72hr?: TempDataPoint[];
  };
  wind: {
    speedCurrent: number | null;
    speedAvg24hr: number | null;
    speedMax24hr: number | null;
    speedAvg72hr: number | null;
    speedMax72hr: number | null;
    direction: string | null;
    direction24hr: string | null;
    direction72hr: string | null;
    hourlySpeed24hr?: TempDataPoint[];
    hourlySpeed72hr?: TempDataPoint[];
    hourlyGust24hr?: TempDataPoint[];
    hourlyGust72hr?: TempDataPoint[];
    // Direction over time (degrees, 0–360, FROM convention).
    hourlyDirection24hr?: TempDataPoint[];
    hourlyDirection72hr?: TempDataPoint[];
  } | null;
  dataQuality: "good" | "partial" | "poor";
}

export interface AvalancheZone {
  id: string;
  name: string;
  forecastUrl: string;
  forecast: DayForecast[];
  weather: WeatherSnapshot;
  problems: AvalancheProblem[];
  keyMessage: string;
  travelAdvice: string;
  freshness: ZoneFreshness;
  hazardDiscussion?: string;
  // Per-zone weather discussion paragraph (NAC's weather_discussion).
  // Often null on individual centers but populated on others.
  weatherDiscussion?: string;
  // Free-text announcement / advisory (NAC's announcement field). Rendered
  // as an alert banner at the top of the zone card when present.
  announcement?: string;
  // Forecaster name (NAC's author field).
  author?: string;
  weatherObservations?: WeatherObservation[];
  weatherValidation?: "confirmed" | "partial" | "discrepancy" | "no_data";
}

export interface AvalancheSummary {
  quickTake: string;
  zones: AvalancheZone[];
  weatherHighlights: string;
  bottomLine: string;
}

export interface ScrapedZoneInfo {
  id: string;
  name: string;
  center: string;
  success: boolean;
  freshness: ZoneFreshness;
}

export interface AvalancheResponse {
  success: boolean;
  error?: string;
  summary?: AvalancheSummary;
  scrapedAt?: string;
  zonesScraped?: ScrapedZoneInfo[];
}

// Minimal stub returned for zones that have stations data but no
// forecast row in the lookback window (off-season, freshly added zones,
// zones a center has stopped issuing). Zone name + center name come
// from the client-side catalog (ZONE_TO_CENTER_NAME etc.) — we don't
// duplicate that on the wire.
export interface StationsOnlyZone {
  id: string;
  centerId: string;
  weatherObservations: WeatherObservation[];
}

export interface CachedForecastResponse {
  success: boolean;
  zones?: AvalancheZone[];
  stationsOnlyZones?: StationsOnlyZone[];
  missingZoneIds?: string[];
  missingSummaryCenterIds?: string[];
  // The forecast issue date (YYYY-MM-DD) the response is for. May be older
  // than `requestedDate` if no row exists for that day.
  forecastDate?: string;
  // Stations snapshot date (YYYY-MM-DD).
  stationsDate?: string;
  // Echo of what the client asked for, when pinned via getCachedForecasts(date).
  requestedDate?: string | null;
  cached?: boolean;
  // Distinct timestamps so the UI can report each layer's freshness
  // (forecasts update 1–2× per day, stations hourly).
  forecastFetchedAt?: string;
  stationsFetchedAt?: string;
  // Same shape get-weather-forecast returns — bundled into the cache read so
  // the client doesn't need a second round trip.
  centerWeather?: Record<string, NacWeatherProduct>;
  zoneNwsForecasts?: Record<string, NwsForecast>;
  centerAvgDiscussions?: Record<string, AvgDiscussion>;
  zoneAvgLocations?: Record<string, AvgLocation[]>;
  quickTake?: string;
  weatherHighlights?: string;
  bottomLine?: string;
  error?: string;
}

export interface SnotelResponse {
  success: boolean;
  observations?: Record<string, WeatherObservation[]>;
  error?: string;
}

export interface NacWeatherTable {
  zone_name: string;
  zone_id: string;
  columns: string[];
  rows: Array<{ heading: string; field: string; unit: string | null }>;
  data: (string | null)[][];
}

export interface NacWeatherProduct {
  discussion: string | null;
  tables: NacWeatherTable[];
  publishedTime: string | null;
}

export interface NwsForecastPeriod {
  name: string;
  temperature: number;
  temperatureUnit: string;
  windSpeed: string;
  windDirection: string;
  shortForecast: string;
  detailedForecast: string;
  isDaytime: boolean;
}

export interface NwsForecast {
  periods: NwsForecastPeriod[];
  gridpoint: string;
  forecastZone: string | null;
  forecastPageUrl: string;
}

export interface AvgDiscussion {
  discussion: string;
  issuedTime: string;
  wfo: string;
}

export interface AvgLocation {
  name: string;
  elevationBand: string;
  tableText: string;
}

export interface ZoneWeatherForecast {
  nacWeather?: NacWeatherProduct;
  nwsForecast?: NwsForecast;
  avgDiscussion?: AvgDiscussion;
  avgLocations?: AvgLocation[];
}

export interface ObservationSummary {
  id: string;
  zoneId: string | null;
  zoneName: string | null;
  centerId: string | null;
  startDate: string | null;
  observerType: "public" | "forecaster" | "professional" | string | null;
  obsSource: string | null;
  observerName: string | null;
  organization: string | null;
  locationName: string | null;
  locationPoint: { lat: number; lng: number } | null;
  // observation_summary is HTML on the wire — let the screen strip tags.
  summaryHtml: string | null;
  instabilitySummary: string | null;
  avalanchesSummary: string | null;
  instabilityFlags: {
    cracking: boolean;
    collapsing: boolean;
    avalanchesCaught: boolean;
    avalanchesObserved: boolean;
    avalanchesTriggered: boolean;
  };
  hasAvalanches: boolean;
  thumbnails: string[];
  viewerUrl: string;
}

export interface ObservationsResponse {
  success: boolean;
  observations?: Record<string, ObservationSummary[]>;
  error?: string;
}

export interface QuickTakeResponse {
  success: boolean;
  quickTake?: string;
  weatherHighlights?: string;
  error?: string;
}

export interface WeatherForecastResponse {
  success: boolean;
  centerWeather?: Record<string, NacWeatherProduct>;
  zoneNwsForecasts?: Record<string, NwsForecast>;
  centerAvgDiscussions?: Record<string, AvgDiscussion>;
  zoneAvgLocations?: Record<string, AvgLocation[]>;
  error?: string;
}

export const avalancheApi = {
  async getSummary(zoneIds?: string[]): Promise<AvalancheResponse> {
    const { data, error } = await supabase.functions.invoke("avalanche-summary", {
      body: { zoneIds },
    });
    if (error) {
      console.warn("Error calling avalanche-summary:", error);
      // FunctionsHttpError stashes the raw Response on .context — log
      // status + body so we can see what the function actually returned.
      try {
        const ctx = (error as any)?.context;
        if (ctx instanceof Response) {
          const status = ctx.status;
          const text = await ctx.clone().text();
          console.error(`avalanche-summary HTTP ${status}: ${text.slice(0, 500)}`);
        }
      } catch {}
      return { success: false, error: error.message };
    }
    return data;
  },

  // forecastDate (YYYY-MM-DD) optionally pins the response to a specific
  // archive day. Omit for "give me each zone's most recent row".
  async getCachedForecasts(
    zoneIds: string[],
    forecastDate?: string,
  ): Promise<CachedForecastResponse> {
    const { data, error } = await supabase.functions.invoke("get-cached-forecasts", {
      body: forecastDate ? { zoneIds, forecastDate } : { zoneIds },
    });
    if (error) {
      console.warn("Error calling get-cached-forecasts:", error);
      return { success: false, error: error.message };
    }
    return data;
  },

  async getSnotelObservations(zoneIds: string[]): Promise<SnotelResponse> {
    const { data, error } = await supabase.functions.invoke("get-snotel-observations", {
      body: { zoneIds },
    });
    if (error) {
      console.warn("Error calling get-snotel-observations:", error);
      return { success: false, error: error.message };
    }
    return data;
  },

  async getWeatherForecast(zoneIds: string[]): Promise<WeatherForecastResponse> {
    const { data, error } = await supabase.functions.invoke("get-weather-forecast", {
      body: { zoneIds },
    });
    if (error) {
      console.warn("Error calling get-weather-forecast:", error);
      return { success: false, error: error.message };
    }
    return data;
  },

  async getCachedObservations(
    zoneIds: string[],
    limit = 50,
  ): Promise<ObservationsResponse> {
    const { data, error } = await supabase.functions.invoke(
      "get-cached-observations",
      { body: { zoneIds, limit } },
    );
    if (error) {
      console.warn("Error calling get-cached-observations:", error);
      return { success: false, error: error.message };
    }
    return data;
  },
};
