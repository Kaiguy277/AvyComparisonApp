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
  re-nagging; a partial grant still surfaces the existing home banner to finish. Helpers
  `hasShownLocationPrompt`/`markLocationPromptShown`/`isLocationWakeGranted` in locationWake.
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
