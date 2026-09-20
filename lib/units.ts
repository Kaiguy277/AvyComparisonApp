// Display formatting for measured values.
//
// Station feeds return temperatures at whatever precision the sensor and the
// upstream API happen to use, and we were rendering that straight to the
// screen — so one tile read "52.34°" next to "36.9°" and "39°".

// Format a Fahrenheit temperature for display.
//
// One decimal place, with a trailing ".0" dropped so whole degrees read "39°"
// rather than "39.0°".
//
// Deliberately NOT rounded to whole degrees: around freezing the difference
// between 31.6 and 32.4 is rain versus snow, and a wet-slab problem versus a
// dry one. That is exactly the range where this app's users need the
// resolution, so the tenth stays when it carries information and disappears
// when it doesn't.
export function formatTempF(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value * 10) / 10;
  // Math.round can produce -0 for small negatives (-0.04 → -0), which would
  // render as "-0°". Sub-zero readings are normal here, so normalise it.
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return `${Number.isInteger(safe) ? safe : safe.toFixed(1)}°`;
}

// Format a wind speed in mph for display.
//
// Station feeds return wind at sensor precision, and the headline figure on the
// station card was rendering it straight through — so one card read "6.95 MPH"
// above "24H AVG 9 mph" and "24H MAX 27.8 mph": three precisions for the same
// quantity in one view.
//
// Unlike temperature, tenths of a mph carry no decision here. Nothing about
// travel or terrain choice turns on 6.95 versus 7, the anemometers are not that
// accurate, and every forecast product these readings sit next to quotes wind in
// whole mph. So this rounds, where formatTempF deliberately does not.
export function formatWindMph(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const rounded = Math.round(value);
  // Math.round(-0.4) is -0, which would render as "-0 mph".
  return `${Object.is(rounded, -0) ? 0 : rounded}`;
}
