import { describe, it, expect } from "vitest";

import { AVAILABLE_ZONES, nearestCenter, ZONE_TO_CENTER,
  nearestCenters,
  nearestZones,
} from "./zones";
// The zone catalogue is duplicated across the app and the Deno edge
// functions (two runtimes can't share one import). The audit's finding:
// "that sync is luck, not structure — adding one zone needs six
// coordinated edits." These tests turn the luck into an enforced
// contract: if any copy drifts (a zone added/removed/re-centered in one
// place but not the others), one of these fails. They're a guard, not the
// physical consolidation — see JOURNAL for why the full merge was deferred.
import { ALL_ZONES } from "@/supabase/functions/_shared/zones-list";
import { NAC_ZONE_TO_SLUG } from "@/supabase/functions/_shared/nac-zone-map";
import { NWS_ZONE_MAP } from "@/supabase/functions/_shared/nws-zone-config";
import { WEATHER_STATION_CONFIG } from "@/supabase/functions/_shared/weather-station-config";

const appIds = AVAILABLE_ZONES.map((z) => z.id).sort();
const set = (xs: string[]) => [...new Set(xs)].sort();

// Zones deliberately absent from weather-station-config (no stations
// mapped yet). Documented so a change here is a conscious edit, not a
// silent regression. (Audit flagged both as rendering an empty stations
// panel with no error.)
const KNOWN_STATIONLESS = ["cordova", "presidential-range"];

describe("zone catalogue is internally consistent across copies", () => {
  it("app AVAILABLE_ZONES ids match the edge ALL_ZONES ids", () => {
    expect(set(ALL_ZONES.map((z) => z.id))).toEqual(appIds);
  });

  it("center assignments agree between app ZONE_TO_CENTER and edge ALL_ZONES", () => {
    for (const z of ALL_ZONES) {
      expect(ZONE_TO_CENTER[z.id], `center for ${z.id}`).toBe(z.centerId);
    }
  });

  it("NAC_ZONE_TO_SLUG covers exactly the zone id set", () => {
    const slugs = set(Object.values(NAC_ZONE_TO_SLUG).map((v) => v.slug));
    expect(slugs).toEqual(appIds);
  });

  it("NAC_ZONE_TO_SLUG center ids agree with ALL_ZONES", () => {
    const byId = new Map(ALL_ZONES.map((z) => [z.id, z.centerId]));
    for (const { slug, centerId } of Object.values(NAC_ZONE_TO_SLUG)) {
      expect(centerId, `center for ${slug}`).toBe(byId.get(slug));
    }
  });

  it("NWS_ZONE_MAP keys cover exactly the zone id set", () => {
    expect(set(Object.keys(NWS_ZONE_MAP))).toEqual(appIds);
  });

  it("weather-station-config covers every zone except the documented stationless ones", () => {
    const stationZones = new Set(WEATHER_STATION_CONFIG.map((z) => z.zoneId));
    const missing = appIds.filter((id) => !stationZones.has(id));
    expect(missing.sort()).toEqual([...KNOWN_STATIONLESS].sort());
    // And no config entry references a zone that doesn't exist.
    for (const z of WEATHER_STATION_CONFIG) {
      expect(appIds, `station config zone ${z.zoneId}`).toContain(z.zoneId);
    }
  });
});

describe("nearestCenter", () => {
  it("resolves an Alaska (Turnagain area) coord to CNFAIC", () => {
    // Girdwood / Turnagain Pass.
    expect(nearestCenter(60.78, -149.13)).toBe("CNFAIC");
  });

  it("resolves a Colorado (Aspen area) coord to CAIC", () => {
    expect(nearestCenter(39.19, -106.82)).toBe("CAIC");
  });

  it("resolves a Wasatch (Salt Lake) coord to UAC", () => {
    expect(nearestCenter(40.6, -111.6)).toBe("UAC");
  });

  it("resolves a Mount Washington (NH) coord to MWAC", () => {
    expect(nearestCenter(44.27, -71.3)).toBe("MWAC");
  });

  it("returns null for a point implausibly far from any center", () => {
    expect(nearestCenter(48.85, 2.35)).toBeNull(); // Paris
    expect(nearestCenter(0, 0)).toBeNull(); // Null Island
  });

  it("returns null for invalid input", () => {
    expect(nearestCenter(NaN, -149)).toBeNull();
  });
});

describe("nearestCenters / nearestZones", () => {
  // Anchorage. CNFAIC (Turnagain) is closest; HPAC (Hatcher) and CAC/VAC
  // are the realistic next choices for the same weekend.
  const ANC = { lat: 61.22, lon: -149.9 };

  it("returns several nearby centers, closest first", () => {
    const r = nearestCenters(ANC.lat, ANC.lon, 3);
    expect(r.length).toBe(3);
    expect(r[0].centerId).toBe("CNFAIC");
    // strictly increasing distance
    expect(r[0].km).toBeLessThan(r[1].km);
    expect(r[1].km).toBeLessThan(r[2].km);
  });

  it("includes Hatcher Pass for an Anchorage user, not just Turnagain", () => {
    const ids = nearestCenters(ANC.lat, ANC.lon, 3).map((r) => r.centerId);
    expect(ids).toContain("HPAC");
  });

  it("respects the limit", () => {
    expect(nearestCenters(ANC.lat, ANC.lon, 1).length).toBe(1);
    expect(nearestCenters(ANC.lat, ANC.lon, 0).length).toBe(0);
  });

  it("excludes centers beyond the range cap", () => {
    // Miami — nothing within 600 km.
    expect(nearestCenters(25.76, -80.19, 3).length).toBe(0);
  });

  it("rejects invalid coordinates", () => {
    expect(nearestCenters(NaN, -149.9)).toEqual([]);
    expect(nearestCenters(61.2, Infinity)).toEqual([]);
  });

  it("nearestZones expands centers into their zones, closest center first", () => {
    const z = nearestZones(ANC.lat, ANC.lon, 2);
    expect(z.length).toBeGreaterThan(1);
    // Every zone carries its center's distance, and the first block is CNFAIC.
    expect(z[0].center).toBe("CNFAIC");
    expect(z.every((x) => Number.isFinite(x.km))).toBe(true);
  });

  it("nearestZones returns nothing when nothing is in range", () => {
    expect(nearestZones(25.76, -80.19, 3)).toEqual([]);
  });
});
