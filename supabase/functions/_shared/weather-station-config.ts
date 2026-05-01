/**
 * Weather Station Configuration for Avalanche Zones
 * Maps Synoptic weather stations to avalanche forecast zones
 *
 * Updated 2026-03-15: Comprehensive review of all zone-station mappings
 * against actual avalanche center weather station pages.
 */

export interface WeatherStation {
  triplet: string;      // Synoptic STID (station identifier)
  name: string;
  elevation: number;    // feet
  latitude: number;
  longitude: number;
  primary: boolean;     // all stations are primary (displayed on zone cards)
}

export interface ZoneStationConfig {
  zoneId: string;      // matches zone IDs in avalanche-summary
  stations: WeatherStation[];
}

// Synoptic station mappings for each avalanche zone
export const WEATHER_STATION_CONFIG: ZoneStationConfig[] = [
  // ===================================================================
  // CNFAIC - Chugach National Forest Avalanche Information Center (AK)
  // ===================================================================
  {
    zoneId: 'turnagain-girdwood',
    stations: [
      {
        triplet: 'SNBA2',
        name: 'SUNBURST',
        elevation: 3799,
        latitude: 60.7583,
        longitude: -149.1789,
        primary: true,
      },
      {
        triplet: 'SERA2',
        name: 'SEATTLE RIDGE',
        elevation: 2400,
        latitude: 60.8332,
        longitude: -149.1602,
        primary: true,
      },
      {
        triplet: 'TUGA2',
        name: 'TURNAGAIN PASS',
        elevation: 1880,
        latitude: 60.78043,
        longitude: -149.18325,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'summit',
    stations: [
      {
        triplet: 'SUUA2',
        name: 'SUMMIT CREEK',
        elevation: 1400,
        latitude: 60.61713,
        longitude: -149.53128,
        primary: true,
      },
      {
        triplet: 'TUGA2',
        name: 'TURNAGAIN PASS',
        elevation: 1880,
        latitude: 60.78043,
        longitude: -149.18325,
        primary: true,
      },
      {
        triplet: 'TNCA2',
        name: 'TINCAN SNOLITE',
        elevation: 3370,
        latitude: 60.75,
        longitude: -149.13,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'seward',
    stations: [
      {
        triplet: 'EXGA2',
        name: 'EXIT GLACIER',
        elevation: 400,
        latitude: 60.19033,
        longitude: -149.62117,
        primary: true,
      },
      {
        triplet: 'PEDA2',
        name: 'PEDERSEN LAGOON',
        elevation: 625,
        latitude: 59.8944,
        longitude: -149.7307,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'chugach-state-park',
    stations: [
      {
        triplet: 'HILA2',
        name: 'ANCHORAGE HILLSIDE',
        elevation: 2080,
        latitude: 61.11312,
        longitude: -149.6835,
        primary: true,
      },
      {
        triplet: 'MORA2',
        name: 'MORAINE',
        elevation: 2100,
        latitude: 61.37727,
        longitude: -148.99917,
        primary: true,
      },
      {
        triplet: 'AYSA2',
        name: 'ALYESKA SUMMIT',
        elevation: 3664,
        latitude: 60.9563,
        longitude: -149.0632,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // HPAC - Hatcher Pass Avalanche Center (AK)
  // ===================================================================
  {
    zoneId: 'hatcher-pass',
    stations: [
      {
        triplet: 'HATA2',
        name: 'INDEPENDENCE MINE',
        elevation: 3550,
        latitude: 61.79117,
        longitude: -149.27967,
        primary: true,
      },
      {
        triplet: 'FBBA2',
        name: 'FROSTBITE BOTTOM',
        elevation: 2700,
        latitude: 61.75,
        longitude: -149.27,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // VAC - Valdez Avalanche Center (AK)
  // ===================================================================
  {
    zoneId: 'valdez-maritime',
    stations: [
      {
        triplet: 'NVSA2',
        name: 'Nicks Valley',
        elevation: 4280,
        latitude: 61.16371,
        longitude: -145.64091,
        primary: true,
      },
      {
        triplet: 'UPPA2',
        name: 'UPPER TSAINA RIVER',
        elevation: 1750,
        latitude: 61.19112,
        longitude: -145.64807,
        primary: true,
      },
      {
        triplet: 'RSCA2',
        name: 'Richardson Highway @ Stuart Creek MP 45',
        elevation: 1217,
        latitude: 61.26066,
        longitude: -145.2838,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'valdez-intermountain',
    stations: [
      {
        triplet: 'NVSA2',
        name: 'Nicks Valley',
        elevation: 4280,
        latitude: 61.16371,
        longitude: -145.64091,
        primary: true,
      },
      {
        triplet: 'UPPA2',
        name: 'UPPER TSAINA RIVER',
        elevation: 1750,
        latitude: 61.19112,
        longitude: -145.64807,
        primary: true,
      },
      {
        triplet: 'RSCA2',
        name: 'Richardson Highway @ Stuart Creek MP 45',
        elevation: 1217,
        latitude: 61.26066,
        longitude: -145.2838,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'valdez-continental',
    stations: [
      {
        triplet: 'NVSA2',
        name: 'Nicks Valley',
        elevation: 4280,
        latitude: 61.16371,
        longitude: -145.64091,
        primary: true,
      },
      {
        triplet: 'UPPA2',
        name: 'UPPER TSAINA RIVER',
        elevation: 1750,
        latitude: 61.19112,
        longitude: -145.64807,
        primary: true,
      },
      {
        triplet: 'RSCA2',
        name: 'Richardson Highway @ Stuart Creek MP 45',
        elevation: 1217,
        latitude: 61.26066,
        longitude: -145.2838,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // EARAC - Eastern Alaska Range Avalanche Center (AK)
  // ===================================================================
  {
    zoneId: 'earac-north',
    stations: [
      {
        triplet: 'AGW01',
        name: 'Gulkana Glacier',
        elevation: 5906,
        latitude: 63.3,
        longitude: -145.4,
        primary: true,
      },
      {
        triplet: 'LESA2',
        name: 'LOOK EYRIE',
        elevation: 5040,
        latitude: 63.32192,
        longitude: -145.59656,
        primary: true,
      },
      {
        triplet: 'FLDA2',
        name: 'FIELDING LAKE',
        elevation: 3000,
        latitude: 63.20267,
        longitude: -145.6305,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'earac-south',
    stations: [
      {
        triplet: 'AGW01',
        name: 'Gulkana Glacier',
        elevation: 5906,
        latitude: 63.3,
        longitude: -145.4,
        primary: true,
      },
      {
        triplet: 'LESA2',
        name: 'LOOK EYRIE',
        elevation: 5040,
        latitude: 63.32192,
        longitude: -145.59656,
        primary: true,
      },
      {
        triplet: 'FLDA2',
        name: 'FIELDING LAKE',
        elevation: 3000,
        latitude: 63.20267,
        longitude: -145.6305,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // CAAC - Coastal Alaska Avalanche Center (Juneau)
  // ===================================================================
  {
    zoneId: 'douglas-island',
    stations: [
      {
        triplet: 'PPSA2',
        name: 'POWDER PATCH EAGLEREST',
        elevation: 2198,
        latitude: 58.262,
        longitude: -134.517,
        primary: true,
      },
      {
        triplet: 'DCSA2',
        name: 'DAVIES CREEK',
        elevation: 2065,
        latitude: 58.7,
        longitude: -134.86,
        primary: true,
      },
      {
        triplet: 'JTMA2',
        name: 'Mount Roberts Tram - Juneau',
        elevation: 1736,
        latitude: 58.2971,
        longitude: -134.386,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'juneau-mainland',
    stations: [
      {
        triplet: 'PPSA2',
        name: 'POWDER PATCH EAGLEREST',
        elevation: 2198,
        latitude: 58.262,
        longitude: -134.517,
        primary: true,
      },
      {
        triplet: 'DCSA2',
        name: 'DAVIES CREEK',
        elevation: 2065,
        latitude: 58.7,
        longitude: -134.86,
        primary: true,
      },
      {
        triplet: 'JTMA2',
        name: 'Mount Roberts Tram - Juneau',
        elevation: 1736,
        latitude: 58.2971,
        longitude: -134.386,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // HAC - Haines Avalanche Center (AK)
  // ===================================================================
  {
    zoneId: 'haines-lutak',
    stations: [
      {
        triplet: 'TKHA2',
        name: 'Takshanuk Mountains',
        elevation: 4364,
        latitude: 59.3935,
        longitude: -135.80955,
        primary: true,
      },
      {
        triplet: 'RRWA2',
        name: 'RIPINSKI RIDGE WEATHER STATION',
        elevation: 2600,
        latitude: 59.2596,
        longitude: -135.4942,
        primary: true,
      },
      {
        triplet: 'FLOA2',
        name: 'FLOWER MOUNTAIN',
        elevation: 2500,
        latitude: 59.4,
        longitude: -136.2833,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'haines-transitional',
    stations: [
      {
        triplet: 'TKHA2',
        name: 'Takshanuk Mountains',
        elevation: 4364,
        latitude: 59.3935,
        longitude: -135.80955,
        primary: true,
      },
      {
        triplet: 'RRWA2',
        name: 'RIPINSKI RIDGE WEATHER STATION',
        elevation: 2600,
        latitude: 59.2596,
        longitude: -135.4942,
        primary: true,
      },
      {
        triplet: 'FLOA2',
        name: 'FLOWER MOUNTAIN',
        elevation: 2500,
        latitude: 59.4,
        longitude: -136.2833,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'haines-chilkat-pass',
    stations: [
      {
        triplet: 'TKHA2',
        name: 'Takshanuk Mountains',
        elevation: 4364,
        latitude: 59.3935,
        longitude: -135.80955,
        primary: true,
      },
      {
        triplet: 'RRWA2',
        name: 'RIPINSKI RIDGE WEATHER STATION',
        elevation: 2600,
        latitude: 59.2596,
        longitude: -135.4942,
        primary: true,
      },
      {
        triplet: 'FLOA2',
        name: 'FLOWER MOUNTAIN',
        elevation: 2500,
        latitude: 59.4,
        longitude: -136.2833,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // NWAC - Northwest Avalanche Center (WA/OR)
  // ===================================================================
  {
    zoneId: 'olympics',
    stations: [
      {
        triplet: 'HUR53',
        name: 'Hurricane Ridge',
        elevation: 5250,
        latitude: 47.9704,
        longitude: -123.49933,
        primary: true,
      },
      {
        triplet: 'WHSW1',
        name: 'WATERHOLE',
        elevation: 5010,
        latitude: 47.94485,
        longitude: -123.42594,
        primary: true,
      },
      {
        triplet: 'BKHW1',
        name: 'BUCKINGHORSE',
        elevation: 4870,
        latitude: 47.7086,
        longitude: -123.45747,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'west-slopes-north',
    stations: [
      {
        triplet: 'MTB50',
        name: 'Mt. Baker - Pan Dome',
        elevation: 5020,
        latitude: 48.85305,
        longitude: -121.67720,
        primary: true,
      },
      {
        triplet: 'MNOW1',
        name: 'MF NOOKSACK',
        elevation: 4970,
        latitude: 48.82453,
        longitude: -121.92951,
        primary: true,
      },
      {
        triplet: 'WCSW1',
        name: 'WELLS CREEK',
        elevation: 4030,
        latitude: 48.8661,
        longitude: -121.78976,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'west-slopes-central',
    stations: [
      {
        triplet: 'KUSW1',
        name: 'SKOOKUM CREEK',
        elevation: 3310,
        latitude: 47.68433,
        longitude: -121.61007,
        primary: true,
      },
      {
        triplet: 'EPSW1',
        name: 'EASY PASS',
        elevation: 5270,
        latitude: 48.85933,
        longitude: -121.43895,
        primary: true,
      },
      {
        triplet: 'STS48',
        name: 'Stevens Pass Grace Lakes',
        elevation: 4800,
        latitude: 47.75,
        longitude: -121.09,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'west-slopes-south',
    stations: [
      {
        triplet: 'CMT69',
        name: 'Crystal Summit',
        elevation: 6830,
        latitude: 46.93505,
        longitude: -121.50043,
        primary: true,
      },
      {
        triplet: 'PVC54',
        name: 'Paradise',
        elevation: 5400,
        latitude: 46.78622,
        longitude: -121.74240,
        primary: true,
      },
      {
        triplet: 'WPS58',
        name: 'White Pass Upper',
        elevation: 5800,
        latitude: 46.62077,
        longitude: -121.38737,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'stevens-pass',
    stations: [
      {
        triplet: 'STS40',
        name: 'Stevens Pass Schmidt Haus',
        elevation: 3950,
        latitude: 47.746,
        longitude: -121.093,
        primary: true,
      },
      {
        triplet: 'STS52',
        name: 'Stevens Pass Skyline',
        elevation: 5200,
        latitude: 47.75,
        longitude: -121.09,
        primary: true,
      },
      {
        triplet: 'STS48',
        name: 'Stevens Pass Grace Lakes',
        elevation: 4800,
        latitude: 47.75,
        longitude: -121.09,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'snoqualmie-pass',
    stations: [
      {
        triplet: 'ALP44',
        name: 'Alpental Mid-Mountain',
        elevation: 4400,
        latitude: 47.44,
        longitude: -121.43,
        primary: true,
      },
      {
        triplet: 'SNO30',
        name: 'Snoqualmie Pass',
        elevation: 3010,
        latitude: 47.43,
        longitude: -121.41,
        primary: true,
      },
      {
        triplet: 'MTW43',
        name: 'Mt Washington',
        elevation: 4300,
        latitude: 47.39,
        longitude: -121.41,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'east-slopes-north',
    stations: [
      {
        triplet: 'HRPW1',
        name: 'HARTS PASS',
        elevation: 6490,
        latitude: 48.71047,
        longitude: -120.6586,
        primary: true,
      },
      {
        triplet: 'WAP55',
        name: 'Washington Pass Base',
        elevation: 5450,
        latitude: 48.52578,
        longitude: -120.65525,
        primary: true,
      },
      {
        triplet: 'SWSW1',
        name: 'SWAMP CREEK',
        elevation: 3930,
        latitude: 48.57142,
        longitude: -120.78267,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'east-slopes-central',
    stations: [
      {
        triplet: 'MSR52',
        name: 'Mission Ridge Mid-Mountain',
        elevation: 5160,
        latitude: 47.28598,
        longitude: -120.41082,
        primary: true,
      },
      {
        triplet: 'TRGW1',
        name: 'TROUGH',
        elevation: 5480,
        latitude: 47.23328,
        longitude: -120.29412,
        primary: true,
      },
      {
        triplet: 'GRCW1',
        name: 'GROUSE CAMP',
        elevation: 5390,
        latitude: 47.28107,
        longitude: -120.48771,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'east-slopes-south',
    stations: [
      {
        triplet: 'WPS58',
        name: 'White Pass Upper',
        elevation: 5800,
        latitude: 46.62077,
        longitude: -121.38737,
        primary: true,
      },
      {
        triplet: 'LOHW1',
        name: 'LOST HORSE',
        elevation: 5120,
        latitude: 46.3575,
        longitude: -121.08095,
        primary: true,
      },
      {
        triplet: 'CHP55',
        name: 'Chinook Pass',
        elevation: 5500,
        latitude: 46.87,
        longitude: -121.52,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'mt-hood',
    stations: [
      {
        triplet: 'MTHO3',
        name: 'Mt Hood Test Site SNOTEL',
        elevation: 5380,
        latitude: 45.32,
        longitude: -121.72,
        primary: true,
      },
      {
        triplet: 'GVT50',
        name: 'Skibowl Summit',
        elevation: 5010,
        latitude: 45.28857,
        longitude: -121.78275,
        primary: true,
      },
      {
        triplet: 'FFMO3',
        name: 'FIFTEENMILE',
        elevation: 5970,
        latitude: 45.35,
        longitude: -121.53,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // COAA - Central Oregon Avalanche Association (OR)
  // ===================================================================
  {
    zoneId: 'central-cascades',
    stations: [
      {
        triplet: 'BEDO3',
        name: 'IRISH TAYLOR',
        elevation: 5540,
        latitude: 43.80368,
        longitude: -121.94793,
        primary: true,
      },
      {
        triplet: 'TCMO3',
        name: 'THREE CREEKS MEADOW',
        elevation: 5690,
        latitude: 44.14425,
        longitude: -121.64095,
        primary: true,
      },
      {
        triplet: 'RORO3',
        name: 'ROARING RIVER',
        elevation: 4950,
        latitude: 43.90098,
        longitude: -122.03063,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'newberry',
    stations: [
      {
        triplet: 'BEDO3',
        name: 'IRISH TAYLOR',
        elevation: 5540,
        latitude: 43.80368,
        longitude: -121.94793,
        primary: true,
      },
      {
        triplet: 'TCMO3',
        name: 'THREE CREEKS MEADOW',
        elevation: 5690,
        latitude: 44.14425,
        longitude: -121.64095,
        primary: true,
      },
      {
        triplet: 'CSTO3',
        name: 'CASCADE SUMMIT',
        elevation: 5100,
        latitude: 43.59042,
        longitude: -122.0601,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // WAC - Wallowa Avalanche Center (OR)
  // ===================================================================
  {
    zoneId: 'northern-wallowas',
    stations: [
      {
        triplet: 'TYLO3',
        name: 'TAYLOR GREEN',
        elevation: 5740,
        latitude: 45.07707,
        longitude: -117.55067,
        primary: true,
      },
      {
        triplet: 'MHWO3',
        name: 'MT. HOWARD',
        elevation: 7910,
        latitude: 45.26522,
        longitude: -117.17373,
        primary: true,
      },
      {
        triplet: 'ANRO3',
        name: 'ANEROID LAKE #2',
        elevation: 7400,
        latitude: 45.21328,
        longitude: -117.19258,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'southern-wallowas',
    stations: [
      {
        triplet: 'TYLO3',
        name: 'TAYLOR GREEN',
        elevation: 5740,
        latitude: 45.07707,
        longitude: -117.55067,
        primary: true,
      },
      {
        triplet: 'ANRO3',
        name: 'ANEROID LAKE #2',
        elevation: 7400,
        latitude: 45.21328,
        longitude: -117.19258,
        primary: true,
      },
      {
        triplet: 'BORO3',
        name: 'BOURNE',
        elevation: 5850,
        latitude: 44.83052,
        longitude: -118.18787,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'elkhorns',
    stations: [
      {
        triplet: 'BORO3',
        name: 'BOURNE',
        elevation: 5850,
        latitude: 44.83052,
        longitude: -118.18787,
        primary: true,
      },
      {
        triplet: 'WFCO3',
        name: 'WOLF CREEK',
        elevation: 5630,
        latitude: 45.06703,
        longitude: -118.15192,
        primary: true,
      },
      {
        triplet: 'EIMO3',
        name: 'EILERTSON MEADOWS',
        elevation: 5510,
        latitude: 44.86887,
        longitude: -118.11387,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'blues',
    stations: [
      {
        triplet: 'BLPO3',
        name: 'BLUE MOUNTAIN SPRING',
        elevation: 5870,
        latitude: 44.24767,
        longitude: -118.51722,
        primary: true,
      },
      {
        triplet: 'BORO3',
        name: 'BOURNE',
        elevation: 5850,
        latitude: 44.83052,
        longitude: -118.18787,
        primary: true,
      },
      {
        triplet: 'GLDO3',
        name: 'GOLD CENTER',
        elevation: 5410,
        latitude: 44.7638,
        longitude: -118.3117,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // SOAIX - Southern Oregon Avalanche Information Exchange (OR)
  // ===================================================================
  {
    zoneId: 'southern-oregon',
    stations: [
      {
        triplet: 'SWNO3',
        name: 'SWAN LAKE MTN',
        elevation: 6830,
        latitude: 42.41323,
        longitude: -121.68002,
        primary: true,
      },
      {
        triplet: 'SSSO3',
        name: 'SUN PASS',
        elevation: 5400,
        latitude: 42.78637,
        longitude: -121.97715,
        primary: true,
      },
      {
        triplet: 'BCDO3',
        name: 'BILLIE CREEK DIVIDE',
        elevation: 5280,
        latitude: 42.40717,
        longitude: -122.26617,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // SAC - Sierra Avalanche Center (CA)
  // ===================================================================
  {
    zoneId: 'central-sierra-nevada',
    stations: [
      {
        triplet: 'ILKC1',
        name: 'INDEPENDENCE LAKE',
        elevation: 8337,
        latitude: 39.42752,
        longitude: -120.31342,
        primary: true,
      },
      {
        triplet: 'LLSC1',
        name: 'LAKE LOIS NEAR SOUTH LAKE TAHOE 10W LOS',
        elevation: 8297,
        latitude: 38.925,
        longitude: -120.19694,
        primary: true,
      },
      {
        triplet: 'SQWC1',
        name: 'Palisades Tahoe',
        elevation: 8010,
        latitude: 39.18986,
        longitude: -120.26576,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // ESAC - Eastern Sierra Avalanche Center (CA)
  // ===================================================================
  {
    zoneId: 'eastside-region',
    stations: [
      {
        triplet: 'TIRC1',
        name: 'TIOGA PASS ENTRY STATION',
        elevation: 10000,
        latitude: 37.91083,
        longitude: -119.25861,
        primary: true,
      },
      {
        triplet: 'RCKC1',
        name: 'ROCK CREEK LAKES',
        elevation: 9744,
        latitude: 37.458,
        longitude: -118.735,
        primary: true,
      },
      {
        triplet: 'XMPC1',
        name: 'MEAN PEAK',
        elevation: 9867,
        latitude: 38.39739,
        longitude: -119.52522,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // BAC - Bridgeport Avalanche Center (CA)
  // ===================================================================
  {
    zoneId: 'bridgeport',
    stations: [
      {
        triplet: 'XMPC1',
        name: 'MEAN PEAK',
        elevation: 9867,
        latitude: 38.39739,
        longitude: -119.52522,
        primary: true,
      },
      {
        triplet: 'MNPC1',
        name: 'MONITOR PASS',
        elevation: 8304,
        latitude: 38.668,
        longitude: -119.609,
        primary: true,
      },
      {
        triplet: 'LVTC1',
        name: 'LEAVITT MEADOWS',
        elevation: 7197,
        latitude: 38.304,
        longitude: -119.551,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // MSAC - Mount Shasta Avalanche Center (CA)
  // ===================================================================
  {
    zoneId: 'mount-shasta',
    stations: [
      {
        triplet: 'MSGRB',
        name: 'Gray Butte',
        elevation: 7958,
        latitude: 41.345,
        longitude: -122.196,
        primary: true,
      },
      {
        triplet: 'MSSKI',
        name: 'Old Ski Bowl',
        elevation: 7617,
        latitude: 41.358,
        longitude: -122.207,
        primary: true,
      },
      {
        triplet: 'SDFC1',
        name: 'Sand Flat',
        elevation: 6811,
        latitude: 41.349,
        longitude: -122.246,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // SNFAC - Sawtooth National Forest Avalanche Center (ID)
  // ===================================================================
  {
    zoneId: 'banner-summit',
    stations: [
      {
        triplet: 'BNRI1',
        name: 'BANNER SUMMIT',
        elevation: 7100,
        latitude: 44.303333,
        longitude: -115.233333,
        primary: true,
      },
      {
        triplet: 'BASI1',
        name: 'BANNER SUMMIT SNOTEL',
        elevation: 7040,
        latitude: 44.303,
        longitude: -115.233,
        primary: true,
      },
      {
        triplet: 'JKPI1',
        name: 'JACKSON PEAK',
        elevation: 7070,
        latitude: 44.05092,
        longitude: -115.44322,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'galena-summit-eastern-mtns',
    stations: [
      {
        triplet: 'GLSI1',
        name: 'GALENA SUMMIT',
        elevation: 8780,
        latitude: 43.87497,
        longitude: -114.71363,
        primary: true,
      },
      {
        triplet: 'LWDI1',
        name: 'LOST-WOOD DIVIDE SNOTEL',
        elevation: 7870,
        latitude: 43.82,
        longitude: -114.27,
        primary: true,
      },
      {
        triplet: 'VNNI1',
        name: 'VIENNA MINE',
        elevation: 8960,
        latitude: 43.79942,
        longitude: -114.85273,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'sawtooth-western-smoky-mtns',
    stations: [
      {
        triplet: 'VNNI1',
        name: 'VIENNA MINE',
        elevation: 8960,
        latitude: 43.79942,
        longitude: -114.85273,
        primary: true,
      },
      {
        triplet: 'GLSI1',
        name: 'GALENA SUMMIT',
        elevation: 8780,
        latitude: 43.87497,
        longitude: -114.71363,
        primary: true,
      },
      {
        triplet: 'ATAI1',
        name: 'ATLANTA SUMMIT',
        elevation: 7580,
        latitude: 43.7569,
        longitude: -115.23907,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'soldier-wood-river-valley-mtns',
    stations: [
      {
        triplet: 'DHDI1',
        name: 'DOLLARHIDE SUMMIT SNOTEL',
        elevation: 8390,
        latitude: 43.60,
        longitude: -114.67,
        primary: true,
      },
      {
        triplet: 'HYNI1',
        name: 'HYNDMAN SNOTEL',
        elevation: 7590,
        latitude: 43.72,
        longitude: -114.17,
        primary: true,
      },
      {
        triplet: 'VNNI1',
        name: 'VIENNA MINE',
        elevation: 8960,
        latitude: 43.79942,
        longitude: -114.85273,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // PAC - Payette Avalanche Center (ID)
  // ===================================================================
  {
    zoneId: 'salmon-river-mountains',
    stations: [
      {
        triplet: 'BKSI1',
        name: 'BIG CREEK SUMMIT',
        elevation: 6580,
        latitude: 44.62642,
        longitude: -115.7937,
        primary: true,
      },
      {
        triplet: 'DDSI1',
        name: 'DEADWOOD SUMMIT SNOTEL',
        elevation: 6990,
        latitude: 44.55,
        longitude: -115.57,
        primary: true,
      },
      {
        triplet: 'BNRI1',
        name: 'BANNER SUMMIT',
        elevation: 7100,
        latitude: 44.303333,
        longitude: -115.233333,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'west-mountains',
    stations: [
      {
        triplet: 'BRRI1',
        name: 'BRUNDAGE RESERVOIR SNOTEL',
        elevation: 6280,
        latitude: 45.05,
        longitude: -116.13,
        primary: true,
      },
      {
        triplet: 'BKSI1',
        name: 'BIG CREEK SUMMIT',
        elevation: 6580,
        latitude: 44.62642,
        longitude: -115.7937,
        primary: true,
      },
      {
        triplet: 'ITD69',
        name: 'Goose Creek Grade',
        elevation: 5417,
        latitude: 44.92944,
        longitude: -116.1555,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // IPAC - Idaho Panhandle Avalanche Center (ID/MT)
  // ===================================================================
  {
    zoneId: 'selkirk-mountains',
    stations: [
      {
        triplet: 'STZI1',
        name: 'SCHWEITZER BASIN',
        elevation: 6090,
        latitude: 48.37428,
        longitude: -116.63917,
        primary: true,
      },
      {
        triplet: 'HDLI1',
        name: 'HIDDEN LAKE',
        elevation: 5000,
        latitude: 48.894,
        longitude: -116.757,
        primary: true,
      },
      {
        triplet: 'BRMI1',
        name: 'BEAR MOUNTAIN',
        elevation: 5400,
        latitude: 48.30577,
        longitude: -116.07448,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'west-cabinet-mountains',
    stations: [
      {
        triplet: 'CHIM8',
        name: 'CHICAGO RIDGE',
        elevation: 5800,
        latitude: 48.06,
        longitude: -115.7,
        primary: true,
      },
      {
        triplet: 'BRMI1',
        name: 'BEAR MOUNTAIN',
        elevation: 5400,
        latitude: 48.30577,
        longitude: -116.07448,
        primary: true,
      },
      {
        triplet: 'MOQI1',
        name: 'MOSQUITO RIDGE',
        elevation: 5200,
        latitude: 48.05737,
        longitude: -116.23052,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'east-cabinet-mountains',
    stations: [
      {
        triplet: 'CHIM8',
        name: 'CHICAGO RIDGE',
        elevation: 5800,
        latitude: 48.06,
        longitude: -115.7,
        primary: true,
      },
      {
        triplet: 'PMNM8',
        name: 'POORMAN CREEK',
        elevation: 5050,
        latitude: 48.127,
        longitude: -115.623,
        primary: true,
      },
      {
        triplet: 'BANM8',
        name: 'BANFIELD MOUNTAIN',
        elevation: 5580,
        latitude: 48.5712,
        longitude: -115.44573,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'silver-valley-bitterroot-mountains',
    stations: [
      {
        triplet: 'LKTI1',
        name: 'LOOKOUT SNOTEL',
        elevation: 5180,
        latitude: 47.458,
        longitude: -115.706,
        primary: true,
      },
      {
        triplet: 'SNSI1',
        name: 'SUNSET',
        elevation: 5570,
        latitude: 47.555,
        longitude: -115.824,
        primary: true,
      },
      {
        triplet: 'HUGI1',
        name: 'HUMBOLDT GULCH',
        elevation: 4260,
        latitude: 47.533,
        longitude: -115.783,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'purcell-mountains',
    stations: [
      {
        triplet: 'BANM8',
        name: 'BANFIELD MOUNTAIN',
        elevation: 5580,
        latitude: 48.5712,
        longitude: -115.44573,
        primary: true,
      },
      {
        triplet: 'HAWM8',
        name: 'HAWKINS LAKE',
        elevation: 6460,
        latitude: 48.967,
        longitude: -115.950,
        primary: true,
      },
      {
        triplet: 'STAM8',
        name: 'STAHL PEAK',
        elevation: 6040,
        latitude: 48.917,
        longitude: -114.867,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // GNFAC - Gallatin National Forest Avalanche Center (MT)
  // ===================================================================
  {
    zoneId: 'bridger-range',
    stations: [
      {
        triplet: 'BRCM8',
        name: 'BRACKETT CREEK',
        elevation: 7320,
        latitude: 45.89107,
        longitude: -110.93851,
        primary: true,
      },
      {
        triplet: 'SAJM8',
        name: 'SACAJAWEA SNOTEL',
        elevation: 6550,
        latitude: 45.874,
        longitude: -110.928,
        primary: true,
      },
      {
        triplet: 'SFSM8',
        name: 'S FORK SHIELDS',
        elevation: 8100,
        latitude: 46.0896,
        longitude: -110.43363,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'northern-gallatin-range',
    stations: [
      {
        triplet: 'SHFM8',
        name: 'SHOWER FALLS SNOTEL',
        elevation: 8060,
        latitude: 45.401,
        longitude: -110.958,
        primary: true,
      },
      {
        triplet: 'LCKM8',
        name: 'LICK CREEK SNOTEL',
        elevation: 6860,
        latitude: 45.504,
        longitude: -110.966,
        primary: true,
      },
      {
        triplet: 'BRCM8',
        name: 'BRACKETT CREEK',
        elevation: 7320,
        latitude: 45.89107,
        longitude: -110.93851,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'southern-gallatin-range',
    stations: [
      {
        triplet: 'SHFM8',
        name: 'SHOWER FALLS SNOTEL',
        elevation: 8060,
        latitude: 45.401,
        longitude: -110.958,
        primary: true,
      },
      {
        triplet: 'LCKM8',
        name: 'LICK CREEK SNOTEL',
        elevation: 6860,
        latitude: 45.504,
        longitude: -110.966,
        primary: true,
      },
      {
        triplet: 'CRRM8',
        name: 'CARROT BASIN SNOTEL',
        elevation: 9000,
        latitude: 44.962,
        longitude: -111.294,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'northern-madison-range',
    stations: [
      {
        triplet: 'BSKM8',
        name: 'LONE MOUNTAIN SNOTEL',
        elevation: 8880,
        latitude: 45.274,
        longitude: -111.427,
        primary: true,
      },
      {
        triplet: 'YCTIM',
        name: 'Yellowstone Club - Timber Station',
        elevation: 9400,
        latitude: 45.23114,
        longitude: -111.45119,
        primary: true,
      },
      {
        triplet: 'YCAND',
        name: 'Yellowstone Club - Andesite Mountain',
        elevation: 8850,
        latitude: 45.26281,
        longitude: -111.40789,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'southern-madison-range',
    stations: [
      {
        triplet: 'CRRM8',
        name: 'CARROT BASIN SNOTEL',
        elevation: 9000,
        latitude: 44.962,
        longitude: -111.294,
        primary: true,
      },
      {
        triplet: 'BEVM8',
        name: 'BEAVER CREEK SNOTEL',
        elevation: 7850,
        latitude: 44.950,
        longitude: -111.359,
        primary: true,
      },
      {
        triplet: 'WYSM8',
        name: 'WEST YELLOWSTONE',
        elevation: 6700,
        latitude: 44.65866,
        longitude: -111.09199,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'lionhead-area',
    stations: [
      {
        triplet: 'MPLM8',
        name: 'MADISON PLATEAU SNOTEL',
        elevation: 7750,
        latitude: 44.583,
        longitude: -111.117,
        primary: true,
      },
      {
        triplet: 'WYSM8',
        name: 'WEST YELLOWSTONE',
        elevation: 6700,
        latitude: 44.65866,
        longitude: -111.09199,
        primary: true,
      },
      {
        triplet: 'WSKM8',
        name: 'WHISKEY CREEK SNOTEL',
        elevation: 6800,
        latitude: 44.611,
        longitude: -111.150,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'island-park',
    stations: [
      {
        triplet: 'WHEI1',
        name: 'WHITE ELEPHANT SNOTEL',
        elevation: 7710,
        latitude: 44.533,
        longitude: -111.411,
        primary: true,
      },
      {
        triplet: 'BLBM8',
        name: 'BLACK BEAR',
        elevation: 8170,
        latitude: 44.51389,
        longitude: -111.12803,
        primary: true,
      },
      {
        triplet: 'ISPI1',
        name: 'ISLAND PARK SNOTEL',
        elevation: 6290,
        latitude: 44.420,
        longitude: -111.385,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'cooke-city',
    stations: [
      {
        triplet: 'FSHM8',
        name: 'FISHER CREEK SNOTEL',
        elevation: 9100,
        latitude: 45.062,
        longitude: -109.945,
        primary: true,
      },
      {
        triplet: 'MNPM8',
        name: 'MONUMENT PEAK SNOTEL',
        elevation: 8850,
        latitude: 45.218,
        longitude: -110.237,
        primary: true,
      },
      {
        triplet: 'WHTM8',
        name: 'WHITE MILL SNOTEL',
        elevation: 8700,
        latitude: 45.046,
        longitude: -109.910,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // FAC - Flathead Avalanche Center (MT)
  // ===================================================================
  {
    zoneId: 'whitefish-range',
    stations: [
      {
        triplet: 'LKMMT',
        name: 'Link Mountain',
        elevation: 7228,
        latitude: 48.75989,
        longitude: -114.5753,
        primary: true,
      },
      {
        triplet: 'BIGMS',
        name: 'Big Mountain Summit, Whitefish Ski Resort',
        elevation: 6737,
        latitude: 48.502483,
        longitude: -114.342139,
        primary: true,
      },
      {
        triplet: 'FTMM8',
        name: 'FLATTOP MTN.',
        elevation: 6300,
        latitude: 48.80225,
        longitude: -113.85713,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'swan-range',
    stations: [
      {
        triplet: 'NOIM8',
        name: 'NOISY BASIN SNOTEL',
        elevation: 6070,
        latitude: 48.150,
        longitude: -113.950,
        primary: true,
      },
      {
        triplet: 'MSPM8',
        name: 'MOSS PEAK',
        elevation: 6780,
        latitude: 47.68493,
        longitude: -113.9623,
        primary: true,
      },
      {
        triplet: 'NFJM8',
        name: 'NORTH FORK JOCKO',
        elevation: 6330,
        latitude: 47.2726,
        longitude: -113.75617,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'flathead-range-glacier-np',
    stations: [
      {
        triplet: 'S11MT',
        name: 'BNSF Shed 11',
        elevation: 6416,
        latitude: 48.24667,
        longitude: -113.54285,
        primary: true,
      },
      {
        triplet: 'FTMM8',
        name: 'FLATTOP MTN.',
        elevation: 6300,
        latitude: 48.80225,
        longitude: -113.85713,
        primary: true,
      },
      {
        triplet: 'PICM8',
        name: 'PIKE CREEK',
        elevation: 5930,
        latitude: 48.30305,
        longitude: -113.32868,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // WCMAC - West Central Montana Avalanche Center (MT)
  // ===================================================================
  {
    zoneId: 'seeley-lake',
    stations: [
      {
        triplet: 'STTM8',
        name: 'STUART MOUNTAIN',
        elevation: 7270,
        latitude: 46.99523,
        longitude: -113.92664,
        primary: true,
      },
      {
        triplet: 'NFJM8',
        name: 'NORTH FORK JOCKO',
        elevation: 6110,
        latitude: 47.2726,
        longitude: -113.75617,
        primary: true,
      },
      {
        triplet: 'MSPM8',
        name: 'MOSS PEAK',
        elevation: 6780,
        latitude: 47.68493,
        longitude: -113.9623,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'rattlesnake',
    stations: [
      {
        triplet: 'STTM8',
        name: 'STUART MOUNTAIN',
        elevation: 7270,
        latitude: 46.99523,
        longitude: -113.92664,
        primary: true,
      },
      {
        triplet: 'NFJM8',
        name: 'NORTH FORK JOCKO',
        elevation: 6110,
        latitude: 47.2726,
        longitude: -113.75617,
        primary: true,
      },
      {
        triplet: 'NOIM8',
        name: 'NOISY BASIN SNOTEL',
        elevation: 6070,
        latitude: 48.150,
        longitude: -113.950,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'bitterroot',
    stations: [
      {
        triplet: 'SDMM8',
        name: 'SADDLE MTN SNOTEL',
        elevation: 7890,
        latitude: 45.700,
        longitude: -113.967,
        primary: true,
      },
      {
        triplet: 'LPSI1',
        name: 'LOLO PASS',
        elevation: 5240,
        latitude: 46.63448,
        longitude: -114.58072,
        primary: true,
      },
      {
        triplet: 'TWLM8',
        name: 'TWIN LAKES',
        elevation: 6400,
        latitude: 46.1438,
        longitude: -114.5056,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // BTAC - Bridger-Teton Avalanche Center (WY)
  // ===================================================================
  {
    zoneId: 'tetons',
    stations: [
      {
        triplet: 'JHR',
        name: 'JACKSON HOLE-RAYMER',
        elevation: 9657,
        latitude: 43.603815,
        longitude: -110.855884,
        primary: true,
      },
      {
        triplet: 'GTHW4',
        name: 'GRAND TARGHEE',
        elevation: 9260,
        latitude: 43.77933,
        longitude: -110.92783,
        primary: true,
      },
      {
        triplet: 'PHBW4',
        name: 'PHILLIPS BENCH',
        elevation: 8200,
        latitude: 43.51948,
        longitude: -110.91103,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'togwotee-pass',
    stations: [
      {
        triplet: 'TOGW4',
        name: 'TOGWOTEE PASS',
        elevation: 9580,
        latitude: 43.74902,
        longitude: -110.0578,
        primary: true,
      },
      {
        triplet: 'LTWW4',
        name: 'LITTLE WARM',
        elevation: 9370,
        latitude: 43.50278,
        longitude: -109.752,
        primary: true,
      },
      {
        triplet: 'TOPW4',
        name: 'TWO OCEAN PLATEAU',
        elevation: 9240,
        latitude: 44.15178,
        longitude: -110.22122,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'snake-river-range',
    stations: [
      {
        triplet: 'PHBW4',
        name: 'PHILLIPS BENCH',
        elevation: 8200,
        latitude: 43.51948,
        longitude: -110.91103,
        primary: true,
      },
      {
        triplet: 'GTHW4',
        name: 'GRAND TARGHEE',
        elevation: 9260,
        latitude: 43.77933,
        longitude: -110.92783,
        primary: true,
      },
      {
        triplet: 'INCW4',
        name: 'INDIAN CREEK SNOTEL',
        elevation: 9400,
        latitude: 42.3,
        longitude: -110.683,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'salt-river-wyoming-ranges',
    stations: [
      {
        triplet: 'SCDW4',
        name: 'SPRING CREEK DIVIDE',
        elevation: 9000,
        latitude: 42.5254,
        longitude: -110.6615,
        primary: true,
      },
      {
        triplet: 'BBSW4',
        name: 'BLIND BULL SUM',
        elevation: 8650,
        latitude: 42.964,
        longitude: -110.60973,
        primary: true,
      },
      {
        triplet: 'TRPW4',
        name: 'TRIPLE PEAK',
        elevation: 8500,
        latitude: 42.76393,
        longitude: -110.5914,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // EWYAIX - Eastern Wyoming Avalanche Info Exchange (WY)
  // ===================================================================
  {
    zoneId: 'big-horns',
    stations: [
      {
        triplet: 'CPKW4',
        name: 'CLOUD PEAK RESERVOIR',
        elevation: 9860,
        latitude: 44.40343,
        longitude: -107.06057,
        primary: true,
      },
      {
        triplet: 'BGEW4',
        name: 'BIG GOOSE',
        elevation: 7990,
        latitude: 44.57924,
        longitude: -107.20068,
        primary: true,
      },
      {
        triplet: 'SCRW4',
        name: 'SHELL CREEK',
        elevation: 9580,
        latitude: 44.50012,
        longitude: -107.42947,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'snowy-range',
    stations: [
      {
        triplet: 'BKLW4',
        name: 'BROOKLYN LAKE',
        elevation: 10240,
        latitude: 41.35885,
        longitude: -106.23209,
        primary: true,
      },
      {
        triplet: 'MBSW4',
        name: 'MED BOW',
        elevation: 10500,
        latitude: 41.37833,
        longitude: -106.34681,
        primary: true,
      },
      {
        triplet: 'WBSW4',
        name: 'WEBBER SPRINGS',
        elevation: 9250,
        latitude: 41.167,
        longitude: -106.933,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'sierra-madre',
    stations: [
      {
        triplet: 'BLHW4',
        name: 'BLACKHALL MTN',
        elevation: 9820,
        latitude: 41.05616,
        longitude: -106.71384,
        primary: true,
      },
      {
        triplet: 'C3RED',
        name: 'Red Creek',
        elevation: 8228,
        latitude: 40.77179,
        longitude: -106.98333,
        primary: true,
      },
      {
        triplet: 'OLDW4',
        name: 'OLD BATTLE',
        elevation: 10000,
        latitude: 41.15397,
        longitude: -106.96937,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // UAC - Utah Avalanche Center (UT)
  // ===================================================================
  {
    zoneId: 'logan',
    stations: [
      {
        triplet: 'CRDUT',
        name: 'Card Canyon',
        elevation: 8715,
        latitude: 41.73126,
        longitude: -111.6834,
        primary: true,
      },
      {
        triplet: 'PSINK',
        name: 'Peter Sinks',
        elevation: 8173,
        latitude: 41.91302,
        longitude: -111.51416,
        primary: true,
      },
      {
        triplet: 'WSUBC',
        name: 'WSU Bloomington Canyon Yurt',
        elevation: 7607,
        latitude: 42.17266,
        longitude: -111.55534,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'ogden',
    stations: [
      {
        triplet: 'UTPWD',
        name: 'Powder Mountain',
        elevation: 8897,
        latitude: 41.3699,
        longitude: -111.764,
        primary: true,
      },
      {
        triplet: 'CKRU1',
        name: 'CHICKEN RIDGE',
        elevation: 7648,
        latitude: 41.33156,
        longitude: -111.30341,
        primary: true,
      },
      {
        triplet: 'BLPU1',
        name: 'BEN LOMOND PEAK SNOTEL',
        elevation: 7688,
        latitude: 41.376,
        longitude: -111.944,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'salt-lake',
    stations: [
      {
        triplet: 'IFF',
        name: 'CARDIFF PEAK',
        elevation: 10059,
        latitude: 40.595,
        longitude: -111.6519,
        primary: true,
      },
      {
        triplet: 'SOL',
        name: 'SOLITUDE POWDERHORN',
        elevation: 9888,
        latitude: 40.6083,
        longitude: -111.6044,
        primary: true,
      },
      {
        triplet: 'CLN',
        name: 'ALTA COLLINS',
        elevation: 9662,
        latitude: 40.576,
        longitude: -111.638,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'provo',
    stations: [
      {
        triplet: 'BUNUT',
        name: 'Bunnells Ridge',
        elevation: 8800,
        latitude: 40.314757,
        longitude: -111.563976,
        primary: true,
      },
      {
        triplet: 'TIMU1',
        name: 'TIMPANOGOS DIVIDE SNOTEL',
        elevation: 8170,
        latitude: 40.428,
        longitude: -111.617,
        primary: true,
      },
      {
        triplet: 'CAMU1',
        name: 'CASCADE MOUNTAIN SNOTEL',
        elevation: 7747,
        latitude: 40.283,
        longitude: -111.610,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'uintas',
    stations: [
      {
        triplet: 'GSTPS',
        name: 'Upper Humpy Basin',
        elevation: 10023,
        latitude: 40.84855,
        longitude: -111.00183,
        primary: true,
      },
      {
        triplet: 'TRLU1',
        name: 'TRIAL LAKE',
        elevation: 9945,
        latitude: 40.67933,
        longitude: -110.94877,
        primary: true,
      },
      {
        triplet: 'TPRUT',
        name: 'Red Creek',
        elevation: 9369,
        latitude: 40.84404,
        longitude: -111.04269,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'skyline',
    stations: [
      {
        triplet: 'SEEU1',
        name: 'SEELEY CREEK',
        elevation: 9903,
        latitude: 39.31042,
        longitude: -111.43297,
        primary: true,
      },
      {
        triplet: 'SKY',
        name: 'Skyline',
        elevation: 9330,
        latitude: 39.6362,
        longitude: -111.3286,
        primary: true,
      },
      {
        triplet: 'ULAMB',
        name: 'Huntington Canyon Portable',
        elevation: 8731,
        latitude: 39.59591,
        longitude: -111.22164,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'moab',
    stations: [
      {
        triplet: 'GOLDB',
        name: 'Goldbasin',
        elevation: 10050,
        latitude: 38.465283,
        longitude: -109.264475,
        primary: true,
      },
      {
        triplet: 'UTLSD',
        name: 'SR-46 at MP 12.5 La Sal Divide',
        elevation: 7734,
        latitude: 38.3426,
        longitude: -109.20875,
        primary: true,
      },
      {
        triplet: 'LSMU1',
        name: 'LA SAL MOUNTAIN SNOTEL',
        elevation: 9577,
        latitude: 38.482,
        longitude: -109.272,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'abajos',
    stations: [
      {
        triplet: 'ABAUT',
        name: 'Abajo Peak',
        elevation: 11330,
        latitude: 37.841,
        longitude: -109.462,
        primary: true,
      },
      {
        triplet: 'BUCU1',
        name: 'BUCKBOARD FLAT',
        elevation: 8923,
        latitude: 37.86943,
        longitude: -109.44717,
        primary: true,
      },
      {
        triplet: 'CJSU1',
        name: 'CAMP JACKSON',
        elevation: 8857,
        latitude: 37.81333,
        longitude: -109.48723,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'southwest',
    stations: [
      {
        triplet: 'BHCU1',
        name: 'Brian Head 2S',
        elevation: 10472,
        latitude: 37.66296,
        longitude: -112.8376,
        primary: true,
      },
      {
        triplet: 'UT14S',
        name: 'SR-14 Summit',
        elevation: 9909,
        latitude: 37.56805,
        longitude: -112.85013,
        primary: true,
      },
      {
        triplet: 'MDVU1',
        name: 'MIDWAY VALLEY',
        elevation: 9826,
        latitude: 37.56933,
        longitude: -112.83849,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // CAIC - Colorado Avalanche Information Center (CO)
  // ===================================================================
  {
    zoneId: 'caic-front-range-north',
    stations: [
      {
        triplet: 'LKIC2',
        name: 'LAKE IRENE',
        elevation: 10700,
        latitude: 40.41432,
        longitude: -105.8198,
        primary: true,
      },
      {
        triplet: 'WPRC2',
        name: 'WILLOW PARK',
        elevation: 10700,
        latitude: 40.43254,
        longitude: -105.73337,
        primary: true,
      },
      {
        triplet: 'CACMP',
        name: 'CAMERON PASS',
        elevation: 10574,
        latitude: 40.49371,
        longitude: -105.9083,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'caic-front-range-boulder',
    stations: [
      {
        triplet: 'CABTP',
        name: 'BERTHOUD PASS (CAIC)',
        elevation: 11861,
        latitude: 39.80,
        longitude: -105.77,
        primary: true,
      },
      {
        triplet: 'BTSC2',
        name: 'BERTHOUD SUMMIT',
        elevation: 11300,
        latitude: 39.80392,
        longitude: -105.77789,
        primary: true,
      },
      {
        triplet: 'LBAC2',
        name: 'LOVELAND BASIN SNOTEL',
        elevation: 11400,
        latitude: 39.67,
        longitude: -105.90,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'caic-front-range-south',
    stations: [
      {
        triplet: 'GLNC2',
        name: 'GLEN COVE (PIKES PEAK) SNOTEL',
        elevation: 11460,
        latitude: 38.876,
        longitude: -105.074,
        primary: true,
      },
      {
        triplet: 'ECLC2',
        name: 'ECHO LAKE SNOTEL',
        elevation: 10600,
        latitude: 39.66,
        longitude: -105.59,
        primary: true,
      },
      {
        triplet: 'BTSC2',
        name: 'BERTHOUD SUMMIT',
        elevation: 11300,
        latitude: 39.80392,
        longitude: -105.77789,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'caic-vail-summit-county',
    stations: [
      {
        triplet: 'HOOC2',
        name: 'HOOSIER PASS',
        elevation: 11611,
        latitude: 39.36055,
        longitude: -106.05994,
        primary: true,
      },
      {
        triplet: 'CPMC2',
        name: 'COPPER MOUNTAIN SNOTEL',
        elevation: 10550,
        latitude: 39.49,
        longitude: -106.17,
        primary: true,
      },
      {
        triplet: 'MIHC2',
        name: 'MICHIGAN CREEK',
        elevation: 10600,
        latitude: 39.43577,
        longitude: -105.91078,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'caic-elk-mountains',
    stations: [
      {
        triplet: 'IDPC2',
        name: 'INDEPENDENCE PASS SNOTEL',
        elevation: 10600,
        latitude: 39.08,
        longitude: -106.61,
        primary: true,
      },
      {
        triplet: 'SOSC2',
        name: 'SCHOFIELD PASS',
        elevation: 10700,
        latitude: 39.01522,
        longitude: -107.04877,
        primary: true,
      },
      {
        triplet: 'ASEC2',
        name: 'CASTLE CREEK NEAR ASPEN',
        elevation: 11394,
        latitude: 39.00778,
        longitude: -106.79194,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'caic-sawatch-range',
    stations: [
      {
        triplet: 'PRPC2',
        name: 'PORPHYRY CREEK',
        elevation: 10760,
        latitude: 38.48884,
        longitude: -106.33965,
        primary: true,
      },
      {
        triplet: 'SGMC2',
        name: 'SARGENTS MESA SNOTEL',
        elevation: 11530,
        latitude: 38.29,
        longitude: -106.37,
        primary: true,
      },
      {
        triplet: 'CAPC2',
        name: 'CASTLE PEAK',
        elevation: 11500,
        latitude: 39.0,
        longitude: -106.84,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'caic-grand-mesa-west-elk',
    stations: [
      {
        triplet: 'CAELT',
        name: 'DAN K-ELKTON',
        elevation: 11147,
        latitude: 38.96973,
        longitude: -107.03999,
        primary: true,
      },
      {
        triplet: 'CAIRW',
        name: 'IRWIN GUIDES STUDY PLOT',
        elevation: 10423,
        latitude: 38.88736,
        longitude: -107.1084,
        primary: true,
      },
      {
        triplet: 'SOSC2',
        name: 'SCHOFIELD PASS',
        elevation: 10700,
        latitude: 39.01522,
        longitude: -107.04877,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'caic-park-range',
    stations: [
      {
        triplet: 'ARPC2',
        name: 'ARAPAHO RIDGE',
        elevation: 10960,
        latitude: 40.35098,
        longitude: -106.38142,
        primary: true,
      },
      {
        triplet: 'STORM',
        name: 'Storm Peak Laboratory',
        elevation: 10531,
        latitude: 40.455111,
        longitude: -106.74428,
        primary: true,
      },
      {
        triplet: 'TOWC2',
        name: 'TOWER',
        elevation: 10500,
        latitude: 40.53743,
        longitude: -106.6768,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'caic-northern-san-juan',
    stations: [
      {
        triplet: 'CATEL',
        name: 'TELLURIDE SKI RESORT',
        elevation: 12159,
        latitude: 37.89913,
        longitude: -107.82088,
        primary: true,
      },
      {
        triplet: 'RMPC2',
        name: 'RED MOUNTAIN PASS',
        elevation: 11200,
        latitude: 37.8918,
        longitude: -107.71342,
        primary: true,
      },
      {
        triplet: 'SLMC2',
        name: 'SLUMGULLION',
        elevation: 11440,
        latitude: 37.9908,
        longitude: -107.20327,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'caic-southern-san-juan',
    stations: [
      {
        triplet: 'WCSC2',
        name: 'WOLF CREEK SUMMIT',
        elevation: 11000,
        latitude: 37.47922,
        longitude: -106.8017,
        primary: true,
      },
      {
        triplet: 'GYBC2',
        name: 'GRAYBACK',
        elevation: 11620,
        latitude: 37.47033,
        longitude: -106.53783,
        primary: true,
      },
      {
        triplet: 'URGC2',
        name: 'UPPER RIO GRANDE',
        elevation: 9400,
        latitude: 37.72194,
        longitude: -107.26015,
        primary: true,
      }
    ]
  },
  {
    zoneId: 'caic-sangre-de-cristo',
    stations: [
      {
        triplet: 'SCYC2',
        name: 'SOUTH COLONY',
        elevation: 10800,
        latitude: 37.96811,
        longitude: -105.53787,
        primary: true,
      },
      {
        triplet: 'UTCC2',
        name: 'UTE CREEK',
        elevation: 10650,
        latitude: 37.61497,
        longitude: -105.37327,
        primary: true,
      },
      {
        triplet: 'HPAC2',
        name: 'HAYDEN PASS SNOTEL',
        elevation: 10700,
        latitude: 38.293,
        longitude: -105.851,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // TAC - Taos Avalanche Center (NM)
  // ===================================================================
  {
    zoneId: 'northern-new-mexico',
    stations: [
      {
        triplet: 'TABN5',
        name: 'TAOS POWDERHORN',
        elevation: 11057,
        latitude: 36.58203,
        longitude: -105.45611,
        primary: true,
      },
      {
        triplet: 'SHUN5',
        name: 'SHUREE',
        elevation: 10100,
        latitude: 36.78778,
        longitude: -105.23999,
        primary: true,
      },
      {
        triplet: 'RRPN5',
        name: 'RED RIVER PASS #2',
        elevation: 9850,
        latitude: 36.69925,
        longitude: -105.34125,
        primary: true,
      }
    ]
  },
  // ===================================================================
  // KPAC - Kachina Peaks Avalanche Center (AZ)
  // ===================================================================
  {
    zoneId: 'san-francisco-peaks',
    stations: [
      {
        triplet: 'ASBTP',
        name: 'AZ Snowbowl Top Patrol',
        elevation: 11555,
        latitude: 35.326,
        longitude: -111.686,
        primary: true,
      },
      {
        triplet: 'XSCA3',
        name: 'SNOWSLIDE CANYON',
        elevation: 9730,
        latitude: 35.3416,
        longitude: -111.65058,
        primary: true,
      },
      {
        triplet: 'JE356',
        name: 'Upper Weatherford',
        elevation: 10025,
        latitude: 35.320,
        longitude: -111.641,
        primary: true,
      }
    ]
  },
];

/**
 * SNOTEL element codes to fetch
 * Ref: https://wcc.sc.egov.usda.gov/nwcc/rgrpt?report=elecodelist
 */
export const SNOTEL_ELEMENTS = {
  // Snow measurements
  SNWD: 'Snow depth (inches)',
  WTEQ: 'Snow water equivalent (inches)',
  PREC: 'Precipitation accumulation (inches)',

  // Temperature
  TOBS: 'Air temperature observed (°F)',
  TMAX: 'Air temperature maximum (°F)',
  TMIN: 'Air temperature minimum (°F)',

  // Wind (not available on all stations)
  WSPD: 'Wind speed average (mph)',
  WSPDX: 'Wind speed maximum (mph)',
  WDIR: 'Wind direction (degrees)',
} as const;

// Element codes as array for API requests
export const ELEMENT_CODES = Object.keys(SNOTEL_ELEMENTS);

/**
 * Get stations for a specific zone
 */
export function getStationsForZone(zoneId: string): WeatherStation[] {
  const config = WEATHER_STATION_CONFIG.find(z => z.zoneId === zoneId);
  return config?.stations || [];
}

/**
 * Get primary station for a zone
 */
export function getPrimaryStation(zoneId: string): WeatherStation | null {
  const stations = getStationsForZone(zoneId);
  return stations.find(s => s.primary) || stations[0] || null;
}

/**
 * Get all configured zones
 */
export function getConfiguredZones(): string[] {
  return WEATHER_STATION_CONFIG.map(z => z.zoneId);
}
