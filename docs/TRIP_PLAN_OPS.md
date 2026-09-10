# Trip Plan — operations notes

Live since 2026-09-09. Spec: `docs/specs/2026-09-09-spec-trip-plan.md`.

## Pieces in production
- Tables `trip_plans`, `trip_plan_contacts`, `trip_plan_events`, `trip_plan_rate_limits`
  (service-role only). RPC `trip_plan_rate_bump`.
- Edge functions: `trip-plans` (API, JWT on), `trip-plan-page` (**deployed
  `--no-verify-jwt`** — contacts open it from a bare browser; keep that flag on every
  redeploy), `trip-plan-sweeper` (cron-key gated).
- pg_cron: `avy-trip-plan-sweep` every 5 min, `avy-trip-plan-purge` daily 09:15 UTC.

## Secrets (Supabase → Edge Function secrets)
- `RESEND_API_KEY` — Resend account kai.myers.a@gmail.com, key "TripPlanner".
- `TRIP_PLAN_EMAIL_FROM` — currently `Avy Comparison <trips@akrfp.com>` (akrfp.com is the
  only verified domain on that Resend account). Switch to
  `Avy Comparison <trips@trips.kaiconsulting.ai>` once the DNS below verifies.
- `TRIP_NUDGE_CHANNELS` — optional, default `email`. Add `sms` when Twilio lands.
- `TRIP_PLAN_PAGE_BASE` — optional override for the share-link base.

## Pending DNS for `trips.kaiconsulting.ai` (Resend domain 86d116fb…)
Add at the DNS host for kaiconsulting.ai, then "Verify" in Resend → Domains:

| Type | Name (relative to kaiconsulting.ai) | Value | Priority |
|---|---|---|---|
| TXT | `resend._domainkey.trips` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDeuycUFRGXdir0CaRf2+cbAiMTiNVvjzcOmQ7Y1TQnVuYEIuESXVt4JM6Ik7P9ZzV8sxKKMzOO+jCOZmuJnHI7ZjoZwH2Dx9TD4sEBj7Ictz1lXm2Z9pyCyZEe7x2CFG247xFOliWcKx2MquggbIEqMffwSO4eBQv4IeDJ+r9mqQIDAQAB` | |
| MX | `send.trips` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send.trips` | `v=spf1 include:amazonses.com ~all` | |

## Redeploy
```
supabase functions deploy trip-plans --use-api
supabase functions deploy trip-plan-sweeper --use-api
supabase functions deploy trip-plan-page --no-verify-jwt --use-api
```

## Smoke (curl)
See LOG 2026-09-09 for the sequence. Delete smoke plans afterwards:
`delete from trip_plans where owner_device_id like 'smoke-device-%'`.

## Known gaps
- Push-to-owner ("Alex opened your plan") is a stub until `device_tokens` carries a
  trip device id.
- SMS channel not implemented (Twilio 10DLC pending).
