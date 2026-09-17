// Danger selection + notification copy for the daily forecast alert.
//
// Extracted from send-forecast-alerts so it can be unit-tested: this is the
// safety-relevant part. Getting "max danger across elevation bands" wrong,
// or letting a stale/absent rating read as LOW, would put a wrong number in
// front of someone deciding whether to go out.

// Ordered worst-last so we can take the max across elevation bands.
export const DANGER_ORDER = [
  "LOW",
  "MODERATE",
  "CONSIDERABLE",
  "HIGH",
  "EXTREME",
] as const;

export interface ElevationDanger {
  alpine?: string;
  treeline?: string;
  belowTreeline?: string;
}

export interface DayForecast {
  date?: string;
  danger?: ElevationDanger;
}

export interface ZonePayload {
  name?: string;
  forecast?: DayForecast[];
}

export interface ZoneDanger {
  name: string;
  danger: string;
}

// Highest danger across the three elevation bands — that's the number a
// traveller plans around. Unknown strings and NO_RATING are ignored rather
// than treated as LOW; a band we can't read must never lower the result.
// Returns null when nothing is ratable, which callers treat as "skip".
export function peakDanger(d: ElevationDanger | undefined | null): string | null {
  if (!d) return null;
  let best = -1;
  for (const band of [d.alpine, d.treeline, d.belowTreeline]) {
    const i = band
      ? (DANGER_ORDER as readonly string[]).indexOf(band.toUpperCase())
      : -1;
    if (i > best) best = i;
  }
  return best >= 0 ? DANGER_ORDER[best] : null;
}

// Pull today's rating out of a cached zone payload. Prefers the entry whose
// date matches, falling back to the first entry (NAC puts today first).
// Returns null when the zone has nothing ratable for today — the caller
// skips it rather than sending yesterday's number.
export function zoneDangerFor(
  payload: ZonePayload | null | undefined,
  today: string,
  fallbackName: string,
): ZoneDanger | null {
  const forecasts = payload?.forecast || [];
  const todays = forecasts.find((f) => f.date === today) || forecasts[0];
  const danger = peakDanger(todays?.danger);
  if (!danger) return null;
  return { name: payload?.name || fallbackName, danger };
}

export function titleCase(danger: string): string {
  return danger.charAt(0) + danger.slice(1).toLowerCase();
}

// Compose the notification. One zone gets a headline of its own name; more
// than one gets a combined line, capped so the body stays readable on a
// lock screen.
export function composeAlert(
  parts: ZoneDanger[],
  maxListed = 4,
): { title: string; body: string } | null {
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    return {
      title: parts[0].name,
      body: `${titleCase(parts[0].danger)} today. Tap for the full forecast.`,
    };
  }
  const listed = parts
    .slice(0, maxListed)
    .map((p) => `${p.name} — ${titleCase(p.danger)}`)
    .join(" · ");
  const overflow =
    parts.length > maxListed ? ` · +${parts.length - maxListed} more` : "";
  return { title: "Today's avalanche danger", body: listed + overflow };
}
