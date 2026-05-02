// Centralized list of every zone the cron will refresh.
// Source of truth: lib/zones.ts on the mobile side. We just need the IDs +
// center mapping here. If the mobile zone list changes, mirror it here too.

export interface ZoneRef {
  id: string;
  centerId: string;
}

export const ALL_ZONES: ZoneRef[] = [
  // CNFAIC
  { id: "turnagain-girdwood", centerId: "CNFAIC" },
  { id: "summit", centerId: "CNFAIC" },
  { id: "seward", centerId: "CNFAIC" },
  { id: "chugach-state-park", centerId: "CNFAIC" },
  // HPAC
  { id: "hatcher-pass", centerId: "HPAC" },
  // VAC
  { id: "valdez-maritime", centerId: "VAC" },
  { id: "valdez-intermountain", centerId: "VAC" },
  { id: "valdez-continental", centerId: "VAC" },
  // CAC
  { id: "cordova", centerId: "CAC" },
  // EARAC
  { id: "earac-north", centerId: "EARAC" },
  { id: "earac-south", centerId: "EARAC" },
  // CAAC
  { id: "douglas-island", centerId: "CAAC" },
  { id: "juneau-mainland", centerId: "CAAC" },
  // HAC
  { id: "haines-lutak", centerId: "HAC" },
  { id: "haines-transitional", centerId: "HAC" },
  { id: "haines-chilkat-pass", centerId: "HAC" },
  // NWAC
  { id: "olympics", centerId: "NWAC" },
  { id: "west-slopes-north", centerId: "NWAC" },
  { id: "west-slopes-central", centerId: "NWAC" },
  { id: "west-slopes-south", centerId: "NWAC" },
  { id: "stevens-pass", centerId: "NWAC" },
  { id: "snoqualmie-pass", centerId: "NWAC" },
  { id: "east-slopes-north", centerId: "NWAC" },
  { id: "east-slopes-central", centerId: "NWAC" },
  { id: "east-slopes-south", centerId: "NWAC" },
  { id: "mt-hood", centerId: "NWAC" },
  // COAA
  { id: "central-cascades", centerId: "COAA" },
  { id: "newberry", centerId: "COAA" },
  // WAC
  { id: "northern-wallowas", centerId: "WAC" },
  { id: "southern-wallowas", centerId: "WAC" },
  { id: "elkhorns", centerId: "WAC" },
  { id: "blues", centerId: "WAC" },
  // SOAIX
  { id: "southern-oregon", centerId: "SOAIX" },
  // SAC
  { id: "central-sierra-nevada", centerId: "SAC" },
  // ESAC
  { id: "eastside-region", centerId: "ESAC" },
  // BAC
  { id: "bridgeport", centerId: "BAC" },
  // MSAC
  { id: "mount-shasta", centerId: "MSAC" },
  // SNFAC
  { id: "banner-summit", centerId: "SNFAC" },
  { id: "galena-summit-eastern-mtns", centerId: "SNFAC" },
  { id: "sawtooth-western-smoky-mtns", centerId: "SNFAC" },
  { id: "soldier-wood-river-valley-mtns", centerId: "SNFAC" },
  // PAC
  { id: "salmon-river-mountains", centerId: "PAC" },
  { id: "west-mountains", centerId: "PAC" },
  // IPAC
  { id: "selkirk-mountains", centerId: "IPAC" },
  { id: "west-cabinet-mountains", centerId: "IPAC" },
  { id: "east-cabinet-mountains", centerId: "IPAC" },
  { id: "silver-valley-bitterroot-mountains", centerId: "IPAC" },
  { id: "purcell-mountains", centerId: "IPAC" },
  // GNFAC
  { id: "bridger-range", centerId: "GNFAC" },
  { id: "northern-gallatin-range", centerId: "GNFAC" },
  { id: "southern-gallatin-range", centerId: "GNFAC" },
  { id: "northern-madison-range", centerId: "GNFAC" },
  { id: "southern-madison-range", centerId: "GNFAC" },
  { id: "lionhead-area", centerId: "GNFAC" },
  { id: "island-park", centerId: "GNFAC" },
  { id: "cooke-city", centerId: "GNFAC" },
  // FAC
  { id: "whitefish-range", centerId: "FAC" },
  { id: "swan-range", centerId: "FAC" },
  { id: "flathead-range-glacier-np", centerId: "FAC" },
  // WCMAC
  { id: "seeley-lake", centerId: "WCMAC" },
  { id: "rattlesnake", centerId: "WCMAC" },
  { id: "bitterroot", centerId: "WCMAC" },
  // BTAC
  { id: "tetons", centerId: "BTAC" },
  { id: "togwotee-pass", centerId: "BTAC" },
  { id: "snake-river-range", centerId: "BTAC" },
  { id: "salt-river-wyoming-ranges", centerId: "BTAC" },
  // EWYAIX
  { id: "big-horns", centerId: "EWYAIX" },
  { id: "snowy-range", centerId: "EWYAIX" },
  { id: "sierra-madre", centerId: "EWYAIX" },
  // UAC
  { id: "logan", centerId: "UAC" },
  { id: "ogden", centerId: "UAC" },
  { id: "salt-lake", centerId: "UAC" },
  { id: "provo", centerId: "UAC" },
  { id: "uintas", centerId: "UAC" },
  { id: "skyline", centerId: "UAC" },
  { id: "moab", centerId: "UAC" },
  { id: "abajos", centerId: "UAC" },
  { id: "southwest", centerId: "UAC" },
  // CAIC
  { id: "caic-front-range-north", centerId: "CAIC" },
  { id: "caic-front-range-boulder", centerId: "CAIC" },
  { id: "caic-front-range-south", centerId: "CAIC" },
  { id: "caic-vail-summit-county", centerId: "CAIC" },
  { id: "caic-elk-mountains", centerId: "CAIC" },
  { id: "caic-sawatch-range", centerId: "CAIC" },
  { id: "caic-grand-mesa-west-elk", centerId: "CAIC" },
  { id: "caic-park-range", centerId: "CAIC" },
  { id: "caic-northern-san-juan", centerId: "CAIC" },
  { id: "caic-southern-san-juan", centerId: "CAIC" },
  { id: "caic-sangre-de-cristo", centerId: "CAIC" },
  // TAC
  { id: "northern-new-mexico", centerId: "TAC" },
  // KPAC
  { id: "san-francisco-peaks", centerId: "KPAC" },
  // MWAC
  { id: "presidential-range", centerId: "MWAC" },
];

// Group zones by center for batched calls.
export function groupByCenter(zones: ZoneRef[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const z of zones) {
    if (!m.has(z.centerId)) m.set(z.centerId, []);
    m.get(z.centerId)!.push(z.id);
  }
  return m;
}
