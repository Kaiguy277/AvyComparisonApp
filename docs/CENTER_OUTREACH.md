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

## Contact addresses (researched 2026-09-11)

26 of 28 centers have a verified contact address, now in
`lib/observation/emailFallback.ts` with per-region comments. Each was read off the
center's own site or its official avalanche.org record. Notes that matter:

- **These are contact/forecaster inboxes, not observation intake.** Essentially every
  center takes observations through a web form. Our email path puts the report in front
  of a human who can route it; that's a fallback, not a designed endpoint. **Ask each
  center in the outreach email whether they'd rather receive these by email or have
  users go to their form** — and collect the form URLs while we're at it.
- **Two traps.** The NAC record lists `chris@avalanche.org` for both SOAIX and EWYAIX —
  that's avalanche.org staff, not either center. And SOAIX's listed site
  `oregonsnow.org` is the Oregon State Snowmobile Association, not an avalanche center.
  Neither is in the app.
- **Two centers have no usable address.** BTAC publishes a form and a phone number only
  (its NAC record shows the director's personal Gmail — not ours to hand out), and SOAIX
  has none. Both open the mail composer with no recipient. Getting a real address for
  these is a concrete outreach goal.
- **Three are person-specific and will rot** when staff change: MSAC, TAC, BAC. Ask for
  a role address.
- **Where a center's own site disagreed with its NAC record**, the site won (CAAC, FAC,
  PAC, KPAC, ESAC). Worth confirming which they prefer.
- **Four Alaska centers share one inbox** (VAC, CAC, HAC → `info@alaskasnow.org`, the
  Alaska Avalanche Information Center umbrella). EARAC has its own alias.

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
