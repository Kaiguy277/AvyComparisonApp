import type { DangerRating } from "@/lib/api/avalanche";

export const palette = {
  ink: {
    950: "#070A14",
    900: "#0B1220",
    800: "#141C2E",
    700: "#1E2840",
    600: "#2A3550",
    500: "#3B4A6B",
    400: "#5A6B8C",
    300: "#8794AE",
    200: "#B8C2D6",
    100: "#E1E7F0",
    50: "#F5F8FC",
  },
  frost: {
    400: "#67D5F0",
    500: "#3DB8E0",
    600: "#1F94BF",
  },
  aspen: {
    400: "#F0C674",
    500: "#E8B765",
    600: "#C99850",
  },
};

// Official NAC danger rating colors — these are the international standard
// recognized by avalanche professionals worldwide. Don't substitute.
export const dangerColors: Record<
  DangerRating,
  { fill: string; ink: string; label: string; level: number }
> = {
  LOW: { fill: "#52BA4A", ink: "#0A2008", label: "LOW", level: 1 },
  MODERATE: { fill: "#FFF200", ink: "#1F1A00", label: "MODERATE", level: 2 },
  CONSIDERABLE: { fill: "#F7941D", ink: "#1F0F00", label: "CONSIDERABLE", level: 3 },
  HIGH: { fill: "#ED1C24", ink: "#FFFFFF", label: "HIGH", level: 4 },
  EXTREME: { fill: "#000000", ink: "#ED1C24", label: "EXTREME", level: 5 },
  NO_RATING: { fill: "#1E2840", ink: "#5A6B8C", label: "—", level: 0 },
};

export const freshness = {
  current: { fill: "#52BA4A", ink: "#0A2008", label: "Current" },
  recent: { fill: "#67D5F0", ink: "#001D2B", label: "Recent" },
  expiring: { fill: "#F7941D", ink: "#1F0F00", label: "Expiring" },
  expired: { fill: "#ED1C24", ink: "#FFFFFF", label: "Expired" },
  unknown: { fill: "#3B4A6B", ink: "#B8C2D6", label: "—" },
} as const;
