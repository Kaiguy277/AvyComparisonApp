# Avalanche center outreach — plan (not started)

Kai's idea, 2026-09-11. **Gate: start only once the app is publicly available** on the
App Store, so the first thing a center hears is "here's a thing you can look at", not
"here's a thing you can't."

## Two asks in one email, per center

1. **Introduction.** Here's what the app does, here's how your forecast is presented,
   here's the link back to your own product. Invitation to tell us if anything is
   misrepresented.
2. **Which weather stations?** This is the real ask, and the reason to write at all.
   The app pairs weather stations to forecast zones, and today **that pairing is our
   guess** (nearest-station heuristics over the Synoptic network). Forecasters know
   which stations they actually trust for each zone — wind at the right elevation and
   aspect, a temperature site that isn't in a cold pool, the snow-depth site that
   represents the zone rather than the parking lot. Ask them to name the stations they'd
   want shown for each of their zones, and use that instead.

## Why this is worth their time (and ours)

- A wrong station is worse than none: it makes the app quietly misleading about wind
  loading in exactly the terrain people are deciding on.
- It's a small ask with a concrete answer — a list of station IDs per zone.
- It opens the relationship before we ever need anything bigger (observation feeds,
  data questions, corrections).

## Before writing anything

- Inventory what we currently show per zone: station IDs, and how they were chosen
  (`lib/zones.ts` station coverage + the Synoptic query in the edge functions).
- Note the two zones already known to have no station coverage (see `lib/zones.test.ts`).
- Per center: find the right contact (most publish a forecaster or info address),
  check whether they're NAC-platform or independent, and note their zone list.
- Draft one template + per-center specifics. Keep it short; forecasters are busy and
  the season is when they have least time. Prefer late spring or early fall.

## Sequencing

Alaska first (CNFAIC, HPAC, Valdez, Chugach NF) — home turf, and the zones with the
most users. Then the larger NAC centers. Log every reply and the station list they give
in this file so the mapping has provenance.
