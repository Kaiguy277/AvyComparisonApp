/**
 * NWS (National Weather Service) Forecast Zone Configuration
 *
 * Maps avalanche forecast zones to NWS mountain forecast zones and WFOs.
 * NWS zone forecasts provide elevation-specific mountain weather (e.g., "Above 10000 Ft")
 * rather than generic grid-point forecasts.
 *
 * AVG (Avalanche Weather Guidance) is a specialized NWS product with hourly tabular
 * forecasts for specific mountain locations including snow levels, QPF, snow ratios, etc.
 * Issued by ~24 mountain WFOs.
 */

export interface NwsZoneMapping {
  /** NWS public forecast zone ID (e.g., 'COZ068') */
  forecastZone: string;
  /** NWS Weather Forecast Office code (e.g., 'BOU') */
  wfo: string;
}

/**
 * Maps avalanche zone IDs → NWS forecast zone + WFO.
 * Zone forecasts fetched via: GET /zones/forecast/{forecastZone}/forecast
 * AVG products fetched via: GET /products/types/AVG/locations/{wfo}
 */
export const NWS_ZONE_MAP: Record<string, NwsZoneMapping> = {
  // ===================================================================
  // ALASKA - CNFAIC (Chugach National Forest Avalanche Info Center)
  // ===================================================================
  'turnagain-girdwood': { forecastZone: 'AKZ727', wfo: 'AFC' },  // Turnagain Pass
  'summit':             { forecastZone: 'AKZ725', wfo: 'AFC' },  // Southern Kenai Mtns
  'seward':             { forecastZone: 'AKZ725', wfo: 'AFC' },  // Southern Kenai Mtns
  'chugach-state-park': { forecastZone: 'AKZ702', wfo: 'AFC' },  // Anchorage Hillside / Eagle River

  // ALASKA - HPAC (Hatcher Pass Avalanche Center)
  'hatcher-pass': { forecastZone: 'AKZ712', wfo: 'AFC' },  // Hatcher Pass

  // ALASKA - VAC (Valdez Avalanche Center)
  'valdez-maritime':      { forecastZone: 'AKZ731', wfo: 'AFC' },  // Valdez
  'valdez-intermountain': { forecastZone: 'AKZ732', wfo: 'AFC' },  // Thompson Pass
  'valdez-continental':   { forecastZone: 'AKZ732', wfo: 'AFC' },  // Thompson Pass

  // ALASKA - EARAC (Eastern Alaska Range Avalanche Center)
  'earac-north': { forecastZone: 'AKZ850', wfo: 'AFG' },  // Eastern AK Range South of Trims Camp
  'earac-south': { forecastZone: 'AKZ850', wfo: 'AFG' },  // Eastern AK Range South of Trims Camp

  // ALASKA - CAAC (Coastal Alaska Avalanche Center)
  'douglas-island':  { forecastZone: 'AKZ325', wfo: 'AJK' },  // City and Borough of Juneau
  'juneau-mainland': { forecastZone: 'AKZ325', wfo: 'AJK' },  // City and Borough of Juneau

  // ALASKA - HAC (Haines Avalanche Center)
  'haines-lutak':        { forecastZone: 'AKZ319', wfo: 'AJK' },  // Haines Borough and Klukwan
  'haines-transitional': { forecastZone: 'AKZ319', wfo: 'AJK' },  // Haines Borough and Klukwan
  'haines-chilkat-pass': { forecastZone: 'AKZ319', wfo: 'AJK' },  // Haines Borough and Klukwan

  // ALASKA - CAC (Cordova Avalanche Center)
  'cordova': { forecastZone: 'AKZ735', wfo: 'AFC' },  // Cordova

  // ===================================================================
  // WASHINGTON - NWAC (Northwest Avalanche Center)
  // ===================================================================
  'olympics':          { forecastZone: 'WAZ328', wfo: 'SEW' },  // Olympics
  'west-slopes-north': { forecastZone: 'WAZ301', wfo: 'SEW' },  // Cascades of Whatcom and Skagit Counties
  'west-slopes-central': { forecastZone: 'WAZ305', wfo: 'SEW' },  // West Slopes of the Central Cascades
  'west-slopes-south': { forecastZone: 'WAZ304', wfo: 'SEW' },  // Cascades of Pierce and Lewis Counties
  'stevens-pass':      { forecastZone: 'WAZ302', wfo: 'SEW' },  // Cascades of Snohomish/King Counties (pass summit)
  'snoqualmie-pass':   { forecastZone: 'WAZ303', wfo: 'SEW' },  // Cascades of Southern King County
  'east-slopes-north': { forecastZone: 'WAZ049', wfo: 'OTX' },  // Western Okanogan County
  'east-slopes-central': { forecastZone: 'WAZ047', wfo: 'OTX' },  // Central Chelan County
  'east-slopes-south': { forecastZone: 'WAZ522', wfo: 'OTX' },  // Upper Slopes Eastern WA Cascades Crest

  // ===================================================================
  // OREGON
  // ===================================================================
  // NWAC - Mt Hood
  'mt-hood': { forecastZone: 'ORZ126', wfo: 'PQR' },  // North Oregon Cascades

  // COAA (Central Oregon Avalanche Association)
  'central-cascades': { forecastZone: 'ORZ509', wfo: 'PDT' },  // East Slopes Oregon Cascades (Three Sisters/Bachelor)
  'newberry':         { forecastZone: 'ORZ509', wfo: 'PDT' },  // East Slopes of the Oregon Cascades

  // WAC (Wallowa Avalanche Center)
  'northern-wallowas': { forecastZone: 'ORZ050', wfo: 'PDT' },  // Wallowa County
  'southern-wallowas': { forecastZone: 'ORZ050', wfo: 'PDT' },  // Wallowa County
  'blues':             { forecastZone: 'ORZ502', wfo: 'PDT' },  // Northern Blue Mountains of Oregon
  'elkhorns':          { forecastZone: 'ORZ502', wfo: 'PDT' },  // Northern Blue Mountains of Oregon

  // SOAIX (Southern Oregon Avalanche Center)
  'southern-oregon': { forecastZone: 'ORZ028', wfo: 'MFR' },  // Siskiyou Mountains and Southern Oregon Cascades

  // ===================================================================
  // CALIFORNIA
  // ===================================================================
  // MSAC (Mt Shasta Avalanche Center)
  'mount-shasta': { forecastZone: 'CAZ083', wfo: 'MFR' },  // North Central/SE Siskiyou County (Mt Shasta area)

  // SAC (Sierra Avalanche Center)
  'central-sierra-nevada': { forecastZone: 'CAZ069', wfo: 'STO' },  // West Slope Northern Sierra Nevada

  // ESAC (Eastern Sierra Avalanche Center)
  'eastside-region': { forecastZone: 'CAZ073', wfo: 'REV' },  // Mono County

  // BAC (Bridgeport Avalanche Center)
  'bridgeport': { forecastZone: 'CAZ069', wfo: 'STO' },  // West Slope Northern Sierra Nevada (Sonora Pass)

  // ===================================================================
  // IDAHO - SNFAC (Sawtooth National Forest Avalanche Center)
  // ===================================================================
  'banner-summit':                 { forecastZone: 'IDZ013', wfo: 'BOI' },  // Boise Mountains
  'galena-summit-eastern-mtns':    { forecastZone: 'IDZ073', wfo: 'PIH' },  // Sun Valley Region
  'sawtooth-western-smoky-mtns':   { forecastZone: 'IDZ072', wfo: 'PIH' },  // Sawtooth/Stanley Basin
  'soldier-wood-river-valley-mtns': { forecastZone: 'IDZ073', wfo: 'PIH' },  // Sun Valley Region

  // IDAHO - PAC (Payette Avalanche Center)
  'salmon-river-mountains': { forecastZone: 'IDZ011', wfo: 'BOI' },  // West Central Mountains
  'west-mountains':         { forecastZone: 'IDZ011', wfo: 'BOI' },  // West Central Mountains

  // IDAHO/MONTANA - IPAC (Idaho Panhandle Avalanche Center)
  'selkirk-mountains':                  { forecastZone: 'IDZ001', wfo: 'OTX' },  // Northern Panhandle
  'west-cabinet-mountains':             { forecastZone: 'IDZ004', wfo: 'OTX' },  // Central Panhandle Mountains
  'east-cabinet-mountains':             { forecastZone: 'MTZ001', wfo: 'MSO' },  // Kootenai/Cabinet Region
  'silver-valley-bitterroot-mountains': { forecastZone: 'IDZ004', wfo: 'OTX' },  // Central Panhandle Mountains
  'purcell-mountains':                  { forecastZone: 'MTZ001', wfo: 'MSO' },  // Kootenai/Cabinet Region

  // ===================================================================
  // MONTANA - GNFAC (Gallatin National Forest Avalanche Center)
  // ===================================================================
  'bridger-range':           { forecastZone: 'MTZ320', wfo: 'TFX' },  // Big Belt, Bridger and Castle Mountains
  'northern-gallatin-range': { forecastZone: 'MTZ330', wfo: 'TFX' },  // Gallatin/Madison County Mountains
  'southern-gallatin-range': { forecastZone: 'MTZ330', wfo: 'TFX' },  // Gallatin/Madison County Mountains
  'northern-madison-range':  { forecastZone: 'MTZ330', wfo: 'TFX' },  // Gallatin/Madison County Mountains
  'southern-madison-range':  { forecastZone: 'MTZ330', wfo: 'TFX' },  // Gallatin/Madison County Mountains
  'lionhead-area':           { forecastZone: 'MTZ330', wfo: 'TFX' },  // Gallatin/Madison County Mountains
  'island-park':             { forecastZone: 'IDZ066', wfo: 'PIH' },  // Centennial Mountains / Island Park
  'cooke-city':              { forecastZone: 'MTZ067', wfo: 'BYZ' },  // Absaroka/Beartooth Mountains

  // MONTANA - FAC (Flathead Avalanche Center)
  'whitefish-range':          { forecastZone: 'MTZ002', wfo: 'MSO' },  // West Glacier Region
  'swan-range':               { forecastZone: 'MTZ002', wfo: 'MSO' },  // West Glacier Region
  'flathead-range-glacier-np': { forecastZone: 'MTZ002', wfo: 'MSO' },  // West Glacier Region

  // MONTANA - WCMAC (West Central Montana Avalanche Center)
  'bitterroot':  { forecastZone: 'MTZ006', wfo: 'MSO' },  // Bitterroot/Sapphire Mountains
  'rattlesnake': { forecastZone: 'MTZ043', wfo: 'MSO' },  // Potomac/Seeley Lake Region
  'seeley-lake': { forecastZone: 'MTZ043', wfo: 'MSO' },  // Potomac/Seeley Lake Region

  // ===================================================================
  // WYOMING - BTAC (Bridger-Teton Avalanche Center)
  // ===================================================================
  'tetons':                      { forecastZone: 'WYZ012', wfo: 'RIW' },  // Teton and Gros Ventre Mountains
  'togwotee-pass':               { forecastZone: 'WYZ012', wfo: 'RIW' },  // Teton and Gros Ventre Mountains
  'snake-river-range':           { forecastZone: 'WYZ012', wfo: 'RIW' },  // Teton and Gros Ventre Mountains
  'salt-river-wyoming-ranges':   { forecastZone: 'WYZ024', wfo: 'RIW' },  // Salt River and Wyoming Ranges

  // WYOMING - EWYAIX
  'big-horns':    { forecastZone: 'WYZ198', wfo: 'BYZ' },  // Northeast Bighorn Mountains
  'snowy-range':  { forecastZone: 'WYZ114', wfo: 'CYS' },  // Snowy Range
  'sierra-madre': { forecastZone: 'WYZ112', wfo: 'CYS' },  // Sierra Madre Range

  // ===================================================================
  // UTAH - UAC (Utah Avalanche Center)
  // ===================================================================
  'logan':     { forecastZone: 'UTZ110', wfo: 'SLC' },  // Wasatch Mountains I-80 North
  'ogden':     { forecastZone: 'UTZ110', wfo: 'SLC' },  // Wasatch Mountains I-80 North
  'salt-lake': { forecastZone: 'UTZ111', wfo: 'SLC' },  // Wasatch Mountains South of I-80
  'provo':     { forecastZone: 'UTZ111', wfo: 'SLC' },  // Wasatch Mountains South of I-80
  'uintas':    { forecastZone: 'UTZ112', wfo: 'SLC' },  // Western Uinta Mountains
  'skyline':   { forecastZone: 'UTZ113', wfo: 'SLC' },  // Wasatch Plateau/Book Cliffs
  'moab':      { forecastZone: 'UTZ028', wfo: 'GJT' },  // La Sal and Abajo Mountains
  'abajos':    { forecastZone: 'UTZ028', wfo: 'GJT' },  // La Sal and Abajo Mountains
  'southwest': { forecastZone: 'UTZ125', wfo: 'SLC' },  // Southern Mountains

  // ===================================================================
  // COLORADO - CAIC (Colorado Avalanche Information Center)
  // ===================================================================
  'caic-front-range-north':   { forecastZone: 'COZ033', wfo: 'BOU' },  // S/E Jackson/Larimer Above 9000 Feet
  'caic-front-range-boulder': { forecastZone: 'COZ034', wfo: 'BOU' },  // Summit/Clear Creek/Boulder Above 9000 Feet
  'caic-front-range-south':   { forecastZone: 'COZ082', wfo: 'PUB' },  // Pikes Peak above 11000 Ft
  'caic-vail-summit-county':  { forecastZone: 'COZ034', wfo: 'BOU' },  // Summit County Above 9000 Feet
  'caic-elk-mountains':       { forecastZone: 'COZ010', wfo: 'GJT' },  // Gore and Elk Mountains
  'caic-sawatch-range':       { forecastZone: 'COZ060', wfo: 'PUB' },  // Eastern Sawatch Mountains above 11000 Ft
  'caic-grand-mesa-west-elk': { forecastZone: 'COZ012', wfo: 'GJT' },  // West Elk and Sawatch Mountains
  'caic-park-range':          { forecastZone: 'COZ004', wfo: 'GJT' },  // Elkhead and Park Mountains
  'caic-northern-san-juan':   { forecastZone: 'COZ018', wfo: 'GJT' },  // Northwestern San Juan Mountains
  'caic-southern-san-juan':   { forecastZone: 'COZ068', wfo: 'PUB' },  // Eastern San Juan Mountains Above 10000 Ft
  'caic-sangre-de-cristo':    { forecastZone: 'COZ073', wfo: 'PUB' },  // Northern Sangre de Cristo above 11000 Ft

  // ===================================================================
  // NEW MEXICO - TAC (Taos Avalanche Center)
  // ===================================================================
  'northern-new-mexico': { forecastZone: 'NMZ213', wfo: 'ABQ' },  // Northern Sangre de Cristo Mountains

  // ===================================================================
  // ARIZONA - KPAC (Kachina Peaks Avalanche Center)
  // ===================================================================
  'san-francisco-peaks': { forecastZone: 'AZZ015', wfo: 'FGZ' },  // Western Mogollon Rim

  // ===================================================================
  // NEW HAMPSHIRE - MWAC (Mount Washington Avalanche Center)
  // ===================================================================
  'presidential-range': { forecastZone: 'NHZ002', wfo: 'GYX' },  // Southern Coos (Presidential Range)
};

/**
 * Maps avalanche center IDs → WFO codes that issue AVG products for that area.
 * Multiple WFOs may cover a single center's zones.
 * AVG products fetched via: GET /products/types/AVG/locations/{wfo}
 */
export const CENTER_AVG_WFOS: Record<string, string[]> = {
  // Alaska
  'CNFAIC': ['AFC'],
  'HPAC':   ['AFC'],
  'VAC':    ['AFC'],
  'EARAC':  ['AFG'],
  'CAAC':   ['AJK'],
  'HAC':    ['AJK'],
  'CAC':    ['AFC'],
  // Washington / Oregon
  'NWAC':   ['SEW', 'OTX', 'PQR'],
  'WAC':    ['PDT'],
  'COAA':   ['PQR'],
  'SOAIX':  ['MFR'],
  'MSAC':   ['MFR'],
  // Idaho
  'SNFAC':  ['BOI', 'PIH'],
  'PAC':    ['BOI'],
  'IPAC':   ['MSO', 'OTX'],
  // Montana
  'FAC':    ['MSO'],
  'WCMAC':  ['MSO'],
  'GNFAC':  ['TFX', 'BYZ'],
  // Wyoming
  'BTAC':   ['RIW'],
  'EWYAIX': ['BYZ', 'CYS'],
  // Utah
  'UAC':    ['SLC'],
  // Colorado
  'CAIC':   ['BOU', 'GJT', 'PUB'],
  // California
  'SAC':    ['STO', 'REV'],
  'ESAC':   ['REV'],
  'BAC':    ['REV'],
  // New Mexico / Arizona
  'TAC':    ['ABQ'],
  'KPAC':   ['FGZ'],
  // New England
  'MWAC':   ['GYX'],
};

/**
 * Get the NWS zone mapping for an avalanche zone.
 */
export function getNwsZoneMapping(zoneId: string): NwsZoneMapping | null {
  return NWS_ZONE_MAP[zoneId] || null;
}

/**
 * Get the WFO codes that issue AVG products for a given avalanche center.
 */
export function getAvgWfos(centerId: string): string[] {
  return CENTER_AVG_WFOS[centerId] || [];
}
