# Journal — Avy Comparison (mobile app)

The narrative companion to `LOG.md`. Where the log records *what* happened, the journal
holds the *thinking around it*: reasoning, open questions, dead ends, gotchas discovered,
things to watch, half-formed ideas, and anything that helps a future session pick up the
thread with the same context the last one had.

**How to use this file**
- Newest entries at the **top**.
- Freer-form than the log — write in prose. Capture what you were thinking, what
  surprised you, what you're unsure about, what to check next time.
- Update it **mid-session** whenever you learn something worth carrying forward,
  especially gotchas and "don't trust X because Y" lessons.
- If a fact becomes a stable, reusable truth about the codebase, also consider promoting
  it to a proper memory file (see `~/.claude/.../memory/MEMORY.md`).

---

## 2026-08-07 — Adoption day: the audit, and why we're not forking

This project was built in nine days by an earlier era of coding agents, and today's job
was to decide whether to hard-fork and start fresh or keep developing. Five parallel
agents read all ~28k lines. The answer came back unanimous and surprisingly nuanced:
**keep it, but stop feature work until a stabilization pass lands.**

The surprise wasn't the bug count — it was the *shape* of the quality. The macro
decisions are consistently good: cron-refreshed Postgres cache with thin read endpoints
is the right backend; offline-first snapshots are right for a backcountry app; the
danger-color tokens are disciplined exactly where safety demands; strict TypeScript
compiles clean with almost no `any`. And the comments preserve real hard-won knowledge —
why BGAppRefreshTask beat BGProcessingTask, APNs priority-5 semantics, NAC schema
provenance. A rewrite would torch that knowledge to escape bugs that are individually
cheap to fix.

The failure signature is distinctly "old-agent": **copy-paste instead of abstraction,
and no consolidation pass.** The snapshot merge is hand-copied three times (already
textually divergent) while the two purpose-built helpers in `offlineCache.ts` sit dead.
The zone catalogue exists seven times. `StationsOnlyTile` is 210 lines pasted from
`ZoneTile`. The signature moment: `ZoneTile.tsx` inlines the `freshnessColor` ternary
340 lines below the named `freshnessColor` function *in the same file*. That's what a
narrow context window does. Quality rises sharply with recency — the newest code
(`components/observation/`) is genuinely good, which suggests each generation of work
was better than the last and the oldest strata were never revisited.

Things that genuinely worried me:
- **This is a safety app with safety bugs.** The 24hr-snow-by-array-index bug means the
  headline number people use for go/no-go decisions can be a 4-hour figure. The archive
  date fallback can show today's danger under yesterday's label. These outrank
  everything else except the security hole.
- **The observation flow betrays users on every non-happy path.** Cancel publishes
  anyway; drafts save into a queue nothing reads while the banner says "tap to retry";
  success can display as failure and prime a duplicate. This is the feature currently
  under active development on this very branch.
- **Trust the migrations less than they look.** Two tables the biggest edge function
  reads/writes have no migration at all — the repo does not fully describe production.
  Before touching backend code, check the live Supabase project for
  `avalanche_forecast_cache` / `avalanche_daily_forecasts` and their RLS.

Gotchas to carry forward:
- `.env` is *deliberately* tracked in git and is the only reason EAS builds get their
  Supabase env (no `env` blocks in eas.json). Untracking it without adding eas.json env
  blocks breaks production builds — the "obvious hygiene fix" is a landmine.
- The `ink` palette scale is **inverted** (ink-950 = lightest, ink-50 = darkest) after
  the dark→paper migration; ink-700 and ink-100 are the same hex. Decoder ring in
  `constants/design.ts:7-18`. Tokens are duplicated between design.ts and
  tailwind.config.js with nothing enforcing agreement.
- Dead code actively lies: `ZoneCard.tsx` (844 lines, 0 importers) looks like the
  canonical zone renderer and was patched as recently as three commits ago. Don't
  fix bugs there thinking they ship; confirm reachability first.
- UTC vs local dates: `todayIsoDate()` is UTC, so "today" rolls over at 3 PM Alaska
  time. Three separate workarounds exist in `app/index.tsx` (:875, :919, :401) for
  this one root cause — symptoms of it were patched repeatedly, never diagnosed.
- expo-doctor patch drift (expo 54.0.34 vs ~54.0.36 etc.) — `npx expo install --check`
  fixes; harmless but shows up in every doctor run.

Open questions for Kai:
- Was the app ever actually distributed via TestFlight? (Whether the staging-NAC bug
  ever hit real testers depends on this.)
- Is the Always-location background wake worth the App Store rejection risk, given the
  code comment admits location data is unused?
- Do the two orphan cache tables exist in prod, and are the redesign worktree branches
  safe to delete?

Where I'd start next session: the ship-blockers list at the bottom of LOG.md's
2026-08-07 entry — device_tokens RLS + refresh-function auth first (it's a live
security hole), then the five observation-flow fixes since that's the active branch.
