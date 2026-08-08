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

## 2026-08-07 — Tier 3: deleting dead code without guessing, and knowing when to stop

The project's own CLAUDE.md rule — "check reachability before touching a component,
~2,500 lines are dead" — is exactly right, and the temptation was to just delete the
audit's list. I didn't. I wrote a real import-reachability analysis (walk imports from
every `app/` route, since expo-router auto-discovers them) and let *that* produce the
delete list, cross-checked with grep. Worth it: the audit was wrong on four files —
`WeatherStationCard`/`MetricChart`/`WindCompass`/`WindDirectionRow` are reachable
through `stations.tsx`, not only through the dead `ZoneCard`. Deleting them would have
broken the stations screen. The analysis caught what a list-follower would have missed.
~2,700 lines gone (app + backend), tsc + tests green, live functions smoke-tested.

The interesting judgment call was task 20, the 7× zone catalogue. The instinct is
"duplication bad, consolidate." But the honest analysis says otherwise: the copies live
in two runtimes (the app bundle and the Deno edge functions) that genuinely cannot share
an import, so a real single source needs a codegen/build step and a rewire of five *live
forecast* functions. High risk, and the payoff is small because the zone set almost never
changes. The audit's actual complaint wasn't "there are copies" — it was "they stay in
sync by luck." So I fixed *that*: a drift-guard test that fails the moment any copy
diverges. That's the whole safety benefit at none of the risk. The physical merge is a
real future change, but it should be its own deliberate thing, not tacked onto a deletion
pass. Deleting dead code and restructuring live code are different risk classes and I
didn't want to blur them.

General lesson from this whole session worth writing down: the audit was an excellent
map but not a substitute for verification. It was wrong about ZoneCard's dependents,
imprecise about the token-in-logs sites (dead code, not live), and it over-weighted the
zone-catalogue consolidation. Every time I verified before acting — reachability graph,
live DB checks, the drift test — it changed what I did. Trust the audit to point; verify
before you cut.

## 2026-08-07 — Phase 3: TanStack Query, and being honest about what I can't verify

Did "the big one" — moved forecast fetching onto TanStack Query. The design that
made it tractable: don't rewrite the render. I extracted the entire fetch decision
tree into `lib/forecast/loadForecastBundle.ts` (a pure-ish async queryFn returning one
complete bundle), then derived the component's existing state-variable names
(`summary`, `weatherForecastData`, `loadSource`, …) from `query.data`. So ~1,900 lines
of render and the two write-back effects never changed — only the ~380-line fetch
tangle got deleted. index.tsx dropped to 2,294 lines and four audit bugs (B10, B12,
B13, B16) fell out of the structure rather than needing individual patches.

The subtle bug I had to design around was `keepPreviousData`. It keeps the previous
date's bundle on screen during a refetch — good UX, matches the old "don't blank"
feel — but the persist and session-fan-out effects key on `viewedDate`, which has
*already* moved. Without a guard they'd file yesterday's forecast under today's key
the instant you page, and for a date with no data that stale write would survive
(the correct result is "empty", which doesn't overwrite). This is the same class as
the B8 safety bug I'd just fixed, arriving through a different door. The fix: both
write-back effects now bail while `forecastQuery.isFetching`, so only settled data for
the current key ever gets persisted. Worth noting the old code had the same transient
window (setViewedDate + async setSummary); I didn't invent it, but keepPreviousData
made it worth closing properly.

**The honest part.** This is the largest single rewrite of the app's busiest file, and
I can't run it. The environment is Linux; it's an iPhone-first Expo app with native
modules (background fetch, notifications, location) that don't work on web, and there's
no iOS simulator here and no test harness in the repo. So "verified" means tsc clean,
eslint clean, and careful branch-for-branch translation of the decision tree — nothing
more. tsc cannot catch a wrong query key, a bad `enabled` predicate, or a
keepPreviousData edge I didn't think of. Before this merges it needs a real device run:
date paging archive↔today, pull-to-refresh, offline launch, and the offline→online
transition are the paths most likely to expose a mistake. The live-scrape fallback is
rare (only on a server-cache miss) but is the most-rewritten branch, so worth forcing.

If I could change one thing about the order of this whole effort, it'd be to stand up a
minimal test harness (even just Jest over lib/dates, the snapshot merge, and
loadForecastBundle with a mocked avalancheApi) BEFORE this phase rather than after.
Four commits of date/concurrency/fetch logic now rest on construction-correctness alone.
That's the honest top of the next-session list, ahead of more feature-shaped work.

## 2026-08-07 — Data-layer refactor (phase 2): dates, one writer, the archive safety bug

Three tasks, each committed on its own. The theme: the data layer's bugs were all
downstream of two structural problems — no single date convention and no single
snapshot writer — so fixing the structure fixed the bugs.

**Dates.** `todayIsoDate()` was UTC; the observation form was local; three separate
workarounds in `index.tsx` had been bolted on to paper over the resulting off-by-one
rather than fixing the root. Introduced `lib/dates.ts` (local, one convention) and
routed everything through it. The subtle part was the *frozen* today values: both
`todayStr` and the header date object were computed once at mount, so an overnight
background stranded the pager on yesterday with the forward arrow disabled. Made them
recompute on AppState 'active'.

**One writer.** The snapshot read-modify-write existed three times and the two purpose-
built helpers in offlineCache sat dead — the exact "each slice re-solved it locally"
signature from the audit. Added `mutateSnapshot` (serializes every write behind one
promise chain) + `mergeZoneBundle` (the nested spread, once). The two identical
fetch-and-store copies collapsed into `refreshFavoritesSnapshot`; the reactive persist
effect kept its distinct viewedDate/in-memory semantics but now runs atomic. Deleted
the dead helpers and the unused auto-refresh preference while I was in there.

**The archive safety bug — the one that mattered most.** Zone detail screens fell back
to a *dateless* in-memory session cache when the snapshot lacked a bundle for the
viewed date. The session always holds the most-recently-fetched day, so back-scrolling
to an archive day silently showed today's danger ratings under that day's label. For a
tool people read before committing to terrain, that's the worst kind of bug: confident
and wrong. The fix rides on the 5-way-duplication cleanup the audit already wanted — a
single `useZoneBundle` hook whose date rule *is* the safety property: today shows
newest + session fallback; an archive day shows only the exact stored bundle, never the
session. Tagged session entries with a `dateKey` and gated the fallback on it.

What I deliberately did NOT do: fully fix §2.4 (get-cached-forecasts returns a global
max forecastDate, so a zone whose forecast is a day old gets filed under a newer archive
key). The honest reason: the client has no reliable per-zone date — `freshness.issueDate`
is the mis-parsing display string the audit already flagged. The today=newest /
archive=exact rule *mitigates* it (archive only shows what was explicitly stored, and
the freshness object marks staleness), but the real fix is a backend change to return a
raw per-zone ISO date from get-cached-forecasts. Logged as a follow-up rather than
faked client-side.

**State of the audit now.** Every ship-blocker and the two highest-value data-layer
structural fixes are done. What remains from the audit, roughly: the §2.4 backend
per-zone date; the consolidation pass (delete ~2,500 dead lines incl. ZoneCard, collapse
the 7× zone catalogue, split the 2,675-line index.tsx, adopt the already-installed
TanStack Query); zod on inbound responses; and standing up a CI/typecheck gate before
that churn. No test infra yet — the whole data layer's date + concurrency logic is
verified by construction and tsc, which is thinner than I'd like. If I were prioritizing
the next session: TanStack Query adoption would retire most of index.tsx's remaining
hand-rolled effects (including the B10 fetchSummary race) in one structural move, and a
minimal test harness around lib/dates + the snapshot merge would give the date/
concurrency work real coverage.

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
