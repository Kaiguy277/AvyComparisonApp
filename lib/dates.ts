// The one date convention for the app: LOCAL calendar dates, never UTC.
//
// Why local: the app's users are backcountry travelers in Alaska and the
// western US (UTC−7 to −9). `new Date().toISOString().slice(0,10)` is a
// UTC date, so it rolls over to "tomorrow" at 3–5 PM local — mid-
// afternoon, exactly when someone is checking conditions for tomorrow.
// That off-by-one desynced the archive date pager from the header and
// keyed cache bundles under the wrong day. The observation form already
// settled on local for the same reason (lib/observation/schema.ts).
//
// A "day key" here is a YYYY-MM-DD string in the device's local zone.
// Bundles are grouped by it; the pager steps through it; freshness is
// computed from real timestamps (ageHours), not from these keys.

// Today as a local YYYY-MM-DD day key.
export function todayKey(now: Date = new Date()): string {
  return toKey(now);
}

// Local YYYY-MM-DD for any Date.
export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Parse a YYYY-MM-DD day key into a local Date at local midnight.
// (`new Date("2026-02-14")` would parse as UTC midnight and shift the
// day backward in western zones — this avoids that.)
export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// Shift a day key by whole days, staying in local time.
export function addDaysKey(key: string, delta: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + delta);
  return toKey(d);
}

// Human label for a day key, e.g. "FEB 14". Parsed in local time so the
// number matches the key.
const MONTHS = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];
export function formatDayKey(key: string): string {
  const d = fromKey(key);
  if (isNaN(d.getTime())) return key;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
// e.g. "FRI · FEB 14"
export function formatDayKeyLong(key: string): string {
  const d = fromKey(key);
  if (isNaN(d.getTime())) return key;
  return `${WEEKDAYS[d.getDay()]} · ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
