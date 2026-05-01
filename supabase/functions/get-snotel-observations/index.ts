import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { fetchMultipleStations } from '../_shared/synoptic-api.ts';
import { getStationsForZone } from '../_shared/weather-station-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const zoneIds: string[] = body?.zoneIds || [];

    if (zoneIds.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No zone IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching SNOTEL observations for ${zoneIds.length} zones`);

    const results: Record<string, any[]> = {};

    const fetchPromises = zoneIds.map(async (zoneId) => {
      const stations = getStationsForZone(zoneId);
      if (stations.length === 0) {
        console.log(`No weather stations configured for ${zoneId}`);
        results[zoneId] = [];
        return;
      }

      console.log(`Fetching ${stations.length} stations for ${zoneId}`);
      const observations = await fetchMultipleStations(
        stations.map(s => ({ triplet: s.triplet, name: s.name, elevation: s.elevation }))
      );
      results[zoneId] = observations;
    });

    await Promise.all(fetchPromises);

    console.log(`SNOTEL fetch complete. Zones with data: ${Object.keys(results).filter(k => results[k].length > 0).length}`);

    return new Response(
      JSON.stringify({
        success: true,
        observations: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-snotel-observations:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
