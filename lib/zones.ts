export interface ForecastZone {
  id: string;
  name: string;
}
export interface AvalancheCenter {
  id: string;
  name: string;
  zones: ForecastZone[];
}
export interface Region {
  id: string;
  name: string;
  centers: AvalancheCenter[];
}

// Extra zone-name strings used by the National Avalanche Center's
// public map-layer polygons that don't match our canonical zone names.
// Keyed by our internal zone id → NAC name(s) seen in the GeoJSON.
// Used by the map view to pair polygons back to the right zone.
export const NAC_ZONE_ALIASES: Record<string, string[]> = {
  "turnagain-girdwood": ["Turnagain Pass and Girdwood"],
  seward: ["Seward and Lost Lake"],
  "earac-north": ["North (Castner-Canwell) Eastern Alaska Range"],
  "earac-south": ["South (Summit) Eastern Alaska Range"],
  "juneau-mainland": ["Juneau"],
  bridgeport: ["Bridgeport Avalanche Center"],
  "san-francisco-peaks": [
    "San Francisco Peaks / Kachina Peaks Wilderness",
    "Kachina Peaks",
  ],
};

// Approximate coordinates for each avalanche center's forecast area centroid.
// Used only to pin centers on the map view — not for forecast lookup.
export const CENTER_COORDS: Record<string, { lat: number; lon: number }> = {
  CNFAIC: { lat: 60.83, lon: -149.0 },
  HPAC: { lat: 61.78, lon: -149.3 },
  VAC: { lat: 61.13, lon: -146.35 },
  CAC: { lat: 60.55, lon: -145.75 },
  EARAC: { lat: 63.4, lon: -145.5 },
  CAAC: { lat: 58.3, lon: -134.42 },
  HAC: { lat: 59.24, lon: -135.45 },
  NWAC: { lat: 47.5, lon: -121.4 },
  COAA: { lat: 44.06, lon: -121.31 },
  WAC: { lat: 45.32, lon: -117.18 },
  SOAIX: { lat: 42.33, lon: -122.87 },
  SAC: { lat: 39.33, lon: -120.18 },
  ESAC: { lat: 37.65, lon: -119.03 },
  BAC: { lat: 38.26, lon: -119.23 },
  MSAC: { lat: 41.41, lon: -122.2 },
  SNFAC: { lat: 43.68, lon: -114.36 },
  PAC: { lat: 44.91, lon: -116.1 },
  IPAC: { lat: 48.27, lon: -116.55 },
  GNFAC: { lat: 45.68, lon: -111.04 },
  FAC: { lat: 48.41, lon: -114.34 },
  WCMAC: { lat: 46.87, lon: -113.99 },
  BTAC: { lat: 43.48, lon: -110.76 },
  EWYAIX: { lat: 44.5, lon: -107.4 },
  UAC: { lat: 40.76, lon: -111.89 },
  CAIC: { lat: 39.0, lon: -106.5 },
  TAC: { lat: 36.41, lon: -105.57 },
  KPAC: { lat: 35.34, lon: -111.68 },
  MWAC: { lat: 44.27, lon: -71.3 },
};

export const REGION_STRUCTURE: Region[] = [
  {
    id: "alaska",
    name: "Alaska",
    centers: [
      {
        id: "CNFAIC",
        name: "Chugach National Forest Avalanche Center",
        zones: [
          { id: "turnagain-girdwood", name: "Turnagain Pass / Girdwood" },
          { id: "summit", name: "Summit Lake" },
          { id: "seward", name: "Seward / Lost Lake" },
          { id: "chugach-state-park", name: "Chugach State Park" },
        ],
      },
      {
        id: "HPAC",
        name: "Hatcher Pass Avalanche Center",
        zones: [{ id: "hatcher-pass", name: "Hatcher Pass" }],
      },
      {
        id: "VAC",
        name: "Valdez Avalanche Center",
        zones: [
          { id: "valdez-maritime", name: "Maritime" },
          { id: "valdez-intermountain", name: "Intermountain" },
          { id: "valdez-continental", name: "Continental" },
        ],
      },
      {
        id: "CAC",
        name: "Cordova Avalanche Center",
        zones: [{ id: "cordova", name: "Cordova" }],
      },
      {
        id: "EARAC",
        name: "Eastern Alaska Range Avalanche Center",
        zones: [
          { id: "earac-north", name: "North (Castner-Canwell)" },
          { id: "earac-south", name: "South (Summit)" },
        ],
      },
      {
        id: "CAAC",
        name: "Coastal Alaska Avalanche Center",
        zones: [
          { id: "douglas-island", name: "Douglas Island" },
          { id: "juneau-mainland", name: "Juneau Mainland" },
        ],
      },
      {
        id: "HAC",
        name: "Haines Avalanche Center",
        zones: [
          { id: "haines-lutak", name: "Lutak" },
          { id: "haines-transitional", name: "Transitional" },
          { id: "haines-chilkat-pass", name: "Chilkat Pass" },
        ],
      },
    ],
  },
  {
    id: "pacific-northwest",
    name: "Pacific Northwest",
    centers: [
      {
        id: "NWAC",
        name: "Northwest Avalanche Center",
        zones: [
          { id: "olympics", name: "Olympics" },
          { id: "west-slopes-north", name: "West Slopes North" },
          { id: "west-slopes-central", name: "West Slopes Central" },
          { id: "west-slopes-south", name: "West Slopes South" },
          { id: "stevens-pass", name: "Stevens Pass" },
          { id: "snoqualmie-pass", name: "Snoqualmie Pass" },
          { id: "east-slopes-north", name: "East Slopes North" },
          { id: "east-slopes-central", name: "East Slopes Central" },
          { id: "east-slopes-south", name: "East Slopes South" },
          { id: "mt-hood", name: "Mt Hood" },
        ],
      },
      {
        id: "COAA",
        name: "Central Oregon Avalanche Center",
        zones: [
          { id: "central-cascades", name: "Central Cascades" },
          { id: "newberry", name: "Newberry" },
        ],
      },
      {
        id: "WAC",
        name: "Wallowa Avalanche Center",
        zones: [
          { id: "northern-wallowas", name: "Northern Wallowas" },
          { id: "southern-wallowas", name: "Southern Wallowas" },
          { id: "elkhorns", name: "Elkhorns" },
          { id: "blues", name: "Blues" },
        ],
      },
      {
        id: "SOAIX",
        name: "Southern Oregon Avalanche Info Exchange",
        zones: [{ id: "southern-oregon", name: "Southern Oregon" }],
      },
    ],
  },
  {
    id: "california-nevada",
    name: "California & Nevada",
    centers: [
      {
        id: "SAC",
        name: "Sierra Avalanche Center",
        zones: [{ id: "central-sierra-nevada", name: "Central Sierra Nevada" }],
      },
      {
        id: "ESAC",
        name: "Eastern Sierra Avalanche Center",
        zones: [{ id: "eastside-region", name: "Eastside Region" }],
      },
      {
        id: "BAC",
        name: "Bridgeport Avalanche Center",
        zones: [{ id: "bridgeport", name: "Bridgeport" }],
      },
      {
        id: "MSAC",
        name: "Mount Shasta Avalanche Center",
        zones: [{ id: "mount-shasta", name: "Mount Shasta" }],
      },
    ],
  },
  {
    id: "idaho",
    name: "Idaho",
    centers: [
      {
        id: "SNFAC",
        name: "Sawtooth Avalanche Center",
        zones: [
          { id: "banner-summit", name: "Banner Summit" },
          { id: "galena-summit-eastern-mtns", name: "Galena Summit & Eastern Mtns" },
          { id: "sawtooth-western-smoky-mtns", name: "Sawtooth & Western Smoky Mtns" },
          { id: "soldier-wood-river-valley-mtns", name: "Soldier & Wood River Valley Mtns" },
        ],
      },
      {
        id: "PAC",
        name: "Payette Avalanche Center",
        zones: [
          { id: "salmon-river-mountains", name: "Salmon River Mountains" },
          { id: "west-mountains", name: "West Mountains" },
        ],
      },
      {
        id: "IPAC",
        name: "Idaho Panhandle Avalanche Center",
        zones: [
          { id: "selkirk-mountains", name: "Selkirk Mountains" },
          { id: "west-cabinet-mountains", name: "West Cabinet Mountains" },
          { id: "east-cabinet-mountains", name: "East Cabinet Mountains" },
          { id: "silver-valley-bitterroot-mountains", name: "Silver Valley & Bitterroot Mountains" },
          { id: "purcell-mountains", name: "Purcell Mountains" },
        ],
      },
    ],
  },
  {
    id: "montana",
    name: "Montana",
    centers: [
      {
        id: "GNFAC",
        name: "Gallatin NF Avalanche Center",
        zones: [
          { id: "bridger-range", name: "Bridger Range" },
          { id: "northern-gallatin-range", name: "Northern Gallatin Range" },
          { id: "southern-gallatin-range", name: "Southern Gallatin Range" },
          { id: "northern-madison-range", name: "Northern Madison Range" },
          { id: "southern-madison-range", name: "Southern Madison Range" },
          { id: "lionhead-area", name: "Lionhead Area" },
          { id: "island-park", name: "Island Park" },
          { id: "cooke-city", name: "Cooke City" },
        ],
      },
      {
        id: "FAC",
        name: "Flathead Avalanche Center",
        zones: [
          { id: "whitefish-range", name: "Whitefish Range" },
          { id: "swan-range", name: "Swan Range" },
          { id: "flathead-range-glacier-np", name: "Flathead Range & Glacier NP" },
        ],
      },
      {
        id: "WCMAC",
        name: "West Central Montana Avalanche Center",
        zones: [
          { id: "seeley-lake", name: "Seeley Lake" },
          { id: "rattlesnake", name: "Rattlesnake" },
          { id: "bitterroot", name: "Bitterroot" },
        ],
      },
    ],
  },
  {
    id: "wyoming",
    name: "Wyoming",
    centers: [
      {
        id: "BTAC",
        name: "Bridger-Teton Avalanche Center",
        zones: [
          { id: "tetons", name: "Tetons" },
          { id: "togwotee-pass", name: "Togwotee Pass" },
          { id: "snake-river-range", name: "Snake River Range" },
          { id: "salt-river-wyoming-ranges", name: "Salt River and Wyoming Ranges" },
        ],
      },
      {
        id: "EWYAIX",
        name: "Eastern Wyoming Avalanche Info Exchange",
        zones: [
          { id: "big-horns", name: "Big Horns" },
          { id: "snowy-range", name: "Snowy Range" },
          { id: "sierra-madre", name: "Sierra Madre" },
        ],
      },
    ],
  },
  {
    id: "utah",
    name: "Utah",
    centers: [
      {
        id: "UAC",
        name: "Utah Avalanche Center",
        zones: [
          { id: "logan", name: "Logan" },
          { id: "ogden", name: "Ogden" },
          { id: "salt-lake", name: "Salt Lake" },
          { id: "provo", name: "Provo" },
          { id: "uintas", name: "Uintas" },
          { id: "skyline", name: "Skyline" },
          { id: "moab", name: "Moab" },
          { id: "abajos", name: "Abajos" },
          { id: "southwest", name: "Southwest" },
        ],
      },
    ],
  },
  {
    id: "colorado",
    name: "Colorado",
    centers: [
      {
        id: "CAIC",
        name: "Colorado Avalanche Information Center",
        zones: [
          { id: "caic-front-range-north", name: "Front Range & Never Summer Mountains" },
          { id: "caic-front-range-boulder", name: "Front Range (Boulder)" },
          { id: "caic-front-range-south", name: "Front Range South & Pikes Peak" },
          { id: "caic-vail-summit-county", name: "Vail & Summit County" },
          { id: "caic-elk-mountains", name: "Elk Mountains (Aspen)" },
          { id: "caic-sawatch-range", name: "Sawatch Range" },
          { id: "caic-grand-mesa-west-elk", name: "Grand Mesa & Flat Tops" },
          { id: "caic-park-range", name: "Park Range (Steamboat)" },
          { id: "caic-northern-san-juan", name: "Northern San Juan Mountains" },
          { id: "caic-southern-san-juan", name: "Southern San Juan Mountains" },
          { id: "caic-sangre-de-cristo", name: "Sangre de Cristo Mountains" },
        ],
      },
    ],
  },
  {
    id: "new-mexico-arizona",
    name: "New Mexico & Arizona",
    centers: [
      {
        id: "TAC",
        name: "Taos Avalanche Center",
        zones: [{ id: "northern-new-mexico", name: "Northern New Mexico" }],
      },
      {
        id: "KPAC",
        name: "Kachina Peaks Avalanche Center",
        zones: [{ id: "san-francisco-peaks", name: "San Francisco Peaks" }],
      },
    ],
  },
  {
    id: "northeast",
    name: "Northeast",
    centers: [
      {
        id: "MWAC",
        name: "Mount Washington Avalanche Center",
        zones: [{ id: "presidential-range", name: "Presidential Range" }],
      },
    ],
  },
];

export const AVAILABLE_ZONES = REGION_STRUCTURE.flatMap((region) =>
  region.centers.flatMap((center) =>
    center.zones.map((zone) => ({
      id: zone.id,
      name: zone.name,
      center: center.id,
    })),
  ),
);

export const ZONE_TO_CENTER: Record<string, string> = {};
for (const region of REGION_STRUCTURE) {
  for (const center of region.centers) {
    for (const zone of center.zones) {
      ZONE_TO_CENTER[zone.id] = center.id;
    }
  }
}

export const DEFAULT_ZONE_IDS = AVAILABLE_ZONES.filter((z) => z.center === "CNFAIC").map(
  (z) => z.id,
);
