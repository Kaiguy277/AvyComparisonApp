# Getting production NAC observation-API access

Status (2026-09-09): NOT yet requested. App submits to `staging-api.avalanche.org`.

## What we already have
- Client speaks the NAC observation API: `POST /v2/public/media` per photo, then
  `POST /obs/v1/public/observation/` (`lib/api/observationSubmit.ts`). Wire format
  from NWAC's open-source Avy app (`lib/observation/constants.ts`).
- Host + Origin come from the tracked `.env` (`EXPO_PUBLIC_NAC_HOST`, `EXPO_PUBLIC_NAC_ORIGIN`).
  Production cutover = flip those two lines, confirm Origin is on NAC's CORS allowlist.

## Who to contact (verified 2026-09-09)
1. **NWAC developers — `developer@nwac.us`.** They maintain the Avy app, which submits
   to the same API in production, and their CONTRIBUTING.md invites email + offers a
   volunteer Slack. Best first contact: they know exactly who at NAC grants access.
2. **National Avalanche Center** — no published developer email. Public API docs
   (read-only products API) at github.com/NationalAvalancheCenter/Avalanche.org-Public-API-Docs.
   Ask NWAC for the right NAC person, or open a GitHub issue on that repo as a fallback.
3. **Alaska centers, for opt-in / relationship:** HPAC `info@hpavalanche.org`
   (confirmed on the NAC observations platform); CNFAIC via cnfaic.org contact page.

## What to ask for
- Production observation-submission access for a third-party app (host, any key/
  header, Origin allowlisting for our value, rate limits).
- Whether centers must opt in to receive third-party public obs, and which of the
  centers we cover already have.
- Whether there's a review/QA step (they may want to see the form + a staging submission).
- Terms of use for redistributing forecast data (the README warns third-party use must
  not alter intent/accuracy — say how we present it).

## Offer them
- TestFlight link, the staging submission IDs we've already made, the form field map.
