# CLAUDE.md — Whumpf (mobile app, formerly "Avy Comparison")

Working agreements for AI-assisted development on this project.

## Session discipline (non-negotiable)

1. **At the start of every session, read `LOG.md` and `JOURNAL.md`** (at minimum the
   newest entries) before doing anything else. They carry the thread between sessions.
2. **Update both mid-session, as work happens — never batched only at session end.**
   - `LOG.md` — structured record: what changed, why, refs (files, commits, functions).
     Newest at top. One dated heading per day, bullets under it.
   - `JOURNAL.md` — narrative: reasoning, surprises, gotchas, open questions, dead ends.
     Newest at top.
3. A change worth making is a change worth logging. Decisions, bug discoveries, manual
   prod actions, and abandoned directions all get entries — not just shipped code.

## Project facts

- Expo SDK 54 / RN 0.81 / React 19, expo-router v6, NativeWind v4, strict TypeScript.
  iPhone-first, distributed via EAS Build → TestFlight (`com.kaimyers.avycomparison`).
- **Renamed to `Whumpf` on 2026-09-11.** Only the *display* name changed. The bundle id,
  EAS slug (`AvyComparisonApp`), scheme, Supabase project ref and the
  `avycomparison.supabase.co` vanity host all keep the old string on purpose — changing
  them orphans the App Store record, the EAS project, or live share links.
- Backend: self-owned Supabase (edge functions in `supabase/functions/`, pg_cron refresh, Postgres caches).
  Shared with the AvalancheComparison web app (`../AvalancheComparison`).
- Current branch: `main`. Work on short-lived branches, merge to `main`, delete the branch.
- Knowledge graph: `graphify-out/` exists — for architecture questions, query it first
  (`/graphify query "..."`) instead of re-exploring.

## Current state

**Read the SESSION HANDOFF at the top of `LOG.md` first** — it is the live status.
In one line (2026-09-18): Whumpf 1.0 has never been approved; the last submission was
cancelled so the push/alerts/trip-tracking work ships *in* 1.0. Everything is merged
to `main` and passing, but **the EAS free iOS build quota is spent until Oct 1**, so
the next build is a **local build on Kai's Mac** (`eas build --local`, see LOG).

The 2026-08-07 audit's findings are in `LOG.md` under that date.

## Hard-earned rules (violating these has already caused bugs)

- **`.env` is deliberately tracked in git** — EAS builds get their env only from the
  git archive. Do not untrack it without first adding `env` blocks to `eas.json`.
- **Check reachability before fixing a component** — ~2,500 lines are dead code with
  zero importers, including `components/avalanche/ZoneCard.tsx` (844 lines). Fixing
  bugs there ships nothing.
- **The repo does not fully describe production.** Check live shape before backend
  changes: `supabase gen types typescript --linked` reads the live schema through the
  Management API with no DB password. (The live cache tables are `forecast_cache`,
  `stations_cache`, `observations_cache` — an older note here named
  `avalanche_forecast_cache` / `avalanche_daily_forecasts`, which do not exist.)
- **Migration history has diverged** between repo and production (out-of-band applies
  recorded under different ids). **Never run `supabase db push` blind** — it may try to
  re-run old migrations. Apply new ones with `supabase db query --linked -f <file>`, then
  record them with `supabase migration repair --status applied <id>`. See LOG 2026-09-17.
- **Two edge functions must always deploy `--no-verify-jwt`:** `trip-plan-page` and
  `legal`. The Deno proxy (`deploy/main.ts`) calls them with no auth headers; dropping the
  flag 401s every share link and both legal pages. Always `--use-api`.
- **The `ink` palette is inverted** (950 = lightest). Decoder ring in
  `constants/design.ts:7-18`. Tokens duplicated in `tailwind.config.js` — keep in sync.
- **Dates:** `todayIsoDate()` is UTC and rolls over at 3 PM Alaska time. Don't add a
  fourth workaround; fix callers to a single convention (local, per
  `lib/observation/schema.ts:227-229` reasoning) when touching date logic.
- **Gates before claiming a change is done:** `npm run typecheck` (tsc --noEmit),
  `npm run lint`, and `npm test` (Vitest — logic tests for `lib/dates`, offline-cache
  merge/prune, `loadForecastBundle`, and the synoptic timestamp math). Tests pin
  `TZ=America/Anchorage` for deterministic date assertions. No CI yet — run them
  locally. **`npm run typecheck` does not cover `supabase/`** (tsconfig excludes it), so
  after touching an edge function also run
  `deno check supabase/functions/<name>/index.ts`.
- **Where you are running matters.** On Kai's Linux desktop there is no iOS simulator and
  the phone's libimobiledevice services need a Developer Disk Image (i.e. a Mac), so UI
  can't be verified there. **On the Mac, use the iOS Simulator** to check layout before
  building — web rendering has repeatedly lied about native layout (JOURNAL 2026-09-10/11).
  Background location and push still need the physical phone.
- **Verify behaviour, not artifacts.** The recurring failure in this project is checking
  the easy property (bytes, pixel size, a page that loads, a deploy that succeeded)
  instead of the thing itself. Submit the form, read the generated plist, query the row.
