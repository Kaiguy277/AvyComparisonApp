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
- `TRIP_NUDGE_CHANNELS` — optional, default `email`. Add `voice` to turn on the
  automated overdue call (nudge_1 / nudge_2 / expired only). Flip
  `VOICE_CALLS_ENABLED` in `lib/tripPlan/schema.ts` in the same release so the
  composer collects contact phones.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_E164` — the voice channel, all
  set 2026-10-06. Account kai@kaiconsulting.ai (SID `AC96f60e…`; password and auth token
  are in Kai's macOS Keychain, see LOG 2026-10-06 evening). The number is **+1 907 202-9385**
  (`PNc2ac534512962baa1e2bb90a00d8538b`, Anchorage, $1.15/mo). Trust Hub: business profile
  `BU16129d…` approved; SHAKEN/STIR `BU180313…` approved + number attached; CNAM "Whumpf"
  `BU990a77…` and Voice Integrity `BUa68163…` submitted 2026-10-07. The auth token also
  gates `trip-plan-voice` (every Twilio callback is HMAC-signed with it).
- `TRIP_PLAN_VOICE_BASE` — **set to `https://whumpf-pages.kaimyersa.deno.net/voice`**
  (the Deno proxy's `/voice` route). Required: Supabase rewrites the TwiML reply to
  `text/plain` (smoked 2026-10-06), and Twilio rejects that. Both the callback URLs handed
  to Twilio and the signature check are built from this value.
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
supabase functions deploy trip-plan-voice --no-verify-jwt --use-api
```
`trip-plan-voice` is called by Twilio, which sends no Supabase headers — the
`X-Twilio-Signature` check is its only gate, so `--no-verify-jwt` is required.
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
- **Voice channel BUILT 2026-10-06 on `feat/voice-nudges`, not yet live.** Everything
  below the 2026-09-22 sketch is implemented (`_shared/twilio.ts`, `voice` in
  `notifyAll`, `trip-plan-voice`, channel-aware `retryFailed`, `call_acknowledged`
  on the packet page, composer phone requirement behind `VOICE_CALLS_ENABLED`).
  Still needed before `voice` goes into `TRIP_NUDGE_CHANNELS`: Twilio account
  upgraded + Trust Hub stack (Business Profile → SHAKEN/STIR → Voice Integrity →
  CNAM), a number in `TWILIO_FROM_E164`, the three secrets, Kai's TCPA decision
  (legal read or not; heading-out notice wording; keypad opt-out or not), and one
  real test call to Kai's own phone with the sweeper driving it.
- **SMS channel not implemented — and reconsider the channel before building it.**
  Decided 2026-09-17 to park this until after the first App Store release.
  - Email via Resend is the system of record and is genuinely solid: `nudge_failed`
    events plus retry through the sweeper. Most people get email push on their phone,
    so it is a better wake-up than it sounds.
  - **A2P 10DLC is carrier-mandated, not a Twilio quirk** — Telnyx, Plivo and AWS SNS
    all impose the same registration. Switching provider buys nothing.
  - **Carrier email-to-SMS gateways (`number@txt.att.net` etc.) were evaluated and
    rejected.** They need the recipient's carrier, which number portability makes
    unguessable without a paid lookup, and they fail SILENTLY with no delivery receipt.
    For "your person is overdue", an alert that quietly didn't arrive is worse than no
    alert — it creates false confidence exactly when someone should be calling 911.
  - **A VOICE CALL may beat SMS for this feature, and outbound voice does not require
    10DLC** (that regime covers SMS/MMS). A ringing phone gets answered; a text at 9pm
    gets glanced at. A short TwiML message would do. **Verify current voice compliance
    requirements before committing** — the 10DLC-is-SMS-only point is solid, the rest of
    the 2026 voice rules were not checked.
  - Twilio account exists (created 2026-09-17, Kai) but **no plan selected and nothing
    provisioned**. Trial is useless here regardless: it only sends to 5 pre-verified
    numbers, and you cannot pre-verify a user's emergency contacts.
  - If picking this up: verification is calendar time, not work time, so start it early.
  - **VERIFIED 2026-09-22 (Twilio docs, pricing dated Aug 2026):** voice needs no 10DLC,
    but treat this stack as required or the number gets "Spam Likely"-labelled: upgraded
    account (payment method) → **Primary Business Profile** (Trust Hub KYC, 24–48 h) →
    **SHAKEN/STIR Trust Product** (A attestation) → **Voice Integrity** (needs EIN or DUNS,
    US address, HTTPS site — the Deno pages qualify) → **CNAM** "Whumpf". Cost: local
    number $1.15/mo, $0.014/min outbound, AMD $0.0075/call, basic TTS free.
  - **TCPA:** a prerecorded/TTS call to a cell needs the called party's prior express
    consent or an emergency purpose. The contact never consented — the owner listed them.
    Overdue-in-the-backcountry is plausibly emergency-purpose; that is a legal call, not
    an engineering one. Mitigate regardless: call only on nudge_1 / nudge_2 / expired,
    warn in the heading-out email, offer a keypad opt-out.
  - **Sketch:** `voice` in `TRIP_NUDGE_CHANNELS`, gated per template; one POST to
    `/2010-04-01/Accounts/{sid}/Calls.json` with inline `Twiml` (`<Say>` + `<Gather
    numDigits="1">`, 1 = acknowledged → new `call_acknowledged` event on the packet page),
    `MachineDetection=DetectMessageEnd`, `StatusCallback` → new `trip-plan-voice` fn
    (`--no-verify-jwt`, verify `X-Twilio-Signature`); no-answer/busy → one retry through
    `nudge_failed`, which means making `retryFailed` channel-aware. Composer: phone
    required on contacts when the channel is on. Secrets: `TWILIO_ACCOUNT_SID`,
    `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_E164`. **Smoke first:** whether Supabase rewrites
    the `text/xml` TwiML reply to the Gather POST; fall back to the Deno proxy if so.
