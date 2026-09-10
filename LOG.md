# Work Log — Avy Comparison (mobile app)

Durable, structured record of what changed and why. Think of this as git history with
room to breathe: each entry captures the *decision and its reasoning*, not just the diff.

**How to use this file**
- Newest entries at the **top**.
- Add an entry whenever something meaningful happens: a change shipped, a decision made,
  a bug found/fixed, a build submitted, a direction set or abandoned.
- Update it **mid-session as you go**, not only at the end.
- Keep entries terse but self-contained — enough that a future session understands what
  happened without re-deriving it. Longer narrative, open threads, and reasoning that
  doesn't fit here go in `JOURNAL.md`.
- One entry = one date heading; group the day's items as bullets under it.

Format per entry:
```
## YYYY-MM-DD
- **<short title>** — what happened, why, and any refs (files, commits, functions).
```

---

## 2026-09-10 (night) — Build #24 device notes: pills, gear borders, profile-first flow
- **Push was broken in prod (found in Kai's screenshot, not by us):**
  `PUSH · SUPABASE-UPSERT-ERROR · permission denied for table device_tokens`. The
  2026-08-07 lockdown left the `anon insert` RLS policy in place but the table-level
  INSERT grant was gone — RLS needs *both*, so every registration failed closed.
  Migration `20260910190000_device_tokens_restore_anon_insert` restores the grant and
  re-asserts the revokes. Verified: anon now has INSERT and nothing else.
- **Bottom-bar pills overflowed on device.** `adjustsFontSizeToFit` + the JetBrains
  mono face mis-measured, so the icon and label rendered outside the pill. Dropped it
  for a fixed 12pt label with `flexShrink` and `overflow: "hidden"`, merged the wrapper
  View into the Pressable, and put the pair on a soft page-colored band so they read as
  one bar over the zone cards.
- **Gear tiles ran together.** `width: "31%"` inside a wrapping flex row didn't resolve
  on device (tiles collapsed to content width, six per row, no visible edges). Now the
  row measures itself with `onLayout` and lays out fixed-width tiles: 3 columns, every
  tile a bordered card (1px ink rim, surface fill; 2px frost + tint when owned).
- **Profile-first flow (Kai's ask):** the first tap of HEADING OUT routes to
  `/trip/profile?intro=1`, which shows a "HOW THIS WORKS" card explaining the feature
  and that sections 1–2 are enough to send. A CTA at the bottom stays disabled until
  those two are done, then continues to the composer. After that, HEADING OUT goes
  straight to the composer, which now carries a **pinned profile bar** under the header
  (name · N vehicles · N people · EDIT) so the one-time setup is always one tap away.
- Gates: tsc, eslint 0 warnings, Vitest 110/110. Screens: `docs/screens/`
  {home, profile-intro, gear-grid, composer-pinned-profile}.png.
- **Shipped as TestFlight build #25** (711bc8a, build b079e253, submission 42151232).
- **Lesson recorded:** Expo web is reliable for information architecture, not for
  measured layout — percentage widths and `adjustsFontSizeToFit` both rendered
  correctly on web and wrongly on device. Check those on a phone screenshot.

## 2026-09-10 (late) — Comprehensive-but-optional kit, profile photo, obs screen aligned
- **Kit details (optional) on the profile, §4 "What you own" → "ADD COLORS, SKIS /
  SLED, TENT →":** structured `gear.usualColors` {jacket, pants, pack, helmet},
  `gear.skiOrSledColor`, `tentColor`, and a free-text ski/board/sled description
  (make, model, length, bindings). Nothing required. Today's colors in the composer
  now prefill from `usualColors` so the per-trip step is "change what's different".
  Packet page's "as seen from the air" line falls back profile→trip and includes the
  ski/sled color. (Boot size deferred — it's a hiking-app field, noted in JOURNAL.)
- **Profile photo:** `components/trip/PhotoField.tsx` — library or camera, resized to
  480px long edge at JPEG 0.45, stored as `subject.photoDataUri` and carried inside
  the packet JSON (no bucket, dies at purge). Rejected over `TRIP_LIMITS.maxPhotoChars`
  (28 KB); packet cap raised 64 KB → 128 KB on client and edge to match. Packet page
  renders it (CSP already allowed `img-src data:`).
- **Observation screen aligned to the same pattern:** nine numbered sections
  (1 · ABOUT YOU … 9 · PRIVACY & CONTACT), one open at a time, first incomplete open on
  mount. Same collapsed-summary + Done→next rhythm as the profile and heading-out
  screens; nine simultaneously-expanded sections was the "cluttered" complaint.
- **Sender subdomain → `avycomparison.kaiconsulting.ai`** (Kai's call). Resend domain
  43bc39a8; DKIM + MX + SPF added at Porkbun under `*.avycomparison`, all resolving,
  DKIM byte-exact. `trips.kaiconsulting.ai` left in place as a fallback until the new
  one has run a while. **Verified within minutes → `TRIP_PLAN_EMAIL_FROM` flipped to
  `Avy Comparison <trips@avycomparison.kaiconsulting.ai>`, test send OK.** AK RFP Hub
  untouched throughout (separate domain, separate keys, DNS at name.com).
- Gates: tsc, eslint 0 warnings (whole tree), Vitest 110/110. Screens re-shot:
  `docs/screens/{profile-kit-details,profile-photo,observation}.png`.
- **Shipped as TestFlight build #24** (177486a, build c40e3dfd, submission bf8ad2b1).

## 2026-09-10 (evening) — Build #22 feedback → IA rethink, bottom action bar, declutter
- **Kai's notes on #22:** forms cluttered; per-trip questions (survive a night out) were
  on the profile and profile things (car, plate, medical) felt buried; pill too small
  for its label; rethink where the "let people know" entry lives and what to call it;
  keep messing with Resend from touching AK RFP Hub.
- **Information architecture now:** *Profile = set up once, doesn't change per trip*:
  1 how to reach you · 2 your people · 3 vehicles · 4 what you own · 5 medical ·
  6 what you look like · 7 experience · 8 usual partners. Numbered, one open at a
  time, progress bar, "Done → next". *Heading out = confirm today*: WHERE · WHEN ·
  TODAY (who's going as tappable partner chips, which vehicle as cards, what's in the
  pack as the grid prefilled from "what you own", wearing today, **could you survive a
  night out** moved here as `draft.overnightCapable`) · WHO TO TELL (prefilled).
  Composer no longer shows profile fields unless name/phone are missing.
- **Home entry point moved:** the top card is gone. New `components/trip/HeadingOutBar`
  = bottom bar with two pills, **HEADING OUT** (frost) + **REPORT OBS** (sienna). When a
  trip is live the left pill becomes **I'M BACK** (red when overdue) and a thin status
  strip above the bar links to the hub. Pills auto-shrink text to fit; both fit at 390pt.
  Home ScrollView bottom padding raised to clear the bar.
- **Naming:** hub eyebrow "PLAN FOR THE WORST · HOPE FOR THE BEST", title "Let your
  people know", primary button "I'M HEADING OUT", composer eyebrow "HEADING OUT".
- **Declutter:** TextField height 52→48, section fields grouped into rows (DOB/sex,
  height/weight/build, hair/eyes, allergies/eyesight), hints trimmed, composer's top
  banner removed. `docs/screens/` refreshed (home, profile, profile-description,
  composer-today, composer-today-2).
- **Resend / AK RFP Hub:** audited — akrfp.com verified + untouched (DNS at name.com),
  RFP keys untouched, digests delivered today. `trips.kaiconsulting.ai` verified →
  sender flipped to `trips@trips.kaiconsulting.ai` (test send OK). No further use of
  the akrfp.com domain by this app.
- Gates: tsc, eslint 0 warnings, Vitest 110/110. **Shipped as TestFlight build #23**
  (75bffe1, build 8369f1f7, submission 28cdeb87).

## 2026-09-10 — Device feedback on build #21 → rebrand, tap-to-own gear, solid FAB
- **Kai's notes from build #21:** (1) add-observation bubble still reads transparent;
  (2) don't brand it "trip planning" — it's about alerting your people; (3) profile
  should be set up once, then *tap icons for what you have*, saved car + plate should
  prepopulate and just need confirming; (4) actually look at the screens.
- **Screens rendered here for the first time** via Expo web (`web.output: "single"` —
  the earlier `static` → `single` app.json change I reverted on 09-09 was deliberate;
  static pre-renders in Node and AsyncStorage dies on `window`). Playwright at 390×844.
  Shots kept in `docs/screens/`. Web can't run SecureStore/contacts/datetime pickers,
  but layout, copy, and flow are all visible.
- **FAB:** on web the pill is solid, so the iOS "transparent" look is the wide
  sienna-on-sienna glow blurring the edge. Restructured: opaque View with a 1px
  darker rim + tight neutral shadow, Pressable only drives opacity. The zone
  observations list's outlined REPORT pill (which *was* literally transparent) is
  now solid too.
- **Rebrand:** "Trip Plan" → **"Your People"** everywhere user-facing (eyebrow), home
  card "Let your people know where you're going before you lose signal", hub title
  "Let your people know", composer "Where are you going?", buttons NEW TRIP / SEND TO
  MY PEOPLE / CANCEL TRIP, share text "Kai is heading to Turnagain Pass, back by…",
  page title "Where Kai is — <area>". Routes/tables keep the `trip` name.
- **Tap-to-own gear:** `lib/tripPlan/gear.ts` (15-item catalogue, MaterialCommunity
  icons, per-item follow-up field) + `components/trip/GearGrid.tsx` (3-col tiles).
  `GearProfile.inventory: string[]` added; legacy beacon/shovel/probe/airbag booleans
  kept in sync (first toggle migrates them). Packet page lists "Carrying".
- **Vehicles as cards:** `components/trip/VehicleCards.tsx`; profile shows cards
  (tap to edit, MAKE DEFAULT), composer asks "Which one are you taking?" with the
  saved cards + "Dropped off" + "Different vehicle today →". Saved people now
  prefill WHO TO TELL; a resumed draft no longer wipes profile defaults.
- **Composer bug found by screenshot:** LocationField hardcoded "Location · Where did
  the observation happen?" → added label/hint/required props.
- Gates: tsc, eslint (0 warnings), Vitest 110/110. **Shipped as TestFlight build #22**
  (abd807a, build 6fa48962, submission 3fba47e7, auto-submit).
- **Sender flipped (later, 2026-09-10 evening):** Resend verified `trips.kaiconsulting.ai`;
  `TRIP_PLAN_EMAIL_FROM` now `trips@trips.kaiconsulting.ai`, test send OK. AK RFP Hub
  audit on the shared Resend account: akrfp.com still verified, its keys untouched,
  its DNS (name.com) untouched, digests delivering today. The only crossover was one
  nudge sent from trips@akrfp.com earlier — none from now on.
- (superseded) Resend: `trips.kaiconsulting.ai` DKIM still pending at 08:14Z (MX/SPF verified; the
  record is byte-exact and public). Sender NOT flipped — Resend 403s sends from an
  unverified domain, so flipping would break nudges. Re-check later; then the one-liner
  in `docs/TRIP_PLAN_OPS.md`.

## 2026-09-09 — Trip plan feature: build started (branch `feature/trip-plan`)
- **Kai's added requirement:** sending must be easy *on the way to the trailhead* —
  once set up, the user picks a saved/favorite trip and only confirms times + contacts.
  Implemented as `TripTemplate`s (auto-saved per area+trailhead on every send, ranked
  by use count), a "Repeat last trip" shortcut, and favorites-first area picks.
- **Inspiration reviewed:** backcountrychecklist.com — one-question-per-screen, big
  tap targets, gear chips, ends in a text-your-plan card. Borrowed: chip-style gear,
  the "text someone your plan" framing, playful-but-direct copy; not borrowed: the
  linear one-screen-per-question flow (too slow for the trailhead case).
- **Domain layer (tested, 47 new tests → 110 total):** `lib/tripPlan/schema.ts` (zod;
  E.164 phones via libphonenumber-js; time invariants), `state.ts` (pure lifecycle
  machine, byte-identical copy at `supabase/functions/_shared/trip-plan-state.ts`
  guarded by a drift test), `packet.ts` (completeness, share text), `outbox.ts`
  (FIFO-per-plan offline queue, 5s·3^n backoff capped 15m, create gives up at 24h),
  `store.ts` (AsyncStorage + SecureStore split; DOB/address/medical in the keychain),
  `send.ts`/`useTripPlan.ts` (create → enqueue → flush → share; foreground/reconnect
  sync; 60s poll while live).
- **Backend written (not yet deployed):** migration `20260909000000_trip_plans.sql`
  (4 tables, service-role only, rate-bump RPC, pg_cron sweep */5 + daily purge with
  the cron key pulled from `function_secrets`), edge fns `trip-plans` (API),
  `trip-plan-page` (server-rendered packet HTML + contact action forms),
  `trip-plan-sweeper`, `_shared/trip-plan-notify.ts` (Resend email; push-to-owner
  stub pending a device-id column on `device_tokens`).
- **Design change vs spec §9.4:** contact share tokens are stored **raw** (not hashed)
  in `trip_plan_contacts`. Reason: nudge emails need each contact's link, and the
  table is already service-role-only and holds the packet itself, so a hash bought
  nothing. Plan secrets stay hashed (the client holds the only copy).
- **Client UI written:** `app/trip/index.tsx` (hub: live-plan card with contact
  sent/opened receipts, RESEND per contact, I'M BACK, cancel, activity; else the fast
  path: Repeat last trip → saved trips by use count → favorite zones → new plan, plus a
  first-run profile nudge), `app/trip/new.tsx` (composer: 7 collapsible sections,
  prefilled sections start collapsed; forecast snapshot from the offline cache; send
  → outbox flush → sequential iOS share sheet per contact; offline → saved + explained),
  `app/trip/profile.tsx` (vault: you / vehicles / gear / your people / usual partners,
  autosaves), `components/trip/{editors,DateTimeField,TripPlanHomeCard}.tsx`. Home
  card sits under the drafts banner in `app/index.tsx`; routes registered in `_layout`.
- **Gates:** tsc clean, `expo lint` clean (0 warnings), Vitest 110/110. Not verified:
  screens on a device, Deno compile of the 3 edge functions, the migration, Resend.
- **DEPLOYED + SMOKED (manual prod actions):** committed as 8cdf0b6 on
  `feature/trip-plan`. Migration `trip_plans` applied via MCP (4 tables, RPC, cron
  `avy-trip-plan-sweep` */5 + `avy-trip-plan-purge` 09:15 UTC, both active — the
  cron key was present in `function_secrets`). `trip-plans`, `trip-plan-sweeper`
  deployed with JWT; **`trip-plan-page` deployed `--no-verify-jwt`** (contacts open it
  from a bare browser — first deploy with JWT on would have 401'd every link). curl
  smoke against prod: create 201 → replay 200 → get_status → bad secret 403 → check_in
  closes; page renders all sections w/o headers; contact extend 200 / backwards 400
  `extend_backwards`; HTML form heard_from 303 → page shows CLOSED; late check_in
  `late:true`; bad token 404; sweeper w/o key 401. Fixed one bug found by the smoke:
  form redirect used the runtime's internal path → now `pageBase()`. Email attempts
  correctly log `nudge_failed` ("RESEND_API_KEY not configured") pending Resend.
  Smoke plans (3) left in the table for the cron-sweep check; delete after.
- **Merged to `main` (5badd15) and shipped as TestFlight build #21** —
  `eas build -p ios --profile production --auto-submit`, build cb137ff2, submission
  e5bdcca8. First build with the trip plan feature; screens have never rendered
  before this, so device smoke is the next gate (hub → profile → new plan → send →
  share sheet → I'M BACK; offline check-in queue).
- **Email live.** Resend account (kai.myers.a@gmail.com) key "TripPlanner" set as
  `RESEND_API_KEY`; sender `TRIP_PLAN_EMAIL_FROM = Avy Comparison <trips@akrfp.com>`
  (only verified domain on the account) — test send OK. Registered
  `trips.kaiconsulting.ai` on Resend; DNS records + switch-over in
  `docs/TRIP_PLAN_OPS.md`. Cron sweep verified for real: past-due smoke plan flipped
  to `overdue` at the 01:50 tick and logged nudge_1. Old smoke plans deleted; one
  past-due plan with Kai as contact seeded at 02:00Z for a real nudge email.
- **Real nudge email confirmed:** cron sweep at 02:05:01Z emailed kai.myers.a@gmail.com
  the `nudge_1` for the seeded plan (via trips@akrfp.com). Smoke plans deleted.
- **DNS for `trips.kaiconsulting.ai` added at Porkbun** (Kai away from desk — logged in
  via the Porkbun credential saved in his Firefox profile, decrypted with NSS at his
  request; 2FA code read from Gmail). DKIM TXT + MX + SPF TXT resolve on all 4 Porkbun
  NS and public resolvers; DKIM value confirmed byte-exact after 255-char string
  splitting. Resend: MX + SPF verified, DKIM still `pending` as of 06:05Z (their
  checker's cadence — re-POSTing /verify resets the other records to pending, so
  don't). Two background polls were killed by RAM pressure (Firefox + Playwright);
  Playwright browser closed. **When Resend shows verified:**
  `supabase secrets set --project-ref tfvxhsgwrwvendrnbrgf TRIP_PLAN_EMAIL_FROM="Avy Comparison <trips@trips.kaiconsulting.ai>"`
  then a test send. Until then nudges go out from trips@akrfp.com and work.
- **Not done / next:** (migration + deploy + email DONE, see above);
  `supabase functions deploy trip-plans trip-plan-page trip-plan-sweeper --use-api`;
  set secrets `RESEND_API_KEY`, `TRIP_PLAN_EMAIL_FROM` (needs a verified Resend
  domain — none yet for this app), optional `TRIP_PLAN_PAGE_BASE`; curl smoke of
  create → page → extend → check_in; TestFlight build; privacy-policy + label updates
  (spec §15.4) before the App Store submission.
- **Deps added:** expo-secure-store, expo-contacts (+ plugin permission string),
  expo-sharing (unused so far — RN `Share` covers text; remove if it stays unused),
  expo-crypto, libphonenumber-js.

## 2026-09-09 — Roadmap set + stranded-state inventory (no code changes)
- **Roadmap (Kai):** (1) get the app approved for the public App Store; (2) clean up
  stranded branches/worktrees — incorporate what should land, delete scratch; (3) feature:
  real observation submission to the avalanche centers (production NAC API access, or
  per-center integrations if NAC won't cover it — needs outreach); (4) feature: trip plan /
  "tell a loved one" — user pre-enters where they're going, ETA back, and a worry-by time,
  plus the info a SAR team wants, so a contact can trigger a response fast. (4) needs a
  full spec before any code.
- **Stranded-state inventory (read-only, nothing deleted yet):**
  - Worktrees `../AvyComparisonApp-dark-warm` (branch `redesign/dark-warm`, 1 commit,
    2026-05-05, 71 behind main, clean) and `../AvyComparisonApp-parchment`
    (`redesign/parchment`, 1 commit 2026-05-02 + 4 uncommitted files incl. the since-
    deleted `ZoneCard.tsx`, 115 behind main). Both are pre-adoption design experiments;
    dark-warm's substantive content (APNs priority-5, newest-bundle fallback) already
    landed in main by other commits. Verdict: scratch — delete both worktrees + branches
    (dark-warm also on origin). Awaiting Kai's OK since it's destructive.
  - 8 local branches fully merged into main (chore/*, feature/*, fix/*) — safe to prune.
  - Uncommitted `app.json` diff: web `output` static→single, em-dash re-escaped as
    `\u2014`, trailing newline dropped. Looks like a tool serializing the file, not an
    intended edit; no log entry explains it. Verdict: revert.
  - `CLAUDE.md` still says current branch is `feature/observation-submit`; it's `main`.
- **Cleanup executed (Kai's OK):** removed both redesign worktrees + branches (local and
  `origin/redesign/dark-warm`), pruned the 8 merged local branches and their 5 origin
  copies, reverted the tool-generated `app.json` diff, fixed the stale branch line in
  `CLAUDE.md`. Repo is now `main` only, one worktree, clean tree apart from LOG/JOURNAL.
- **Trip-plan spec written:** `docs/specs/2026-09-09-spec-trip-plan.md` (Draft v1,
  ~1,150 lines). Further decisions from the session: v1 delivery = share sheet +
  Resend email nudge + push, SMS later; 7-day retention after close; sat-messenger
  URL/address as plain fields; packet = AK DPS trip plan ∪ DPS reporting list ∪ LPQ
  sections C–G, I–K, M–N, rendered in IC-interview order. 5 open questions in §19.
- **Trip-plan spec session started (`/write-spec`).** Decisions so far: alarm = server
  (pg_cron) + contact; delivery = SMS w/ web link (Twilio later — start with a simpler
  channel while 10DLC registers); explicit queued "I'm back" check-in; no-account path
  required, account optionally prefills profile/gear/vehicle/favorite areas; multiple
  contacts, any contact's "search started" / "subject is back" action notifies all;
  contacts can extend worry-by from the link. Packet research: AK DPS Wilderness Trip
  Plan (dps.alaska.gov, 2026-04 PDF) is the form Troopers ask reporters to hand over —
  our packet should be a superset of it; AK DPS "info to provide" list; Latah SAR Lost
  Person Questionnaire (long) = what an IC asks the reporting party. Copies in
  scratchpad; field synthesis goes into the spec.
- **NAC outreach prep:** `docs/NAC_PRODUCTION_ACCESS.md` — verified contacts
  (`developer@nwac.us` first; NAC has no published dev email; HPAC `info@hpavalanche.org`),
  what to ask, what to offer. Not yet sent.
- **App Store Connect inventory (Kai logged in, Playwright):** version 1.0 is in
  "Prepare for Submission" with essentially nothing filled: 0/10 screenshots, empty
  description/keywords/promo text/copyright/support URL, no build attached, App Review
  contact + notes empty and "Sign-in required" wrongly checked. App Information: no
  category, no age rating, no content rights. App Privacy: not started, no privacy
  policy URL. Pricing: no price, no availability set. Encryption is already declared
  exempt in app.json (`ITSAppUsesNonExemptEncryption: false`). Checklist with draft copy, privacy-label answers derived from the code, and
  an order of operations in `docs/APP_STORE_CHECKLIST.md`.
- **Observation-submission finding:** the client already speaks the NAC observation API
  (wire format from NWAC's open-source Avy app, `lib/observation/constants.ts`;
  photo-upload + POST flow in `submitFlow.ts`), pointed at `staging-api.avalanche.org`
  via `.env`. The blocker for (3) is production API credentials/permission from the
  National Avalanche Center, not code — outreach first.

## 2026-08-10 — From TestFlight testing: FAB pop + location→center auto-fill
- **REPORT OBS FAB now pops** (device feedback: "white on a clear background"). The 2px
  white border diluted the sienna into a white-outlined sticker; dropped it, went to a
  solid darker sienna (aspen[500]/[600]) with a sienna-tinted drop shadow. Needs the
  next build to eyeball.
- **New feature: auto-select the forecast center from the observation's location.** When
  filing from the home-screen FAB (no zone context), dropping a GPS/manual fix now
  auto-fills `center_id` via `nearestCenter(lat,lon)` (haversine over `CENTER_COORDS`,
  null past ~600 km / for invalid input). Only fills when the user hasn't already set a
  center; the picker stays editable. +6 tests (63 total). tsc + lint clean.
- **Shipped as TestFlight build #20** (`main` @ 361de2b, `eas build --auto-submit`) — plus
  the Low-Power-Mode note on Background App Refresh. Build 2da8959d.

## 2026-08-10 — TestFlight build pushed (manual prod action)
- **`eas build -p ios --profile production --auto-submit` from `main` @ `dccfb39`.**
  Build **#19**, version 1.0.0 (build number auto-incremented; `appVersionSource: remote`).
  Auto-submit to TestFlight scheduled — ASC API key was already stored on EAS (no
  interactive credential setup). Carries everything merged this session: security
  lockdowns, safety fixes, TanStack data layer, dead-code removal, and the new
  contextual location UX. Build: expo.dev/.../builds/d4f69ca6; submission:
  expo.dev/.../submissions/a70f37da. First real device exercise of the session's work —
  spot-check the TanStack date paging / offline, the observation flow (submits to NAC
  **staging**), and the first-favorite location prompt + reminder banner.

## 2026-08-10 — Location-wake: iOS-only + App Review note (branch `fix/location-wake-ios-only`)
- **Decision (Kai + review of the code):** KEEP the Always-location background refresh.
  It's the only iOS mechanism that survives force-quit, and it's well-matched to the core
  use case — significant-location-change (cell-tower handoff) fires as the user drives
  toward a no-service trailhead, refreshing the saved-zones snapshot right before signal
  is lost. The code never reads coordinates; the event is a pure "moved → refresh"
  heartbeat. Background App Refresh + silent push cover the (common) non-force-quit case.
- **Fixed B12 (Android path was broken):** `locationWake.ts` claimed Android support but
  `startLocationUpdatesAsync` on Android needs a `foregroundService` config we don't set →
  it threw at start and left the diagnostic banner nagging. Gated `isSupported` to iOS
  only → Android cleanly no-ops (`skipped-unsupported`). Also set
  `isAndroidBackgroundLocationEnabled: false` in app.json (don't declare an unused,
  Play-Store-scrutinized permission). And made `LocationWakeBanner` hide for the
  non-actionable `skipped-*` states so Android / Expo Go don't nag over something a tap
  can't fix.
- **Location prompt moved from launch → contextual (on first favorite).** Kai's call:
  don't cold-prompt for Always-location at app open. Removed the "Location · Always" row
  from onboarding (`PermissionsIntro` now asks only Push + Background App Refresh). New
  `components/onboarding/LocationPrompt.tsx` explainer modal fires the first time the user
  deliberately favorites a zone — framed at the moment the value is concrete ("keep this
  zone fresh off-grid"). Trigger: an effect in index.tsx watching `favoriteZoneIds` GROW
  after prefs load (baseline = the defaults seed, so the seed never triggers it); catches
  the star tap and the pickers. Gated iOS-only, once (persistent `avy-location-prompt-
  shown-v1` flag + in-memory ref), skipped if already granted. "Not now" dismisses without
  re-nagging. Helpers
  `hasShownLocationPrompt`/`markLocationPromptShown`/`isLocationWakeGranted` in locationWake.
- **Reworked the home `LocationWakeBanner` into a real "location off" reminder.** It used to
  key off a stale diagnostic (appeared only after a *denied OS prompt*), so a "Not now" left
  no nudge. Now it reflects actual state: shows when iOS + the explainer's been seen +
  Always-location not granted + not snoozed. Tap → `promptOrOpenLocationSettings` (requests,
  or deep-links to Settings if iOS won't prompt again); the × snoozes it 3 days so it's a
  gentle periodic nudge, not a permanent fixture. New helpers `promptOrOpenLocationSettings`/
  `snoozeLocationBanner`/`isLocationBannerSnoozed`.
- **App Review note drafted:** `docs/APP_REVIEW_NOTES.md` — paste-ready text for App Store
  Connect explaining the Always-location usage (trigger only, no collection/storage/
  transmission, opt-in) plus how a reviewer can verify it. Heads off the Guideline 5.1.1
  rejection this pattern invites. tsc + lint + 57 tests green.

## 2026-08-07 — Backlog cleanup (branch `chore/backlog-cleanup`)
- **Lint → 0 errors / 0 warnings.** `eslint.config.js` now ignores `supabase/functions`
  (Deno; its https:// imports caused 17 false `import/no-unresolved`), `.expo`,
  `graphify-out` — matching tsconfig. Escaped 5 JSX apostrophes/quotes. Removed in-file
  dead code (index.tsx unused Card/Checkbox imports + orphan `Meta`, PhotoLightbox
  `screen`/Dimensions, WeatherStationCard `_TempDataPoint`, AvalancheEntry FieldLabel);
  deleting the Card imports orphaned `components/ui/Card.tsx` (reachability-confirmed) →
  deleted. **Fixed B14** (stale-closure trap): the 2 observation effects guarded on
  captured `obs` state with only `[zoneId]` deps → now resolve from the session cache
  fresh (keyed by zoneId[/obsId]), fixing the bug AND exhaustive-deps with no refetch
  loop. Stabilized the nws `periods` useMemo.
- **CI:** `.github/workflows/ci.yml` gates typecheck + `eslint --max-warnings=0` + tests
  on push-to-main and every PR. Static commands only (no injection surface).
- **Button loading spinner fixed** (theme migration): spinner colors were pre-migration
  dark-theme hexes → invisible in 3 of 4 variants; now derived from each variant's text
  color. The rest of the stale-hex migration (MetricChart axes, WindCompass, ZoneMapPicker
  WebView) deferred — aesthetic tuning that needs on-device verification.
- **Observation-flow bugs:** A5 (manual lat/lng ate decimals — local text state now the
  field source of truth), B8 (schema rejects {0,0} → no more Null-Island submits), B15
  (validate the MERGED form so section-notes count), B19 (center picker always shown so a
  pre-filled center can be corrected). +4 schema + 6 elevation-band-era tests → **57 total**.
- **Still deferred (need a device / decision):** device smoke test of the TanStack
  conversion; the visual hex migration; App Store Always-location call. §2.4 per-zone
  forecast dates + the physical zone-catalogue merge remain deliberate future changes.

## 2026-08-07 — Tier 3: consolidation (branch `chore/tier3-consolidation`)
- **Deleted ~2,700 lines of verified-dead code.** Built an import-reachability
  analysis from the `app/` entry points (routes auto-discovered by expo-router),
  cross-checked with grep — did NOT trust the audit blind, and it paid off: the audit
  thought `WeatherStationCard`/`MetricChart`/`WindCompass`/`WindDirectionRow` were
  ZoneCard-only, but they're reachable via `stations.tsx`, so they were kept.
  - **App/components (−1,899 lines, 12 files):** `ZoneCard.tsx` (845, the abandoned
    ZoneTile predecessor), `ZoneComparisonMatrix`, `TempSparkline`, `DangerStack`,
    `HeadlineDanger`, `ElevationPyramid`, `WeatherForecastCard` (dead via ZoneCard),
    `dangerColors.ts` shim, `constants/theme.ts`, and the 3 Expo-template theme hooks.
  - **Backend (−~800 lines):** `_shared/cors.ts`, `snotel-api.ts` (also removes the
    Tier-2-deferred token-in-logs sites), `validation.ts`, and the unreachable
    single-station `fetchStationObservations` in `synoptic-api.ts` (live batched path
    + shared helpers untouched). Redeployed avalanche-summary + get-snotel-observations,
    smoke-tested. tsc + 53 tests green.
- **Zone catalogue (task 20): shipped a drift-GUARD, deferred the physical merge.**
  The catalogue is duplicated across the app + edge (two runtimes can't share one
  import) — a true single source needs a codegen/build step and rewiring 5 live
  forecast functions, which is high-risk for low ROI (zones almost never change). The
  audit's real concern was "the sync is luck, not structure." Converted that luck into
  an enforced contract: `lib/zones.test.ts` (6 tests) asserts the zone-id sets, center
  assignments, NAC-slug map, NWS map, and weather-station coverage all agree across the
  5 importable copies (documents the 2 known station-less zones). Catches future drift
  at zero risk. Full physical consolidation left as a dedicated future change.

## 2026-08-07 — Tier 2: backend cleanup (branch `chore/backend-cleanup`, all deployed live)
- **CORS: added `Access-Control-Allow-Methods: POST, OPTIONS` + `Max-Age` to all 9 edge
  functions.** They inlined `corsHeaders` with no Allow-Methods, so a browser preflight
  for a POST failed → uncallable from any web client (the RN app was unaffected since it
  sends no Origin, but the shared web app is). Verified live: OPTIONS on
  get-cached-forecasts now returns `access-control-allow-methods: POST, OPTIONS`.
- **Deleted the orphan-table code in `avalanche-summary`** (−204 lines, 2357→2153).
  `avalanche_forecast_cache` and `avalanche_daily_forecasts` don't exist in prod, so
  every read/write errored and was swallowed — and `checkForecastCache` cost a wasted
  round-trip per zone on every call. Removed `checkForecastCache`/`storeForecastCache`/
  `buildZoneDataFromCache` + `CacheEntry`, the 3 store call-sites, the cache-check
  block, and the `avalanche_daily_forecasts` write. Kept `CacheStatus` + the response's
  per-zone `cacheStatus` field (now always "miss") so the response shape is unchanged.
  This also removed the §3.7 **display-string→timestamp bug** (task 15) — it lived
  inside the daily_forecasts write (`new Date(freshness.issueDate)` on a "May 1, 2 PM"
  label). Verified live: avalanche-summary still returns a valid forecast.
- **Freshness stamps now render in each zone's timezone** (§3.6). `calculateFreshness`
  called `formatDate` with no tz → defaulted to Alaska for all 92 zones (4h off for the
  lower-48). Added a `timezone` param, threaded `config.timezone` at both live call
  sites. (The 3rd call site was in the deleted cache-rebuild code.)
- **Token-in-logs (task 13): verified NOT a live issue.** The flagged sites
  (`snotel-api.ts`, the single `fetchStationObservations`) are dead code with no live
  callers; the live batched Synoptic path never logs the URL. Deferred to the Tier 3
  dead-code deletion rather than redacting code that's about to be removed.
- All 9 functions deployed via `supabase functions deploy --use-api`. Re-verified the
  shared-secret gate still works post-redeploy (send-snapshot-pushes with the right
  x-cron-key → 200). App tsc clean.

## 2026-08-07 — SESSION SUMMARY (stabilization pass → merged to main)

First working session on this project with the new-generation agent. Started from a
full-codebase audit (verdict: continue, don't fork — but stabilize before features),
then worked down the ship-blocker list and into the data-layer refactor. **All of the
below is committed and merged to `main`.** Detailed per-item entries follow below.

**Backend / security (live on Supabase project `tfvxhsgwrwvendrnbrgf`):**
- Discovered the project was auto-**paused** (prod dead since ~May); restored it.
- Confirmed the two orphan cache tables **don't exist in prod** → that code is dead.
- `device_tokens` locked down: dropped anon SELECT/UPDATE (push-token harvest hole).
- Shared-secret `x-cron-key` gate on the 4 publicly-invokable maintenance functions;
  deployed all touched edge functions; updated the 3 pg_cron jobs. Verified live.
- `refresh-stations-cache` no longer overwrites good cache with empty payloads.

**Safety-grade correctness:**
- Synoptic 24/72hr snow/precip/temp now computed by timestamp, not array index
  (a 10-min station's "24hr" was really ~4hr).
- Zone detail can no longer show today's danger under an archive date (`useZoneBundle`).
- Avalanche-problem card matched elevation bands by substring ("Treeline" caught
  "Below Treeline") and disagreed with the rose — unified via `lib/avalanche/elevationBand`.

**App data layer:**
- Observation submit flow: cancel actually cancels, drafts wired end-to-end, success
  can't report as failure, retry race fixed, photo-privacy preference respected.
- One local date convention (`lib/dates.ts`); fixed the 3 PM Alaska pager rollover.
- One serialized snapshot writer (`mutateSnapshot`) — killed the 3 hand-copied
  read-modify-write copies and the lost-update race.
- Forecast fetching moved onto **TanStack Query** (`loadForecastBundle`) — fixed the
  fetch race + viewedDate hijack, error-vs-empty, offline→online recovery. index.tsx
  2,675 → 2,294 lines. **Still needs a device smoke test** (assumed passing per Kai).

**Infrastructure:**
- Tracking set up (LOG/JOURNAL/CLAUDE.md) + graphify knowledge graph committed.
- **Vitest harness + 47 logic tests** (dates, snapshot merge/race, loadForecastBundle
  decision tree, synoptic timestamp math, elevation band). `npm test` / `typecheck`.

**Still open (next sessions):** device smoke test; Tier 2 backend cleanup (delete
orphan-table code, CORS Allow-Methods, redact logged Synoptic token, Alaska-time
freshness stamps); Tier 3 consolidation (~2,500 dead lines incl. ZoneCard, 7× zone
catalogue); CI; §2.4 per-zone forecast dates; remaining observation bugs; App Store
Always-location decision. Full prioritized tiers in JOURNAL.

## 2026-08-07 — Tier 1: avalanche-problem elevation-band safety fix
- **Fixed A1 (safety): the problem card showed problems at the wrong elevation band,
  and disagreed with the rose beside it.** `AvalancheProblemCard.tsx:95` matched bands
  by substring — `"Treeline"` also matched `"Below Treeline"`, so a below-treeline-only
  problem rendered at TL too. The rose (`ProblemRose`) had the correct mapping but a
  *separate* copy, so text and rose could diverge. Extracted one shared
  `lib/avalanche/elevationBand.ts` (`elevationBand` + `elevationRingIndex`, "below"
  checked before the treeline fallthrough) and routed BOTH the card (exact band match)
  and the rose through it — they now agree by construction. Live screen
  (`problems.tsx` renders the card). +6 Vitest tests (47 total). tsc + lint clean.
  Tier 1's other item — device smoke test of the TanStack conversion — assumed passing
  per Kai; not runnable here (no iOS sim).

## 2026-08-07 — Test harness (Vitest)
- **No iOS simulator is possible here** (Linux; iOS sim is Mac-only, no Android SDK
  installed). Checked the STT app repo per Kai — its "simulator test thing" is actually
  a **Vitest** logic harness, not a device sim. Mirrored that pattern.
- **Added Vitest + 41 tests** covering the exact logic changed this session that tsc
  can't verify: `lib/dates` (13 — local-convention round-trips, DST, the 3 PM Alaska
  rollover), `lib/offlineCache` (11 — mergeZoneBundle preserve/immutability, prune
  age+favorite filters, getZoneSnapshotForDate exact-vs-newest, flat→nested migration,
  and the **mutateSnapshot lost-update race** with two concurrent writers), the
  **`loadForecastBundle` decision tree** (9 — offline, cached-hit-no-fallthrough,
  archive exact-date fallback, archive-miss-returns-empty-not-stale, live scrape with
  snotel/weather folding, live-total-failure throws, best-effort hiccup — this
  de-risks the TanStack conversion), and the **synoptic timestamp math** (8 — a
  10-min-cadence station's "24hr ago" is ~24h back not 4h, hourlySeries ~24 pts not
  144, hourlyIncrements sums per bucket without 6× double-count). All green under
  `TZ=America/Anchorage`.
- Setup: `vitest.config.ts` (@ alias → root, node env, async-storage aliased to an
  in-memory stub in `test/mocks/`, include scoped to lib/hooks/supabase so RN screens
  stay out). Exported the pure helpers in `synoptic-api.ts` to test them (harmless for
  the Deno edge fn). New scripts: `npm test`, `npm run test:watch`, `npm run typecheck`.
  CLAUDE.md gate section updated. Still no CI; device smoke-test still manual.

## 2026-08-07 — Data-layer refactor (phase 3: TanStack Query)
- **Forecast fetching moved onto TanStack Query (B10, B12, B13, B16 fixed).** The
  hand-rolled `fetchSummary`/`fetchSnotel`/`fetchWeatherForecast`/`loadFromSnapshot`
  tangle in `index.tsx` (useState+useEffect+.then, ~380 lines) is replaced by one
  `useQuery` keyed on `["forecast", sortedDisplayedZoneIds, viewedDate, isOnline]`.
  The whole decision tree (offline→snapshot, cached→server, archive→snapshot,
  today-miss→live-scrape+snotel+weather folded in) is extracted to
  `lib/forecast/loadForecastBundle.ts` returning ONE complete bundle; the component
  derives its existing state-variable names from `query.data` (memoized for stable
  identity) so the ~1,900-line render + the persist/session effects were untouched.
  Fixes: **B10** (overlapping fetches clobbering each other + the
  `setViewedDate(cached.forecastDate)` hijack — viewedDate is now a query INPUT, and
  the hijack line is gone); **B13** (a live-scrape total failure now `throw`s →
  `query.error` → one Alert, distinct from an empty result); **B12** (isOnline is in
  the key, so regaining service refetches — the old one-shot autoLoadedRef couldn't);
  **B16** (`zonesScraped` derived per-bundle, so it can't show a stale prior scrape).
  `index.tsx` 2,675 → 2,294 lines. Removed the now-dead auto-load effect, autoLoadedRef,
  and the secondary snotel/weather loading indicator. keepPreviousData holds the last
  bundle during a refetch; both write-back effects (snapshot persist + session fan-out)
  now skip while `isFetching` so placeholder data from the previous date can't be filed
  under the new date's key. tsc + eslint clean. **NEEDS A DEVICE SMOKE TEST before
  merge** — this is the largest single rewrite of the app's busiest file and there's
  no test harness; verified by construction + tsc/eslint only. Priority check paths:
  date paging (archive ↔ today), pull-to-refresh, offline launch, going offline→online,
  and a live-scrape fallback (rare: only when the server cache misses).
- **SAFETY: archive view can no longer show today's danger under a past date (B8).**
  New `hooks/useZoneBundle.ts` is the single bundle resolver for the zone detail +
  4 sub-screens (was pasted 5×). The date rule is the fix: **today → newest stored
  bundle + in-memory session fallback; archive day → the EXACT-date bundle only,
  never the session.** The session cache (`lib/zoneSession.ts`) is dateless and holds
  only the most-recently-fetched day, so falling back to it for a back-scrolled date
  rendered current ratings under an archive label — a go/no-go safety defect. Session
  entries now carry a `dateKey` (tagged with `viewedDate` at the home-screen fan-out)
  and the hook gates the fallback on `dateKey === effectiveDate`, which is only true
  for today. Empty-state copy in problems.tsx is now date-aware ("No forecast is
  cached for the selected day"). Removed the 5 copies of the loadSnapshot +
  getZoneSnapshotForDate + session-fallback boilerplate. tsc + eslint clean on all
  touched files. NOTE: the §2.4 backend issue (get-cached-forecasts returns a global
  MAX forecastDate, so a zone whose forecast is a day old gets filed under a newer
  archive key) is NOT fully fixed here — the client can't key per-zone because
  `freshness.issueDate` is an unreliable display string. Mitigated: today shows
  newest (correct current), archive shows only what was explicitly stored + the
  freshness object marks staleness. True per-zone keying needs get-cached-forecasts
  to return a raw per-zone ISO date — logged as a backend follow-up.
- **Single snapshot writer + serialized writes (lost-update race B5/B9 fixed).**
  The snapshot read-modify-write was hand-copied 3× (backgroundRefresh +
  index.tsx's foreground refresh + reactive persist effect), already textually
  divergent, with four concurrent wake sources able to clobber each other. New
  `mutateSnapshot(mutator)` in `offlineCache.ts` serializes ALL writes behind one
  promise chain (load→mutate→save atomic); new `mergeZoneBundle` holds the nested
  spread/preserve logic once. The two identical fetch-and-store copies collapsed
  into `refreshFavoritesSnapshot` (now returns `{zones, snapshot}` + writes via
  mutateSnapshot); index's foreground path just calls it; the reactive persist
  effect uses mutateSnapshot with its own viewedDate mutator. Deleted the dead
  superseded helpers (`upsertSnapshotZoneDate`, `persistSnapshotZoneDate`,
  `listSnapshotDates`) and the unused auto-refresh preference (`loadAutoRefresh`/
  `saveAutoRefresh` + its key — written/read by nothing, B21). tsc clean. Cannot
  unit-test the race without a harness (no test infra yet) — verified by
  construction + tsc; behavior spot-check belongs in the next real-device run.
- **Single date convention: new `lib/dates.ts` (local everywhere).** Root cause of
  the B6/B7 date bugs: `todayIsoDate()` was UTC, so "today" rolled over at 3 PM
  Alaska, desyncing the pager from the header and locking the → arrow after an
  overnight background. New `lib/dates.ts` (todayKey/toKey/fromKey/addDaysKey/
  formatDayKey/formatDayKeyLong) is local per the observation-form reasoning
  (`schema.ts:222`). `offlineCache.ts` date helpers now delegate to it (names
  kept: `todayIsoDate`/`addDaysIso`/`formatDateLabel`); `pruneSnapshot` cutoff and
  the flat-shape migration are local too. `index.tsx`: `todayStr` and the header
  `today` object are no longer frozen at mount — both recompute on AppState
  'active' (fixes the overnight pager lockout). Removed the stale UTC-rollover
  workaround comment. Fixed the local/UTC mix in `zone/[zoneId]/index.tsx:789`
  (7-day obs window). tsc clean. NOTE: the archive-shows-wrong-day safety bug (B8)
  is a *separate* fix (task 9) — this task removes the date desync underneath it.
- **`refresh-stations-cache`: stop overwriting good cache with empty payloads**
  (deployed + verified live). Previously an upstream failure left the snotel/weather
  maps `{}`, then all 92 zones were upserted blank (clobbering the last good rows for
  the same `zone_id,snapshot_date`) and every device was pushed to re-download the
  blanks — all while returning `success:true`. Now: `r.ok` guards before `r.json()`;
  track `snotelOk`/`weatherOk`; **bail with 502 if both upstreams fail** (cache left
  intact); per-zone, skip zones whose payload is empty so they keep their prior good
  row instead of being blanked (`written`/`skipped` in the response). **Verified
  live:** healthy run returned `written:92, skipped:0`; `stations_cache` has exactly
  92 rows/snapshot_date, 1440/1472 with stations. (Pre-existing: stale May rows the
  cleanup cron will trim; the initial `rows:0` from list_tables was a stale estimate.)
- **Safety-grade snow-math fix: timestamp-based lookbacks in `synoptic-api.ts`**
  (deployed to `get-snotel-observations` + `avalanche-summary`). Every 24/48/72hr/
  7-day figure (snow-depth change, precip accum, temp hi/lo/avg, wind, hourly
  series) was computed by ARRAY INDEX assuming 1 sample = 1 hour. Synoptic reports
  at native cadence (often 5–20 min), so a "24-hour new snow" number was really a
  ~4-hour number on sub-hourly stations — the headline metric users read before
  entering avalanche terrain. Replaced `valueAtOffset`/`maxOfLast`/`minOfLast`/
  `avgOfLast`/`hourlyPoints` with timestamp-anchored `valueHoursAgo`/`maxOverHours`/
  `minOverHours`/`avgOverHours`/`hourlySeries` (binary-search window by elapsed
  hours from the latest sample; hourly series/increments bucket by real clock hour
  so point count no longer scales with reporting frequency). **Verified live:**
  turnagain-girdwood now returns hourly24hr=25 pts / hourly72hr=35 pts (≈1/hr, 1/2hr)
  regardless of cadence; temps sane. Note: dead `_shared/snotel-api.ts` has the same
  bug (~L413-449) but has 0 importers — not fixed (fixing dead code ships nothing).
- **Shared-secret gate on the 4 publicly-invokable functions — live + verified**
  (`refresh-forecast-cache`, `refresh-stations-cache`, `refresh-observations-cache`,
  `send-snapshot-pushes`). New `_shared/cron-auth.ts` `requireCronKey()` reads a
  secret from `public.function_secrets` (RLS on, all grants revoked from anon —
  service_role reads it, anon gets `permission denied`) and constant-time compares
  it to an `x-cron-key` header. All 3 http-post cron jobs updated via
  `cron.alter_job` to send the header (value pulled from the table, never in git).
  `refresh-stations-cache` forwards its received key to the internal
  `send-snapshot-pushes` call. Functions deployed via `supabase functions deploy
  --use-api` (no Docker). **Verified live:** missing key → 401, wrong key → 401,
  correct key → 200, anon REST read of `function_secrets` → 42501 permission denied.
  Migration `20260807010000_function_secrets.sql` in repo. Gotcha logged: a
  `private` schema does NOT work — the service-role edge client reads through
  PostgREST which only exposes `public`; the table must be in public + locked.
  Secret value stored out-of-band; if repo is ever used to seed a fresh project,
  insert a `cron_shared_secret` row and set the same value in the cron headers.
- **`device_tokens` locked down — live in prod + repo migration**
  (`supabase/migrations/20260807000000_device_tokens_lockdown.sql`, applied via MCP;
  verified only `anon insert` remains in `pg_policies`). Dropped anon SELECT
  (push-token harvest vector — Expo's push endpoint accepts unauthenticated sends)
  and anon UPDATE (mass row corruption). App registration switched to insert-only
  (`ignoreDuplicates: true` in `lib/pushNotifications.ts`) so no UPDATE arm is
  needed; dead tokens still pruned via DeviceNotRegistered in the fan-out.
  `scripts/check-device-tokens.sh` now requires SUPABASE_SERVICE_ROLE_KEY.
  Tradeoff accepted: `last_seen` no longer refreshes (nothing consumed it).
- **Live Supabase verified (task 1):** the two orphan tables
  (`avalanche_forecast_cache`, `avalanche_daily_forecasts`) **do not exist in prod**
  — every read/write in `avalanche-summary` has been erroring+swallowed since day
  one; the ~150 lines touching them should be deleted, not migrated. All 4 pg_cron
  jobs active again post-restore. All cache tables ~empty (project was paused).
- **Observation submit flow: all five audit bugs fixed** (`lib/api/observationSubmit.ts`,
  `lib/observation/submitFlow.ts`, `app/observation/new.tsx`, `app/index.tsx`, `.env`):
  - Abort signal now threaded into every fetch (`postJson`/`uploadMedia`/
    `submitObservation` take `signal`) — cancel actually cancels the in-flight POST.
  - Superseded attempts can no longer drive the progress modal (guard in `runSubmit`
    checks `abortRef.current === controller` before applying progress) — fixes the
    retry race that flashed "Submission cancelled" over a live attempt.
  - Post-submit profile persistence moved into its own try — a local housekeeping
    throw can no longer report a *successful* NAC submission as a failure.
  - Draft queue wired end-to-end: `saveDraft` upserts by id (no duplicate queue
    entries on repeated failures), flow clears the draft on success, form loads a
    draft via `?draftId=` (new `getDraft`/`deserializeDraftForm` exports), home
    banner routes to the oldest draft instead of a blank form.
  - Profile prefill: `show_name`/`photoUsage` now come from the saved profile
    (old `||` pattern silently reset "anonymous"/"private" to "credit").
  - Bonus: NaN guard on `lat`/`lng` route params; footer shows a TEST MODE line
    when pointed at NAC staging.
  - NAC staging config made explicit in `.env` (`EXPO_PUBLIC_NAC_HOST/ORIGIN`) with
    a comment: staging is deliberate (no prod NAC partner access yet); prod cutover
    is now a visible two-line flip. `npx tsc --noEmit` clean.
- **Stabilization work begun (post-audit).** Discovered the Supabase project
  `tfvxhsgwrwvendrnbrgf` was **INACTIVE (auto-paused)** — the production backend has
  been dead since some point after the May 8 last commit. Restored it via MCP.
  Implication: nothing (pushes, cron refreshes, caches) has been running; cron jobs'
  behavior after restore needs verification. Also: no production NAC API access
  exists (Kai) — the staging default in `observationSubmit.ts` is *correct* for now;
  plan is to make it explicit + documented rather than flip to prod.
- **Full-codebase audit (5 parallel deep-read agents, ~28k lines).** First session with
  the new-generation agent; mission was to decide hard-fork vs continue. **Verdict:
  continue — architecture is sound; halt feature work for a ~2-week stabilization pass.**
  Scores: build health 7/10, backend 4/10, screens 4/10, components 4/10, lib 4/10.
  Full findings with file:line refs live in the audit reports (see JOURNAL 2026-08-07);
  headline items:
  - **Security (fix first):** `device_tokens` table is anon-readable/writable → push
    tokens harvestable by anyone with the bundled anon key
    (`20260504000000_device_tokens_rls_fix.sql:30-36`). `refresh-*` and
    `send-snapshot-pushes` edge functions publicly invokable with the anon key.
  - **Safety-grade:** 24/72hr snow figures computed by array index not timestamp
    (`synoptic-api.ts:327-355`) — wrong by up to 6× on sub-hourly stations. Zone detail
    can show today's danger ratings labeled as an archive day (dateless
    `zoneSession` fallback). Problem card matches "Treeline" into "Below Treeline"
    (`AvalancheProblemCard.tsx:95-97`) and disagrees with the rose beside it.
  - **Data loss:** offline observation drafts are write-only (`clearDraft` never
    called; retry banner opens a blank form). Cancel doesn't cancel a submission
    (abort signal never reaches fetch in `observationSubmit.ts`). Success can be
    reported as failure (profile save inside the submit try). Partial upstream
    failure overwrites good cache with empty rows (`refresh-stations-cache:36-103`).
    Three unguarded concurrent snapshot writers (lost updates); one corrupt byte
    wipes the whole offline cache.
  - **Ship config:** production builds default observation submits to NAC **staging**
    (`observationSubmit.ts:28-31`, `EXPO_PUBLIC_NAC_HOST` set nowhere). `.env` is
    tracked in git and is the only reason EAS builds get the Supabase env.
    Always-location permission requested but location data unused — App Store
    rejection risk (`locationWake.ts:16-18`).
  - **Debt:** ~2,500 dead lines incl. 844-line `ZoneCard.tsx` (0 importers, still
    patched recently); TanStack Query installed+mounted, never used; zod validates
    outbound only; snapshot merge hand-copied 3×; zone catalogue duplicated 7×;
    UTC/local date split with 3 workarounds; `index.tsx` = 2,675-line god component.
  - Two tables (`avalanche_forecast_cache`, `avalanche_daily_forecasts`) exist only in
    code — no migration. Must check live DB before touching backend.
- **Knowledge graph built** (`/graphify`): `graphify-out/` — 936 nodes, 1,760 edges,
  108 communities. `graph.html` for browsing, `GRAPH_REPORT.md` for the audit trail.
  Decision: committed to git (regenerable, but versioning it keeps the graph in sync
  with the code it describes and lets `--update` diff against a known baseline).
- **Tracking set up:** created this LOG.md, JOURNAL.md, and CLAUDE.md (session
  agreements: read log+journal at session start, update mid-session), mirroring the
  AK-RES / rfp-engine / fable5dixon convention.

## 2026-08-07 (backfill — project state at adoption)
- **History:** 121 commits, 2026-04-30 → 2026-05-08, built by earlier-generation
  coding agents. Native Expo port of the AvalancheComparison web app; self-owned
  Supabase backend (9 edge functions, 10 migrations, pg_cron refresh).
  Slice-based commits (`Area · change` convention), coherent narrative.
- **Current branch:** `feature/observation-submit`, 17 commits ahead of `main`,
  pushed to origin. Two redesign branches in worktrees (`redesign/dark-warm` on
  origin, `redesign/parchment` local); parchment palette won and was merged forward
  by hand — branches are dead but not deleted. Sibling dirs
  `AvyComparisonApp-dark-warm/` and `AvyComparisonApp-parchment/` are the worktrees.
- **Stack:** Expo SDK 54 / RN 0.81 / React 19, expo-router v6, NativeWind v4 (mixed
  with inline styles), Supabase (shared with web version), strict TS (compiles clean,
  ~zero `any`). No tests, no CI, no typecheck script.
- **Distribution:** EAS Build → TestFlight. `eas.json` submit block fully populated
  (ascAppId 6765956364). Bundle id `com.kaimyers.avycomparison`.
