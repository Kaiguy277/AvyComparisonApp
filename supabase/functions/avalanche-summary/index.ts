import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { fetchMultipleStations, type StationObservation } from '../_shared/synoptic-api.ts';
import { getStationsForZone } from '../_shared/weather-station-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Supabase client for cache operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// NAC API configuration
const NAC_API_BASE = 'https://api.avalanche.org/v2/public';

// Common headers for NAC API requests (User-Agent required to avoid 500s)
const nacHeaders = {
  'User-Agent': '(kaiconsulting.lovable.app, kaimyers@alaskapacific.edu)',
  'Accept': 'application/json',
};

// Zone configuration with NAC IDs, fallback URLs, and official forecast URLs
const ZONE_CONFIG = [
  // ── BAC - Bridgeport Avalanche Center ──
  {
    id: 'bridgeport',
    nacZoneId: '3004',
    centerId: 'BAC',
    name: 'Bridgeport Avalanche Center',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://bridgeportavalanchecenter.org/avalanche-forecast/',
    forecastUrl: 'https://bridgeportavalanchecenter.org/avalanche-forecast/',
  },
  // ── BTAC - Bridger-Teton Avalanche Center ──
  {
    id: 'salt-river-wyoming-ranges',
    nacZoneId: '2856',
    centerId: 'BTAC',
    name: 'Salt River and Wyoming Ranges',
    timezone: 'America/Denver',
    fallbackUrl: 'https://bridgertetonavalanchecenter.org/forecasts/#/salt-river-and-wyoming-ranges/',
    forecastUrl: 'https://bridgertetonavalanchecenter.org/forecasts/#/salt-river-and-wyoming-ranges/',
  },
  {
    id: 'snake-river-range',
    nacZoneId: '2860',
    centerId: 'BTAC',
    name: 'Snake River Range',
    timezone: 'America/Denver',
    fallbackUrl: 'https://bridgertetonavalanchecenter.org/forecasts/#/snake-river-range',
    forecastUrl: 'https://bridgertetonavalanchecenter.org/forecasts/#/snake-river-range',
  },
  {
    id: 'tetons',
    nacZoneId: '2855',
    centerId: 'BTAC',
    name: 'Tetons',
    timezone: 'America/Denver',
    fallbackUrl: 'https://bridgertetonavalanchecenter.org/forecasts/#/tetons',
    forecastUrl: 'https://bridgertetonavalanchecenter.org/forecasts/#/tetons',
  },
  {
    id: 'togwotee-pass',
    nacZoneId: '2852',
    centerId: 'BTAC',
    name: 'Togwotee Pass',
    timezone: 'America/Denver',
    fallbackUrl: 'https://bridgertetonavalanchecenter.org/forecasts/#/togwotee-pass',
    forecastUrl: 'https://bridgertetonavalanchecenter.org/forecasts/#/togwotee-pass',
  },
  // ── CAC - Cordova Avalanche Center ──
  {
    id: 'cordova',
    nacZoneId: '1421',
    centerId: 'CAC',
    name: 'Cordova',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://alaskasnow.org/cordova/',
    forecastUrl: 'https://alaskasnow.org/cordova/',
  },
  // ── CAIC - Colorado Avalanche Information Center ──
  {
    id: 'caic-northern-san-juan',
    nacZoneId: '2647',
    centerId: 'CAIC',
    name: 'Northern San Juan Mountains',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  {
    id: 'caic-sangre-de-cristo',
    nacZoneId: '2651',
    centerId: 'CAIC',
    name: 'Sangre de Cristo Mountains',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  {
    id: 'caic-southern-san-juan',
    nacZoneId: '2660',
    centerId: 'CAIC',
    name: 'Southern San Juan Mountains',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  {
    id: 'caic-park-range',
    nacZoneId: '2690',
    centerId: 'CAIC',
    name: 'Park Range (Steamboat)',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  {
    id: 'caic-front-range-north',
    nacZoneId: '2712',
    centerId: 'CAIC',
    name: 'Front Range & Never Summer Mountains',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  {
    id: 'caic-vail-summit-county',
    nacZoneId: '2730',
    centerId: 'CAIC',
    name: 'Vail & Summit County',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  {
    id: 'caic-front-range-boulder',
    nacZoneId: '2745',
    centerId: 'CAIC',
    name: 'Front Range (Boulder)',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  {
    id: 'caic-grand-mesa-west-elk',
    nacZoneId: '2747',
    centerId: 'CAIC',
    name: 'Grand Mesa & Flat Tops',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  {
    id: 'caic-elk-mountains',
    nacZoneId: '2751',
    centerId: 'CAIC',
    name: 'Elk Mountains (Aspen)',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  {
    id: 'caic-sawatch-range',
    nacZoneId: '2754',
    centerId: 'CAIC',
    name: 'Sawatch Range',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  {
    id: 'caic-front-range-south',
    nacZoneId: '2755',
    centerId: 'CAIC',
    name: 'Front Range South & Pikes Peak',
    timezone: 'America/Denver',
    fallbackUrl: 'https://avalanche.state.co.us/',
    forecastUrl: 'https://avalanche.state.co.us/',
  },
  // ── CAAC - Coastal Alaska Avalanche Center ──
  {
    id: 'douglas-island',
    nacZoneId: '2165',
    centerId: 'CAAC',
    name: 'Douglas Island',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://www.coastalakavalanche.org/forecast/#/douglas-island/',
    forecastUrl: 'https://www.coastalakavalanche.org/forecast/#/douglas-island/',
  },
  {
    id: 'juneau-mainland',
    nacZoneId: '2164',
    centerId: 'CAAC',
    name: 'Juneau Mainland',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://www.coastalakavalanche.org/forecast/#/juneau-mainland/',
    forecastUrl: 'https://www.coastalakavalanche.org/forecast/#/juneau-mainland/',
  },
  // ── CNFAIC - Chugach National Forest Avalanche Information Center ──
  {
    id: 'turnagain-girdwood',
    nacZoneId: '2815',
    centerId: 'CNFAIC',
    name: 'Turnagain Pass / Girdwood',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://cnfaic.org/forecast/turnagain/',
    forecastUrl: 'https://cnfaic.org/forecast/turnagain/',
  },
  {
    id: 'summit',
    nacZoneId: '2816',
    centerId: 'CNFAIC',
    name: 'Summit Lake',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://cnfaic.org/forecast/summit/',
    forecastUrl: 'https://cnfaic.org/forecast/summit/',
  },
  {
    id: 'seward',
    nacZoneId: '2817',
    centerId: 'CNFAIC',
    name: 'Seward / Lost Lake',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://cnfaic.org/forecast/seward/',
    forecastUrl: 'https://cnfaic.org/forecast/seward/',
  },
  {
    id: 'chugach-state-park',
    nacZoneId: '2818',
    centerId: 'CNFAIC',
    name: 'Chugach State Park',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://cnfaic.org/forecast/chugach-state-park/',
    forecastUrl: 'https://cnfaic.org/forecast/chugach-state-park/',
  },
  // ── COAA - Central Oregon Avalanche Center ──
  {
    id: 'central-cascades',
    nacZoneId: '2470',
    centerId: 'COAA',
    name: 'Central Cascades',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://coavalanche.org/pages/forecasts/#/central-cascades',
    forecastUrl: 'https://coavalanche.org/pages/forecasts/#/central-cascades',
  },
  {
    id: 'newberry',
    nacZoneId: '2471',
    centerId: 'COAA',
    name: 'Newberry',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://coavalanche.org/pages/forecasts/#/newberry',
    forecastUrl: 'https://coavalanche.org/pages/forecasts/#/newberry',
  },
  // ── EARAC - Eastern Alaska Range Avalanche Center ──
  {
    id: 'earac-north',
    nacZoneId: '3002',
    centerId: 'EARAC',
    name: 'Eastern Alaska Range - North (Castner-Canwell)',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://alaskasnow.org/eastern-ak-range/',
    forecastUrl: 'https://alaskasnow.org/eastern-ak-range/',
  },
  {
    id: 'earac-south',
    nacZoneId: '3003',
    centerId: 'EARAC',
    name: 'Eastern Alaska Range - South (Summit)',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://alaskasnow.org/eastern-ak-range/',
    forecastUrl: 'https://alaskasnow.org/eastern-ak-range/',
  },
  // ── ESAC - Eastern Sierra Avalanche Center ──
  {
    id: 'eastside-region',
    nacZoneId: '128',
    centerId: 'ESAC',
    name: 'Eastside Region',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.esavalanche.org/forecasts#/eastside-region',
    forecastUrl: 'https://www.esavalanche.org/forecasts#/eastside-region',
  },
  // ── EWYAIX - Eastern Wyoming Avalanche Info Exchange ──
  {
    id: 'big-horns',
    nacZoneId: '2841',
    centerId: 'EWYAIX',
    name: 'Big Horns',
    timezone: 'America/Denver',
    fallbackUrl: 'https://ewyoavalanche.org',
    forecastUrl: 'https://ewyoavalanche.org',
  },
  {
    id: 'sierra-madre',
    nacZoneId: '2843',
    centerId: 'EWYAIX',
    name: 'Sierra Madre',
    timezone: 'America/Denver',
    fallbackUrl: 'https://ewyoavalanche.org',
    forecastUrl: 'https://ewyoavalanche.org',
  },
  {
    id: 'snowy-range',
    nacZoneId: '2842',
    centerId: 'EWYAIX',
    name: 'Snowy Range',
    timezone: 'America/Denver',
    fallbackUrl: 'https://ewyoavalanche.org',
    forecastUrl: 'https://ewyoavalanche.org',
  },
  // ── FAC - Flathead Avalanche Center ──
  {
    id: 'flathead-range-glacier-np',
    nacZoneId: '1735',
    centerId: 'FAC',
    name: 'Flathead Range & Glacier NP',
    timezone: 'America/Denver',
    fallbackUrl: 'https://flatheadavalanche.com/avalanche-forecast#/flathead-range-&-glacier-np',
    forecastUrl: 'https://flatheadavalanche.com/avalanche-forecast#/flathead-range-&-glacier-np',
  },
  {
    id: 'swan-range',
    nacZoneId: '1734',
    centerId: 'FAC',
    name: 'Swan Range',
    timezone: 'America/Denver',
    fallbackUrl: 'https://flatheadavalanche.com/avalanche-forecast#/swan-range',
    forecastUrl: 'https://flatheadavalanche.com/avalanche-forecast#/swan-range',
  },
  {
    id: 'whitefish-range',
    nacZoneId: '1733',
    centerId: 'FAC',
    name: 'Whitefish Range',
    timezone: 'America/Denver',
    fallbackUrl: 'https://flatheadavalanche.com/avalanche-forecast#/whitefish-range',
    forecastUrl: 'https://flatheadavalanche.com/avalanche-forecast#/whitefish-range',
  },
  // ── GNFAC - Gallatin NF Avalanche Center ──
  {
    id: 'bridger-range',
    nacZoneId: '2819',
    centerId: 'GNFAC',
    name: 'Bridger Range',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.mtavalanche.com/avalanche-forecast#/bridger-range/',
    forecastUrl: 'https://www.mtavalanche.com/avalanche-forecast#/bridger-range/',
  },
  {
    id: 'cooke-city',
    nacZoneId: '2827',
    centerId: 'GNFAC',
    name: 'Cooke City',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.mtavalanche.com/avalanche-forecast#/cooke-city/',
    forecastUrl: 'https://www.mtavalanche.com/avalanche-forecast#/cooke-city/',
  },
  {
    id: 'island-park',
    nacZoneId: '2826',
    centerId: 'GNFAC',
    name: 'Island Park',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.mtavalanche.com/avalanche-forecast#/island-park/',
    forecastUrl: 'https://www.mtavalanche.com/avalanche-forecast#/island-park/',
  },
  {
    id: 'lionhead-area',
    nacZoneId: '2825',
    centerId: 'GNFAC',
    name: 'Lionhead Area',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.mtavalanche.com/avalanche-forecast#/lionhead-area/',
    forecastUrl: 'https://www.mtavalanche.com/avalanche-forecast#/lionhead-area/',
  },
  {
    id: 'northern-gallatin-range',
    nacZoneId: '2821',
    centerId: 'GNFAC',
    name: 'Northern Gallatin Range',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.mtavalanche.com/avalanche-forecast#/northern-gallatin-range/',
    forecastUrl: 'https://www.mtavalanche.com/avalanche-forecast#/northern-gallatin-range/',
  },
  {
    id: 'northern-madison-range',
    nacZoneId: '2822',
    centerId: 'GNFAC',
    name: 'Northern Madison Range',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.mtavalanche.com/avalanche-forecast#/northern-madison-range/',
    forecastUrl: 'https://www.mtavalanche.com/avalanche-forecast#/northern-madison-range/',
  },
  {
    id: 'southern-gallatin-range',
    nacZoneId: '2824',
    centerId: 'GNFAC',
    name: 'Southern Gallatin Range',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.mtavalanche.com/avalanche-forecast#/southern-gallatin-range/',
    forecastUrl: 'https://www.mtavalanche.com/avalanche-forecast#/southern-gallatin-range/',
  },
  {
    id: 'southern-madison-range',
    nacZoneId: '2823',
    centerId: 'GNFAC',
    name: 'Southern Madison Range',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.mtavalanche.com/avalanche-forecast#/southern-madison-range/',
    forecastUrl: 'https://www.mtavalanche.com/avalanche-forecast#/southern-madison-range/',
  },
  // ── HAC - Haines Avalanche Center ──
  {
    id: 'haines-lutak',
    nacZoneId: '3005',
    centerId: 'HAC',
    name: 'Haines - Lutak',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://alaskasnow.org/haines-forecast/#/lutak/',
    forecastUrl: 'https://alaskasnow.org/haines-forecast/#/lutak/',
  },
  {
    id: 'haines-transitional',
    nacZoneId: '3006',
    centerId: 'HAC',
    name: 'Haines - Transitional',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://alaskasnow.org/haines-forecast/#/transitional/',
    forecastUrl: 'https://alaskasnow.org/haines-forecast/#/transitional/',
  },
  {
    id: 'haines-chilkat-pass',
    nacZoneId: '3007',
    centerId: 'HAC',
    name: 'Haines - Chilkat Pass',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://alaskasnow.org/haines-forecast/#/chilkat-pass/',
    forecastUrl: 'https://alaskasnow.org/haines-forecast/#/chilkat-pass/',
  },
  // ── HPAC - Hatcher Pass Avalanche Center ──
  {
    id: 'hatcher-pass',
    nacZoneId: '2152',
    centerId: 'HPAC',
    name: 'Hatcher Pass',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://hpavalanche.org/forecast/',
    forecastUrl: 'https://hpavalanche.org/forecast/',
  },
  // ── IPAC - Idaho Panhandle Avalanche Center ──
  {
    id: 'east-cabinet-mountains',
    nacZoneId: '1901',
    centerId: 'IPAC',
    name: 'East Cabinet Mountains',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.idahopanhandleavalanche.org/forecasts/#/east-cabinet-mountains/',
    forecastUrl: 'https://www.idahopanhandleavalanche.org/forecasts/#/east-cabinet-mountains/',
  },
  {
    id: 'purcell-mountains',
    nacZoneId: '1903',
    centerId: 'IPAC',
    name: 'Purcell Mountains',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.idahopanhandleavalanche.org/forecasts/#/purcell-mountains/',
    forecastUrl: 'https://www.idahopanhandleavalanche.org/forecasts/#/purcell-mountains/',
  },
  {
    id: 'selkirk-mountains',
    nacZoneId: '1899',
    centerId: 'IPAC',
    name: 'Selkirk Mountains',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.idahopanhandleavalanche.org/forecasts/#/selkirk-mountains/',
    forecastUrl: 'https://www.idahopanhandleavalanche.org/forecasts/#/selkirk-mountains/',
  },
  {
    id: 'silver-valley-bitterroot-mountains',
    nacZoneId: '1902',
    centerId: 'IPAC',
    name: 'Silver Valley & Bitterroot Mountains',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.idahopanhandleavalanche.org/forecasts/#/silver-valley-&-bitterroot-mountains/',
    forecastUrl: 'https://www.idahopanhandleavalanche.org/forecasts/#/silver-valley-&-bitterroot-mountains/',
  },
  {
    id: 'west-cabinet-mountains',
    nacZoneId: '1900',
    centerId: 'IPAC',
    name: 'West Cabinet Mountains',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.idahopanhandleavalanche.org/forecasts/#/west-cabinet-mountains/',
    forecastUrl: 'https://www.idahopanhandleavalanche.org/forecasts/#/west-cabinet-mountains/',
  },
  // ── KPAC - Kachina Peaks Avalanche Center ──
  {
    id: 'san-francisco-peaks',
    nacZoneId: '2990',
    centerId: 'KPAC',
    name: 'San Francisco Peaks',
    timezone: 'America/Phoenix',
    fallbackUrl: 'https://kachinapeaks.org/Forecast/#/san-francisco-peaks-%2F-kachina-peaks-wilderness',
    forecastUrl: 'https://kachinapeaks.org/Forecast/#/san-francisco-peaks-%2F-kachina-peaks-wilderness',
  },
  // ── MSAC - Mount Shasta Avalanche Center ──
  {
    id: 'mount-shasta',
    nacZoneId: '1833',
    centerId: 'MSAC',
    name: 'Mount Shasta',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.shastaavalanche.org/advisories/avalanche-advisory/#/mount-shasta',
    forecastUrl: 'https://www.shastaavalanche.org/advisories/avalanche-advisory/#/mount-shasta',
  },
  // ── MWAC - Mount Washington Avalanche Center ──
  {
    id: 'presidential-range',
    nacZoneId: '2355',
    centerId: 'MWAC',
    name: 'Presidential Range',
    timezone: 'America/New_York',
    fallbackUrl: 'http://www.mountwashingtonavalanchecenter.org/',
    forecastUrl: 'http://www.mountwashingtonavalanchecenter.org/',
  },
  // ── NWAC - Northwest Avalanche Center ──
  {
    id: 'east-slopes-central',
    nacZoneId: '1655',
    centerId: 'NWAC',
    name: 'East Slopes Central',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'http://www.nwac.us/avalanche-forecast/#/east-slopes-central',
    forecastUrl: 'http://www.nwac.us/avalanche-forecast/#/east-slopes-central',
  },
  {
    id: 'east-slopes-north',
    nacZoneId: '1654',
    centerId: 'NWAC',
    name: 'East Slopes North',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'http://www.nwac.us/avalanche-forecast/#/east-slopes-north',
    forecastUrl: 'http://www.nwac.us/avalanche-forecast/#/east-slopes-north',
  },
  {
    id: 'east-slopes-south',
    nacZoneId: '1656',
    centerId: 'NWAC',
    name: 'East Slopes South',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'http://www.nwac.us/avalanche-forecast/#/east-slopes-south',
    forecastUrl: 'http://www.nwac.us/avalanche-forecast/#/east-slopes-south',
  },
  {
    id: 'mt-hood',
    nacZoneId: '1657',
    centerId: 'NWAC',
    name: 'Mt Hood',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'http://www.nwac.us/avalanche-forecast/#/mt-hood',
    forecastUrl: 'http://www.nwac.us/avalanche-forecast/#/mt-hood',
  },
  {
    id: 'olympics',
    nacZoneId: '1645',
    centerId: 'NWAC',
    name: 'Olympics',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'http://www.nwac.us/avalanche-forecast/#/olympics',
    forecastUrl: 'http://www.nwac.us/avalanche-forecast/#/olympics',
  },
  {
    id: 'snoqualmie-pass',
    nacZoneId: '1653',
    centerId: 'NWAC',
    name: 'Snoqualmie Pass',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'http://www.nwac.us/avalanche-forecast/#/snoqualmie-pass',
    forecastUrl: 'http://www.nwac.us/avalanche-forecast/#/snoqualmie-pass',
  },
  {
    id: 'stevens-pass',
    nacZoneId: '1649',
    centerId: 'NWAC',
    name: 'Stevens Pass',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'http://www.nwac.us/avalanche-forecast/#/stevens-pass',
    forecastUrl: 'http://www.nwac.us/avalanche-forecast/#/stevens-pass',
  },
  {
    id: 'west-slopes-central',
    nacZoneId: '1647',
    centerId: 'NWAC',
    name: 'West Slopes Central',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'http://www.nwac.us/avalanche-forecast/#/west-slopes-central',
    forecastUrl: 'http://www.nwac.us/avalanche-forecast/#/west-slopes-central',
  },
  {
    id: 'west-slopes-north',
    nacZoneId: '1646',
    centerId: 'NWAC',
    name: 'West Slopes North',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'http://www.nwac.us/avalanche-forecast/#/west-slopes-north',
    forecastUrl: 'http://www.nwac.us/avalanche-forecast/#/west-slopes-north',
  },
  {
    id: 'west-slopes-south',
    nacZoneId: '1648',
    centerId: 'NWAC',
    name: 'West Slopes South',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'http://www.nwac.us/avalanche-forecast/#/west-slopes-south',
    forecastUrl: 'http://www.nwac.us/avalanche-forecast/#/west-slopes-south',
  },
  // ── PAC - Payette Avalanche Center ──
  {
    id: 'salmon-river-mountains',
    nacZoneId: '2897',
    centerId: 'PAC',
    name: 'Salmon River Mountains',
    timezone: 'America/Denver',
    fallbackUrl: 'https://payetteavalanche.org/forecasts/#/salmon-river-mountains/',
    forecastUrl: 'https://payetteavalanche.org/forecasts/#/salmon-river-mountains/',
  },
  {
    id: 'west-mountains',
    nacZoneId: '2898',
    centerId: 'PAC',
    name: 'West Mountains',
    timezone: 'America/Denver',
    fallbackUrl: 'https://payetteavalanche.org/forecasts/#/west-mountains/',
    forecastUrl: 'https://payetteavalanche.org/forecasts/#/west-mountains/',
  },
  // ── SAC - Sierra Avalanche Center ──
  {
    id: 'central-sierra-nevada',
    nacZoneId: '2458',
    centerId: 'SAC',
    name: 'Central Sierra Nevada',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.sierraavalanchecenter.org/forecasts/avalanche/central-sierra-nevada#/central-sierra-nevada/',
    forecastUrl: 'https://www.sierraavalanchecenter.org/forecasts/avalanche/central-sierra-nevada#/central-sierra-nevada/',
  },
  // ── SNFAC - Sawtooth Avalanche Center ──
  {
    id: 'banner-summit',
    nacZoneId: '2907',
    centerId: 'SNFAC',
    name: 'Banner Summit',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.sawtoothavalanche.com/forecasts/avalanche/banner-summit',
    forecastUrl: 'https://www.sawtoothavalanche.com/forecasts/avalanche/banner-summit',
  },
  {
    id: 'galena-summit-eastern-mtns',
    nacZoneId: '2904',
    centerId: 'SNFAC',
    name: 'Galena Summit & Eastern Mtns',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.sawtoothavalanche.com/forecasts/avalanche/galena-summit-&-eastern-mtns',
    forecastUrl: 'https://www.sawtoothavalanche.com/forecasts/avalanche/galena-summit-&-eastern-mtns',
  },
  {
    id: 'sawtooth-western-smoky-mtns',
    nacZoneId: '2906',
    centerId: 'SNFAC',
    name: 'Sawtooth & Western Smoky Mtns',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.sawtoothavalanche.com/forecasts/avalanche/sawtooth-&-western-smoky-mtns',
    forecastUrl: 'https://www.sawtoothavalanche.com/forecasts/avalanche/sawtooth-&-western-smoky-mtns',
  },
  {
    id: 'soldier-wood-river-valley-mtns',
    nacZoneId: '2905',
    centerId: 'SNFAC',
    name: 'Soldier & Wood River Valley Mtns',
    timezone: 'America/Denver',
    fallbackUrl: 'https://www.sawtoothavalanche.com/forecasts/avalanche/soldier-&-wood-river-valley-mtns',
    forecastUrl: 'https://www.sawtoothavalanche.com/forecasts/avalanche/soldier-&-wood-river-valley-mtns',
  },
  // ── SOAIX - Southern Oregon Avalanche Info Exchange ──
  {
    id: 'southern-oregon',
    nacZoneId: '1369',
    centerId: 'SOAIX',
    name: 'Southern Oregon',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.oregonsnow.org/observations/#/view/observations',
    forecastUrl: 'https://www.oregonsnow.org/observations/#/view/observations',
  },
  // ── TAC - Taos Avalanche Center ──
  {
    id: 'northern-new-mexico',
    nacZoneId: '490',
    centerId: 'TAC',
    name: 'Northern New Mexico',
    timezone: 'America/Denver',
    fallbackUrl: 'https://taosavalanchecenter.org/forecasts/#/northern-new-mexico',
    forecastUrl: 'https://taosavalanchecenter.org/forecasts/#/northern-new-mexico',
  },
  // ── UAC - Utah Avalanche Center ──
  {
    id: 'abajos',
    nacZoneId: '1744',
    centerId: 'UAC',
    name: 'Abajos',
    timezone: 'America/Denver',
    fallbackUrl: 'https://utahavalanchecenter.org/forecast/abajos',
    forecastUrl: 'https://utahavalanchecenter.org/forecast/abajos',
  },
  {
    id: 'logan',
    nacZoneId: '1736',
    centerId: 'UAC',
    name: 'Logan',
    timezone: 'America/Denver',
    fallbackUrl: 'https://utahavalanchecenter.org/forecast/logan',
    forecastUrl: 'https://utahavalanchecenter.org/forecast/logan',
  },
  {
    id: 'moab',
    nacZoneId: '1742',
    centerId: 'UAC',
    name: 'Moab',
    timezone: 'America/Denver',
    fallbackUrl: 'https://utahavalanchecenter.org/forecast/moab',
    forecastUrl: 'https://utahavalanchecenter.org/forecast/moab',
  },
  {
    id: 'ogden',
    nacZoneId: '1737',
    centerId: 'UAC',
    name: 'Ogden',
    timezone: 'America/Denver',
    fallbackUrl: 'https://utahavalanchecenter.org/forecast/ogden',
    forecastUrl: 'https://utahavalanchecenter.org/forecast/ogden',
  },
  {
    id: 'provo',
    nacZoneId: '1739',
    centerId: 'UAC',
    name: 'Provo',
    timezone: 'America/Denver',
    fallbackUrl: 'https://utahavalanchecenter.org/forecast/provo',
    forecastUrl: 'https://utahavalanchecenter.org/forecast/provo',
  },
  {
    id: 'salt-lake',
    nacZoneId: '1738',
    centerId: 'UAC',
    name: 'Salt Lake',
    timezone: 'America/Denver',
    fallbackUrl: 'https://utahavalanchecenter.org/forecast/salt-lake',
    forecastUrl: 'https://utahavalanchecenter.org/forecast/salt-lake',
  },
  {
    id: 'skyline',
    nacZoneId: '1741',
    centerId: 'UAC',
    name: 'Skyline',
    timezone: 'America/Denver',
    fallbackUrl: 'https://utahavalanchecenter.org/forecast/skyline',
    forecastUrl: 'https://utahavalanchecenter.org/forecast/skyline',
  },
  {
    id: 'southwest',
    nacZoneId: '1743',
    centerId: 'UAC',
    name: 'Southwest',
    timezone: 'America/Denver',
    fallbackUrl: 'https://utahavalanchecenter.org/forecast/southwest',
    forecastUrl: 'https://utahavalanchecenter.org/forecast/southwest',
  },
  {
    id: 'uintas',
    nacZoneId: '1740',
    centerId: 'UAC',
    name: 'Uintas',
    timezone: 'America/Denver',
    fallbackUrl: 'https://utahavalanchecenter.org/forecast/uintas',
    forecastUrl: 'https://utahavalanchecenter.org/forecast/uintas',
  },
  // ── VAC - Valdez Avalanche Center ──
  {
    id: 'valdez-maritime',
    nacZoneId: '1609',
    centerId: 'VAC',
    name: 'Valdez - Maritime',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://alaskasnow.org/valdez/',
    forecastUrl: 'https://alaskasnow.org/valdez/',
  },
  {
    id: 'valdez-intermountain',
    nacZoneId: '1610',
    centerId: 'VAC',
    name: 'Valdez - Intermountain',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://alaskasnow.org/valdez/',
    forecastUrl: 'https://alaskasnow.org/valdez/',
  },
  {
    id: 'valdez-continental',
    nacZoneId: '1611',
    centerId: 'VAC',
    name: 'Valdez - Continental',
    timezone: 'America/Anchorage',
    fallbackUrl: 'https://alaskasnow.org/valdez/',
    forecastUrl: 'https://alaskasnow.org/valdez/',
  },
  // ── WAC - Wallowa Avalanche Center ──
  {
    id: 'blues',
    nacZoneId: '2985',
    centerId: 'WAC',
    name: 'Blues',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.wallowaavalanchecenter.org/forecasts/#/blues',
    forecastUrl: 'https://www.wallowaavalanchecenter.org/forecasts/#/blues',
  },
  {
    id: 'elkhorns',
    nacZoneId: '2984',
    centerId: 'WAC',
    name: 'Elkhorns',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.wallowaavalanchecenter.org/forecasts/#/elkhorns',
    forecastUrl: 'https://www.wallowaavalanchecenter.org/forecasts/#/elkhorns',
  },
  {
    id: 'northern-wallowas',
    nacZoneId: '2982',
    centerId: 'WAC',
    name: 'Northern Wallowas',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://wallowaavalanchecenter.org/forecasts/#/northern-wallowas',
    forecastUrl: 'https://wallowaavalanchecenter.org/forecasts/#/northern-wallowas',
  },
  {
    id: 'southern-wallowas',
    nacZoneId: '2983',
    centerId: 'WAC',
    name: 'Southern Wallowas',
    timezone: 'America/Los_Angeles',
    fallbackUrl: 'https://www.wallowaavalanchecenter.org/forecasts/#/southern-wallowas',
    forecastUrl: 'https://www.wallowaavalanchecenter.org/forecasts/#/southern-wallowas',
  },
  // ── WCMAC - West Central Montana Avalanche Center ──
  {
    id: 'bitterroot',
    nacZoneId: '1724',
    centerId: 'WCMAC',
    name: 'Bitterroot',
    timezone: 'America/Denver',
    fallbackUrl: 'https://missoulaavalanche.org/forecasts/#/Bitterroot',
    forecastUrl: 'https://missoulaavalanche.org/forecasts/#/Bitterroot',
  },
  {
    id: 'rattlesnake',
    nacZoneId: '1723',
    centerId: 'WCMAC',
    name: 'Rattlesnake',
    timezone: 'America/Denver',
    fallbackUrl: 'https://missoulaavalanche.org/forecasts/#/rattlesnake',
    forecastUrl: 'https://missoulaavalanche.org/forecasts/#/rattlesnake',
  },
  {
    id: 'seeley-lake',
    nacZoneId: '1722',
    centerId: 'WCMAC',
    name: 'Seeley Lake',
    timezone: 'America/Denver',
    fallbackUrl: 'http://www.missoulaavalanche.org/forecasts/#/seeley-lake',
    forecastUrl: 'http://www.missoulaavalanche.org/forecasts/#/seeley-lake',
  },
];

// Map NAC danger scale numbers to our rating strings
function mapDangerRating(level: number | null | undefined): string {
  const ratings: Record<number, string> = {
    0: 'NO_RATING',
    1: 'LOW',
    2: 'MODERATE',
    3: 'CONSIDERABLE',
    4: 'HIGH',
    5: 'EXTREME',
  };
  if (level === -1 || level === null || level === undefined) return 'NO_RATING';
  return ratings[level] || 'NO_RATING';
}

// Format date for display
function formatDate(isoDate: string | null, timezone: string = 'America/Anchorage'): string | null {
  if (!isoDate) return null;
  try {
    const date = new Date(isoDate);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
  } catch {
    return isoDate;
  }
}

// Calculate freshness status based on expiration. `timezone` is the
// zone's local zone (from ZONE_CONFIG) — the issue/expiry DISPLAY strings
// must render in it, or every zone shows Alaska time (4h off for the
// lower-48 centers, and the date is wrong near day boundaries).
function calculateFreshness(
  startDate: string | null,
  endDate: string | null,
  timezone: string = 'America/Anchorage',
): {
  issueDate: string | null;
  expiresDate: string | null;
  ageHours: number | null;
  hoursUntilExpiry: number | null;
  status: 'current' | 'recent' | 'expiring' | 'expired' | 'unknown';
} {
  if (!startDate || !endDate) {
    return { issueDate: null, expiresDate: null, ageHours: null, hoursUntilExpiry: null, status: 'unknown' };
  }

  try {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate parsed dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      console.error(`Invalid date parsing: startDate=${startDate}, endDate=${endDate}`);
      return { issueDate: null, expiresDate: null, ageHours: null, hoursUntilExpiry: null, status: 'unknown' };
    }

    const ageHours = Math.round((now.getTime() - start.getTime()) / (1000 * 60 * 60));
    const hoursUntilExpiry = Math.round((end.getTime() - now.getTime()) / (1000 * 60 * 60));

    // Debug logging to diagnose freshness calculation
    console.log(`Freshness calc: now=${now.toISOString()}, start=${start.toISOString()}, end=${end.toISOString()}`);
    console.log(`Freshness calc: ageHours=${ageHours}, hoursUntilExpiry=${hoursUntilExpiry}`);

    let status: 'current' | 'recent' | 'expiring' | 'expired' | 'unknown';
    if (hoursUntilExpiry < 0) {
      status = 'expired';
    } else if (hoursUntilExpiry <= 6) {
      status = 'expiring';
    } else if (ageHours < 24) {
      status = 'current';
    } else {
      status = 'recent';
    }

    console.log(`Freshness result: status=${status}`);

    return {
      issueDate: formatDate(startDate, timezone),
      expiresDate: formatDate(endDate, timezone),
      ageHours,
      hoursUntilExpiry,
      status,
    };
  } catch (error) {
    console.error(`Freshness calculation error:`, error);
    return { issueDate: null, expiresDate: null, ageHours: null, hoursUntilExpiry: null, status: 'unknown' };
  }
}

// Normalize zone name for fuzzy matching
function normalizeZoneName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+and\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .sort()
    .join(' ');
}

// Fetch individual zone forecast using /product endpoint
async function fetchZoneForecast(centerId: string, zoneId: string): Promise<any | null> {
  try {
    const url = `${NAC_API_BASE}/product?type=forecast&center_id=${centerId}&zone_id=${zoneId}`;
    console.log(`Fetching forecast: ${url}`);
    const response = await fetch(url, { headers: nacHeaders });
    
    if (!response.ok) {
      console.log(`Product endpoint returned ${response.status} for zone ${zoneId}`);
      return null;
    }
    
    const data = await response.json();
    console.log(`Got forecast for zone ${zoneId}: published=${data.published_time}, expires=${data.expires_time}`);
    return data;
  } catch (error) {
    console.error(`Error fetching forecast for zone ${zoneId}:`, error);
    return null;
  }
}

// Firecrawl fallback removed for the mobile-only deployment. Centers whose
// forecasts aren't available via the NAC API simply return null here; the
// caller falls through gracefully (the zone shows up but with empty
// problem/discussion fields, which the UI already handles).
async function scrapeZoneForecast(_fallbackUrl: string, zoneName: string): Promise<{
  markdown: string | null;
  success: boolean;
}> {
  console.log(`No Firecrawl fallback available for ${zoneName} (mobile deployment)`);
  return { markdown: null, success: false };
}

// Fetch map-layer for overall danger levels and timestamps
// Only processes data for the specified centers to optimize for scale
async function fetchMapLayerData(selectedCenterIds: string[]): Promise<Map<string, {
  danger_level: number;
  start_date: string | null;
  end_date: string | null;
  name: string;
}>> {
  const zoneMap = new Map();
  try {
    console.log('Fetching NAC map-layer...');
    const response = await fetch(`${NAC_API_BASE}/products/map-layer`, {
      headers: nacHeaders,
    });

    if (!response.ok) {
      console.error('Map-layer fetch failed:', response.status);
      return zoneMap;
    }

    const data = await response.json();
    const features = data.features || [];

    // Create a Set for faster lookup
    const centerIdSet = new Set(selectedCenterIds);

    for (const feature of features) {
      const props = feature.properties || {};
      // Only process zones from selected centers
      if (props.center_id && centerIdSet.has(props.center_id)) {
        const id = String(feature.id);
        zoneMap.set(id, {
          danger_level: props.danger_level ?? -1,
          start_date: props.start_date || null,
          end_date: props.end_date || null,
          name: props.name || 'Unknown Zone',
        });
        console.log(`Map-layer: ${props.name} (ID: ${id}, center: ${props.center_id}), danger: ${props.danger_level}`);
      }
    }
    console.log(`Found ${zoneMap.size} zones from ${selectedCenterIds.length} selected centers in map-layer`);
  } catch (error) {
    console.error('Error fetching map-layer:', error);
  }
  return zoneMap;
}

// ── UAC (Utah Avalanche Center) custom API integration ──
// UAC doesn't populate the NAC API — they have their own JSON endpoint
const UAC_API_BASE = 'https://utahavalanchecenter.org/forecast';

// Parse UAC danger rose: 24 values = 3 elevation bands × 8 aspects
// Values are danger_level × 2 (0=none, 2=low, 4=moderate, 6=considerable, 8=high, 10=extreme)
function parseUacDangerRose(roseStr: string): { alpine: string; treeline: string; belowTreeline: string } {
  if (!roseStr) return { alpine: 'NO_RATING', treeline: 'NO_RATING', belowTreeline: 'NO_RATING' };
  const values = roseStr.split(',').map(v => Number(v.trim()));
  // 24 values: first 8 = upper (alpine), next 8 = middle (treeline), last 8 = lower (below treeline)
  const maxInRange = (start: number, end: number) => {
    let max = 0;
    for (let i = start; i < end && i < values.length; i++) {
      if (values[i] > max) max = values[i];
    }
    return max;
  };
  const roseToRating = (val: number): string => {
    const level = Math.round(val / 2);
    return mapDangerRating(level);
  };
  return {
    alpine: roseToRating(maxInRange(0, 8)),
    treeline: roseToRating(maxInRange(8, 16)),
    belowTreeline: roseToRating(maxInRange(16, 24)),
  };
}

// Parse UAC per-problem aspect rose: 14 = present, 16 = absent
function parseUacProblemRose(roseStr: string): Array<{ elevation: string; aspects: string[] }> {
  if (!roseStr) return [];
  const values = roseStr.split(',').map(v => Number(v.trim()));
  const aspectNames = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const elevBands = [
    { name: 'Alpine', start: 0 },
    { name: 'Treeline', start: 8 },
    { name: 'Below Treeline', start: 16 },
  ];
  const result: Array<{ elevation: string; aspects: string[] }> = [];
  for (const band of elevBands) {
    const aspects: string[] = [];
    for (let i = 0; i < 8 && (band.start + i) < values.length; i++) {
      if (values[band.start + i] === 14) {
        aspects.push(aspectNames[i]);
      }
    }
    if (aspects.length > 0) {
      result.push({ elevation: band.name, aspects });
    }
  }
  return result;
}

// Fetch and parse a UAC forecast into our ZoneData format
async function fetchUacForecast(regionSlug: string, config: typeof ZONE_CONFIG[0]): Promise<{
  success: boolean;
  zoneData?: {
    forecast: Array<{ date: string; danger: { alpine: string; treeline: string; belowTreeline: string } }>;
    problems: Array<{ name: string; likelihood: string | null; size: { min: number; max: number } | null; aspects: Array<{ elevation: string; aspects: string[] }>; discussion: string | null }>;
    bottomLine: string;
    hazardDiscussion: string;
    weather: { snow: string; wind: string; temps: string; discussion: string | null };
    publishedTime: string | null;
    expiresTime: string | null;
  };
}> {
  try {
    const url = `${UAC_API_BASE}/${regionSlug}/json`;
    console.log(`Fetching UAC API: ${url}`);
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) {
      console.error(`UAC API error for ${regionSlug}: ${resp.status}`);
      return { success: false };
    }
    const data = await resp.json();
    const advisory = data?.advisories?.[0]?.advisory;
    if (!advisory) {
      console.error(`No advisory data for UAC ${regionSlug}`);
      return { success: false };
    }

    // Parse danger ratings from the overall danger rose
    const todayDanger = parseUacDangerRose(advisory.overall_danger_rose);

    // Parse avalanche problems (up to 3)
    const problems: Array<{ name: string; likelihood: string | null; size: { min: number; max: number } | null; aspects: Array<{ elevation: string; aspects: string[] }>; discussion: string | null }> = [];
    for (let i = 1; i <= 3; i++) {
      const name = advisory[`avalanche_problem_${i}`];
      if (!name || name.trim() === '') continue;
      const description = advisory[`avalanche_problem_${i}_description`] || '';
      const roseStr = advisory[`danger_rose_${i}`] || '';
      problems.push({
        name,
        likelihood: null, // UAC doesn't provide likelihood separately — it's in the description
        size: null, // UAC doesn't provide structured size
        aspects: parseUacProblemRose(roseStr),
        discussion: stripHtml(description),
      });
    }

    // Parse published time
    let publishedTime: string | null = null;
    if (advisory.date_issued_timestamp) {
      publishedTime = new Date(Number(advisory.date_issued_timestamp) * 1000).toISOString();
    }

    // UAC forecasts typically expire ~24 hours after issue
    let expiresTime: string | null = null;
    if (publishedTime) {
      const expires = new Date(new Date(publishedTime).getTime() + 24 * 60 * 60 * 1000);
      expiresTime = expires.toISOString();
    }

    // Build weather from mountain_weather field
    const weatherText = stripHtml(advisory.mountain_weather) || '';

    console.log(`UAC ${regionSlug}: ${problems.length} problems, danger=${advisory.overall_danger_rating}`);

    return {
      success: true,
      zoneData: {
        forecast: [
          { date: 'Today', danger: todayDanger },
          { date: 'Tomorrow', danger: todayDanger }, // UAC only provides current day
        ],
        problems,
        bottomLine: stripHtml(advisory.bottom_line) || '',
        hazardDiscussion: stripHtml(advisory.current_conditions) || '',
        weather: {
          snow: 'N/A',
          wind: 'N/A',
          temps: 'N/A',
          discussion: weatherText,
        },
        publishedTime,
        expiresTime,
      },
    };
  } catch (error) {
    console.error(`Error fetching UAC ${regionSlug}:`, error);
    return { success: false };
  }
}

// Extract danger ratings from forecast
function extractDangerRatings(forecast: any): {
  today: { alpine: string; treeline: string; belowTreeline: string };
  tomorrow: { alpine: string; treeline: string; belowTreeline: string };
} | null {
  const dangerData = forecast?.danger || [];
  if (dangerData.length === 0) return null;
  
  const todayDanger = dangerData[0] || {};
  const tomorrowDanger = dangerData[1] || dangerData[0] || {};

  return {
    today: {
      alpine: mapDangerRating(todayDanger.upper),
      treeline: mapDangerRating(todayDanger.middle),
      belowTreeline: mapDangerRating(todayDanger.lower),
    },
    tomorrow: {
      alpine: mapDangerRating(tomorrowDanger.upper),
      treeline: mapDangerRating(tomorrowDanger.middle),
      belowTreeline: mapDangerRating(tomorrowDanger.lower),
    },
  };
}

// Map elevation band name to standardized form
function normalizeElevation(elevName: string): string {
  const lower = elevName.toLowerCase();
  if (lower.includes('alpine') || lower.includes('upper')) return 'Alpine';
  if (lower.includes('treeline') || lower.includes('middle')) return 'Treeline';
  if (lower.includes('below') || lower.includes('lower')) return 'Below Treeline';
  return elevName;
}

// Strip HTML tags from a string, returning plain text
function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim() || null;
}

// Map aspect abbreviation from NAC API location strings
const ASPECT_MAP: Record<string, string> = {
  'north': 'N', 'northeast': 'NE', 'east': 'E', 'southeast': 'SE',
  'south': 'S', 'southwest': 'SW', 'west': 'W', 'northwest': 'NW',
};

// Extract avalanche problems with detailed aspect/elevation data
function extractProblems(forecast: any): Array<{
  name: string;
  likelihood: string | null;
  size: { min: number; max: number } | null;
  aspects: Array<{ elevation: string; aspects: string[] }>;
  discussion: string | null;
  problemDescription: string | null;
  iconUrl: string | null;
}> {
  const problems = forecast?.forecast_avalanche_problems || [];
  return problems.slice(0, 4).map((p: any) => {
    // Extract aspect/elevation data from the API
    // NAC API returns location as an array of strings like "north upper", "southeast middle"
    const locationData: any[] = p.location || [];
    const elevAspectMap = new Map<string, Set<string>>();

    for (const loc of locationData) {
      if (typeof loc === 'string') {
        // String format: "north upper", "southeast middle", "west lower"
        const parts = loc.toLowerCase().split(' ');
        const aspectKey = parts[0]; // e.g. "north", "southeast"
        const elevKey = parts[1] || 'unknown'; // e.g. "upper", "middle", "lower"
        const aspect = ASPECT_MAP[aspectKey];
        if (aspect) {
          const elevation = normalizeElevation(elevKey);
          if (!elevAspectMap.has(elevation)) elevAspectMap.set(elevation, new Set());
          elevAspectMap.get(elevation)!.add(aspect);
        }
      } else if (typeof loc === 'object' && loc !== null) {
        // Object format (legacy): { north: true, east: true, elev_name: "upper" }
        const activeAspects: string[] = [];
        for (const [key, abbr] of Object.entries(ASPECT_MAP)) {
          if (loc[key]) activeAspects.push(abbr);
        }
        const elevation = normalizeElevation(loc.elev_name || loc.elevation || 'Unknown');
        if (activeAspects.length > 0) {
          if (!elevAspectMap.has(elevation)) elevAspectMap.set(elevation, new Set());
          activeAspects.forEach(a => elevAspectMap.get(elevation)!.add(a));
        }
      }
    }

    // Convert map to sorted array (Alpine first, then Treeline, then Below Treeline)
    const elevOrder = ['Alpine', 'Treeline', 'Below Treeline'];
    const aspects = Array.from(elevAspectMap.entries())
      .sort((a, b) => elevOrder.indexOf(a[0]) - elevOrder.indexOf(b[0]))
      .map(([elevation, aspectSet]) => ({
        elevation,
        aspects: Array.from(aspectSet),
      }));

    // Parse size - API returns as array of strings: ["1", "2.5"]
    let size: { min: number; max: number } | null = null;
    if (Array.isArray(p.size) && p.size.length >= 2) {
      size = { min: Number(p.size[0]), max: Number(p.size[1]) };
    } else if (p.size?.min !== undefined && p.size?.max !== undefined) {
      size = { min: Number(p.size.min), max: Number(p.size.max) };
    }

    return {
      name: p.name || p.avalanche_problem_id || 'Unknown Problem',
      likelihood: p.likelihood || null,
      size,
      aspects,
      discussion: stripHtml(p.discussion),
      problemDescription: stripHtml(p.problem_description),
      iconUrl: typeof p.icon === 'string' ? p.icon : null,
    };
  });
}

// Extract weather summary from forecast - checks multiple locations for weather info
function extractWeather(forecast: any): {
  snow: string;
  wind: string;
  temps: string;
  discussion: string | null;
} {
  // Check multiple locations for weather data
  const weather = forecast?.weather_data || forecast?.weather_summary || null;
  
  // Gather all possible weather-related text for AI extraction
  const weatherTexts: string[] = [];
  
  // Check weather_summary and weather_discussion
  if (forecast?.weather_summary?.weather_discussion) {
    weatherTexts.push(forecast.weather_summary.weather_discussion);
  }
  if (forecast?.weather_discussion) {
    weatherTexts.push(forecast.weather_discussion);
  }
  
  // Check bottom_line - often contains weather info
  if (forecast?.bottom_line) {
    weatherTexts.push(`BOTTOM LINE: ${forecast.bottom_line}`);
  }
  
  // Check hazard_discussion - sometimes mentions recent snow
  if (forecast?.hazard_discussion) {
    weatherTexts.push(`HAZARD DISCUSSION: ${forecast.hazard_discussion}`);
  }
  
  // Check forecast_zone for weather synopsis
  if (forecast?.forecast_zone?.weather_synopsis) {
    weatherTexts.push(forecast.forecast_zone.weather_synopsis);
  }
  
  // Combine all weather-related text
  const weatherDiscussion = weatherTexts.length > 0 ? weatherTexts.join('\n\n') : null;
  
  if (weatherDiscussion) {
    console.log(`Found weather text (${weatherDiscussion.length} chars)`);
  }
  
  // Try to extract structured fields if available
  let snow = 'N/A';
  let wind = 'N/A';
  let temps = 'N/A';
  
  if (weather) {
    // Try multiple field names for snow
    const snowVal = weather.new_snow_24hr || weather.snow_24hr || weather.recent_snow || 
                    weather.new_snow || weather.snowfall_24hr || null;
    if (snowVal !== null && snowVal !== undefined) {
      snow = typeof snowVal === 'number' ? `${snowVal}"` : snowVal;
    }
    
    // Try multiple field names for wind
    const windVal = weather.wind_summary || weather.ridgeline_winds || weather.wind || null;
    if (windVal) wind = windVal;
    
    // Try multiple field names for temps
    const tempsVal = weather.temperature_summary || weather.temps || weather.temperature || null;
    if (tempsVal) temps = tempsVal;
  }
  
  return {
    snow: snow,
    wind: wind,
    temps: temps,
    discussion: weatherDiscussion,
  };
}

// Build zone data from all sources
interface ZoneData {
  id: string;
  nacZoneId: string;
  name: string;
  center: string;
  forecastUrl: string;
  forecast: Array<{ date: string; danger: { alpine: string; treeline: string; belowTreeline: string } }>;
  problems: Array<{
    name: string;
    likelihood: string | null;
    size: { min: number; max: number } | null;
    aspects: Array<{ elevation: string; aspects: string[] }>;
    discussion: string | null;
    problemDescription: string | null;
    iconUrl: string | null;
  }>;
  weather: { snow: string; wind: string; temps: string; discussion: string | null };
  bottomLine: string;
  hazardDiscussion: string;
  weatherDiscussion: string | null;
  announcement: string | null;
  author: string | null;
  freshness: {
    issueDate: string | null;
    expiresDate: string | null;
    ageHours: number | null;
    hoursUntilExpiry: number | null;
    status: 'current' | 'recent' | 'expiring' | 'expired' | 'unknown';
  };
  dataSource: 'api' | 'scrape' | 'map-layer';
  scrapedContent: string | null;
  publishedTime: string | null; // ISO timestamp for cache key
  expiresTime: string | null;   // ISO timestamp for expiration (used for cache storage)
}

// Cache status for logging/debugging
type CacheStatus = 'hit' | 'miss' | 'stored' | 'error';

// NOTE: the avalanche_forecast_cache read/write/rebuild helpers
// (checkForecastCache / storeForecastCache / buildZoneDataFromCache) and
// their CacheEntry type were removed — that table does not exist in the
// production project, so every call errored and was swallowed. The
// synthesized-results write to avalanche_daily_forecasts was removed for
// the same reason. `CacheStatus` is kept only for the response's
// per-zone cacheStatus field, which now always reports "miss".

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // No AI gateway needed — keyMessage and travelAdvice are derived
    // deterministically from the structured forecast fields NAC already
    // returns (bottomLine, hazardDiscussion, danger ratings).

    // Parse request body to get zone selection
    const body = await req.json().catch(() => ({}));
    const requestedZoneIds = body?.zoneIds;

    // Filter zones based on user selection (default to all zones if not specified)
    const zonesToProcess = requestedZoneIds && Array.isArray(requestedZoneIds) && requestedZoneIds.length > 0
      ? ZONE_CONFIG.filter(zone => requestedZoneIds.includes(zone.id))
      : ZONE_CONFIG;

    console.log(`Fetching avalanche forecasts for ${zonesToProcess.length} zone(s)...`);
    if (requestedZoneIds) {
      console.log(`Requested zones: ${requestedZoneIds.join(', ')}`);
    }

    // Step 1: Get map-layer data for timestamps and overall danger
    // Only fetch data for centers that are in the selected zones
    const selectedCenterIds = [...new Set(zonesToProcess.map(z => z.centerId))];
    console.log(`Selected centers: ${selectedCenterIds.join(', ')}`);
    const mapLayerData = await fetchMapLayerData(selectedCenterIds);

    // Step 2: Fetch individual zone forecasts with cache-aside pattern
    const cacheStatuses = new Map<string, CacheStatus>();
    
    const zoneDataPromises = zonesToProcess.map(async (config): Promise<ZoneData> => {
      const mapData = mapLayerData.get(config.nacZoneId);
      
      // Fetch from NAC API first to get published_time (this is always needed to check cache validity)
      const forecast = await fetchZoneForecast(config.centerId, config.nacZoneId);
      
      // Get published_time from API response (preferred) or map-layer (fallback)
      const publishedTime = forecast?.published_time || mapData?.start_date || null;
      const expiresTime = forecast?.expires_time || mapData?.end_date || null;
      
      // (Removed a dead avalanche_forecast_cache read that used to sit
      // here — the table doesn't exist in prod, so the lookup always
      // errored and fell through, costing a round-trip per zone for
      // nothing. Process the NAC API response we already fetched.)
      console.log(`Processing API response for ${config.name}...`);
      const freshness = calculateFreshness(publishedTime, expiresTime, config.timezone);
      
      // If API returned good data
      if (forecast) {
        const dangerRatings = extractDangerRatings(forecast);
        const problems = extractProblems(forecast);
        const weather = extractWeather(forecast);
        const bottomLine = forecast.bottom_line || '';
        const hazardDiscussion = forecast.hazard_discussion || '';
        const weatherDiscussion = forecast.weather_discussion || null;
        const announcement = forecast.announcement || null;
        const author = forecast.author || null;

        if (dangerRatings) {
          console.log(`API success for ${config.name}: ${problems.length} problems, freshness=${freshness.status}`);
          const zoneData: ZoneData = {
            id: config.id,
            nacZoneId: config.nacZoneId,
            name: config.name,
            center: config.centerId,
            forecastUrl: config.forecastUrl,
            forecast: [
              { date: 'Today', danger: dangerRatings.today },
              { date: 'Tomorrow', danger: dangerRatings.tomorrow },
            ],
            problems,
            weather,
            bottomLine,
            hazardDiscussion,
            weatherDiscussion: stripHtml(weatherDiscussion),
            announcement: stripHtml(announcement),
            author,
            freshness,
            dataSource: 'api',
            scrapedContent: null,
            publishedTime: publishedTime,
            expiresTime: expiresTime,
          };

          return zoneData;
        }
      }
      
      // UAC-specific: Try UAC's own JSON API (they don't populate the NAC API)
      if (config.centerId === 'UAC') {
        const uacResult = await fetchUacForecast(config.id, config);
        if (uacResult.success && uacResult.zoneData) {
          const uacFreshness = calculateFreshness(uacResult.zoneData.publishedTime, uacResult.zoneData.expiresTime, config.timezone);
          const zoneData: ZoneData = {
            id: config.id,
            nacZoneId: config.nacZoneId,
            name: config.name,
            center: config.centerId,
            forecastUrl: config.forecastUrl,
            forecast: uacResult.zoneData.forecast,
            problems: uacResult.zoneData.problems.map((p) => ({
              ...p,
              problemDescription: null,
              iconUrl: null,
            })),
            weather: uacResult.zoneData.weather,
            bottomLine: uacResult.zoneData.bottomLine,
            hazardDiscussion: uacResult.zoneData.hazardDiscussion,
            weatherDiscussion: null,
            announcement: null,
            author: null,
            freshness: uacFreshness,
            dataSource: 'api',
            scrapedContent: null,
            publishedTime: uacResult.zoneData.publishedTime,
            expiresTime: uacResult.zoneData.expiresTime,
          };

          return zoneData;
        }
      }

      // Fallback: Try web scraping
      console.log(`API insufficient for ${config.name}, trying Firecrawl...`);
      const scrapeResult = await scrapeZoneForecast(config.fallbackUrl, config.name);
      
      if (scrapeResult.success && scrapeResult.markdown) {
        // Use map-layer for danger ratings, scrape for details
        const overallDanger = mapDangerRating(mapData?.danger_level ?? -1);
        console.log(`Scrape success for ${config.name}, using map-layer danger: ${overallDanger}`);
        
        const zoneData: ZoneData = {
          id: config.id,
          nacZoneId: config.nacZoneId,
          name: config.name,
          center: config.centerId,
          forecastUrl: config.forecastUrl,
          forecast: [
            { date: 'Today', danger: { alpine: overallDanger, treeline: overallDanger, belowTreeline: overallDanger } },
            { date: 'Tomorrow', danger: { alpine: overallDanger, treeline: overallDanger, belowTreeline: overallDanger } },
          ],
          problems: [],
          weather: { snow: 'N/A', wind: 'N/A', temps: 'N/A', discussion: null },
          bottomLine: '',
          hazardDiscussion: '',
          weatherDiscussion: null,
          announcement: null,
          author: null,
          freshness,
          dataSource: 'scrape',
          scrapedContent: scrapeResult.markdown.slice(0, 8000), // Limit context size
          publishedTime: publishedTime,
          expiresTime: expiresTime,
        };

        return zoneData;
      }
      
      // Last resort: Map-layer only
      console.log(`Falling back to map-layer only for ${config.name}`);
      const overallDanger = mapDangerRating(mapData?.danger_level ?? -1);
      
      const zoneData: ZoneData = {
        id: config.id,
        nacZoneId: config.nacZoneId,
        name: config.name,
        center: config.centerId,
        forecastUrl: config.forecastUrl,
        forecast: [
          { date: 'Today', danger: { alpine: overallDanger, treeline: overallDanger, belowTreeline: overallDanger } },
          { date: 'Tomorrow', danger: { alpine: overallDanger, treeline: overallDanger, belowTreeline: overallDanger } },
        ],
        problems: [],
        weather: { snow: 'N/A', wind: 'N/A', temps: 'N/A', discussion: null },
        bottomLine: '',
        hazardDiscussion: '',
        weatherDiscussion: null,
        announcement: null,
        author: null,
        freshness,
        dataSource: 'map-layer',
        scrapedContent: null,
        publishedTime: publishedTime,
        expiresTime: expiresTime,
      };
      
      // Don't cache map-layer-only data (too sparse to be useful)
      cacheStatuses.set(config.id, 'miss');
      
      return zoneData;
    });

    const zonesData = await Promise.all(zoneDataPromises);
    console.log(`Built data for ${zonesData.length} zones`);

    // Log data sources and cache status
    zonesData.forEach(z => {
      const cacheStatus = cacheStatuses.get(z.id) || 'miss';
      console.log(`${z.name}: source=${z.dataSource}, cache=${cacheStatus}, freshness=${z.freshness.status}, problems=${z.problems.length}`);
    });

    // Step 2.5: Fetch weather station observations AND weather forecasts (in parallel)
    console.log('Fetching weather station observations and weather forecasts...');
    const weatherObservationsMap = new Map<string, StationObservation[]>();
    const weatherForecastMap = new Map<string, string>(); // centerId → weather discussion text

    try {
      // Fetch station observations per zone
      const stationFetchPromises = zonesData.map(async (zone) => {
        const stations = getStationsForZone(zone.id);
        if (stations.length === 0) {
          return { zoneId: zone.id, observations: [] };
        }
        const observations = await fetchMultipleStations(
          stations.map(s => ({ triplet: s.triplet, name: s.name, elevation: s.elevation }))
        );
        return { zoneId: zone.id, observations };
      });

      // Fetch NAC weather product per center (for weather forecast/outlook)
      const uniqueCenters = [...new Set(zonesData.map(z => z.center))];
      const weatherProductPromises = uniqueCenters.map(async (centerId) => {
        try {
          const url = `${NAC_API_BASE}/product?type=weather&center_id=${centerId}`;
          console.log(`Fetching NAC weather product for ${centerId}`);
          const response = await fetch(url, { headers: nacHeaders });
          if (!response.ok) return { centerId, discussion: null };
          const data = await response.json();
          // Strip HTML but preserve paragraph structure
          let discussion = data.weather_discussion || null;
          if (discussion) {
            discussion = discussion
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/<\/p>/gi, '\n\n')
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
              .replace(/&rdquo;|&ldquo;/g, '"').replace(/&rsquo;|&lsquo;/g, "'").replace(/&deg;/g, '°')
              .replace(/\n{3,}/g, '\n\n').trim();
          }
          return { centerId, discussion };
        } catch (err) {
          console.error(`Error fetching NAC weather for ${centerId}:`, err);
          return { centerId, discussion: null };
        }
      });

      // Fetch NOAA NWS forecast for centers without NAC weather
      // (done after NAC results are in, so we know which centers need NOAA)

      // Run station + NAC weather fetches in parallel
      const [stationResults, weatherProductResults] = await Promise.all([
        Promise.all(stationFetchPromises),
        Promise.all(weatherProductPromises),
      ]);

      stationResults.forEach(result => {
        weatherObservationsMap.set(result.zoneId, result.observations);
      });

      const centersWithNacWeather = new Set<string>();
      weatherProductResults.forEach(result => {
        if (result.discussion) {
          weatherForecastMap.set(result.centerId, result.discussion);
          centersWithNacWeather.add(result.centerId);
        }
      });

      console.log(`NAC weather forecasts available for: ${[...centersWithNacWeather].join(', ') || 'none'}`);

      // For centers without NAC weather, try NOAA NWS
      const centersNeedingNoaa = uniqueCenters.filter(c => !centersWithNacWeather.has(c));
      if (centersNeedingNoaa.length > 0) {
        console.log(`Fetching NOAA forecasts for: ${centersNeedingNoaa.join(', ')}`);
        const noaaPromises = centersNeedingNoaa.map(async (centerId) => {
          // Find a representative lat/lon from any zone in this center
          const zoneForCenter = zonesData.find(z => z.center === centerId);
          if (!zoneForCenter) return;
          const stations = getStationsForZone(zoneForCenter.id);
          if (stations.length === 0) return;
          const lat = stations[0].latitude;
          const lon = stations[0].longitude;
          try {
            const nwsHeaders = {
              'User-Agent': '(AvalancheComparison/1.0, kaimyers@alaskapacific.edu)',
              'Accept': 'application/geo+json',
            };
            const pointsResp = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, { headers: nwsHeaders });
            if (!pointsResp.ok) return;
            const pointsData = await pointsResp.json();
            const { gridId, gridX, gridY } = pointsData.properties;
            const forecastResp = await fetch(`https://api.weather.gov/gridpoints/${gridId}/${gridX},${gridY}/forecast?units=us`, { headers: nwsHeaders });
            if (!forecastResp.ok) return;
            const forecastData = await forecastResp.json();
            const periods = (forecastData.properties?.periods || []).slice(0, 6);
            if (periods.length > 0) {
              const nwsText = periods.map((p: any) => `${p.name}: ${p.detailedForecast}`).join('\n');
              weatherForecastMap.set(centerId, `[NWS Mountain Forecast]\n${nwsText}`);
              console.log(`NOAA forecast retrieved for ${centerId}`);
            }
          } catch (err) {
            console.error(`NOAA fetch error for ${centerId}:`, err);
          }
        });
        await Promise.all(noaaPromises);
      }
    } catch (error) {
      console.error('Error fetching weather data:', error);
      // Continue without weather data - graceful degradation
    }

    // Step 3: Build context for AI synthesis
    const forecastContext = zonesData.map(zone => {
      const todayDanger = zone.forecast[0].danger;
      const tomorrowDanger = zone.forecast[1].danger;
      
      let context = `
=== ZONE ID: "${zone.id}" | ${zone.name} (${zone.center}) ===
Data Source: ${zone.dataSource.toUpperCase()}
Issued: ${zone.freshness.issueDate || 'Unknown'} | Expires: ${zone.freshness.expiresDate || 'Unknown'} | Status: ${zone.freshness.status}

TODAY'S DANGER:
- Alpine: ${todayDanger.alpine}
- Treeline: ${todayDanger.treeline}  
- Below Treeline: ${todayDanger.belowTreeline}

TOMORROW'S DANGER:
- Alpine: ${tomorrowDanger.alpine}
- Treeline: ${tomorrowDanger.treeline}
- Below Treeline: ${tomorrowDanger.belowTreeline}

WEATHER:
- Snow: ${zone.weather.snow}
- Wind: ${zone.weather.wind}
- Temps: ${zone.weather.temps}
${zone.weather.discussion ? `- Discussion: ${zone.weather.discussion}` : ''}

AVALANCHE PROBLEMS:`;

      if (zone.problems.length > 0) {
        zone.problems.forEach(p => {
          context += `\n- ${p.name}`;
          if (p.likelihood) context += ` | Likelihood: ${p.likelihood}`;
          if (p.size) context += ` | Size: D${p.size.min}-D${p.size.max}`;
          if (p.aspects.length > 0) {
            context += `\n  Elevation/Aspect:`;
            p.aspects.forEach(a => {
              context += `\n    - ${a.elevation}: ${a.aspects.join(', ')}`;
            });
          }
          if (p.discussion) context += `\n  Discussion: ${p.discussion.slice(0, 400)}`;
        });
      } else {
        context += '\nNone listed';
      }

      if (zone.bottomLine) {
        context += `\n\nBOTTOM LINE:\n${zone.bottomLine.slice(0, 500)}`;
      }

      if (zone.hazardDiscussion) {
        context += `\n\nHAZARD DISCUSSION:\n${zone.hazardDiscussion.slice(0, 500)}`;
      }

      // Include scraped content for AI to parse
      if (zone.scrapedContent) {
        context += `\n\nSCRAPED FORECAST PAGE:\n${zone.scrapedContent}`;
      }

      // Include weather station observations
      const observations = weatherObservationsMap.get(zone.id) || [];
      if (observations.length > 0) {
        context += `\n\n=== WEATHER STATION OBSERVATIONS (ACTUAL MEASUREMENTS) ===`;
        observations.forEach(obs => {
          const obsDate = new Date(obs.timestamp);
          const hoursAgo = Math.round((Date.now() - obsDate.getTime()) / (1000 * 60 * 60));

          context += `\n\nStation: ${obs.stationName} (${obs.stationTriplet})`;
          context += `\nTimestamp: ${obs.timestamp} (${hoursAgo} hours ago)`;
          context += `\nData Quality: ${obs.dataQuality.toUpperCase()}`;

          // Snow observations
          context += `\n\nSNOW OBSERVATIONS:`;
          if (obs.snow.depth !== null) context += `\n  - Current depth: ${obs.snow.depth}"`;
          if (obs.snow.depth24hrChange !== null) {
            const change = obs.snow.depth24hrChange > 0 ? `+${obs.snow.depth24hrChange}` : obs.snow.depth24hrChange;
            context += `\n  - 24hr change: ${change}" `;
          }
          if (obs.snow.depth7dayChange !== null) {
            const change = obs.snow.depth7dayChange > 0 ? `+${obs.snow.depth7dayChange}` : obs.snow.depth7dayChange;
            context += `\n  - 7-day change: ${change}"`;
          }
          if (obs.snow.precip24hr !== null) context += `\n  - Precipitation 24hr: ${obs.snow.precip24hr}"`;
          if (obs.snow.precip48hr !== null) context += `\n  - Precipitation 48hr: ${obs.snow.precip48hr}"`;
          if (obs.snow.precip7day !== null) context += `\n  - Precipitation 7-day: ${obs.snow.precip7day}"`;
          if (obs.snow.swe !== null) context += `\n  - SWE: ${obs.snow.swe}"`;

          // Temperature observations
          context += `\n\nTEMPERATURE OBSERVATIONS:`;
          if (obs.temperature.current !== null) context += `\n  - Current: ${obs.temperature.current}°F`;
          if (obs.temperature.high24hr !== null) context += `\n  - 24hr high: ${obs.temperature.high24hr}°F`;
          if (obs.temperature.low24hr !== null) context += `\n  - 24hr low: ${obs.temperature.low24hr}°F`;
          if (obs.temperature.trend) context += `\n  - Trend: ${obs.temperature.trend.toUpperCase()}`;

          // Wind observations (if available)
          if (obs.wind) {
            context += `\n\nWIND OBSERVATIONS:`;
            if (obs.wind.speedAvg24hr !== null) context += `\n  - 24hr average: ${obs.wind.speedAvg24hr} mph`;
            if (obs.wind.speedMax24hr !== null) context += `\n  - 24hr max: ${obs.wind.speedMax24hr} mph`;
            if (obs.wind.direction) context += `\n  - Direction: ${obs.wind.direction}`;
          }
        });

        // Add comparison instructions for AI
        context += `\n\n**IMPORTANT**: Compare the WEATHER OBSERVATIONS above with the forecast WEATHER section.`;
        context += `\nNote any discrepancies or confirmations between predicted and actual measurements.`;
      }

      // Include weather forecast/outlook for this zone's center
      const weatherForecast = weatherForecastMap.get(zone.center);
      if (weatherForecast) {
        context += `\n\n=== WEATHER FORECAST / OUTLOOK (NEXT 2-3 DAYS) ===`;
        context += `\n${weatherForecast.slice(0, 2000)}`;
      }

      return context;
    }).join('\n\n---\n\n');

const systemPrompt = `<role>You are an expert avalanche safety analyst synthesizing structured forecast data, weather forecasts, and weather station observations into actionable guidance.</role>

<context>
The user sees your quickTake as the first thing on the page, above a comparison table and individual zone cards. Each zone card already shows: danger ratings, avalanche problems, travel advice, weather outlook (forecaster discussion + NWS mountain forecast), and live weather station observations. Your quickTake adds value by SYNTHESIZING across zones — the cards handle per-zone detail.

The data you receive includes:
- Avalanche danger ratings (today + tomorrow) per zone
- Avalanche problems with likelihood, size, and aspect/elevation
- Weather forecast / outlook for the next 2-3 days (from avalanche center forecasters or NWS)
- Live weather station observations (actual measurements: snow depth, precipitation, temperature, wind)
</context>

<instructions>
QUICK TAKE — Scale your response based on zone count:

For 1-2 zones: Write 3-5 sentences for someone planning a specific trip. Name the zone(s). State danger ratings and primary avalanche problem(s). Describe the 2-3 day weather forecast (storms, wind, temps). Reference station observations when they confirm or contradict the forecast.

For 3-6 zones: Write 3-5 sentences comparing conditions. Identify whether danger is uniform or varies. Name the dominant problem type(s). Summarize the 2-3 day weather outlook. Call out any zone that stands out.

For 7+ zones: Write at most 6 sentences synthesizing the ENTIRE region. Characterize the overall danger range in 1 sentence. Name the 1-2 dominant problem types in 1 sentence. Describe the regional 2-3 day weather pattern in 1-2 sentences. Flag standout areas (higher danger, expired forecasts, no data) in 1 sentence. Use area names and patterns, not individual zone names.

For ALL zone counts: Lead with the most critical safety information. Focus on the next 2-3 days. Use the WEATHER FORECAST / OUTLOOK data — incoming storms, wind events, and temperature changes are the most actionable information. Reference station measurements when they tell a meaningful story.
</instructions>

<examples>
EXAMPLE — 1 zone (Turnagain Pass):
"Turnagain Pass is rated Moderate at all elevations today, increasing to Considerable in the Alpine tomorrow. Wind Slab is the primary concern on north-through-east aspects above treeline, with recent skier-triggered activity confirming reactivity. A storm system moves in tonight bringing 8-14 inches of snow with SW ridgeline winds gusting to 55 mph, significantly increasing wind slab potential. Stations at Turnagain recorded +6 inches and 0.8 inches SWE in the last 24 hours with temperatures holding in the mid-20s."

EXAMPLE — 4 zones (CNFAIC center):
"Danger across the Chugach National Forest zones is mostly Low today, rising to Moderate in Alpine terrain tomorrow as winds increase. Persistent Slab on buried facets remains an isolated concern at upper elevations, while Loose Dry sluffs require sluff management on steep terrain. An incoming front tonight brings 6-12 inches with strengthening SW winds — expect fresh wind slabs forming on north-facing alpine terrain by tomorrow morning. The Chugach State Park forecast is expired; check cnfaic.org for updates."

EXAMPLE — 15 zones (all Alaska):
"Avalanche danger across Alaska ranges from Low to Moderate, with most areas seeing stable conditions today and increasing wind slab concerns tomorrow as a Pacific front pushes through. Persistent weak layers (buried facets) remain a lurking concern across Southcentral zones, and wind slab will become the dominant problem as ridgeline winds ramp up to 40-60 mph overnight. Stations are reporting 4-8 inches of new snow across the Chugach with more on the way — 8-14 inches expected through tomorrow. Several forecast zones in the Haines and Eastern Alaska Range areas are expired or have no current ratings; exercise extra caution and check official sources before traveling in those areas."
</examples>

<output_format>
Return valid JSON with this structure:
{
  "quickTake": "See instructions and examples above",
  "zones": [
    {
      "id": "EXACT_ZONE_ID_FROM_DATA",
      "name": "Zone Name",
      "forecastUrl": "URL from the zone config",
      "forecast": [
        { "date": "Today", "danger": { "alpine": "RATING", "treeline": "RATING", "belowTreeline": "RATING" } },
        { "date": "Tomorrow", "danger": { "alpine": "RATING", "treeline": "RATING", "belowTreeline": "RATING" } }
      ],
      "weather": { "snow": "Amount/discussion", "wind": "Description", "temps": "Range" },
      "problems": [
        {
          "name": "Problem name",
          "likelihood": "Possible/Likely/Very Likely/Certain",
          "size": { "min": 1, "max": 3 },
          "aspects": [
            { "elevation": "Alpine", "aspects": ["N", "NE", "NW"] }
          ],
          "discussion": "Brief 1-2 sentence explanation"
        }
      ],
      "keyMessage": "Most important thing — integrate danger, weather forecast, and problems",
      "travelAdvice": "Specific terrain selection recommendations",
      "weatherValidation": "confirmed | partial | discrepancy | no_data"
    }
  ],
  "weatherHighlights": "2-3 day weather outlook: recent precipitation, forecast snow/wind/temps, and how weather is affecting the snowpack. Integrate station measurements."
}
</output_format>

<constraints>
- Use EXACT zone IDs and danger ratings from the data. Do not modify them.
- Extract weather from discussion text when structured fields show "N/A".
- Base every claim on data provided. If data is missing, state it is unavailable.
- For expired forecasts, mention this in keyMessage.
- For NO_RATING zones, recommend checking the official source.
- Include weatherValidation for every zone ("confirmed", "partial", "discrepancy", or "no_data").
- Extract avalanche problems with full detail: name, likelihood, size (D1-D5), aspects/elevation, discussion.
- When station observations exist, compare them with forecast and note confirmations or discrepancies.
- When forecast weather is unavailable but station observations exist, use only measured data.
</constraints>`;

    // Build scope context for the AI
    const centerNames = [...new Set(zonesData.map(z => z.center))];
    const numZones = zonesData.length;
    const numCenters = centerNames.length;

    let scopeDescription: string;
    let scopeGuidance: string;

    if (numZones === 1) {
      scopeDescription = `Single zone: ${zonesData[0].name} (${zonesData[0].center})`;
      scopeGuidance = `1 zone — use the focused (1-2 zone) quickTake style from the examples.`;
    } else if (numZones <= 3 && numCenters === 1) {
      scopeDescription = `${numZones} zones within ${centerNames[0]}: ${zonesData.map(z => z.name).join(', ')}`;
      scopeGuidance = `${numZones} zones in one center — use the focused (1-2 zone) or center (3-6 zone) quickTake style.`;
    } else if (numZones <= 6) {
      scopeDescription = `${numZones} zones across ${numCenters} center(s): ${centerNames.join(', ')}`;
      scopeGuidance = `${numZones} zones — use the center/sub-regional (3-6 zone) quickTake style.`;
    } else {
      scopeDescription = `${numZones} zones across ${numCenters} centers: ${centerNames.join(', ')}`;
      scopeGuidance = `${numZones} zones — use the regional (7+ zone) quickTake style. Write at most 6 synthesized sentences. Do NOT walk through zones individually.`;
    }

    // Avoid the unused-variable warning while keeping the prompt scaffolding
    // intact for future use (if we ever wire AI back in).
    void scopeDescription; void scopeGuidance; void forecastContext; void systemPrompt;

    // Deterministic synthesis: NAC's structured forecast already gives us
    // bottomLine + hazardDiscussion + danger ratings + problems. Build
    // keyMessage and travelAdvice from those rather than asking an LLM
    // to rewrite them.
    // Defensive: stripHtml can return null/undefined for null/undefined input.
    // Coerce every result before string ops.
    function safeStrip(s: any): string {
      if (s === null || s === undefined) return '';
      const stripped = stripHtml(String(s));
      return typeof stripped === 'string' ? stripped : '';
    }

    function firstSentence(s: any, max = 240): string {
      const trimmed = safeStrip(s).trim();
      if (!trimmed) return '';
      const dot = trimmed.search(/[.!?]\s/);
      const cut = dot > 30 && dot < max ? dot + 1 : Math.min(trimmed.length, max);
      return trimmed.slice(0, cut).trim();
    }

    function deriveKeyMessage(zone: typeof zonesData[number]): string {
      const lead = firstSentence(zone.bottomLine || zone.hazardDiscussion || '', 240);
      if (lead) return lead;
      const today = zone.forecast?.[0]?.danger;
      if (today) {
        const ratings = [today.alpine, today.treeline, today.belowTreeline]
          .filter((r) => r && r !== 'NO_RATING');
        const order = ['LOW','MODERATE','CONSIDERABLE','HIGH','EXTREME'];
        const top = ratings.sort(
          (a: string, b: string) => order.indexOf(b) - order.indexOf(a),
        )[0];
        if (top) return `Today's avalanche danger is ${String(top).toLowerCase()}. Read the official forecast before planning your day.`;
      }
      return 'Read the official forecast before planning your day.';
    }

    function deriveTravelAdvice(zone: typeof zonesData[number]): string {
      const bl = safeStrip(zone.bottomLine).trim();
      if (bl) return bl;
      const hd = safeStrip(zone.hazardDiscussion).trim();
      if (hd) return hd.length > 600 ? hd.slice(0, 600) + '…' : hd;
      return 'Refer to the official forecast for terrain and travel guidance.';
    }

    const summary = {
      quickTake: '',
      weatherHighlights: '',
      bottomLine: '',
      zones: zonesData.map((z) => ({
        id: z.id,
        name: z.name,
        keyMessage: deriveKeyMessage(z),
        travelAdvice: deriveTravelAdvice(z),
        weatherValidation: 'no_data' as const,
      })),
    };

    // Filter would only matter if AI hallucinated zones; deterministic
    // synthesis can't, but keep the same shape for the merge below.
    const filteredZones = summary.zones;

    const zonesWithMetadata = filteredZones.map((zone: any, index: number) => {
      // Match by exact ID first
      let sourceData = zonesData.find(z => z.id === zone.id);
      
      // Fallback matching
      if (!sourceData && zone.name) {
        sourceData = zonesData.find(z => 
          z.name.toLowerCase() === zone.name.toLowerCase() ||
          normalizeZoneName(z.name) === normalizeZoneName(zone.name)
        );
      }
      
      // Index-based fallback
      if (!sourceData && zonesData.length === summary.zones.length) {
        sourceData = zonesData[index];
        console.log(`Index fallback: ${zone.name} -> ${sourceData?.name}`);
      }
      
      if (sourceData) {
        console.log(`Matched: ${zone.name} -> ${sourceData.name} (${sourceData.id}), source=${sourceData.dataSource}, freshness=${sourceData.freshness.status}`);
      } else {
        console.log(`No match for: ${zone.name}`);
      }
      
      // Get weather observations for this zone
      const observations = sourceData ? weatherObservationsMap.get(sourceData.id) || [] : [];

      return {
        ...zone,
        // Structured fields come straight from the API extraction, not from
        // any synthesis layer. We carry through every text field NAC ships.
        forecast: sourceData?.forecast || zone.forecast,
        problems: sourceData?.problems || zone.problems,
        hazardDiscussion: stripHtml(sourceData?.hazardDiscussion) || undefined,
        weatherDiscussion: sourceData?.weatherDiscussion || undefined,
        announcement: sourceData?.announcement || undefined,
        author: sourceData?.author || undefined,
        forecastUrl: sourceData?.forecastUrl || zone.forecastUrl || '',
        freshness: sourceData?.freshness || {
          issueDate: null,
          expiresDate: null,
          ageHours: null,
          hoursUntilExpiry: null,
          status: 'unknown'
        },
        dataSource: sourceData?.dataSource || 'unknown',
        weatherObservations: observations.length > 0 ? observations : undefined,
      };
    });

    console.log('Summary generated successfully');

    // (Removed the write to avalanche_daily_forecasts here — that table
    // doesn't exist in prod, so every upsert errored and was swallowed.
    // It also carried the display-string→timestamp bug: freshness.issueDate
    // is a formatted label like "May 1, 2:00 PM", not an ISO string, so
    // new Date(...) mis-parsed it. The real forecast cache is written by
    // the refresh-forecast-cache cron into forecast_cache.)

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          ...summary,
          zones: zonesWithMetadata,
        },
        scrapedAt: new Date().toISOString(),
        zonesScraped: zonesData.map(z => ({
          id: z.id,
          nacZoneId: z.nacZoneId,
          name: z.name,
          center: z.center,
          success: true,
          dataSource: z.dataSource,
          cacheStatus: cacheStatuses.get(z.id) || 'miss',
          freshness: z.freshness,
        })),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in avalanche-summary:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
