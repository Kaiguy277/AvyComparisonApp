// Freeze the zone's forecast for the trip day into the packet.
import type { AvalancheZone } from "@/lib/api/avalanche";
import type { ForecastSnapshot } from "./schema";
import { ZONE_TO_CENTER_NAME } from "@/lib/zones";

export function forecastSnapshotFromZone(
  zone: AvalancheZone | null | undefined,
  zoneId: string | undefined,
): ForecastSnapshot | null {
  if (!zone) return null;
  const today = zone.forecast?.[0];
  return {
    centerName: (zoneId && ZONE_TO_CENTER_NAME[zoneId]) || "",
    zoneName: zone.name,
    issuedAt: zone.freshness?.issueDate ?? null,
    dangerByBand: today
      ? {
          upper: today.danger.alpine,
          middle: today.danger.treeline,
          lower: today.danger.belowTreeline,
        }
      : null,
    problems: (zone.problems ?? []).map((p) => p.name),
  };
}
