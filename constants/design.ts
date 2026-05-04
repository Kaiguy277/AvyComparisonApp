import type { DangerRating } from "@/lib/api/avalanche";

// Warm-paper palette. Tiles sit on a slightly-cooler page bg with a
// raised surface so they read as cards floating on a backdrop, not
// edge-to-edge color blocks. NAC danger colors stay locked.
//
// `ink` scale runs from page-bg → primary text:
//   950 → page bg                 (warm bone, slightly cooler than tile)
//   900 → recessed surface        (panels behind content)
//   800 → tile / raised surface   (one step warmer than page → reads "above")
//   700 → strong ink line         (deep brown-black, primary divider)
//   600 → medium ink              (icon strokes, mountain outline)
//   500 → soft sepia              (low-contrast borders)
//   400 → muted text              (eyebrow labels, fine meta)
//   300 → secondary text          (bylines, captions)
//   200 → body text               (main prose)
//   100 → primary text            (titles, key numbers)
//   50  → emphasis text           (rare; highest-contrast)
export const palette = {
  ink: {
    950: "#EDE5D2",
    900: "#E5DCC4",
    800: "#F6EFDD",
    700: "#1B1916",
    600: "#3A332A",
    500: "#A89A82",
    400: "#7B7160",
    300: "#5C534A",
    200: "#2E2A24",
    100: "#1B1916",
    50:  "#0F0D0B",
  },
  // Cobalt accent — used for "Full forecast" tile and weather chart fills.
  frost: {
    400: "#3F7AB8",
    500: "#2D5F95",
    600: "#1F4773",
  },
  // Burnt sienna — single warm accent for announcements + "tap" hints.
  aspen: {
    400: "#B25437",
    500: "#92402A",
    600: "#73311F",
  },
};

// Official NAC danger rating colors — international standard, untouched.
export const dangerColors: Record<
  DangerRating,
  { fill: string; ink: string; label: string; level: number }
> = {
  LOW: { fill: "#52BA4A", ink: "#0A2008", label: "LOW", level: 1 },
  MODERATE: { fill: "#FFF200", ink: "#1F1A00", label: "MODERATE", level: 2 },
  CONSIDERABLE: { fill: "#F7941D", ink: "#1F0F00", label: "CONSIDERABLE", level: 3 },
  HIGH: { fill: "#ED1C24", ink: "#FFFFFF", label: "HIGH", level: 4 },
  EXTREME: { fill: "#000000", ink: "#ED1C24", label: "EXTREME", level: 5 },
  NO_RATING: { fill: "#D6CCBA", ink: "#5C534A", label: "—", level: 0 },
};

export const freshness = {
  current: { fill: "#52BA4A", ink: "#0A2008", label: "Current" },
  recent: { fill: "#3F7AB8", ink: "#F6EFDD", label: "Recent" },
  expiring: { fill: "#F7941D", ink: "#1F0F00", label: "Expiring" },
  expired: { fill: "#ED1C24", ink: "#FFFFFF", label: "Expired" },
  unknown: { fill: "#A89A82", ink: "#F6EFDD", label: "—" },
} as const;
