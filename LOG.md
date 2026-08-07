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

## 2026-08-07
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
