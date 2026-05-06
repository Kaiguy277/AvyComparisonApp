// Build the public viewer URL for a single observation.
//
// The NAC observations widget is loaded as a script on each center's
// forecast page (see du6amfiq9m9h7.cloudfront.net/loader/nac-widget-loader.min.js).
// Inside the widget the SPA route is `#/observation/<id>` — so any
// page that embeds the widget can deep-link to a single obs by hash.
//
// avalanche.org's own /observations/ URL is currently a broken redirect
// (HTTP 301 → unrelated technical paper), so we route to the issuing
// center's forecast page where the widget is reliably embedded.

const CENTER_VIEWER_BASE: Record<string, string> = {
  BAC: "https://bridgeportavalanchecenter.org/avalanche-forecast/",
  BTAC: "https://bridgertetonavalanchecenter.org/forecasts/",
  CAAC: "https://www.coastalakavalanche.org/forecast/",
  CAC: "https://alaskasnow.org/cordova/",
  CAIC: "https://avalanche.state.co.us/",
  CNFAIC: "https://cnfaic.org/forecast/",
  COAA: "https://coavalanche.org/pages/forecasts/",
  EARAC: "https://alaskasnow.org/eastern-ak-range/",
  ESAC: "https://www.esavalanche.org/forecasts/",
  EWYAIX: "https://ewyoavalanche.org/",
  FAC: "https://flatheadavalanche.com/avalanche-forecast/",
  GNFAC: "https://www.mtavalanche.com/avalanche-forecast/",
  HAC: "https://alaskasnow.org/haines-forecast/",
  HPAC: "https://hpavalanche.org/forecast/",
  IPAC: "https://www.idahopanhandleavalanche.org/forecasts/",
  KPAC: "https://kachinapeaks.org/Forecast/",
  MSAC: "https://www.shastaavalanche.org/advisories/",
  MWAC: "https://www.mountwashingtonavalanchecenter.org/",
  NWAC: "https://nwac.us/avalanche-forecast/",
  PAC: "https://payetteavalanche.org/forecasts/",
  SAC: "https://www.sierraavalanchecenter.org/forecasts/",
  SNFAC: "https://www.sawtoothavalanche.com/forecasts/",
  SOAIX: "https://www.oregonsnow.org/observations/",
  TAC: "https://taosavalanchecenter.org/forecasts/",
  UAC: "https://utahavalanchecenter.org/forecast/",
  VAC: "https://alaskasnow.org/valdez/",
  WAC: "https://www.wallowaavalanchecenter.org/forecasts/",
  WCMAC: "https://missoulaavalanche.org/forecasts/",
};

export function viewerUrlForObservation(
  centerId: string | null | undefined,
  obsId: string,
): string {
  const code = (centerId ?? "").toUpperCase();
  const base = CENTER_VIEWER_BASE[code];
  if (base) return `${base}#/observation/${obsId}`;
  // Fallback: avalanche.org/forecast/ at least lands on a real page
  // where the user can look up the obs from the center selector.
  return `https://avalanche.org/forecast/`;
}

export function viewerUrlForCenter(centerId: string | null | undefined): string {
  const code = (centerId ?? "").toUpperCase();
  return CENTER_VIEWER_BASE[code] ?? "https://avalanche.org/forecast/";
}
