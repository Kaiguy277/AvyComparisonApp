import type { DangerRating } from "@/lib/api/avalanche";

export const dangerColors: Record<
  DangerRating,
  { bg: string; text: string; border: string; hex: string }
> = {
  LOW: { bg: "bg-green-500", text: "text-white", border: "border-green-500", hex: "#22c55e" },
  MODERATE: {
    bg: "bg-yellow-400",
    text: "text-black",
    border: "border-yellow-400",
    hex: "#facc15",
  },
  CONSIDERABLE: {
    bg: "bg-orange-500",
    text: "text-white",
    border: "border-orange-500",
    hex: "#f97316",
  },
  HIGH: { bg: "bg-red-600", text: "text-white", border: "border-red-600", hex: "#dc2626" },
  EXTREME: { bg: "bg-black", text: "text-white", border: "border-black", hex: "#000000" },
  NO_RATING: {
    bg: "bg-gray-300",
    text: "text-gray-700",
    border: "border-gray-300",
    hex: "#d1d5db",
  },
};

export const freshnessConfig = {
  current: { color: "text-green-600", bg: "bg-green-100", label: "Current" },
  recent: { color: "text-yellow-600", bg: "bg-yellow-100", label: "Recent" },
  expiring: { color: "text-orange-600", bg: "bg-orange-100", label: "Expiring Soon" },
  expired: { color: "text-red-600", bg: "bg-red-100", label: "Expired" },
  unknown: { color: "text-muted-foreground", bg: "bg-muted", label: "Unknown" },
};
