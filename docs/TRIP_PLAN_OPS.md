# Trip Plan — operations notes

Live since 2026-09-09. Spec: `docs/specs/2026-09-09-spec-trip-plan.md`.

## Pieces in production
- Tables `trip_plans`, `trip_plan_contacts`, `trip_plan_events`, `trip_plan_rate_limits`,
  `trip_plan_locations` (service-role only). RPCs `trip_plan_rate_bump`,
  `trim_trip_plan_locations`.
- **Live tracking (1.1, schema deployed 2026-09-17; app not shipped yet).** Opt-in per
  trip via `trip_plans.tracking_enabled` (default false, so no existing plan can receive
  positions). The app posts to the `location` action on `trip-plans`, authed with
  `plan_secret` like the other user actions — a `share_token` holder can READ the trail
  on the packet page but can never write it. The action refuses when tracking is off or
  the plan is closed. The trail cascades on plan delete, so the existing `purge_after`
  sweeper already disposes of it; there is no separate retention path.
- Edge functions: `trip-plans` (API, JWT on), `trip-plan-page` (**deployed
  `--no-verify-jwt`** — contacts open it from a bare browser; keep that flag on every
  redeploy), `trip-plan-sweeper` (cron-key gated).
- pg_cron: `avy-trip-plan-sweep` every 5 min, `avy-trip-plan-purge` daily 09:15 UTC.

## Secrets (Supabase → Edge Function secrets)
- `RESEND_API_KEY` — Resend account kai.myers.a@gmail.com, key "TripPlanner".
- `TRIP_PLAN_EMAIL_FROM` — `Avy Comparison <trips@avycomparison.kaiconsulting.ai>`
  (Resend domain 43bc39a8, added 2026-09-10). The earlier `trips.kaiconsulting.ai`
  domain (86d116fb) is superseded; its DNS records are still in place and can be
  deleted from Porkbun once the new sender has run for a while. The Resend account is shared with AK RFP Hub (akrfp.com, keys RFP_app/
  RFP@/STT); this app only uses its own key "TripPlanner" and its own subdomain. Never
  send from akrfp.com again.
- `TRIP_NUDGE_CHANNELS` — optional, default `email`. Add `sms` when Twilio lands.
- `TRIP_PLAN_PAGE_BASE` — `https://avycomparison.supabase.co/functions/v1/trip-plan-page`.
  The project has a **vanity subdomain** (`avycomparison.supabase.co`, free, activated
  2026-09-11) so the link a contact receives reads as this app rather than a random
  project ref. The old `tfvxhsgwrwvendrnbrgf.supabase.co` host still resolves, so links
  already sent keep working.

## DNS for the sending subdomains (Porkbun, kaiconsulting.ai)
kaiconsulting.ai DNS is at **Porkbun** (login saved in Kai's Firefox; 2FA code goes to
kai.myers.a@gmail.com). These three records were added 2026-09-09 and resolve on all
four Porkbun nameservers:

Current sender: **avycomparison.kaiconsulting.ai**

| Type | Name (relative to kaiconsulting.ai) | Value | Priority |
|---|---|---|---|
| TXT | `resend._domainkey.avycomparison` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDARD74e0uPnWGO9JlUa7Y+REygJY2zTT8wlEaPrnJriY10S3lbq5Clv5ql9XVEkNwkye+SA5ynbM3z16CM/AR2lBGphocLiywWwVI9FDWSD/Vyb2SLUaRMCYbb2DAsf0CBKgyvqt28p4SnCr7F4M+wg50KY5+urump/WxiX+GCMQIDAQAB` | |
| MX | `send.avycomparison` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
| TXT | `send.avycomparison` | `v=spf1 include:amazonses.com ~all` | |

Superseded (still present): **trips.kaiconsulting.ai**

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
**Deploy after every change to `supabase/functions/**` — edge code does not ship with
the app build.** On 2026-09-11 the live page was several commits stale (still titled
"trip plan", no gear inventory row, no photo) because app builds had gone out without a
function deploy. If the page looks older than the repo, this is why.

## Smoke (curl)
See LOG 2026-09-09 for the sequence. Delete smoke plans afterwards:
`delete from trip_plans where owner_device_id like 'smoke-device-%'`.

## Known gaps
- Push-to-owner ("Alex opened your plan") is a stub until `device_tokens` carries a
  trip device id.
- SMS channel not implemented (Twilio 10DLC pending).
