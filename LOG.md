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

## 2026-09-20 — Mac unblocked: Xcode 16.2 in, **app built, running and SEEN in the Simulator**

> Scope: Mac-only, as with the 2026-09-19 entry. Linux dev is unaffected.

### Blockers from yesterday, resolved
- **Xcode 16.2 installed** (`.xip` from developer.apple.com, 2.97 GB — modern Xcode no longer
  bundles simulator runtimes, so that size is correct). 15.3 parked at
  `/Applications/Xcode_15.3.app`, not deleted. Now: **iOS 18.2 SDK**, Apple clang 16.
- **CocoaPods 1.17.0** on **MacPorts ruby33 (3.3.9)**. Two traps:
  - MacPorts `ruby33` defaults to the **`+yjit`** variant, whose build dep is **rust** → it
    starts compiling a Rust toolchain. Use `-yjit`.
  - MacPorts' own fetch is broken here: `curl progress callback failed: unbalanced open
    paren ... $env(COLUMNS)` aborts each mirror. **Workaround that worked:** download the
    tarball with curl and stage it — `sudo cp ruby-3.3.9.tar.gz
    /opt/local/var/macports/distfiles/ruby33/` — then `sudo port install ruby33 -yjit`.
- **CORRECTION to the 2026-09-19 entry.** I wrote that Xcode 16 would supply `stdckdint.h`.
  It does **not** — Apple clang 16 lacks it and rejects `-std=c23`; Apple's clang numbering
  does not track upstream LLVM. The real cause was **Homebrew's bundled portable Ruby
  4.0.7** (released 4 days earlier), whose own `ruby/internal/stdckdint.h` breaks native gem
  builds. **Any Ruby 3.x avoids it.** CocoaPods was a Ruby-version problem, not a clang one.
- `npx expo prebuild --platform ios` + `pod install`: **clean**. `ios/Whumpf.xcworkspace` built
  with **0 errors**. App installs, launches, Metro bundles 2350 modules (~35 s).
  - ⚠️ **`expo prebuild` rewrites `package.json` scripts** (`expo start --ios` → `expo run:ios`,
    same for android). Reverted here. It will do this on Linux too — check before committing.

### Simulator traps worth remembering
- **`xcodebuild -downloadPlatform iOS` downloads the NEWEST runtime** (18.3.1), which Xcode
  16.2 (SDK 18.2) **cannot build against**: `xcodebuild` then reports *"Unable to find a
  destination"* and lists only "Any iOS Device" as ineligible — misleading, since the real
  problem is the simulator runtime, not the device platform. **Pin it:**
  `xcodebuild -downloadPlatform iOS -buildVersion 18.2`. The 18.3.1 runtime (8.1 GB) was deleted.
- After switching Xcode, a **stale CoreSimulator service** made `simctl list runtimes` return
  **empty** even though the download had succeeded. Fix:
  `sudo killall -9 com.apple.CoreSimulator.CoreSimulatorService`. Classic
  artifact-vs-behaviour: the download said `Done`, the runtime was not usable.
- **This Mac has 8 GB RAM.** A cold RN build plus a booted simulator (87 CoreSimulator
  processes, **4.16 GB**) does not fit; one build was killed under memory pressure. Also found
  **orphaned `SimLaunchHost` processes (`ppid=1`, 3–4 h old) pinning ~900 MB** — `sudo kill -9`
  them. Check `ps -A -o rss,ppid,etime,comm` before blaming the build.

### First look at the screens — written on Linux, never seen until today
**Verified good:** onboarding layout; home **bar pill** (`CACHED` / `PUSH ·
SKIPPED-NOT-DEVICE · TAP TO RETRY` / `BG WAKE`); **ZONES NEAR YOU** strip (appears once
location is granted); the zones grid (4 cards, correct data); footer/About; the
**HEADING OUT / REPORT OBS** bottom bar; profile autosave (`SAVED 12:02 PM`) with the
section header live-updating; back chevron present. No clipping or overflow anywhere.
- **`BG WAKE · … VIA LOCATION` confirmed** — it read `VIA FOREGROUND` before location was
  granted and `VIA LOCATION` after. That is the movement-triggered refresh, the
  highest-value item in `RELEASE_CHECKLIST.md` §4, working.
- **"Your trips" strip correctly absent** on a fresh install (no history, no saved trip),
  and **HEADING OUT correctly routes to the profile gate** rather than the composer.

**Findings:**
1. **Temperature formatting is inconsistent** — the four zone cards render **`33.9°`, `36°`,
   `49.6°`, `43°`**: one decimal on two, none on the other two. This is the `temperature
   formatting` item from the Mac prompt. Not yet traced to a formatter.
2. **`expo-background-fetch` is deprecated** — warns on every launch ("Use
   expo-background-task instead"). Background refresh is this app's premise, so this is worth
   scheduling, though not a 1.0 blocker.
3. Zone cards briefly render **absent** right after launch while forecasts load, then appear.
   Looked like a bug; it is just the loading window. Do not chase it.

### Full walkthrough completed (automated, Simulator) — all 7 handoff screens SEEN
Drove the whole Heading Out flow end to end with the tap/type harness. **Every screen on the
Mac-prompt list has now been looked at**, plus the fixes from `fix/trip-flow` verified live:
- **Home bar pill** ✓ · **ZONES NEAR YOU** ✓ · **`BG WAKE · VIA LOCATION`** ✓ (flipped from
  `VIA FOREGROUND` the moment location was granted — movement refresh works).
- **Profile gate** ✓ — HEADING OUT correctly routes to `Your profile` on a fresh install;
  sections 1–2 gate the first trip exactly as the copy promises; autosave + live section
  summaries work; `CONTINUE — PLAN A TRIP` skips sections 3–8.
- **Composer** ✓ — WHEN pre-fills sensibly (leaving now, back +8h, worry +3h); packet
  completeness meter reads 58% with an honest "Fine to send" note.
- **Trip hub (live)** ✓ — LIVE badge, back-by/worry-by, per-contact `Not sent yet` + SEND,
  ACTIVITY log, I'M BACK, CANCEL TRIP.
- **BUG #1 FROM THE BUILD-35 AUDIT CONFIRMED FIXED** — after creating a trip, home now shows
  the **trip strip** (`Tin can Ridge · back by …`) and the bottom bar switches HEADING OUT →
  **I'M BACK**. It used to still say HEADING OUT. The `saveActivePlan` subscriber works.
- **"Your trips" strip** ✓ — correctly **absent** with no trips, appears as
  `Your trips · 1 past` once history exists.
- **DISMISS on the closed card** ✓ — no longer a no-op.
- **PAST TRIPS** ✓ (`PAST TRIPS · 1`) → **past-trip screen** ✓ (read-only, ACTIVITY preserved,
  REMOVE FROM HISTORY).
- **"Go to trip" alert** ✓ — reaching the composer with a live trip now gives *"You already
  have a live trip … Check in or cancel it before starting another"* with **Not now / Go to
  trip**, and **Go to trip navigates** (previously a dead end offering only OK).
- **REPEAT LAST TRIP** ✓ — prefills and **auto-advances the times**, incl. next-day rollover
  (`worry-by Tomorrow 12:30 AM`).
- **Zone detail** ✓ and **Stations** ✓ render correctly, including the off-season empty
  states (forecasts legitimately EXPIRED in September — not a bug).
- **Back navigation** never dead-ended anywhere in this walkthrough.

**Production note:** two real trip plans were created against production Supabase during this
test (contact `sam@example.com`, a non-deliverable reserved domain). **Both were closed** —
one checked-in, one cancelled — so nothing is live and no overdue reminders can fire. The
rows still exist; they were not deleted.

### DEVICE PASS on Kai's iPhone XR (iOS 18.7.8) — §4 checks 1 & 2 PASS (2026-09-21)
Ad-hoc build installed over build 35 with `devicectl` — **no crash on upgrade** (not the
`≤32` path that broke, but a data point). Phone now runs **1.0.0 (39)**, which includes the
wind-formatter fix.
- ✅ **Push token decoupling — CONFIRMED ON HARDWARE.** With notifications denied the home
  screen reads exactly `ALERTS OFF · NO DAILY FORECAST · TAP TO TURN ON` (amber), **not**
  `PUSH · PERMISSION-DENIED`. This is the behaviour that was only ever inferred from
  `PushTokenModule.swift` and never run on a device. It works.
- ✅ **Tapping the line deep-links to iOS Settings → Whumpf.** No permission prompt appears,
  which is correct: iOS only ever prompts once per install, and it had already been denied.
  The checklist already allowed for this ("or deep-link to Settings if iOS will not ask
  again") — it is not a bug.
- ✅ **Granting notifications clears it.** After enabling and relaunching, the amber line is
  **gone**; only `CACHED` and `BG WAKE` remain. Full cycle verified.
- ✅ **Wind formatter verified on device**: `6 mph E`, `4 mph NW`, `19 mph SE`, `0 mph NE` —
  all whole numbers. Temps `34.6° / 37° / 46.9° / 46°` show `formatTempF` behaving as
  designed.
- Observed: **Background App Refresh was OFF** in Settings → Whumpf, which is why `BG WAKE`
  reports `VIA FOREGROUND`. Location was already **Always**.
- Still to do on device: trip tracking + blue indicator + check-in stopping it (which is also
  the §5 recording Apple asked for), and the daily forecast alert.

### Trip tracking on device: blue indicator ✅, **0 positions is CORRECT, not a bug**
Kai ran the §5 recording: toggle on, trip sent, **blue location indicator present**, app
backgrounded, checked in. The packet page said the location had not come through yet, and
production confirms it — plan `97bb13f9` (22:44→22:46 UTC), `tracking_enabled: true`,
**0 rows in `trip_plan_locations`**. The 2026-09-19 tracked trip is also 0.
- **This is expected.** `lib/tripPlan/tracking.ts:203-207` sets
  **`distanceInterval: 500` m** and **`timeInterval: 10 * 60 * 1000`** (10 min). A ~2-minute
  stationary test cannot produce a position. The packet page's "not come through yet" is
  honest, not broken. **Do not file this as a bug.**
- Consequence for §5: the checklist's step 5 ("show Last known position") **cannot be
  satisfied in a 60-second stationary take**. Either move 500 m / wait 10 min during the
  recording, or accept that steps 3/4/6 (indicator present → persists backgrounded →
  disappears on check-in) are what Apple actually asked for: *"persistent background
  location usage"*. Step 5 was our own addition.
- **Still genuinely unverified:** that a position ever reaches `trip_plan_locations` at all.
  Every tracked trip so far is 0, so the write path has never once been exercised — a real
  gap, just not the one the recording exposed. Worth one walk of >500 m with a trip open.

### Build-33 crash logs: GONE from the device — thread closed unresolved (2026-09-21)
Phone connected (`Kai's iPhone`, **iPhone11,8 / iPhone XR, iOS 18.7.8**, UDID
`00008020-000C65893AF3002E`). Synced device logs via Xcode → Devices → View Device Logs;
they land in `~/Library/Developer/Xcode/DeviceLogs/<device>/`.
- **17 logs total, every one dated 2026-09-21**, all under `Other Logs` /
  `Unsymbolicated Logs` (cpu_resource, JetsamEvent, SiriSearchFeedback…).
- **None reference `Whumpf` or `com.kaimyers.avycomparison`.** iOS has rotated out everything
  from build 33's era.
- **So the upgrade-crash cause stays inferred and cannot now be confirmed.**
  `lib/legacyTaskCleanup.ts` remains the fix-by-hypothesis. Per RELEASE_CHECKLIST §4, the
  honest note is that it **went untested** — and unless a device still carries a build ≤32,
  it cannot be tested at all. **Stop planning to confirm it; it is not recoverable.**
- Phone currently runs **build 35**, so installing an ad-hoc build over it tests an upgrade
  from 35 — not the ≤32 path that crashed.

### ⛔ SUBMISSION REJECTED BY APPLE — Xcode 16.2 is not new enough either
`eas submit` uploaded build 39 and **Apple refused it**: *"applications uploaded to App Store
Connect [must be] built with a recent version of Xcode and the iOS SDK."*

**The requirement, from Apple's own page (verified today, not recalled):**
| in force since | requires |
|---|---|
| 2024-04-29 | Xcode 15+ / iOS 17 SDK |
| **2026-04-28** | **Xcode 26+ / iOS 26 SDK** ← current |

Build 39 was Xcode 16.2 / **iOS 18.2 SDK**. That satisfied the *old* rule and nothing else.

**CORRECTION to the 2026-09-19 and 2026-09-20 entries.** I wrote that "Apple has required the
iOS 18 SDK for App Store submissions since April 2025". **That is wrong** — there was no such
rule. Until 2026-04-28 the floor was Xcode 15 / iOS 17, which **Xcode 15.3 already met**. So
the Xcode upgrade was never justified by App Review at all.
- It *was* still necessary: Expo SDK 54 / RN 0.81.5 needs **Xcode 16.1+** to compile, and 15.3
  could not build the app. That reason was real and is why today's Simulator pass happened.
- But it was **necessary, not sufficient**, and I asserted the wrong reason with confidence.
  The right move was to read Apple's requirements page before claiming a deadline.

**Can this Mac reach Xcode 26?** Probably not.
- Xcode 26 requires **macOS Sequoia 15.6+**. This machine is on **macOS 14.7.7**.
- `softwareupdate --list-full-installers` offers **Sequoia 15.8 at most — macOS 26 (Tahoe) is
  not offered**, so this Mac is at the end of its OS line.
- Hardware is **MacBookPro16,3** (13-inch Intel, 2020). Whether Xcode 26 runs on Intel at all
  is **unverified** — Apple's page lists the OS range but I could not confirm Intel support,
  and I am not going to assert it either way again.
- So the local-build path needs, at minimum, a macOS upgrade to Sequoia 15.8, and may be a
  dead end regardless.

**The reliable path is EAS cloud builds**, which run current Xcode on Apple's infrastructure
and sidestep this machine entirely. The free iOS quota **resets Thu 2026-10-01** (11 days).

**What today still bought, despite the rejection:** the app was built, run and *seen* for the
first time — all 7 handoff screens verified, the build-35 trip-flow fixes confirmed fixed on
screen, and a real wind-formatting bug found and fixed. None of that needed a submittable
binary. Build 39 is signed and on disk; it is simply not uploadable.

### BUILD 39 BUILT LOCALLY AND SIGNED ✅ (submitted, and REJECTED — see above)
`eas build -p ios --profile production --local` → **`build-1789944416173.ipa`, 19 MB**.
Verified by inspecting the archive, not by trusting the success line:
`com.kaimyers.avycomparison` · **1.0.0 (39)** · MinimumOS 15.1 · **built against
`iphoneos18.2`** · chain `iPhone Distribution: Kai Myers (254PZ32RGR)` → WWDR → Apple Root CA.
**This is the first binary from this Mac that Apple would accept** (the iOS 18 SDK rule).

- **It is build 39, not 37.** `autoIncrement` consumes a number per *attempt*, and the first
  two attempts failed. Harmless — Apple only needs the number to increase — but the
  2026-09-18 handoff's "the next build will be 37" is now wrong.
- **fastlane 2.240.1** installed in ~2 min with `sudo gem3.3 install fastlane`, versus
  Homebrew's llvm+rust source build. Use the MacPorts Ruby for gems on this machine.

#### The real blocker: an expired Apple intermediate (cost two failed builds)
Both failures reported `Prepare credentials … Distribution certificate with fingerprint
6415A76F… hasn't been imported successfully` — a generic message that says nothing about the
cause. The actual state of this Mac:
```
security find-identity -v -p codesigning  →  0 valid identities found
Apple WWDR Certification Authority (G3)   →  notAfter Feb 7 2023   (expired 3½ years)
```
EAS downloads the distribution cert and imports it into a temp keychain, then validates it
with `find-identity -v`, which only lists identities whose **chain validates**. With the only
intermediate expired, the import "succeeds" and the identity is still unusable.
- Installing **WWDR G6** did **not** fix it — the leaf is an **`iPhone Distribution`** cert
  (old style), which chains to **G3**, not G6. Read the certificate's common name before
  picking an intermediate.
- Fix: install Apple's **renewed G3** (`https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer`,
  valid to 2030) into the login keychain. Next build succeeded.
- The **expired G3 is still present in the System keychain** — `security delete-certificate`
  fails with a write-permissions error. Harmless now that a valid G3 resolves first, but it
  is still there and will confuse the next person who looks.
- **This was a machine-level certificate problem, not an EAS-local one.** It had nothing to do
  with building locally and would have surfaced anywhere this Mac signed code.

#### Noted, deliberately not acted on
`expo-doctor` reports 4 patch mismatches (`expo` 54.0.34 vs `~54.0.37`; `expo-constants`,
`expo-font`, `expo-router`). It does not block the build. Bumping Expo packages immediately
before a release build trades a working build for a debugging session — do it after 1.0 ships.

### CORRECTION + FIX: the temperature finding was wrong; the wind one was real
**I was wrong about temperature.** `33.9°` next to `36°` is **deliberate**, and
`lib/units.ts:formatTempF` documents why: one decimal, trailing `.0` dropped, *"deliberately
NOT rounded to whole degrees: around freezing the difference between 31.6 and 32.4 is rain
versus snow"*. Nothing to fix — reading the formatter before "fixing" it caught this.

**The wind figures were a real bug.** `WeatherStationCard` rendered the headline speed raw
(`${w.speedCurrent}` → **`6.95 MPH`**) while the zone tiles already did `Math.round(...)`, and
`RangeStat` passed `avg`/`max` through unformatted (**`9 mph`**, **`27.8 mph`**). Three
precisions for one quantity in a single view — exactly the bug `formatTempF`'s own comment
describes for temperature, which got a formatter while wind never did.
- Added **`formatWindMph`** (`lib/units.ts`) — rounds to whole mph, guards `-0`, `—` for
  null/non-finite. It **rounds where `formatTempF` deliberately does not**, because tenths of
  a mph change no decision, the anemometers are not that accurate, and the forecast products
  these readings sit beside all quote whole mph. That reasoning is in the code.
- Applied at the headline, the gust figure and both `RangeStat`s.
- `RangeStat` only appended its unit for `number` values, so a formatted string would have
  silently dropped `" mph"`; it now appends for strings too, never to the `—` placeholder.
- **+3 tests** (`lib/units.test.ts`), incl. the `-0` case. Gates: tsc 0, eslint 0,
  **Vitest 171**.
- **Verified on screen**, not just in tests: the card now reads **`7 MPH E`**, **`gusts to
  28`**, **`24H AVG 9 mph`**, **`24H MAX 28 mph`**.

### (superseded — see the correction above) Original finding as first written
Not only the zone cards (`33.9°` / `36°` / `49.6°` / `43°`). On the **stations screen, in one
view**: wind reads **`6.95 MPH`**, **`9 mph`** and **`27.8 mph`** — three precisions for the
same quantity — and the unit is cased **`MPH`** in one place and **`mph`** in another.
(Temps on that screen are consistent at one decimal: 34.1 / 34.7 / 31.1.) Two decimals on a
wind speed is also more precision than the measurement warrants. Worth a single shared
formatter before submission; it is the kind of polish App Review does not care about but
users notice immediately.

### UI automation harness — `scratchpad/tap3.py` (new, not in repo)
Driving the Simulator from the CLI, since `idb`/`cliclick` are unavailable. Hard-won:
- **The Simulator window is NOT the device screen.** It includes a title bar and a device
  bezel. Measured insets at the current zoom: **22 pt left, 81 pt top**, device screen
  **319.5 × 693.5 pt** for a 1206 × 2622 screenshot. Assuming window == screen sent every tap
  to the wrong place for hours and looked exactly like a permissions failure.
- Needs **Accessibility** (for synthetic events) *and* **Screen Recording** (or
  `screencapture` silently returns bare wallpaper with no windows) granted to the host app —
  here, VS Code. `AXIsProcessTrusted()` is the honest check.
- **Taps** work. **TextInputs need a longer hold (~0.35 s)** than buttons to take focus.
- **Typing must use virtual keycodes** — `CGEventKeyboardSetUnicodeString` is ignored by the
  Simulator and falls back to the keycode, so every character came out as `a`.
- **Modifiers need real `flagsChanged` events**; setting `CGEventSetFlags` alone makes
  `Cmd+V` type a literal `V`.
- **Controlled `TextInput`s reorder fast keystrokes** (`Kai Myers` → `Kai Kki Myers`). Reliable
  entry: `xcrun simctl pbcopy` + long-press → **Select All** → **Paste** from the iOS edit menu.
- **OPEN:** the profile **CELL NUMBER** field will not take focus by tap (direct, long-press,
  or blur-then-tap); typed text lands in FULL NAME instead. Trip-flow screens
  (**"Your trips"**, trip hub **PAST TRIPS**, past-trip screen, **"Go to trip"** alert) are
  therefore still unseen — they all require a saved trip to exist.

## 2026-09-19 — Mac setup: gates reproduce green, but **Xcode 15.3 blocks the whole plan**

> **SCOPE: everything in this entry about tooling is specific to Kai's Mac** (Intel `x86_64`,
> macOS 14.7.7, Xcode 15.3 — a *second* machine, not a replacement). **The Linux desktop is
> still in active use for development** and none of the Homebrew / MacPorts / Ruby / clang
> findings below apply to it. The Mac exists in this plan for the two things Linux cannot do:
> run the **iOS Simulator** and produce an **iOS build**. Code, gates and backend work carry
> on as before on Linux. The Linux constraints from CLAUDE.md still hold there too: no iOS
> simulator, and the phone's services need a Developer Disk Image.

- **Repo cloned** to `~/Documents/Whumpf/AvyComparisonApp` **on the Mac**, `npm install` done
  (697 packages).
  Gates reproduce the handoff exactly: **tsc 0, eslint 0, Vitest 168 passed** (15 files, 2.8s).
- **BLOCKER — Xcode 15.3 / iOS 17.4 SDK is too old.** Expo SDK 54 / RN 0.81.5 needs **Xcode
  16.1+**, and Apple has required the **iOS 18 SDK** for App Store submissions since Apr 2025.
  So on this machine `npx expo run:ios` will not compile *and* build 37 could not be accepted
  even if it built. Handoff steps 2–3 are blocked until Xcode is upgraded.
  - **The checklist asked the wrong question.** `MAC_SESSION_PROMPT.md` says "tell me if Xcode,
    CocoaPods or fastlane are missing". Xcode was not missing — it was present and too old, so
    it got ticked off. Present ≠ usable. Check the **SDK version**, not the app's existence.
  - Fix: **Xcode 16.2** — last release supporting *both* Intel and macOS 14 (this Mac is
    `x86_64`, macOS 14.7.7), ships the iOS 18.2 SDK. Must come from developer.apple.com as the
    `.xip`; the Mac App Store only offers latest, which needs macOS 15. Kai downloading (~7 GB).
- **This Mac is Intel (`x86_64`) — Homebrew is not a usable installer here.** `brew install
  cocoapods fastlane` builds **from source**: the build tree pulls **llvm@22, rust, cmake,
  ninja, python@3.14, ruby**. Two runs killed at 15 min and 10 min; nothing reached the Cellar,
  stale `/usr/local/var/homebrew/locks/*.lock` cleared. **Don't reach for brew on this box** —
  MacPorts is already installed (2.11.5) and still ships prebuilt Intel binaries.
- **CocoaPods not installed.** System Ruby is **2.6.10** (EOL) and the gem graph has left it
  behind: `ffi` needs ≥3.0, `securerandom` ≥3.1, `zeitwerk` ≥3.2. Pinning (`ffi 1.16.3`,
  `cocoapods 1.15.2`, `--conservative`) just moved the failure downstream — a losing game.
  **Four routes tried, all dead-ended on the SAME root cause — Xcode 15.3's clang:**
  1. Homebrew → compiles llvm@22 + rust from source (no Intel bottles).
  2. System Ruby 2.6 gems → endless version pins (`ffi`, `securerandom`, `zeitwerk`).
  3. MacPorts `ruby33` → default variant is **`+yjit`**, whose build dep is **rust**; with
     `-yjit` it is a non-default variant so no prebuilt archive exists and it builds from
     source, then the source fetch failed. Note the fetch errors were largely a **MacPorts
     bug**, not the network: `curl progress callback failed: unbalanced open paren ...
     $env(COLUMNS)` aborts the fetch per-mirror when `COLUMNS` is unset.
  4. Homebrew's bundled **portable Ruby 4.0.7** (already on the box, no install) → native
     gem ext fails: **`stdckdint.h` file not found**. That is a **C23** header shipped by
     clang 18 / Xcode 16; this box has **Apple clang 15.0.0** and the header is absent.
  **Conclusion: CocoaPods is not a Ruby problem, it is the Xcode problem.** Do not spend more
  time here — install Xcode 16.2 first, then `gem install cocoapods` against a modern Ruby.
- **fastlane deferred** — only needed at build time, and it is the formula that drags in
  LLVM/Rust. Once a modern Ruby is in, `gem install fastlane` is the cheap route.
- **npm cache was broken** — `~/.npm/_cacache` had root-owned dirs; the first `npm install` and
  `npm install -g eas-cli` both failed `EACCES`. **Both reported exit 0** because the command
  was piped to `tail` (zsh: `$PIPESTATUS` is `$pipestatus`, so the guard printed nothing).
  Kai ran `sudo chown -R 501:20 ~/.npm`; verified 0 root-owned files + clean `install --dry-run`.
- **eas-cli 24.7.0** installed. `eas login` (k.ai_consulting) **not yet done**.
- Noted, not acted on: `npm audit` reports 36 vulns (2 critical, 15 high). Deliberately not
  touching the dep tree before a release build.

## 2026-09-18 — SESSION HANDOFF → continue on Kai's Mac (read this first)

> **AMENDED 2026-09-19 — read the 2026-09-19 entry above first.** Everything below about the
> *state of the code* still holds (main green, 168 tests, what's unbuilt). What does **not**
> hold is that the Mac is ready to build: its Xcode is 15.3 / iOS 17.4 SDK, and Expo SDK 54 +
> Apple's iOS 18 SDK rule both require Xcode 16.1+. Steps 1–2 below are blocked until Xcode
> 16.2 is installed. Also: this Mac is Intel — do not use Homebrew for CocoaPods/fastlane.

**Opening prompt for the Mac session:** `docs/MAC_SESSION_PROMPT.md`.

**Why the move:** EAS free iOS cloud builds are spent until **Thu Oct 1 2026**. Kai has a
Mac, so the next build is **local** (`eas build --local`), which does not use the cloud
quota. The Mac also has the **iOS Simulator**, so UI can finally be checked before
building — every screen below was written on Linux without being seen.

### State at handoff
- **`main` is green:** tsc 0, eslint 0, **Vitest 168**, `deno check` clean. Nothing
  uncommitted. Pushed to `origin/main`.
- **App Store Connect:** app 6765956364, version **1.0** is `Developer Rejected` (we
  cancelled it ourselves), build 33 still attached, `Add for Review` available. Listing,
  screenshots and review notes intact. **Nothing approved has ever shipped.**
- **Builds:** 33, 34, 35 in TestFlight. Remote buildNumber is at 36 (36 was refused before
  building), so **the next build will be 37**. Nothing in 33–35 contains the trip-flow fixes.
- **Backend is LIVE and current** — all migrations applied, all functions deployed, cron
  active. Server-side fixes already in production: extend-by-time (8h-early bug), "I heard
  from <name>, close the trip" wording, privacy policy disclosing trip tracking.

### What is in `main` that no build has yet
Trip-flow fixes (stale trip state across screens, composer dead end → "Go to trip",
duplicate hub, remote close stops tracking, DISMISS no-op), **trip history** + "Your trips"
strip + PAST TRIPS + past-trip screen, back button that never dead-ends (22 screens),
movement-triggered forecast refresh + ZONES NEAR YOU, temperature formatting, push-token
decoupling, daily forecast alerts, live trip tracking, legacy location-wake cleanup.

### Steps on the Mac
```
git clone https://github.com/Kaiguy277/AvyComparisonApp.git   # or: git pull
cd AvyComparisonApp && npm install
npm i -g eas-cli && eas login                    # account: k.ai_consulting
# Local iOS builds need Xcode (+ command line tools), CocoaPods and fastlane.
# EAS reports anything missing; install what it asks for.

npm run typecheck && npm run lint && npm test    # expect 168

# 1. LOOK AT IT FIRST, in the Simulator — costs nothing:
npx expo run:ios
#    Check: home bar pill + "Your trips" strip, trip hub + PAST TRIPS, past-trip
#    screen, "Go to trip" alert, ZONES NEAR YOU strip, temperature formatting.
#    (Background location, push and the daily alert need the real phone.)

# 2. Production build, locally (no cloud quota):
eas build --platform ios --profile production --local
# 3. Submit the .ipa it produces to TestFlight (submissions aren't metered):
eas submit --platform ios --path <the .ipa>
```
`.env` is tracked on purpose, so the clone has the right env. Credentials are on Expo's
servers and download after `eas login`.

### Then, to submit for review — `docs/RELEASE_CHECKLIST.md`
1. Device pass on the real phone (§4). Highest value: the **no-dead-ends trip walkthrough**,
   **movement refresh** (`BG WAKE · … VIA LOCATION`), and **push decoupling** (amber
   ALERTS OFF, not PERMISSION-DENIED).
2. **Screen recording** Apple asked for (§5) — ends with check-in and the blue location
   indicator disappearing. Mandatory: there is no approved version to fall back on.
3. **App Privacy labels** — not yet updated; do it only at submission (they're app-level).
   Precise Location needs no change; add Usage Data → Product Interaction (not linked) for
   `device_tokens.zones`. Kai publishes them himself.
4. Attach the new build, paste the **1.1 block** from `docs/APP_REVIEW_NOTES.md`, attach the
   recording, **Add for Review**.

### Open threads
- **9-minute trip create delay on build 35, with signal — UNDIAGNOSED.** ~5 failed sends then
  success. Needs the `trip-plans` edge logs for 2026-09-18 00:20–00:32 UTC (Supabase
  dashboard only). Watch for a slow create in testing.
- **Build-33 upgrade crash cause is inferred, not confirmed.** `lib/legacyTaskCleanup.ts`
  targets it. On the Mac, the phone's crash logs are readable (Xcode → Devices and
  Simulators → View Device Logs, or Console.app) — worth confirming.
- Twilio parked (no plan, nothing provisioned) — reasoning in `docs/TRIP_PLAN_OPS.md`.
- Harmless: contact actions rate-limit by edge-node IP; local branch `feature/trip-plan` is
  fully merged and safe to delete.
- **On the Linux box:** `.playwright-mcp/twilio-2FA-recovery-code.txt` is gitignored (never
  pushed) but plaintext — move to a password manager and delete.

## 2026-09-18 (evening) — build 36 REFUSED: EAS free iOS quota exhausted
- Merged `fix/trip-flow` → `main` (`23d742e`). Gates on main green (Vitest 168), plist
  correct. **Build 36 refused by EAS before building**: "This account has used its iOS
  builds from the Free plan this month, which will reset in 11 days (on Thu Oct 01 2026)."
- **I had the count wrong.** I told Kai 1 credit remained; there were 0. The "12/15" email
  fired as build 33 was queued and I assumed 33 wasn't yet counted — it was. So 33, 34, 35
  used the last three. Kai chose "build now" on the strength of my number.
- No build ran and nothing was lost. EAS still auto-incremented the remote buildNumber to 36,
  so the next build will be 37 — harmless, Apple only needs it to increase.
- **Options put to Kai:** wait for the Oct 1 reset (free); EAS Starter ($45 included credit,
  then $2/iOS build per the earlier Expo email — monthly price not quoted from memory); or
  `eas build --local`, which for iOS needs macOS + Xcode, so not from this Linux box.
- Lesson: read the quota from the source (billing page / `eas` output), not by arithmetic on
  a courtesy email whose timing relative to the build was ambiguous.

## 2026-09-18 (later) — trip history + always-reachable trips; heard-from wording
- **Kai: not in airplane mode for any test.** So Trip B's ~9-minute create delay is a real,
  **UNDIAGNOSED** bug. The backoff (5s→15s→45s→2m15s→6m45s ≈ 10 min) means ~5 consecutive
  failed sends then success. Ruled out: rate limiting (no buckets), packet size (both trips
  ~31 KB, no photo). **Needs the `trip-plans` edge-function logs for 2026-09-18 00:20–00:32
  UTC**, which only the Supabase dashboard shows — the CLI has no log command and its
  token lives in the OS keyring (not extracted). Next step: Kai logs into supabase.com in
  the Playwright browser.
  - Side finding, not fixed: contact actions are rate-limited by the *edge node's* IP,
    because trip-plan-page proxies them, so the per-IP contact limit is effectively shared
    across all contacts. Harmless at current scale.
- **"I heard from <name>, close the trip"** (`f21a5ae`, deployed). Kai asked for it to say
  explicitly that it closes the trip. Used the person's name rather than "them". Added a
  line pointing a contact whose person is merely late to Extend instead.
- **Trip history + navigation** (`4f9f92c`):
  - Local history (`KEYS.history`, 25, newest departure first), archived inside
    `saveActivePlan` whenever a closed plan is saved — every close path funnels through it.
  - Hub was unreachable from home between trips. The strip now shows **"Your trips"**
    whenever there is history or a saved trip. HEADING OUT still goes straight to the
    composer (fast path unchanged).
  - Hub **PAST TRIPS** → new `app/trip/history/[planId].tsx` (read-only + remove).
  - `PlanCard` extracted to `components/trip/PlanCard.tsx`, all actions optional.
  - **Shared `ZoneScreenHeader` back button** fell back to nothing if a screen was first in
    the stack; now falls back to home. Covers all 22 screens using it.
- **Not visually verified** — the app can't run here, and web rendering is unreliable for
  layout (JOURNAL 2026-09-10/11). The new strip and past-trip screen need eyes on device.
- Gates: tsc 0, eslint 0, **Vitest 168**.

## 2026-09-18 — Trip flow audit after Kai's build-35 test (branch `fix/trip-flow`)
Kai: "once I started a trip… there was no way of going to it" + "once you clicked on the
link, updating the timeline broke some things". Audited the whole Heading Out flow against
code AND production data from his two test trips.
- **Production evidence.** Trip A `8972aab8`: created, opened by contact, then contact
  tapped *heard from* → `contact_heard_from`, which **closes the plan server-side**. The
  phone never learned it. Trip B `071edf1f`: create sat unsent ~9 min, a check-in queued at
  `client_at` 00:22:40 (9 min before the server saw the plan), both flushed together, then
  a **cancel 8s after close** (`late: true`) — the screen still showed it live.
- **Seven bugs, fixed (`5c883c3`):**
  1. `useTripPlan` held a per-screen copy refreshed only on mount/foreground/reconnect. Home
     stays mounted under the trip screens, so after creating a trip it still said HEADING
     OUT — and its 60s poll never started, since it only runs when a plan is already loaded.
     → `store.ts` now notifies subscribers on every `saveActivePlan`; the hook subscribes.
  2. Hook now also syncs with the **server** on screen focus, so a contact closing the trip
     from the web shows up on return.
  3. Composer checked LOCAL storage only → now asks the server first (bounded 6s, falls back
     offline), and the "already have a live trip" alert offers **Go to trip**, not just OK.
  4. `router.replace("/trip")` after sending → `router.dismissTo("/trip")`. From the hub it
     left two hubs stacked, so Back landed on the same screen. (`dismissTo` confirmed present
     in expo-router 6.0.24.)
  5. A trip closed remotely (contact action, expiry, 404) now stops tracking. Only the owner's
     own check-in/cancel used to.
  6. DISMISS on a closed trip always works; it silently no-op'd if anything was queued. Live
     trips still refuse (would orphan a queued check-in).
  7. (Acting on closed trips was a symptom of 1–3.)
  Tests: store change notification (6), `dropPendingFor` (2).
- **Contact page "pick a time" extend was 8 hours early** (`e08384d`) — that is the
  "timeline" bug. `<input type="datetime-local">` submits a zone-less wall time; the server
  did `new Date(...)`, and edge runtime local time is **UTC**, while the page labels the field
  with the plan's zone. 9 PM Alaska → 9 PM UTC → refused as `extend_backwards`. Every
  extension-by-time failed; neither test trip has an `extended` event.
  **Reproduced in production before fixing**, then fixed and re-verified. New
  `_shared/zoned-time.ts` (the repo only had formatters INTO a zone), 10 tests incl. both DST
  transitions. Picker now prefilled + `min`-bounded at the current worry-by; empty submit and
  server errors now give sentences, not codes. **Deployed** (`--no-verify-jwt`).
  - Smoke convention used: contact **`delivered@resend.dev`** (Resend's test sink — no real
    mail, no reputation hit), plan deleted by id afterwards, cascade verified (0/0/0 rows).
    Prefer this over using Kai as the smoke contact.
  - A "MISMATCH" in the smoke was my test comparing to the second; `datetime-local` has
    minute precision, and the stored value was exactly 00:26 AKDT.
- **App-side fixes need a build; the page fix is already live.** 1 iOS credit left.
- Gates: tsc 0, eslint 0, **Vitest 161**, deno check clean.

## 2026-09-17 (night, later) — movement-triggered refresh restored; Twilio parked
- **Movement-triggered forecast refresh is back** (`ca4f644`), and this is the change Kai
  actually wanted: trip tracking only helps someone who *filed a trip plan*, i.e. the
  conscientious user. The safety case is the forgetful one who drives out without checking.
  Sig-change monitoring is the only mechanism iOS restores after a force-quit.
  **Why it is not what 2.5.4 rejected:** the app now has a real persistent-location feature
  (tracking), AND we now **read** the coordinate instead of discarding it —
  `nearestCenters()` resolves which centers you are near, and the home screen shows a
  "ZONES NEAR YOU" strip offering to follow them. Build 32 threw the coordinate away, which
  is exactly what Apple objected to. Apple's own Next Steps even suggested this mechanism.
  Purpose strings now state **both** uses.
  - `lib/locationRefresh.ts`: Lowest accuracy, 5 km filter, no blue bar, 20-min refresh
    throttle **shared** with the tracking task. **Only one location session at a time** —
    starting a tracked trip stops the monitor and the higher-accuracy task takes over both
    jobs; ending the trip hands back. Two concurrent sessions is untested in expo-location.
  - `nearestCenters`/`nearestZones` return the top 3, closest first, because centers
    cluster (Anchorage → CNFAIC, HPAC, VAC). **Granularity limit:** we only hold per-CENTER
    centroids; per-zone polygons come from NAC GeoJSON at runtime, which a headless task
    cannot depend on. Fine in practice — CNFAIC *is* Turnagain/Summit/Seward/Girdwood.
  - Also: daily alert now sets `_contentAvailable` so a BACKGROUNDED app pulls the full
    forecast rather than only showing the rating. **A force-quit app cannot be made to run
    code from any push** — that is iOS policy, not a design choice; the banner still carries
    the rating, and the tap path already worked (`app/index.tsx:298-307` refreshes on mount
    and on every `active` transition). Vitest 143.
- **Twilio: account created, then PARKED.** See `docs/TRIP_PLAN_OPS.md` "Known gaps" for the
  full reasoning. Headlines: 10DLC is carrier-mandated so no provider avoids it; carrier
  email-to-SMS gateways rejected because they **fail silently** (fatal for an overdue
  alert); **an automated voice call may be both more effective and exempt from 10DLC**,
  worth researching before building SMS. No plan selected, nothing provisioned, no cost.
- **Security note:** Twilio auto-downloaded `twilio_2FA_recovery_code.txt` into
  `.playwright-mcp/` in the repo. **Already gitignored** (`.gitignore:48`) and git does not
  see it, but it is plaintext on disk — move to a password manager and delete.

## 2026-09-17 (night) — **1.0 SUBMISSION CANCELLED**; everything ships as one release
- **Kai's call:** don't wait for 1.0 approval if 1.1 follows immediately — one review cycle
  instead of two. I argued for banking the approval first (if the combined build is rejected,
  nothing is live); **he reaffirmed, so we cancelled.** Recorded because it raises the stakes:
  with background location in the only submission, **the screen recording and device testing
  are now mandatory-path, not optional.**
- **Submission cancelled in ASC.** Version 1.0 is now **`Developer Rejected`** (ASC's term for
  a developer-cancelled submission) with **`Add for Review`** available again. Build 33 still
  attached; all listing metadata, screenshots and review notes intact.
- **`feat/1.1-push-and-tracking` merged to `main`** (`0d6505c`), branch deleted.
  **Version stays `1.0.0`** — nothing was ever released, so these features ship *in* the first
  App Store release rather than as a 1.1 update. "1.1" remains internal shorthand only.
- Gates on merged main: tsc 0, eslint 0, **Vitest 134**, and `deno check` clean on all four
  edge functions (trip-plans, trip-plan-page, send-forecast-alerts, legal).
- **Privacy policy now discloses trip tracking** and was deployed
  (`legal --no-verify-jwt --use-api`). Verified live: the tracking bullet, the "stops when you
  check in or cancel" wording and the new data-table row are present, and the interim
  "does not track you in the background" line is gone. The policy has now been correct for
  each binary in turn — build 33 (no tracking), then this one (tracking).
- **Next, in order:** build 34 → Kai device-tests (`docs/RELEASE_CHECKLIST.md` §4) and
  records the screen capture (§5) → App Privacy labels updated + published → attach 34, paste
  the 1.1 review notes, attach the recording → **Add for Review**.
- **Build budget: 3 iOS builds left.** Each failed device test costs one.

## 2026-09-17 (evening, later) — privacy docs corrected; 1.1 release checklist
- **LIVE PRIVACY POLICY WAS CONTRADICTING OUR OWN REVIEW NOTES.** It still described
  background location as a refresh trigger ("In the background (\"Always\") — only as a
  trigger… the app does not read, store, transmit, or share the coordinates"), which build
  33 removed, while the App Review notes told Apple the app "never requests Always
  authorization". A reviewer cross-checking the Privacy Policy URL against the notes —
  while we are in review *for a location issue* — would have found the two disagreeing.
  Rewrote the Location section and the FAQ to match build 33 ("The app does not track you
  in the background") and **deployed `legal --no-verify-jwt --use-api`**. Verified live:
  `/privacy` + `/support` 200 text/html, and the old Always claim is gone.
  - `legal` takes `--no-verify-jwt` for the same reason `trip-plan-page` does: the Deno
    proxy (`deploy/main.ts`) forwards with **no auth headers at all**. Dropping the flag
    would 401 both legal pages.
- **`docs/RELEASE_CHECKLIST.md` written** — preconditions, the privacy-policy copy to
  deploy *with* 1.1 (not before), the App Privacy label analysis, device verification
  steps, the screen-recording shot list Apple asked for, and the build budget.
- **App Privacy label analysis for 1.1:** *Precise Location* needs **no change** — it is
  already declared collected + linked to identity for App Functionality, and a trip plan
  is already tied to the named subject. The genuinely new item is **`device_tokens.zones`**
  (which zones a device follows, stored against an anonymous token), not covered by any
  current answer; recommend **Usage Data → Product Interaction, App Functionality, NOT
  linked**. Kai published the labels personally last time and should again.
- **`docs/APP_REVIEW_NOTES.md`: added the 1.1 LOCATION block** to paste instead of the 1.0
  one, framing tracking as the feature the background mode exists for, with the per-trip
  scoping and teardown spelled out, and referencing the attached screen recording.
- **Sequencing rule recorded:** App Privacy answers are app-level, not version-level, so
  they must NOT be edited until 1.1 is actually being submitted — editing now would
  misdescribe the 1.0 build in review.

## 2026-09-17 (evening) — 1.0 resubmitted; 1.1 backend deployed to production
- **Whumpf 1.0 build 33 RESUBMITTED — `Waiting for Review`.** Swapped 32 → 33 on the
  version, saved, then **Update Review** (note: "Resubmit to App Review" on the
  submission-details page stays *disabled*; attaching a new build moves the version to
  "Prepare for Submission" and the live control is **Update Review** on the version page).
- **The first `--auto-submit` hung.** Build finished 12:07 but never uploaded; the process
  had **no open network socket** and flat I/O counters 40 min later. Killed it and re-ran
  `eas submit --id <build>`, which scheduled immediately. **Re-submitting reuses the
  existing IPA and costs no build credit.** Lesson: don't pipe a long background command
  through `tail` — it buffers until exit and hides exactly this.
- **EAS build budget: 12/15 iOS builds used this period (3 left).** The "limit reached"
  email is actually an 80% warning; it did not block anything.
- **BUILD 33 CRASHES ON UPGRADE from ≤32, but is fine on a fresh install.** Build 32
  registered a background-location task (`avy.location-wake`); expo-task-manager persists
  that in the app container and restores it natively at launch. Build 33 removed both the
  handler and `location` from `UIBackgroundModes`, and iOS throws when
  `allowsBackgroundLocationUpdates` is set without that mode → crash before JS runs.
  **Not a risk to the 1.0 release** (first App Store version, so every real user and the
  reviewer are fresh installs); it only bites TestFlight upgraders. Kai chose to leave the
  submission in review. `lib/legacyTaskCleanup.ts` (c6a4df1) fixes it for 1.1, which can
  do what 33 could not because tracking restores the `location` background mode.
  **Cause still INFERRED from Apple's documented behaviour — no `.ips` obtained yet.**
- **Temp rounding fixed** (`9e6166f`): a tile showed `52.34°` beside `36.9°`/`39°`.
  `lib/units.ts formatTempF` — 1dp, trailing `.0` dropped. Deliberately NOT whole degrees:
  near 32°F, 31.6 vs 32.4 is rain vs snow. Vitest 134.
- **Four migrations APPLIED TO PRODUCTION** (`208ada0`). Renamed `20260917240000` →
  `20260917235500` (**hour 24 is not a valid timestamp**; the CLI printed it unparsed).
  - **Histories had diverged**: the Aug/Sep work was applied out-of-band under different
    ids, so `db push` would have run 8 migrations including re-scheduling live crons.
    Verified every local-only old migration was already live in substance, then
    `migration repair --status applied` on those four.
  - `db push` still refused (six remote-only ids absent locally) and suggested marking
    them **reverted** — which would erase the only record those changes happened.
    **Declined.** Applied the four new files with `supabase db query --linked -f` and
    recorded them with `migration repair`, leaving the six remote entries intact.
  - Verified against the live schema: `device_tokens` has `alerts_enabled`/`zones`/
    `last_alert_date`; `trip_plan_locations` and `trip_plans.tracking_enabled` exist;
    `set_device_zones` + `trim_trip_plan_locations` exist; **`register_device_token` is
    now an overloaded pair, so build 33 clients still resolve the 2-arg form.**
  - Cron `avy-forecast-alerts-early` (16:00 UTC) + `-late` (17:00 UTC) both **active**.
- **Three edge functions deployed:** `send-forecast-alerts` (new), `trip-plans`,
  `trip-plan-page` (**`--no-verify-jwt`**, per `docs/TRIP_PLAN_OPS.md`).
  **Smoke-verified by behaviour, not deploy output:** trip-plan-page without auth → 404
  (not 401, so the flag held); proxy `/p` bad token → 404 html; `/privacy` + `/support` →
  200 html; send-forecast-alerts without the cron key → 401; `trip-plans` unknown action →
  400; the new `location` action with a bogus plan → 404 `plan_not_found`; and a real
  cron-key invocation of send-forecast-alerts → **`{"success":true,"sent":0}`** (correct —
  no device has `zones` yet).
- **Prod/repo divergence noted, left alone:** production runs
  `avy-refresh-stations-cache` at `45 * * * *`, migration `20260502010000` says `15`.
- **Still blocking the 1.1 app build:** App Privacy answers + privacy policy still say
  location isn't collected; device verification of the push-token decoupling and the
  tracking permission flow; the physical-device screen recording Apple asked for.

## 2026-09-17 (afternoon) — 1.1 built on `feat/1.1-push-and-tracking`
Branch deliberately NOT merged to `main` until 1.0 is approved, so a further
1.0 fix can be built from a clean `main` matching what's in review.

- **Push token decoupled from alert permission** (`68112fd`). `lib/pushNotifications
  .ts:125` returned before minting a token when permission was denied, so declining
  notifications also killed silent-push refresh. iOS never required this —
  `getDevicePushTokenAsync` just calls `registerForRemoteNotifications()` with no
  permission check (`PushTokenModule.swift`). Client now always registers and reports
  `alerts_enabled`. New diagnostic step `ok-alerts-off`; `permission-denied` kept in the
  union as legacy (persisted in AsyncStorage). Migration `20260917210000`: column +
  3-arg RPC overload; **the 2-arg RPC is kept** because 1.0 installs still call it.
  **Unverified on device:** that `getExpoPushTokenAsync` resolves with permission denied.
- **Daily forecast alert** (`4d68f98`). Visible pushes ARE delivered to force-quit apps;
  silent ones are not — so this covers the exact gap the location wake did, with no
  location permission. Migration `20260917220000`: `device_tokens.zones` +
  `last_alert_date` + `set_device_zones` RPC. `lib/deviceZoneSync.ts` is its own module
  to dodge an import cycle (offlineCache ← backgroundRefresh ← pushNotifications).
  New fn `send-forecast-alerts`; cron `20260917230000` at 16:00 and 17:00 UTC (second
  pass is a safe retry thanks to the per-device dedupe).
  **`setNotificationHandler` was returning false for everything** — it would have
  swallowed this alert whenever the app was open. Now shows anything with a title/body.
  Safety rules under test: a zone without TODAY's forecast is skipped rather than
  alerted with yesterday's rating; an unreadable/NO_RATING band never lowers the
  reported danger (alert carries the max across bands). +15 tests, 128 total.
- **Live trip tracking** (`03a4fb4`, `ac8e6ec`). Migration `20260917235500`:
  `trip_plans.tracking_enabled` + `trip_plan_locations` (ON DELETE CASCADE so the trail
  dies with the plan via the existing sweeper), RLS-locked like `device_tokens`,
  `trim_trip_plan_locations` caps the trail at 1000 points (~a week at the ~10 min
  cadence). New `location` action on `trip-plans`, plan_secret authed, refuses when
  tracking is off or the plan is closed. `lib/tripPlan/tracking.ts` buffers points in
  AsyncStorage and flushes opportunistically — no signal is the NORMAL case here.
  Opt-in toggle in `app/trip/new.tsx`, off by default, asked per trip. Packet page gains
  "Last known position" with decimal degrees, Maps links, a >3h staleness warning and a
  collapsible route table.
- **`app.json`: Always location restored**, with copy describing the real feature, and
  `plugins/withTrimmedPermissions.js` no longer strips the location keys or the
  background mode (doing so would now silently break tracking); it still strips
  expo-image-picker's unused mic string. Verified against the generated plist:
  `UIBackgroundModes: ['fetch','location','remote-notification']`.
- **Gate gap found:** `npm run typecheck` does NOT cover `supabase/` (tsconfig excludes
  it), so none of the edge-function work is checked by it. Used
  `PATH=$HOME/.deno/bin:$PATH deno check supabase/functions/*/index.ts` instead — all
  clean. **Consider adding a deno check to the gate list.**
- **CLAUDE.md correction:** the live cache tables are `forecast_cache`, `stations_cache`,
  `observations_cache` — NOT `avalanche_forecast_cache` / `avalanche_daily_forecasts` as
  the "Hard-earned rules" section claims. Confirmed via `supabase gen types typescript
  --linked`, which reads the live schema through the management API and needs no DB
  password — a good way to check production shape.
- **NOT DONE / blocking 1.1 ship:** migrations and both new functions are committed but
  **not applied or deployed**; App Privacy answers + privacy policy still say location
  isn't collected (tracking makes that false, and `device_tokens.zones` is new collected
  data too); the physical-device screen recording Apple asked for; device verification of
  the push-token decoupling.

## 2026-09-17 — **REJECTED (2.5.4)** → background location removed entirely
- **Apple rejected 1.0 (32)** on 2026-09-17 (message 2026-09-16 11:48 PM), reviewed on an
  iPad Air 11-inch (M3) in compat mode. Submission `586a9a86-a854-468e-a9d9-351c14e508b1`.
  **Guideline 2.5.4:** "The app declares support for location in the UIBackgroundModes key
  … but we are unable to locate any features that require persistent location."
  **One issue only — no UGC/1.2 finding.** Their prescribed fix: remove `location` from
  `UIBackgroundModes`.
- **The rejection was correct.** `lib/locationWake.ts` registered a significant-location-
  change monitor purely to get iOS to relaunch the app after force-quit and never read the
  coordinates — its own header comment said so, and the submitted review note explained the
  trick in plain language. The prior internal note in `docs/APP_REVIEW_NOTES.md` claiming
  this was "an appeal, not a code change" **was wrong**; the fallback it listed was right.
- **Removed:** `lib/locationWake.ts`, `components/onboarding/LocationPrompt.tsx` (deleted);
  `registerLocationWakeIfPermitted()` from `app/_layout.tsx`; the first-favorite Always
  explainer, the `LocationWakeBanner` ("LOCATION OFF · LIMITED REFRESH") and all their
  state/callbacks from `app/index.tsx`; `isIosBackgroundLocationEnabled` → false and both
  `locationAlways*` strings from `app.json`.
- **Kept:** foreground location in `components/observation/LocationField.tsx` ("Use current
  location" fills an observation's coordinates + elevation) — a real user-initiated
  feature, so When In Use is justified. Its usage string now describes that feature
  instead of background refresh.
- **New `plugins/withTrimmedPermissions.js`.** expo-location writes all three NSLocation
  usage strings unconditionally (generic default when unset, no opt-out — see
  `node_modules/expo-location/plugin/build/withLocation.js`), so the plist still advertised
  Always after the config change. The plugin deletes `NSLocationAlwaysUsageDescription`,
  `NSLocationAlwaysAndWhenInUseUsageDescription` and — same defect class — expo-image-
  picker's `NSMicrophoneUsageDescription` (both pickers are `mediaTypes: ["images"]`, the
  mic is never used).
  **Ordering gotcha:** Expo composes `withInfoPlist` mods **last-registered-first**, so the
  plugin must be listed **FIRST** in `app.json` `plugins` to run **last**. Listed after
  expo-location it ran before it and saw nothing to delete.
- **Verified against the generated plist, not the config:** `npx expo config --type
  introspect` now shows `UIBackgroundModes: ['fetch', 'remote-notification']` and exactly
  one NSLocation key (`NSLocationWhenInUseUsageDescription`). Both remaining background
  modes are genuinely used (expo-background-fetch, silent push).
- **Cost accepted:** background refresh no longer survives force-quit. Background App
  Refresh + silent push still cover the backgrounded-but-alive case. Apple's hint to use
  the significant-change service instead is a dead end — it still needs Always auth with
  no feature behind it, i.e. a 5.1.1 rejection next time.
- `docs/APP_REVIEW_NOTES.md` rewritten: new LOCATION paragraph for the Notes field, and the
  old "it's an appeal" reasoning replaced with the history and a do-not-reintroduce rule.
- Gates green on branch `fix/remove-background-location`: tsc 0, eslint 0, Vitest 113.
- **Resubmit in flight:** EAS build **33** started 2026-09-17 12:01 PM AKDT
  (`1f35795b-95c5-4feb-a75a-bc469b6d4824`, production, `--auto-submit`). Build number
  auto-incremented by EAS (`appVersionSource: remote`), no manual bump.
- **ASC App Review Notes replaced and saved** (verified by reload): the old
  `BACKGROUND LOCATION ("ALWAYS")` block is gone, replaced by the LOCATION paragraph from
  `docs/APP_REVIEW_NOTES.md`. Remaining: attach build 33 to the version once it processes,
  then **Resubmit to App Review**.
- **1.1 plan agreed with Kai** (build after 1.0 is approved, in this order):
  1. **Decouple push-token registration from alert permission.** `lib/pushNotifications.ts`
     :125 returns before `getExpoPushTokenAsync` when `!granted`, so users who decline
     notifications get no token and therefore no silent-push refresh — an app limitation,
     not an iOS one (iOS delivers `content-available` without notification authorization).
     Gate only the *visible* notification on `granted`. **Verify on device** that
     `getExpoPushTokenAsync` succeeds with permission denied — untested.
  2. **Daily morning notification for favorited zones** (e.g. "Turnagain Pass —
     CONSIDERABLE today"), fired off the forecast cron. Visible pushes ARE delivered to
     force-quit apps (silent ones are not), so this covers the exact gap the location wake
     used to, and a tap refreshes the cache. Infra already exists in
     `supabase/functions/send-snapshot-pushes`.
  3. **Live trip tracking** (Option B) — share location with SAR/trip-plan contacts while a
     trip is active. This is a genuine persistent-location feature, so it re-legitimises
     `UIBackgroundModes: location`, and cache refresh can ride its wakes.
     **Scope decision: location follows the trip, not always-on.** Running a monitor 24/7
     outside an active trip is the same empty-permission argument that lost 2.5.4.
     **Consequence to plan for:** this inverts the App Privacy answers (precise location
     becomes collected/transmitted/linked, currently declared "not stored or shared"),
     needs a location table with retention + purge, privacy-policy copy, and the
     **screen recording on a physical device** Apple asked for.

## 2026-09-14 (afternoon) — **SUBMITTED FOR APP REVIEW** (Whumpf 1.0, build #32)
- Build #32 (iPhone-only, `e97a80a`) processed; swapped #31 → #32 on the version, saved,
  Add for Review → Draft Submission showed "iOS App 1.0 · 1.0.0 (32) · Ready to Submit"
  → **Submit for Review** at ~1:05 PM AKDT. ASC: "1 Item Submitted… up to 48 hours".
- Release is **automatic after approval**, so approval = live in US + Canada.
- While in review, metadata is partly editable; a new build requires removing the version
  from review first.
- **If rejected:** most likely angles are Guideline 5.1.1 (Always location — reply with
  the internal reasoning in `docs/APP_REVIEW_NOTES.md`, it's an appeal not a code change)
  or 1.2 (UGC — add a "report this observation" link to the center's page).

## 2026-09-14 — Review info saved; iPad blocker → iPhone-only build #32
- **Version page saved** with build #31, contact Kai Myers / +1 916 955 8064 /
  kai.myers.a@gmail.com, notes, sign-in unchecked, auto-release.
- **"Add for Review" refused:** "You must upload a screenshot for 13-inch iPad displays."
  Cause: `app.json` `ios.supportsTablet: true` (Expo template default), never tested on
  iPad. **Kai chose iPhone-only** → `supportsTablet: false` (e97a80a). iPad users still
  install it in iPhone compatibility mode; adding iPad later is fine, removing it after
  release is what Apple blocks — so this was the moment to decide.
- **TestFlight build #32** (EAS build 8e96ab5d, auto-submit) started from `e97a80a`.
  Once processed: swap #31 → #32 on the version, then Add for Review.

## 2026-09-13 (evening) — ASC submission, continued
- **Browser handover:** the ASC Playwright Chrome was still owned by the previous Claude
  session's MCP server (pipe-controlled, profile `mcp-chrome-bc2da72`), so this session
  couldn't attach. Killed only that MCP process (PID 168205); the restart dropped Apple's
  session cookie and Kai re-logged in.
- **Age rating saved: 4+** (172 regions; Brazil ALL, Korea 00+). New questionnaire has a
  Capabilities step: **User-Generated Content = Yes** (Kai's call — the Observations tab
  shows public NAC obs), everything else No/None. Needs a review note explaining the obs
  come from the NAC public API and are moderated by the centers.
- **Price = Free** ($0.00 confirmed in Current Price). **Availability = US + Canada** (Kai).
- **Unchecked Apple silicon Mac + Vision Pro availability** — iPhone-first, untested on
  either; re-enable any time.
- **Screenshots uploaded to the 6.9" slot, but they need redoing.** Found on inspection:
  store-03 shows `undefined MPH` and "Not enough hourly data" everywhere because
  `lib/forecast/demoData.ts` `station()` builds `wind: {speed, direction, gust}` and casts
  `as unknown as WeatherObservation` — the real shape is `speedCurrent`/`speedMax24hr`/
  hourly series. Demo-only; real data is typed `number | null`. (Same cause: home shows
  wind "—".) store-02 has a huge empty Problems box; store-04/05 are mostly blank. Also
  uploaded in parallel so ASC order is scrambled.
- **Screenshots redone and re-uploaded in order** (6.9" slot; 6.5" inherits):
  home, zone, stations, **problems** (new, replaces the blank obs form), **trip form
  filled in**. `demoData.ts` `station()` now typed against the real shape with
  deterministic hourly series (no cast). Capture moved to `docs/store-screenshots/
  capture.mjs`: headless Chrome with a real `deviceScaleFactor: 3` at 430×932 — the old
  CSS-transform trick is what made the zone tiles desktop-width (RN Web read the 1290px
  window). Clock pinned to Jan 16 via `clock.install` + `resume()` (a `setFixedTime`
  frozen clock stalled the home fade-in → empty home).
- **Gate regression fixed:** `tsc` was failing on `deploy/main.ts` (Deno globals) since
  137e507 — the handoff's "gates green" predates it. Excluded `deploy/` in `tsconfig.json`
  and `eslint.config.js`, same as `supabase/`. Gates now: tsc 0, eslint 0, Vitest 113.
- **TestFlight build #31** (`fd1d2b3`, EAS build 60d2c7c5, submission fb19caad) — picks up
  bf55cad (26 center contact addresses) that #30 lacked. Kai chose to submit #31. #31 processed
  (Ready to Submit) and is now the attached build (unsaved until the phone number is in).
- **App Review Information filled (not yet saved):** Sign-in required unchecked; contact
  Kai Myers / kai.myers.a@gmail.com; notes = the exact text now at the top of
  `docs/APP_REVIEW_NOTES.md` (location note corrected — the prompt appears on first
  favorite, not an onboarding screen — plus obs-staging and UGC notes). ASC won't save
  without a **phone number — waiting on Kai**. Release = automatic after approval (Kai).

## 2026-09-13 — SESSION HANDOFF / current state (read this first next session)
**App is renamed `Whumpf`, backend is fully live, App Store submission is ~70% set up.**

### Live infrastructure (all working, verified)
- **Supabase** project `tfvxhsgwrwvendrnbrgf` (vanity host `avycomparison.supabase.co`).
  Edge fns deployed: trip-plans, trip-plan-page (`--no-verify-jwt`), trip-plan-sweeper,
  legal, plus the forecast/obs stack. Cron sweep + purge active.
- **SAR packet + legal pages** are served through a **Deno Deploy proxy** because
  Supabase serves function HTML as text/plain. Origin: `https://whumpf-pages.kaimyersa.deno.net`
  (`/p?t=…`, `/privacy`, `/support`). Deno org `kaimyersa` (Google login on the account).
  `TRIP_PLAN_PAGE_BASE` points at `…/p`. **To redeploy the proxy:** see `deploy/README.md`
  — must run `deno run -A --node-modules-dir=auto jsr:@deno/deploy … main.ts` (the `deno
  deploy` wrapper double-forwards flags); token = org token from console.deno.com ›
  Settings › Organization Tokens.
- **Email:** Resend, sender `Whumpf <trips@avycomparison.kaiconsulting.ai>` (verified).
- **Push** fixed (RPC `register_device_token`). Observation submit is on NAC **staging** —
  the app explains this and offers to email the report to the center instead
  (26/28 center addresses in `lib/observation/emailFallback.ts`).

### App Store Connect — app 6765956364, version 1.0 "Prepare for Submission"
DONE: name Whumpf, subtitle, description, keywords, promo text, copyright, Support +
Marketing URLs, content rights, category (Weather/Sports), Privacy Policy URL, and the
**App Privacy questionnaire (published)**.
**STILL TO DO (all in ASC, needs Kai logged in; I can drive each):**
1. Age rating questionnaire (all lowest → expect 4+).
2. Attach **build #30** (already on TestFlight) to the version.
3. Upload the 5 screenshots in `docs/store-screenshots/` (store-01…05, 1290×2796).
4. Price = Free; Availability = **US only for 1.0** (Kai to confirm scope — my rec).
5. App Review Information: paste the two notes from `docs/APP_REVIEW_NOTES.md`
   (Always-location; observation submits to NAC staging + email fallback), and UNCHECK
   "Sign-in required" if set.
6. Then "Add for Review" / Submit.

### Other open threads
- NWAC production-access email is **drafted in Kai's Gmail, unsent** (to developer@nwac.us).
- Post-launch: center weather-station outreach (`docs/CENTER_OUTREACH.md`).
- Latest TestFlight build is **#30**. Gates green: tsc, eslint 0, Vitest 113.
- **Rotate creds** that passed through the transcript: GitHub, Google, Porkbun passwords;
  optionally the Resend key and the Deno org token.

## 2026-09-13 (later) — App Store Connect metadata + App Privacy published
- **Version 1.0 metadata saved:** subtitle `Avalanche + weather, obs, plan`; full
  description; keywords (`avalanche,forecast,backcountry,ski,snowmachine,snowpack,SNOTEL,
  weather,touring,splitboard`); promotional text; copyright `2026 Kai Myers`; Support URL
  `https://whumpf-pages.kaimyersa.deno.net/support`; Marketing URL = the privacy page.
- **Privacy Policy URL** set to `https://whumpf-pages.kaimyersa.deno.net/privacy`.
- **App Privacy questionnaire completed and PUBLISHED** (Kai reviewed, then had me click
  Publish). 10 data types, all purpose = App Functionality, none used for tracking:
  Name, Email, Phone, Physical Address, Health, Precise Location, Contacts,
  Photos/Videos, Other User Content — all **linked to identity**; **Device ID (push
  token) NOT linked** (stored anonymously). Reasoning: observations are attributed to the
  named observer and trip packets are tied to the person; the push token has no
  name/account. No analytics/ads/tracking SDKs in the app, so no other types apply.
- **Automation note:** ASC's per-type privacy flow is a 5–6 step modal each; drove all 10
  via a single page-context driver (App Functionality → linked yes/no → skip 2 info
  screens → No tracking → Save). The "Set Up <type>" targets are clickable `<p>`s, not
  buttons.
- **Still blocking submission (all inside ASC):** age rating questionnaire; attach build
  #30; upload the 5 screenshots from `docs/store-screenshots/`; set price (Free) +
  availability (US); App Review notes already drafted in `docs/APP_REVIEW_NOTES.md`
  (Always-location + the observation email-fallback note) — paste into the version's
  App Review Information.

## 2026-09-13 — BLOCKER cleared: Deno Deploy proxy serves the HTML
- **Chosen fix:** a thin proxy on **Deno Deploy** (free), not a port. All logic/auth/DB
  stay in the Supabase functions; `deploy/main.ts` forwards `/p`, `/privacy`, `/support`
  and re-serves as real `text/html`. It also forwards the packet's contact-action POSTs
  and rewrites their 303 back to its own origin so the pretty URL stays.
- **Live:** `https://whumpf-pages.kaimyersa.deno.net` (org `kaimyersa`, Google login on
  the account — GitHub was walled by 2FA that never delivered; Google's SMS code did).
  `TRIP_PLAN_PAGE_BASE` repointed at `…/p`. **Verified in a browser** (not just curl this
  time): packet renders, `/privacy` + `/support` render, the note and extend forms post
  and land, redirects stay on-origin, bad token 404s.
- **Two CLI gotchas, both documented in `deploy/README.md`:** (1) the `deno deploy`
  wrapper in deno 2.9.6 **double-forwards every flag** ("Option --x can only occur once"),
  so deploys run the jsr tool directly: `deno run -A --node-modules-dir=auto
  jsr:@deno/deploy …`. (2) The new console.deno.com uses `ddo_` **org tokens** (Settings ›
  Organization Tokens), which the classic `deployctl` rejects — must use the new tool.
- **Old Supabase share links still resolve** (as source), so nothing already sent breaks
  further; everything new uses the Deno origin.
- **Still to do (needs ASC login):** set the App Store privacy + support URLs to
  `https://whumpf-pages.kaimyersa.deno.net/privacy` and `/support`.

## 2026-09-11 (late night) — **BLOCKER: Supabase won't serve HTML. The packet page doesn't render.**
- Found while trying to screenshot a sample packet: the page loads as **raw HTML source**
  in a browser. `curl -D -` shows why — the response comes back
  `content-type: text/plain` with `content-security-policy: default-src 'none'; sandbox`,
  even though the function sets `text/html`.
- **Cause (confirmed):** Supabase deliberately rewrites `text/html` → `text/plain` for GET
  responses on `*.supabase.co` function domains, as anti-phishing. Serving HTML requires
  **Pro plan + the Custom Domain add-on**, or hosting the page somewhere else. Refs:
  supabase/discussions #31238, #35627, #37443.
- **Impact is worse than the screenshot.** Two things are broken in production right now:
  1. **Every SAR packet link.** A contact who opens one sees markup, not a page. This is
     the whole deliverable of the "let your people know" feature.
  2. **The App Store privacy + support URLs**, which are submission blockers. A reviewer
     opening them sees source. That's a likely rejection.
- **My verification was wrong, and that's the lesson.** I "verified end to end" by curling
  the body and grepping for `<title>` and section headings — which passes happily on a
  text/plain response. I never opened the URL in a browser or checked a response header.
  Checking the *bytes* is not checking the *behaviour*.
- Options (need Kai's call, all involve either money or a new account):
  a. **Supabase Pro $25/mo + Custom Domain add-on $10/mo.** One CLI command + DNS; also
     delivers the branded link Kai wanted. Most expensive, least moving parts.
  b. **Deno Deploy (free).** The page function is already Deno; redeploy it there, talk to
     Postgres with the service role. `*.deno.dev` renders HTML. Needs a Deno Deploy login.
  c. **Cloudflare Worker (free) on `whumpf.app`** (unregistered, ~$15/yr). Worker proxies
     to the Supabase function and re-serves as `text/html`. Needs the domain + a CF account.
  d. **GitHub Pages** for the *static* legal pages only — free, uses the existing
     `Kaiguy277` account, and `gh` is already authenticated here. Does not solve the
     packet page, which is dynamic.
- Test plan created for the screenshot has been deleted.

## 2026-09-11 (late night) — Avalanche center contact addresses researched
- Subagent cross-checked all 28 centers against both the center's own site and the
  official `api.avalanche.org/v2/public/avalanche-center/<id>` record. **26 verified
  addresses** now in `lib/observation/emailFallback.ts`, replacing the single HPAC entry,
  so the observation email fallback prefills a recipient for nearly every center.
- **Two traps it caught, both of which a naive lookup would have shipped:** the NAC
  record lists `chris@avalanche.org` for SOAIX *and* EWYAIX — that's avalanche.org staff,
  not either center; and SOAIX's listed site `oregonsnow.org` is the Oregon State
  Snowmobile Association, not an avalanche center at all.
- **Two deliberately absent.** BTAC publishes only a form + phone (its NAC record exposes
  the director's personal Gmail — not ours to hand out); SOAIX has no center address.
  Both fall through to "compose with no recipient".
- **Caveat recorded in code and in `docs/CENTER_OUTREACH.md`:** these are contact/
  forecaster inboxes, *not* observation intake endpoints — essentially every center takes
  obs through a web form. The email route puts the report in front of a human who can
  route it, which is why the body leads with "public observation". Added an outreach
  question: would you rather receive these by email, or should users use your form (and
  what's its URL)?
- Also flagged: MSAC/TAC/BAC addresses are person-specific and will rot; five centers'
  own sites disagree with their NAC record (own site won).

## 2026-09-11 (late night) — Store screenshots from sample data
- **Problem:** it's September. Every real zone reads EXPIRED with May dates, which shows
  the app at its least useful and tells a store browser nothing.
- **`lib/forecast/demoData.ts`, gated on `EXPO_PUBLIC_DEMO=1`** (absent from `.env` and
  `eas.json`, so a production build cannot enable it). Four hand-written mid-winter
  Alaska zones — plausible values, not a copy of any real forecast — wired in at two
  seams: `loadForecastBundle` (home) and `useZoneBundle` (zone detail, which reads the
  snapshot and would otherwise still show stale real data). Demo mode also hides the
  dev diagnostic lines.
- **Capture method worth keeping** (App Store wants 1290×2796 and the browser runs at
  DPR 1): set the viewport to 1290×2796, override `window.innerWidth/innerHeight` to
  430×932 so RN Web lays out phone-sized, then `transform: scale(3)` on `#root` with
  `transform-origin: 0 0`. Text renders as true 3× vectors rather than an upscaled
  blur. Inject CSS to hide scrollbars. **Gotcha:** don't leave `documentElement.zoom`
  set from an earlier attempt — it compounds with the transform (9× the first time).
- Five shots in `docs/store-screenshots/`, all verified 1290×2796.

## 2026-09-11 (late night) — Subtitle, and an honest answer to the staging problem
- **Subtitle** (30-char cap, measured not guessed): `Avalanche forecasts, obs, plan` —
  exactly 30. Keeps "Avalanche" because the name Whumpf tells a stranger nothing about
  the domain, and names all three features. Rejected: "Compare avalanche forecasts"
  (misses obs + trip plan), "Compare, report, check in" (no domain word),
  "Avalanche zones, obs, trip plan" (31).
- **Kai's call on the TEST MODE question: keep the button, be honest about it.** Tapping
  send while `observationApiConfig.isStaging` now opens an explanation — production access
  from NAC is pending, so the app can't file it — and offers to **send the same
  observation to the center by email**, formatted, with the PDF receipt and photos
  attached, or just save the PDF. Nothing silently posts into a test system any more.
  Button reads SEND OBSERVATION; the footer explains rather than saying "TEST MODE".
  New `lib/observation/emailFallback.ts` (expo-mail-composer).
- **Verified center addresses only.** `VERIFIED_CENTER_EMAIL` holds just HPAC
  (`info@hpavalanche.org`) today — a wrong address sends someone's field observation into
  a void, which is worse than asking them to pick. Unknown centers open the composer with
  no recipient. This is now a concrete reason the center-outreach effort
  (`docs/CENTER_OUTREACH.md`) pays for itself: each reply adds an address.
- App Review notes updated so a reviewer knows the button explains rather than submits.
- **In App Store Connect:** name → `Whumpf`, subtitle set, category Weather / Sports,
  content rights declared (third-party forecast data, rights held). Saved.

## 2026-09-11 (late night) — Renamed to **Whumpf**
- **Why rename at all:** the old name started with "Avy", which is literally NWAC's app.
  Given Kai's whole framing to NAC is "I'm not a rip-off and not a competitor", the name
  was working against the pitch. Renaming does that job permanently instead of having to
  explain it in an email.
- **Why Whumpf:** the sound a collapsing weak layer makes — the most visceral red flag in
  avalanche terrain, so it reads as "built by someone who's been out there". Verified
  clear: no App Store app, company or trademark using it; `whumpf.app`, `.io`, `.ai` and
  `getwhumpf.com` all unregistered (`.com` and `.co` are taken). Known cost: beginners
  can't spell it from hearing it, so the subtitle "Compare avalanche forecasts" and the
  keyword field carry search. Rejected along the way: MTN WX (lands on the crowded
  mountain-weather shelf — Mountain-Forecast.com, PeakWeather, Mountain Weather — and
  hides the cross-center comparison advantage), Snowline, Zonecast, Treeline, The Call.
- **Scope of the change — display name only.** Changed: `app.json` name, the home
  wordmark, the onboarding wordmark, the footer, Settings-permission copy (3 places),
  the PDF receipt line, the trip-plan page footer, the `legal` pages, the email
  sender name (`TRIP_PLAN_EMAIL_FROM` → `Whumpf <trips@avycomparison.kaiconsulting.ai>`),
  and the NWAC draft. **Deliberately unchanged:** bundle id `com.kaimyers.avycomparison`,
  EAS slug `AvyComparisonApp`, scheme, Supabase project ref, and the
  `avycomparison.supabase.co` vanity host — each is an identity key whose change would
  orphan the App Store record, the EAS project, or already-sent share links.
- Support page now opens by explaining the word, for anyone who lands there not knowing it.
- All 4 edge functions redeployed (page copy is server-side). Gates: tsc, eslint 0
  warnings, Vitest 113/113.

## 2026-09-11 (night) — App Store prep: privacy + support pages live
- **Kai's call: submit to the App Store *before* sending the NWAC email** — so the first
  thing they see is a real, installable app rather than a pitch.
- **NWAC draft rewritten** to Kai's notes: dropped "built around the avalanche.org
  platform" (read as derivative) and the Alaska framing (it's national — 92 zones, 28
  centers). Now leads with "I'm not trying to compete; if this is useful, I'd rather see
  it in Avy", then the actual motivation — from Anchorage it's ~1h north to Hatcher Pass,
  ~1h south to Turnagain, a few hours east to Valdez, three centers for one Saturday —
  then five concrete differences (cross-center side-by-side, offline-first background
  refresh, weather stations + SNOTEL + NWS on the zone, cached day pager, trip plan/SAR
  packet), then the four questions. Keeps the credit for their published schemas.
- **Privacy policy + support pages written and deployed** as a `legal` edge function
  (`--no-verify-jwt`), the last two blockers I could clear without Kai's ASC login:
  - `https://avycomparison.supabase.co/functions/v1/legal/privacy`
  - `https://avycomparison.supabase.co/functions/v1/legal/support`
  Content is derived from what the code actually does, not boilerplate: no accounts/ads/
  analytics, on-device vs. transmitted split, observations → NAC, trip plans + 7-day
  purge, push token, the three uses of location with the background-trigger carve-out,
  named service providers, deletion path, safety disclaimer.
- Remaining App Store work is all inside App Store Connect (needs Kai signed in) plus
  device screenshots — see `docs/APP_STORE_CHECKLIST.md`.

## 2026-09-11 (evening) — Real-looking SAR links, NWAC outreach drafted
- **Share links no longer read as garbage.** Activated the project's free **vanity
  subdomain**: `tfvxhsgwrwvendrnbrgf.supabase.co` → **`avycomparison.supabase.co`**
  (`supabase vanity-subdomains activate --experimental`). `TRIP_PLAN_PAGE_BASE` repointed,
  verified end to end: a new plan's link is
  `https://avycomparison.supabase.co/functions/v1/trip-plan-page?t=…` and opens with no
  auth headers. The old host still resolves, so links already sent keep working.
  (Custom domains like `sar.kaiconsulting.ai` need the Pro plan + a $10/mo add-on, or a
  Cloudflare Worker proxy which would mean moving kaiconsulting.ai's NS off Porkbun —
  not done, decision left to Kai.)
- **Caught a stale backend.** The live `trip-plan-page` was several commits behind the
  repo — still titled "trip plan", no gear-inventory row, no photo support — because
  app builds had been going out without redeploying edge functions. Redeployed all
  three; verified the page now renders the current copy and all nine sections. Added a
  loud note to `docs/TRIP_PLAN_OPS.md`: **edge code does not ship with the app build.**
- **NWAC email drafted** in Kai's Gmail (to developer@nwac.us, unsent): who at NAC grants
  production observation access, whether centers opt in individually, what they'd want
  to review, terms of use for presenting forecast data. Kai reviews and sends.
- **New backlog item (Kai, for after launch):** contact every avalanche center to
  introduce the app *and* ask which weather stations they consider most representative
  for each forecast zone — station choice is currently our guess, and local knowledge
  beats it. Research + drafts to start once the app is publicly available. See
  `docs/CENTER_OUTREACH.md`.

## 2026-09-11 (later) — Kai's bug sweep through profile + observation
**Profile**
- **Space key did nothing in gear detail fields** (stove/fire, overnight) — profile.tsx
  ran `gearProfileSchema.parse()` on *every keystroke*, and `optionalText` trims, so a
  trailing space was deleted as fast as it was typed (interior spaces too, since every
  space is trailing while you type it). Radio only seemed fine by luck of typing order.
  Fixed by dropping the per-keystroke parse; `saveProfile` still parses once on save.
  Added `normalizeGear()` to fill schema defaults without trimming.
- Usual colors are **no longer behind progressive disclosure** — shown in §4 directly;
  the fold now only holds skis/sled + tent color.
- **Photo "too large" on a normal selfie.** Old cap was 28 KB of base64 with a single
  480px/0.45 pass, which typically yields 40–80 KB — so it rejected almost everything.
  Now steps 400/0.5 → 320/0.45 → 256/0.4 → 200/0.35 until it fits, cap raised to 120 KB,
  packet cap 128 KB → 384 KB (client + edge).
- Date of birth is a **wheel picker** (`components/trip/DateOnlyField.tsx`), defaulting
  to 1990 so nobody spins through 30 years. "Sex" → **"Gender"**. **Home address moved**
  from "what you look like" to "how to reach you". **Usual partners can be added from
  the phone's contacts.**
- **DONE button at the bottom of the profile**, and the composer now re-reads the
  profile with `useFocusEffect` — filling only gaps, never overwriting a choice already
  made for this trip — so edits show up immediately instead of after a restart.

**Observation**
- **Take a photo** alongside choose-from-library (both entry points).
- **Pick on a map**: new `components/observation/MapPointPicker.tsx`, Leaflet in a
  WebView like ZoneMapPicker, tap to drop and drag to fine-tune. No new native dep.
- **Elevation is no longer required.** Blank = "I don't know"; schema regex `\d*`,
  payload sends `null` instead of `NaN`. A GPS fix now reports altitude
  (`LocationField.onAltitudeFt`), offered as a one-tap `USE GPS · N FT` chip with a
  note that it comes from the fix, not the crown. +3 tests (113 total).
- **PDF copy of what you submitted** — `lib/observation/receipt.ts` (expo-print) builds
  it from the same merged form the flow posted; "SAVE A COPY (PDF)" on the success
  screen shares it.
- Gates: tsc, eslint 0 warnings, Vitest 113/113. **Shipped as TestFlight build #28**
  (3ec5a52, build 96686eda, submission 0724f562).
- **Still open from Kai's list:** elevation does not auto-populate without a GPS fix
  (a map pin carries no altitude — would need a terrain-elevation lookup service);
  worth deciding whether to add one.

## 2026-09-11 — ROOT CAUSE of every UI complaint: NativeWind drops function styles
- **The bug behind all of it.** This project runs NativeWind v4.2.3 with
  `jsxImportSource: "nativewind"`, so every JSX element goes through NativeWind's
  interop. That interop **does not apply a *function* `style` on `Pressable` on
  native** — but does on web. Any control whose layout lived in
  `style={({ pressed }) => ({...})}` fell back to defaults on device: no padding, no
  border, no background, no `flexDirection: "row"`, children stacked at the top-left.
  Every complaint in this run was one symptom: "add-obs bubble is transparent"
  (background dropped), "icons blend together" (tile borders dropped), "text doesn't
  fit in the pills" (centering + padding dropped), and the stacked profile section
  headers / plain-text chips in the 4:50 PM screenshot.
- **Why it hid:** it renders *correctly* in the Expo web preview, so every screenshot I
  took to verify a fix looked right. The codebase already held the safe pattern —
  `ZoneTile` and the MANAGE ZONES header keep layout on a plain child View and use the
  function style only for `opacity`, which is why those two never broke.
- **Fix:** new `components/ui/Touchable.tsx` resolves the style function itself from
  local pressed state and hands `Pressable` a plain object. Codemodded **28 files**
  (every `style={({ pressed })` call site) from `Pressable` → `Touchable`; stale imports
  cleaned. Components that style via `className` (Button, Collapsible, Checkbox) were
  never affected and are untouched.
- **Dynamic Type.** Kai's phone is on a larger text setting, which is why his labels
  were oversized versus my screenshots. `components/ui/Text.tsx` now defaults to
  `maxFontSizeMultiplier={1.25}` (overridable), and fixed-height chrome (field labels,
  chips, gear tiles, section eyebrows, bar pills) sets `allowFontScaling={false}`.
- **Kai's ask — a box per field, coloured by state.** New `FieldCard` in
  `formPrimitives`: empty = sepia rim on the recessed surface; filled = frost rim +
  tint + a corner check; focused = brighter frost; error = aspen. `TextField`,
  `SelectField` and the trip `DateTimeField` render through it, so profile,
  heading-out and observation all get the same separated, self-labelling boxes.
- Gates: tsc, eslint 0 warnings, Vitest 110/110. **Shipped as TestFlight build #27**
  (79bf132, build 7dbef0d7, submission e2254e2e).

## 2026-09-10 (night) — Build #24 device notes: pills, gear borders, profile-first flow
- **Push was broken in prod (found in Kai's screenshot, not by us):**
  `PUSH · SUPABASE-UPSERT-ERROR · permission denied for table device_tokens`, failing
  since the 2026-08-07 lockdown. First fix (restore the anon INSERT grant) was wrong
  and got reverted: **PostgREST needs SELECT to resolve an upsert's ON CONFLICT
  target**, and SELECT is precisely what the lockdown removed on purpose (readable
  tokens = anyone can push to every device). Real fix, migration
  `20260910230000_device_tokens_register_rpc`: a SECURITY DEFINER
  `register_device_token(p_token, p_platform)` with shape checks, EXECUTE to anon, and
  the table left fully closed — no INSERT, no SELECT. Client calls the RPC instead of
  `.upsert()` (`lib/pushNotifications.ts`; diagnostic step renamed
  `supabase-register-error`). Live-verified as anon: register 204, repeat 204 (last_seen
  now refreshes again, which the lockdown had given up), read still 42501, bad platform
  400. Smoke rows deleted.
- **Bottom-bar pills, two rounds.** Round one dropped `adjustsFontSizeToFit` (the mono
  face mis-measured and pushed the label outside the pill) and added a page-colored
  band behind the pair. Round two removed that band after Kai's next screenshot — it
  was translucent, so the disclaimer text read straight through the buttons, and
  merging the shadow and `overflow: "hidden"` onto one view clipped the shadow.
  Final shape: outer View owns fill + rim + shadow, inner Pressable owns clipping and
  the pressed tint, fixed 12pt label. Two opaque pills, no backdrop.
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
- Shipped as build #25 (711bc8a), superseded the same night by **TestFlight build #26**
  (b4a621a, build cd2cfc72, submission 132d0472) with the pill and push fixes above.
- **"26 never landed" — it did, just late.** Build finished 15:10 AKDT, auto-submit
  `132d0472` FINISHED, and Apple's "1.0.0 (26) is ready to test" email arrived 15:32
  AKDT; Kai's 14:59 screenshot predates it and was build #25 (hence the translucent
  band). Diagnosis path worth reusing: `eas build:view <id>` shows build state but not
  submission state, and the Expo/ASC web UIs need a login — the fastest read is the
  EAS GraphQL API with the session secret from `~/.expo/state.json`
  (`submissions{byId(submissionId:){status error logFiles}}`), then Kai's Gmail for
  Apple's TestFlight mail. Note: I re-ran `eas submit` before checking, which created
  a second, **ERRORED** submission (`01b86ec2`) because build 26 was already uploaded.
  Harmless, but check submission status before resubmitting.
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
