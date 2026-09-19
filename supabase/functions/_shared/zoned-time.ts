// Wall-clock time in a named IANA timezone <-> UTC instant.
//
// Why this exists: the trip-plan page's "pick a time" field is an
// <input type="datetime-local">, which submits a bare "2026-09-18T21:00" with
// NO timezone. The server parsed it with `new Date(...)`, and in the edge
// runtime local time is UTC — while the page labelled the field with the
// plan's timezone ("Or pick a time (America/Anchorage)"). So a contact in
// Alaska choosing 9:00 PM got 9:00 PM UTC, eight hours EARLY, which the state
// machine then rejected as `extend_backwards`. Every extension-by-time failed.
//
// The repo previously only had formatters INTO a timezone (packet.ts,
// trip-plan-notify.ts). This is the inverse, and there is no built-in for it.

// Offset of `timeZone` from UTC at `instant`, in ms (AKDT -> -8h).
export function tzOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asIfUtc - Math.floor(instant / 1000) * 1000;
}

const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

// Interpret "YYYY-MM-DDTHH:mm[:ss]" as a wall-clock time in `timeZone` and
// return the UTC instant, or null if the string isn't in that shape.
//
// Resolved in two passes because the offset depends on the instant, which is
// what we're solving for: guess with the offset at the naive UTC reading,
// then re-check at the corrected instant. That is what makes it land right
// either side of a DST change.
export function wallTimeToUtc(local: string, timeZone: string): number | null {
  const m = LOCAL_RE.exec(local.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const naive = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0);
  if (!Number.isFinite(naive)) return null;
  let utc = naive - tzOffsetMs(naive, timeZone);
  const second = naive - tzOffsetMs(utc, timeZone);
  if (second !== utc) utc = second;
  return utc;
}

// UTC instant -> "YYYY-MM-DDTHH:mm" wall clock in `timeZone`, the format a
// datetime-local input expects for its value and min attributes.
export function utcToWallTime(instant: number, timeZone: string): string {
  const local = new Date(instant + tzOffsetMs(instant, timeZone));
  return local.toISOString().slice(0, 16);
}
