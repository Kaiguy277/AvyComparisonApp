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

## 2026-08-07 — First stabilization pass: all six ship-blockers cleared

Worked straight down the audit's ship-blocker list; all six done, each committed
separately, all verified live where they touch prod. The through-line: this went
faster than the audit implied because the diagnoses were precise — most fixes were
small and surgical once the live backend was confirmed.

**The big discovery up front:** the Supabase project was *auto-paused* (INACTIVE).
Production has been dead since sometime after the May 8 last commit — no pushes, no
cron refresh, nothing. Restored it. This also resolved an audit open question: the
two orphan tables (`avalanche_forecast_cache`, `avalanche_daily_forecasts`) genuinely
**do not exist** in prod, so every read/write of them in `avalanche-summary` has been
erroring-and-swallowed from day one. When we get to consolidation, delete that ~150
lines rather than writing migrations for it.

**Kai's heads-up reframed one item:** there's no production NAC API access yet, so the
staging default in `observationSubmit.ts` is *correct*, not a bug. Rather than flip it
to prod, I made it explicit in `.env` with a comment and added a "TEST MODE" line to
the submit footer, so a future prod cutover is a visible two-line change.

**Gotchas worth remembering:**
- **A `private` Postgres schema is invisible to edge functions.** The service-role
  client reads through PostgREST, which only exposes `public`. First attempt at the
  cron-secret store put it in `private` and the gate failed closed ("auth
  unavailable"). Fix: table in `public`, RLS on, all grants revoked from anon — anon
  gets `permission denied`, service_role bypasses RLS. Verified anon can't read it.
- **Edge deploys work headless via `supabase functions deploy <name> --use-api`** (no
  Docker). The CLI is at ~/.local/bin/supabase and the project is already linked. It
  bundles `_shared/*.ts` automatically and fails loudly on a Deno build error, which
  is our only type-gate for the functions (no local deno).
- **pg_cron secret plumbing:** updated the 3 http-post jobs with `cron.alter_job`,
  pulling the secret from the table inside a DO block so the value never entered my
  SQL text (it lives in cron.job command + the table, both service-role-only, like
  the anon key already did).
- The snow-math fix is the one I'd most want re-checked by Kai against a known
  station, because it changes displayed numbers. The verification I have is
  structural (point counts prove time-bucketing: 25 pts/24h, 35 pts/72h regardless of
  cadence) rather than a golden-value comparison. It's correct by construction, but a
  real-station spot-check before the next TestFlight build would be worth doing.

**What's left from the audit** (next sessions, in rough priority): the data-layer
refactor (one date convention, one snapshot writer, per-zone date keys, zod on inbound
— fixes the archive-shows-wrong-day safety bug and the lost-update races); then the
consolidation pass (delete ~2,500 dead lines incl. ZoneCard, collapse the 7× zone
catalogue, split index.tsx, adopt the already-installed TanStack Query). The
observation flow's remaining smaller items (split-validation B15, the CenterPicker
lock B19) are lower stakes. No CI/tests yet — worth standing up a typecheck gate
before the refactor churn begins.

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
