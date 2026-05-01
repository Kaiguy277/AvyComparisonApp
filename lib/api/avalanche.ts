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

export interface CachedForecastResponse {
  success: boolean;
  zones?: AvalancheZone[];
  missingZoneIds?: string[];
  missingSummaryCenterIds?: string[];
  forecastDate?: string;
  cached?: boolean;
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
      console.error("Error calling avalanche-summary:", error);
      return { success: false, error: error.message };
    }
    return data;
  },

  async getCachedForecasts(zoneIds: string[]): Promise<CachedForecastResponse> {
    const { data, error } = await supabase.functions.invoke("get-cached-forecasts", {
      body: { zoneIds },
    });
    if (error) {
      console.error("Error calling get-cached-forecasts:", error);
      return { success: false, error: error.message };
    }
    return data;
  },

  async getSnotelObservations(zoneIds: string[]): Promise<SnotelResponse> {
    const { data, error } = await supabase.functions.invoke("get-snotel-observations", {
      body: { zoneIds },
    });
    if (error) {
      console.error("Error calling get-snotel-observations:", error);
      return { success: false, error: error.message };
    }
    return data;
  },

  async generateQuickTake(
    zones: Array<{ id: string; centerId: string; [key: string]: any }>,
  ): Promise<QuickTakeResponse> {
    const { data, error } = await supabase.functions.invoke("generate-quick-take", {
      body: { zones },
    });
    if (error) {
      console.error("Error calling generate-quick-take:", error);
      return { success: false, error: error.message };
    }
    return data;
  },

  async getWeatherForecast(zoneIds: string[]): Promise<WeatherForecastResponse> {
    const { data, error } = await supabase.functions.invoke("get-weather-forecast", {
      body: { zoneIds },
    });
    if (error) {
      console.error("Error calling get-weather-forecast:", error);
      return { success: false, error: error.message };
    }
    return data;
  },
};
