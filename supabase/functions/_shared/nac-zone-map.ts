// Mapping between NAC's numeric zone_id (returned by the observations
// detail endpoint and the product endpoint) and the human-readable
// slug we use everywhere else (`east-slopes-south`, `tetons`, etc.).
//
// Source of truth is ZONE_CONFIG in avalanche-summary/index.ts. Keep
// in sync — adding a zone there means adding it here too. (Worth
// extracting into a single file if either side keeps growing.)

export const NAC_ZONE_TO_SLUG: Record<string, { slug: string; centerId: string }> = {
  // BAC
  "3004": { slug: "bridgeport", centerId: "BAC" },
  // BTAC
  "2856": { slug: "salt-river-wyoming-ranges", centerId: "BTAC" },
  "2860": { slug: "snake-river-range", centerId: "BTAC" },
  "2855": { slug: "tetons", centerId: "BTAC" },
  "2852": { slug: "togwotee-pass", centerId: "BTAC" },
  // CAC
  "1421": { slug: "cordova", centerId: "CAC" },
  // CAIC
  "2647": { slug: "caic-northern-san-juan", centerId: "CAIC" },
  "2651": { slug: "caic-sangre-de-cristo", centerId: "CAIC" },
  "2660": { slug: "caic-southern-san-juan", centerId: "CAIC" },
  "2690": { slug: "caic-park-range", centerId: "CAIC" },
  "2712": { slug: "caic-front-range-north", centerId: "CAIC" },
  "2730": { slug: "caic-vail-summit-county", centerId: "CAIC" },
  "2745": { slug: "caic-front-range-boulder", centerId: "CAIC" },
  "2747": { slug: "caic-grand-mesa-west-elk", centerId: "CAIC" },
  "2751": { slug: "caic-elk-mountains", centerId: "CAIC" },
  "2754": { slug: "caic-sawatch-range", centerId: "CAIC" },
  "2755": { slug: "caic-front-range-south", centerId: "CAIC" },
  // CAAC
  "2165": { slug: "douglas-island", centerId: "CAAC" },
  "2164": { slug: "juneau-mainland", centerId: "CAAC" },
  // CNFAIC
  "2815": { slug: "turnagain-girdwood", centerId: "CNFAIC" },
  "2816": { slug: "summit", centerId: "CNFAIC" },
  "2817": { slug: "seward", centerId: "CNFAIC" },
  "2818": { slug: "chugach-state-park", centerId: "CNFAIC" },
  // COAA
  "2470": { slug: "central-cascades", centerId: "COAA" },
  "2471": { slug: "newberry", centerId: "COAA" },
  // EARAC
  "3002": { slug: "earac-north", centerId: "EARAC" },
  "3003": { slug: "earac-south", centerId: "EARAC" },
  // ESAC
  "128": { slug: "eastside-region", centerId: "ESAC" },
  // EWYAIX
  "2841": { slug: "big-horns", centerId: "EWYAIX" },
  "2843": { slug: "sierra-madre", centerId: "EWYAIX" },
  "2842": { slug: "snowy-range", centerId: "EWYAIX" },
  // FAC
  "1735": { slug: "flathead-range-glacier-np", centerId: "FAC" },
  "1734": { slug: "swan-range", centerId: "FAC" },
  "1733": { slug: "whitefish-range", centerId: "FAC" },
  // GNFAC
  "2819": { slug: "bridger-range", centerId: "GNFAC" },
  "2827": { slug: "cooke-city", centerId: "GNFAC" },
  "2826": { slug: "island-park", centerId: "GNFAC" },
  "2825": { slug: "lionhead-area", centerId: "GNFAC" },
  "2821": { slug: "northern-gallatin-range", centerId: "GNFAC" },
  "2822": { slug: "northern-madison-range", centerId: "GNFAC" },
  "2824": { slug: "southern-gallatin-range", centerId: "GNFAC" },
  "2823": { slug: "southern-madison-range", centerId: "GNFAC" },
  // HAC
  "3005": { slug: "haines-lutak", centerId: "HAC" },
  "3006": { slug: "haines-transitional", centerId: "HAC" },
  "3007": { slug: "haines-chilkat-pass", centerId: "HAC" },
  // HPAC
  "2152": { slug: "hatcher-pass", centerId: "HPAC" },
  // IPAC
  "1901": { slug: "east-cabinet-mountains", centerId: "IPAC" },
  "1903": { slug: "purcell-mountains", centerId: "IPAC" },
  "1899": { slug: "selkirk-mountains", centerId: "IPAC" },
  "1902": { slug: "silver-valley-bitterroot-mountains", centerId: "IPAC" },
  "1900": { slug: "west-cabinet-mountains", centerId: "IPAC" },
  // KPAC
  "2990": { slug: "san-francisco-peaks", centerId: "KPAC" },
  // MSAC
  "1833": { slug: "mount-shasta", centerId: "MSAC" },
  // MWAC
  "2355": { slug: "presidential-range", centerId: "MWAC" },
  // NWAC
  "1655": { slug: "east-slopes-central", centerId: "NWAC" },
  "1654": { slug: "east-slopes-north", centerId: "NWAC" },
  "1656": { slug: "east-slopes-south", centerId: "NWAC" },
  "1657": { slug: "mt-hood", centerId: "NWAC" },
  "1645": { slug: "olympics", centerId: "NWAC" },
  "1653": { slug: "snoqualmie-pass", centerId: "NWAC" },
  "1649": { slug: "stevens-pass", centerId: "NWAC" },
  "1647": { slug: "west-slopes-central", centerId: "NWAC" },
  "1646": { slug: "west-slopes-north", centerId: "NWAC" },
  "1648": { slug: "west-slopes-south", centerId: "NWAC" },
  // PAC
  "2897": { slug: "salmon-river-mountains", centerId: "PAC" },
  "2898": { slug: "west-mountains", centerId: "PAC" },
  // SAC
  "2458": { slug: "central-sierra-nevada", centerId: "SAC" },
  // SNFAC
  "2907": { slug: "banner-summit", centerId: "SNFAC" },
  "2904": { slug: "galena-summit-eastern-mtns", centerId: "SNFAC" },
  "2906": { slug: "sawtooth-western-smoky-mtns", centerId: "SNFAC" },
  "2905": { slug: "soldier-wood-river-valley-mtns", centerId: "SNFAC" },
  // SOAIX
  "1369": { slug: "southern-oregon", centerId: "SOAIX" },
  // TAC
  "490": { slug: "northern-new-mexico", centerId: "TAC" },
  // UAC
  "1744": { slug: "abajos", centerId: "UAC" },
  "1736": { slug: "logan", centerId: "UAC" },
  "1742": { slug: "moab", centerId: "UAC" },
  "1737": { slug: "ogden", centerId: "UAC" },
  "1739": { slug: "provo", centerId: "UAC" },
  "1738": { slug: "salt-lake", centerId: "UAC" },
  "1741": { slug: "skyline", centerId: "UAC" },
  "1743": { slug: "southwest", centerId: "UAC" },
  "1740": { slug: "uintas", centerId: "UAC" },
  // VAC
  "1609": { slug: "valdez-maritime", centerId: "VAC" },
  "1610": { slug: "valdez-intermountain", centerId: "VAC" },
  "1611": { slug: "valdez-continental", centerId: "VAC" },
  // WAC
  "2985": { slug: "blues", centerId: "WAC" },
  "2984": { slug: "elkhorns", centerId: "WAC" },
  "2982": { slug: "northern-wallowas", centerId: "WAC" },
  "2983": { slug: "southern-wallowas", centerId: "WAC" },
  // WCMAC
  "1724": { slug: "bitterroot", centerId: "WCMAC" },
  "1723": { slug: "rattlesnake", centerId: "WCMAC" },
  "1722": { slug: "seeley-lake", centerId: "WCMAC" },
};
