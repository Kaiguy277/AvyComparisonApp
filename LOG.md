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
  Note: graphify-out/ is untracked and NOT in .gitignore — decide before any `git add .`.
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
