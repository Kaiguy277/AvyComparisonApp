import { describe, it, expect, vi, beforeEach } from "vitest";

import { loadForecastBundle } from "./loadForecastBundle";

// Mock the network client and the snapshot reader so we can drive each
// branch of the decision tree deterministically. AVAILABLE_ZONES /
// ZONE_TO_CENTER (from @/lib/zones) are left real — they're a pure catalog
// and the live path groups by them.
// vi.hoisted so these exist before the hoisted vi.mock factories run.
const { api, loadSnapshot } = vi.hoisted(() => ({
  api: {
    getCachedForecasts: vi.fn(),
    getSummary: vi.fn(),
    getSnotelObservations: vi.fn(),
    getWeatherForecast: vi.fn(),
  },
  loadSnapshot: vi.fn(),
}));

vi.mock("@/lib/api/avalanche", () => ({ avalancheApi: api }));
vi.mock("@/lib/offlineCache", () => ({ loadSnapshot }));

const ZONE = "turnagain-girdwood"; // a real CNFAIC zone id
const fc = (id: string) => ({ id, name: id }) as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("offline", () => {
  it("reads the snapshot and never hits the network", async () => {
    loadSnapshot.mockResolvedValue({
      fetchedAt: "2026-02-14T12:00:00Z",
      zones: { [ZONE]: { "2026-02-14": { forecast: fc(ZONE), cachedAt: "x" } } },
    });
    const b = await loadForecastBundle({
      zoneIds: [ZONE],
      date: "2026-02-14",
      isToday: true,
      isOnline: false,
    });
    expect(b.loadSource).toBe("offline");
    expect(b.summary?.zones).toHaveLength(1);
    expect(api.getCachedForecasts).not.toHaveBeenCalled();
  });

  it("returns an empty bundle when the snapshot has nothing", async () => {
    loadSnapshot.mockResolvedValue(null);
    const b = await loadForecastBundle({
      zoneIds: [ZONE],
      date: "2026-02-14",
      isToday: true,
      isOnline: false,
    });
    expect(b.summary).toBeNull();
    expect(b.loadSource).toBe("offline");
  });
});

describe("online — server cache hit", () => {
  it("uses the cache and does NOT fall through to a live scrape", async () => {
    api.getCachedForecasts.mockResolvedValue({
      success: true,
      zones: [fc(ZONE)],
      stationsOnlyZones: [],
      missingZoneIds: [],
      centerWeather: { CNFAIC: { discussion: "hi" } },
      zoneNwsForecasts: {},
      centerAvgDiscussions: {},
      zoneAvgLocations: {},
      forecastDate: "2026-08-07",
      forecastFetchedAt: "2026-08-07T09:00:00Z",
    });
    const b = await loadForecastBundle({
      zoneIds: [ZONE],
      date: "2026-08-07",
      isToday: true,
      isOnline: true,
    });
    expect(b.loadSource).toBe("cached");
    expect(b.resolvedDate).toBe("2026-08-07");
    expect(b.weather?.centerWeather.CNFAIC).toBeDefined();
    expect(api.getSummary).not.toHaveBeenCalled();
  });
});

describe("online — archive day with an incomplete cache", () => {
  it("falls back to the snapshot for the EXACT date, never a live scrape", async () => {
    api.getCachedForecasts.mockResolvedValue({
      success: true,
      zones: [],
      stationsOnlyZones: [],
      missingZoneIds: [ZONE],
    });
    loadSnapshot.mockResolvedValue({
      fetchedAt: "2026-08-05T12:00:00Z",
      zones: { [ZONE]: { "2026-08-05": { forecast: fc(ZONE), cachedAt: "x" } } },
    });
    const b = await loadForecastBundle({
      zoneIds: [ZONE],
      date: "2026-08-05",
      isToday: false,
      isOnline: true,
    });
    expect(b.loadSource).toBe("offline");
    expect(b.summary?.zones).toHaveLength(1);
    // Critical: no live scrape for an archive day (NAC only serves today).
    expect(api.getSummary).not.toHaveBeenCalled();
  });

  it("returns empty (not stale) when the archive date isn't cached", async () => {
    api.getCachedForecasts.mockResolvedValue({ success: true, zones: [], missingZoneIds: [ZONE] });
    loadSnapshot.mockResolvedValue({
      fetchedAt: "x",
      zones: { [ZONE]: { "2026-08-01": { forecast: fc(ZONE), cachedAt: "x" } } },
    });
    const b = await loadForecastBundle({
      zoneIds: [ZONE],
      date: "2026-08-05", // different day than what's cached
      isToday: false,
      isOnline: true,
    });
    expect(b.summary).toBeNull();
  });
});

describe("online — today, cache miss → live scrape", () => {
  it("scrapes, folds in snotel + weather, and reports loadSource live", async () => {
    api.getCachedForecasts.mockResolvedValue({ success: true, zones: [], missingZoneIds: [ZONE] });
    api.getSummary.mockResolvedValue({
      success: true,
      summary: { zones: [fc(ZONE)] },
      zonesScraped: [{ id: ZONE }],
    });
    api.getSnotelObservations.mockResolvedValue({
      success: true,
      observations: { [ZONE]: [{ stationName: "SUNBURST" }] },
    });
    api.getWeatherForecast.mockResolvedValue({
      success: true,
      centerWeather: { CNFAIC: { discussion: "wx" } },
      zoneNwsForecasts: {},
      centerAvgDiscussions: {},
      zoneAvgLocations: {},
    });
    const b = await loadForecastBundle({
      zoneIds: [ZONE],
      date: "2026-08-07",
      isToday: true,
      isOnline: true,
    });
    expect(b.loadSource).toBe("live");
    expect(api.getSummary).toHaveBeenCalled();
    // snotel folded into the zone's weatherObservations
    expect((b.summary?.zones[0] as any).weatherObservations).toHaveLength(1);
    expect(b.weather?.centerWeather.CNFAIC).toBeDefined();
    expect(b.zonesScraped).toHaveLength(1);
  });

  it("THROWS when every live-scrape batch fails (distinct from empty)", async () => {
    api.getCachedForecasts.mockResolvedValue({ success: true, zones: [], missingZoneIds: [ZONE] });
    api.getSummary.mockResolvedValue({ success: false });
    await expect(
      loadForecastBundle({ zoneIds: [ZONE], date: "2026-08-07", isToday: true, isOnline: true }),
    ).rejects.toThrow(/Failed to fetch/);
  });

  it("survives a snotel/weather hiccup on the live path (best-effort)", async () => {
    api.getCachedForecasts.mockResolvedValue({ success: true, zones: [], missingZoneIds: [ZONE] });
    api.getSummary.mockResolvedValue({ success: true, summary: { zones: [fc(ZONE)] }, zonesScraped: [] });
    api.getSnotelObservations.mockRejectedValue(new Error("boom"));
    api.getWeatherForecast.mockRejectedValue(new Error("boom"));
    const b = await loadForecastBundle({
      zoneIds: [ZONE],
      date: "2026-08-07",
      isToday: true,
      isOnline: true,
    });
    expect(b.loadSource).toBe("live");
    expect(b.summary?.zones).toHaveLength(1);
    expect(b.weather).toBeNull();
  });
});

describe("empty selection", () => {
  it("returns an empty bundle without any network call", async () => {
    const b = await loadForecastBundle({ zoneIds: [], date: "2026-08-07", isToday: true, isOnline: true });
    expect(b.summary).toBeNull();
    expect(api.getCachedForecasts).not.toHaveBeenCalled();
  });
});
