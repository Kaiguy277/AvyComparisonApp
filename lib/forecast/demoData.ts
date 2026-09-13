// Sample forecast data for App Store screenshots.
//
// Gated behind EXPO_PUBLIC_DEMO=1, which is never set in a production build
// (see eas.json / .env — it exists only when generating store assets). The
// store requires screenshots that show the app doing its job, and for most
// of the year every real zone reads EXPIRED with stale dates, which shows
// the app at its least useful and tells a browser nothing.
//
// The numbers here are plausible mid-winter Alaska values, not a copy of any
// real forecast. Nothing in this file ships to users.

import type {
  AvalancheSummary,
  AvalancheZone,
  DangerRating,
  WeatherObservation,
} from "@/lib/api/avalanche";
import type { ForecastBundle } from "./loadForecastBundle";
import { AVAILABLE_ZONES, ZONE_TO_CENTER } from "@/lib/zones";

export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO === "1";

function iso(offsetHours: number): string {
  return new Date(Date.now() + offsetHours * 3_600_000).toISOString();
}

// The real feed hands the client a display string ("May 4, 7:00 AM"), not an
// ISO timestamp — match it so the freshness line reads the same as production.
function displayDate(offsetHours: number): string {
  const d = new Date(Date.now() + offsetHours * 3_600_000);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const DIR_DEGREES: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};

// Deterministic hourly series (oldest first, ending an hour ago) so the
// charts have something to draw and screenshots are reproducible.
function hourly(
  hours: number,
  at: (hoursAgo: number) => number,
): { timestamp: string; value: number }[] {
  const points = [];
  for (let h = hours; h >= 1; h--) {
    points.push({
      timestamp: iso(-h),
      value: Math.round(at(h) * 10) / 10,
    });
  }
  return points;
}

// Typed against the real shape, no cast: an earlier version guessed at the
// field names and rendered "undefined MPH" in the store screenshots.
function station(
  name: string,
  elevation: number,
  tempF: number,
  windMph: number,
  windDir: string,
  snow24: number,
  depth: number,
): WeatherObservation {
  const dirDeg = DIR_DEGREES[windDir] ?? 0;
  const temp = (h: number) => tempF + 5 * Math.sin((h / 24) * 2 * Math.PI) - h * 0.05;
  const speed = (h: number) => Math.max(0, windMph + 6 * Math.sin(h / 3) - h * 0.1);
  const gust = (h: number) => speed(h) + 10 + 3 * Math.cos(h / 2);
  const dir = (h: number) => (dirDeg + 20 * Math.sin(h / 5) + 360) % 360;
  // Snowfall front-loaded into the last ~18 hours, in inches of SWE per hour.
  const precip = (h: number) => (h <= 18 ? snow24 / 12 / 18 : 0.005);
  const max24 = Math.round(Math.max(...hourly(24, gust).map((p) => p.value)));
  const max72 = Math.round(Math.max(...hourly(72, gust).map((p) => p.value)));

  return {
    stationTriplet: name.toUpperCase().replace(/\s+/g, "_"),
    stationName: name,
    elevation,
    timestamp: iso(-1),
    snow: {
      depth,
      depth24hrChange: snow24,
      depth72hrChange: Math.round(snow24 * 2.2),
      depth7dayChange: Math.round(snow24 * 3.4),
      precip24hr: Math.round((snow24 / 12) * 10) / 10,
      precip72hr: Math.round(((snow24 * 2.2) / 12) * 10) / 10,
      precip48hr: Math.round(((snow24 * 1.6) / 12) * 10) / 10,
      precip7day: Math.round(((snow24 * 3.4) / 12) * 10) / 10,
      swe: Math.round((depth / 4) * 10) / 10,
      snowPercentage24hr: 100,
      snowPercentage72hr: 100,
      hourlyPrecip24hr: hourly(24, precip),
      hourlyPrecip72hr: hourly(72, precip),
    },
    temperature: {
      current: tempF,
      high24hr: tempF + 5,
      low24hr: tempF - 8,
      high72hr: tempF + 9,
      low72hr: tempF - 11,
      avg24hr: tempF - 2,
      avg72hr: tempF - 1,
      trend: "cooling",
      hourly24hr: hourly(24, temp),
      hourly72hr: hourly(72, temp),
    },
    wind: {
      speedCurrent: windMph,
      speedAvg24hr: Math.round(windMph * 0.8),
      speedMax24hr: max24,
      speedAvg72hr: Math.round(windMph * 0.7),
      speedMax72hr: max72,
      direction: windDir,
      direction24hr: windDir,
      direction72hr: windDir,
      hourlySpeed24hr: hourly(24, speed),
      hourlySpeed72hr: hourly(72, speed),
      hourlyGust24hr: hourly(24, gust),
      hourlyGust72hr: hourly(72, gust),
      hourlyDirection24hr: hourly(24, dir),
      hourlyDirection72hr: hourly(72, dir),
    },
    dataQuality: "good",
  };
}

interface DemoZoneSpec {
  id: string;
  danger: [DangerRating, DangerRating, DangerRating];
  problems: { name: string; likelihood: string; discussion: string }[];
  keyMessage: string;
  travel: string;
  snow: string;
  wind: string;
  temps: string;
  stations: WeatherObservation[];
}

const SPECS: DemoZoneSpec[] = [
  {
    id: "turnagain-girdwood",
    danger: ["CONSIDERABLE", "CONSIDERABLE", "MODERATE"],
    problems: [
      {
        name: "Wind Slab",
        likelihood: "Likely",
        discussion:
          "Fresh wind slabs 8–16\" deep sit on easterly through southerly aspects above 2,500'. Expect them to be reactive at the top of steep terrain and near ridgelines.",
      },
      {
        name: "Persistent Slab",
        likelihood: "Possible",
        discussion:
          "The late-December facet layer is still producing results in isolated terrain. Failures would be large and unsurvivable in a terrain trap.",
      },
    ],
    keyMessage:
      "Recent wind loading has built touchy slabs near and above treeline. Give cornices a wide berth and avoid steep, wind-loaded starting zones today.",
    travel:
      "Stick to lower-angle terrain away from overhead hazard. If you're stepping out, do it one at a time with a clear escape.",
    snow: '14" in 24h',
    wind: "22 mph E",
    temps: "18°F",
    stations: [
      station("Sunburst", 3799, 14, 24, "E", 14, 68),
      station("Center Ridge", 1880, 22, 9, "SE", 11, 54),
    ],
  },
  {
    id: "summit",
    danger: ["CONSIDERABLE", "MODERATE", "MODERATE"],
    problems: [
      {
        name: "Persistent Slab",
        likelihood: "Possible",
        discussion:
          "A buried surface hoar layer down 2–3 feet remains the main concern on shaded, sheltered slopes.",
      },
    ],
    keyMessage:
      "A persistent weak layer is still capable of producing large avalanches on shaded slopes. Conservative terrain choices remain the play.",
    travel:
      "Avoid steep, shaded, sheltered terrain above treeline. Slopes that have already avalanched are the safer bet.",
    snow: '9" in 24h',
    wind: "12 mph W",
    temps: "11°F",
    stations: [station("Summit Lake", 1400, 11, 12, "W", 9, 47)],
  },
  {
    id: "seward",
    danger: ["MODERATE", "MODERATE", "LOW"],
    problems: [
      {
        name: "Loose Wet",
        likelihood: "Possible",
        discussion:
          "Sun on steep southerly aspects will produce point releases by early afternoon. Time your descent.",
      },
    ],
    keyMessage:
      "Warming will bring loose wet activity on sunny aspects this afternoon. Start early and be off steep solar slopes by midday.",
    travel: "Move to shaded aspects or lower-angle terrain once the snow surface goes wet.",
    snow: '3" in 24h',
    wind: "8 mph NW",
    temps: "29°F",
    stations: [station("Pedersen Lagoon", 625, 29, 8, "NW", 3, 31)],
  },
  {
    id: "chugach-state-park",
    danger: ["CONSIDERABLE", "MODERATE", "MODERATE"],
    problems: [
      {
        name: "Wind Slab",
        likelihood: "Likely",
        discussion:
          "Northwest wind has stripped the ridges and loaded the south and east sides of every gully. Slabs are stiff and 1–2 feet deep.",
      },
    ],
    keyMessage:
      "Wind slabs are the story on this side of the inlet. They're easy to spot once you're looking — smooth, rounded pillows that sound hollow underfoot.",
    travel:
      "Steer around wind-loaded pockets below ridgelines and stay off convex rolls above terrain traps.",
    snow: '7" in 24h',
    wind: "26 mph NW",
    temps: "16°F",
    stations: [station("Moraine", 2100, 16, 26, "NW", 7, 44)],
  },
  {
    id: "hatcher-pass",
    danger: ["HIGH", "CONSIDERABLE", "MODERATE"],
    problems: [
      {
        name: "Storm Slab",
        likelihood: "Very Likely",
        discussion:
          "Two feet of new snow with strong ridgetop wind has built deep, cohesive slabs. Natural avalanches are likely today.",
      },
      {
        name: "Wind Slab",
        likelihood: "Likely",
        discussion:
          "Cross-loading has left thick pillows on the lee side of every ridge and gully wall.",
      },
    ],
    keyMessage:
      "Dangerous avalanche conditions. Natural avalanches are likely and human-triggered avalanches are very likely in steep terrain.",
    travel:
      "Travel in avalanche terrain is not recommended. Stay well back from runout zones, including the road corridor.",
    snow: '24" in 24h',
    wind: "38 mph NW",
    temps: "8°F",
    stations: [station("Independence Mine", 3550, 8, 38, "NW", 24, 82)],
  },
];

function zoneFor(spec: DemoZoneSpec): AvalancheZone | null {
  const meta = AVAILABLE_ZONES.find((z) => z.id === spec.id);
  if (!meta) return null;
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: meta.id,
    name: meta.name,
    forecastUrl: "https://avalanche.org/",
    forecast: [
      {
        date: today,
        danger: {
          alpine: spec.danger[0],
          treeline: spec.danger[1],
          belowTreeline: spec.danger[2],
        },
      },
    ],
    weather: { snow: spec.snow, wind: spec.wind, temps: spec.temps },
    problems: spec.problems.map((p) => ({
      name: p.name,
      likelihood: p.likelihood,
      size: { min: 1.5, max: 3 },
      aspects: [
        { elevation: "Above Treeline", aspects: ["N", "NE", "E", "SE"] },
        { elevation: "Near Treeline", aspects: ["NE", "E"] },
      ],
      discussion: p.discussion,
      problemDescription: null,
      iconUrl: null,
    })),
    keyMessage: spec.keyMessage,
    travelAdvice: spec.travel,
    freshness: {
      issueDate: displayDate(-5),
      expiresDate: displayDate(19),
      ageHours: 5,
      hoursUntilExpiry: 19,
      status: "current",
    },
    author: "Forecaster on duty",
    weatherObservations: spec.stations,
    weatherValidation: "confirmed",
  };
}

export function demoBundle(zoneIds: string[]): ForecastBundle {
  const wanted = new Set(zoneIds);
  const zones = SPECS.filter((s) => wanted.has(s.id))
    .map(zoneFor)
    .filter((z): z is AvalancheZone => z !== null);
  // Any favorited zone we don't have a hand-written spec for still needs to
  // render, so give it the first spec's shape under its own name.
  for (const id of zoneIds) {
    if (zones.some((z) => z.id === id)) continue;
    const filled = zoneFor({ ...SPECS[1], id });
    if (filled) zones.push(filled);
  }

  const summary: AvalancheSummary = {
    quickTake:
      "Wind loading overnight has left touchy slabs near and above treeline across the region. Hatcher Pass is the outlier — two feet of new snow there puts it a full step above everywhere else.",
    zones,
    weatherHighlights:
      "Snow tapering through the morning, ridgetop wind easing from the northwest, temperatures in the teens.",
    bottomLine:
      "Conservative terrain selection everywhere. If you want steeper ground, Seward is the least loaded of the four.",
  };

  return {
    summary,
    stationsOnlyZones: [],
    weather: {
      centerWeather: {},
      zoneNwsForecasts: {},
      centerAvgDiscussions: {},
      zoneAvgLocations: {},
    },
    scrapedAt: iso(-1),
    zonesScraped: zones.map((z) => ({
      id: z.id,
      name: z.name,
      center: ZONE_TO_CENTER[z.id] ?? "CNFAIC",
      success: true,
      freshness: z.freshness,
    })),
    loadSource: "cached",
    resolvedDate: new Date().toISOString().slice(0, 10),
  };
}

// The zone detail screens read the on-device snapshot via useZoneBundle, not
// the bundle above, so they need their own demo path or they'd show whatever
// stale real data is cached.
export function demoZoneBundle(zoneId: string): {
  forecast?: AvalancheZone;
  stations?: WeatherObservation[];
  cachedAt: string;
} {
  const spec = SPECS.find((sp) => sp.id === zoneId) ?? { ...SPECS[0], id: zoneId };
  const zone = zoneFor(spec);
  return {
    forecast: zone ?? undefined,
    stations: spec.stations,
    cachedAt: iso(-1),
  };
}
