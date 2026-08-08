# CLAUDE.md — Avy Comparison (mobile app)

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
- Backend: self-owned Supabase (9 edge functions, pg_cron refresh, Postgres caches).
  Shared with the AvalancheComparison web app (`../AvalancheComparison`).
- Current branch: `feature/observation-submit` (17 ahead of `main`).
- Knowledge graph: `graphify-out/` exists — for architecture questions, query it first
  (`/graphify query "..."`) instead of re-exploring.

## Current state (2026-08-07 audit)

Full audit verdict: **continue developing, no hard fork — but stabilization before
features.** The prioritized findings live in `LOG.md` (2026-08-07 entry). Highest
severity: `device_tokens` RLS hole, staging-NAC default in production builds,
array-index snow math, broken observation cancel/draft flow.

## Hard-earned rules (violating these has already caused bugs)

- **`.env` is deliberately tracked in git** — EAS builds get their env only from the
  git archive. Do not untrack it without first adding `env` blocks to `eas.json`.
- **Check reachability before fixing a component** — ~2,500 lines are dead code with
  zero importers, including `components/avalanche/ZoneCard.tsx` (844 lines). Fixing
  bugs there ships nothing.
- **The repo does not fully describe production.** `avalanche_forecast_cache` and
  `avalanche_daily_forecasts` have no migrations. Verify against the live Supabase
  project before backend changes.
- **The `ink` palette is inverted** (950 = lightest). Decoder ring in
  `constants/design.ts:7-18`. Tokens duplicated in `tailwind.config.js` — keep in sync.
- **Dates:** `todayIsoDate()` is UTC and rolls over at 3 PM Alaska time. Don't add a
  fourth workaround; fix callers to a single convention (local, per
  `lib/observation/schema.ts:227-229` reasoning) when touching date logic.
- **Gates before claiming a change is done:** `npm run typecheck` (tsc --noEmit),
  `npm run lint`, and `npm test` (Vitest — logic tests for `lib/dates`, offline-cache
  merge/prune, `loadForecastBundle`, and the synoptic timestamp math). Tests pin
  `TZ=America/Anchorage` for deterministic date assertions. No CI yet — run them
  locally. The app itself is iPhone-first and can't be run in this Linux env (no iOS
  sim); Vitest covers the pure logic, device smoke-testing is still manual.
