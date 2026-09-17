# Whumpf — first release checklist

Everything that must be true before the app is submitted. Written 2026-09-17.

**This ships as version 1.0, not 1.1.** The 1.0 submission was cancelled on 2026-09-17
(Kai's call: don't wait for an approval that would be replaced within days), so the
push, notification and tracking work goes out *in* the first release. "1.1" survives
only as internal shorthand in older LOG entries.

**Order matters.** This release re-introduces background location, and the whole point is
that the metadata must match the binary this time. Build 32 was rejected under Guideline
2.5.4 because it did not.

**There is no approved version to fall back on.** If this is rejected, nothing is live.
That is why §4 and §5 are not optional.

---

## 0. Preconditions

- [x] The previous submission is cancelled (2026-09-17). Version 1.0 sits at
      `Developer Rejected` with `Add for Review` available and build 33 attached; all
      listing metadata, screenshots and review notes survived.
- [x] Migrations applied to production (2026-09-17). `device_tokens.alerts_enabled/zones/
      last_alert_date`, `trip_plan_locations`, `trip_plans.tracking_enabled`,
      `set_device_zones`, `trim_trip_plan_locations`, and the `register_device_token`
      overload.
- [x] Edge functions deployed: `send-forecast-alerts`, `trip-plans`, `trip-plan-page`,
      `legal`. **`trip-plan-page` and `legal` must always deploy `--no-verify-jwt`.**
- [x] Cron `avy-forecast-alerts-early` / `-late` scheduled and active. Currently a no-op
      (no device has `zones` until 1.1 ships), verified returning `{"sent":0}`.

---

## 1. Privacy policy (deploy with 1.1, NOT before)

`supabase/functions/legal/index.ts` was corrected on 2026-09-17 to match build 33: it now
says the app does **not** track in the background. That is true of 1.0 and must stay true
until 1.1 actually ships.

When 1.1 goes out, the Location section needs a third bullet and the FAQ answer needs
replacing. Suggested copy:

> **Trip tracking (only if you turn it on)** — when you turn on location sharing for a
> trip, the app records your position while that trip is open and sends it to our server,
> so the contacts you chose can see where you are and which way you were heading. It is
> off unless you switch it on for that specific trip, it stops when you check in or
> cancel, and the trail is deleted with the trip plan (seven days after it closes). Only
> people holding that trip's share link can see it.

FAQ, replacing "Does the app track my location?":

> **Does the app track my location?**
> Only if you ask it to, and only during a trip. Location sharing is off by default and is
> a per-trip choice — it is not a setting you turn on once. While it is on, your position
> goes to the contacts on that trip plan and nowhere else, and it stops when you check in.
> The rest of the app only reads your location when you tap a button asking it to.

Also update the "What we send, and where" table with a `Trip tracking` row.

Deploy: `supabase functions deploy legal --no-verify-jwt --use-api`

---

## 2. App Privacy answers in App Store Connect

**Do not touch these until you are submitting 1.1** — the labels are app-level, not
version-level, so editing them now would misdescribe the 1.0 build that is live.

Currently published (2026-09-13): Name, Email, Phone, Physical Address, Health, Precise
Location, Contacts, Photos/Videos, Other User Content — all **linked to identity**, all
purpose *App Functionality*, none used for tracking. Device ID (push token) **not linked**.

**Analysis for 1.1:**

- **Precise Location — no change needed.** It is already declared as collected, linked to
  identity, for App Functionality. Trip tracking stores it on our server, but a trip plan
  is already tied to the named subject, so the existing answer stays accurate. Worth
  re-reading the purpose text to be sure it does not say location is never stored.
- **`device_tokens.zones` is genuinely new collected data** — the list of zones a device
  follows, transmitted and stored against an anonymous push token. It is not covered by
  any current answer. Recommended: add **Usage Data → Product Interaction**, purpose *App
  Functionality*, **not linked to identity** (there is no account or name on that row),
  not used for tracking.
  - The alternative reading is "Other Usage Data". Product Interaction is the closer fit
    because it is a record of what the user chose in the app.
- **Kai reviewed and published these labels personally last time. Do that again** — this
  is the part of the submission that has to be exactly true.

---

## 3. App Review Information notes

`docs/APP_REVIEW_NOTES.md` carries the 1.1 LOCATION block. Apple's rejection explicitly
asked for a screen recording, so the notes must reference it and the attachment must be
present.

---

## 4. Device verification (needs Kai's iPhone; cannot be done from this Linux machine)

No iOS simulator exists for Linux, and on iOS 18 the `libimobiledevice` services
(screenshot, syslog, app list) all need a personalised Developer Disk Image, i.e. Xcode on
a Mac. So these are manual.

The app surfaces its own diagnostics for exactly this reason — read them off the screen.

- [ ] **Push token decoupling.** With notifications **denied**, open the app. The
      diagnostic line should read `ALERTS OFF · NO DAILY FORECAST · TAP TO TURN ON`
      (amber). If it says `PUSH · PERMISSION-DENIED` or nothing registers, the decoupling
      failed — this is the one behaviour inferred from native source
      (`PushTokenModule.swift` calls `registerForRemoteNotifications()` with no permission
      check) and never run on a device.
- [ ] Tap that line: it should prompt, or deep-link to Settings if iOS will not ask again.
- [ ] **Grant notifications**, relaunch, confirm the line disappears (state `ok`).
- [ ] **Upgrade crash is gone.** Install 1.1 OVER a build ≤32 if any device still has one.
      Build 33 crashed on that path; `lib/legacyTaskCleanup.ts` should clear the orphaned
      `avy.location-wake` task. If no such device exists, note that it went untested.
- [ ] **Daily forecast alert.** After the app has synced favourites, check
      `device_tokens.zones` is populated for that token, then invoke
      `send-forecast-alerts` with the cron key and confirm a notification arrives.
      Out of season every zone's forecast is expired, so this may legitimately return
      `{"sent":0}` — check `zonesWithForecast` in the response before concluding it broke.
- [ ] **Trip tracking.** Create a trip with the toggle ON. Confirm the iOS Always prompt
      appears, the blue location indicator shows, positions land in `trip_plan_locations`,
      the packet page shows "Last known position", and **checking in stops it**.
- [ ] **"ZONES NEAR YOU" strip.** Once Always is granted and the app has had a location
      fix, the home screen should offer the zones of the nearest center. Tapping it should
      add them to favourites (and they should then appear in `device_tokens.zones`).
      Before granting, the same strip should instead read "KEEP FORECASTS ON YOUR PHONE".
- [ ] **Movement-triggered refresh fires.** Long-press the wordmark to turn on debug mode,
      then drive far enough to cross cell towers. Expect `BG WAKE · HH:MM VIA LOCATION`.
      This is the whole point of the release — the forgetful user who never opens the app —
      so if only this one thing gets tested properly, make it this.
- [ ] **Session handoff.** Only one location session runs at a time. Start a tracked trip:
      the blue indicator should appear (tracking). Check in: it should disappear, and the
      low-power monitor should resume (no indicator, but `VIA LOCATION` wakes continue).
- [ ] **Temperature formatting.** Station temps should read consistently — no "52.34°"
      beside "36.9°". Whole degrees show no decimal.
- [ ] **Daily alert wakes a backgrounded app.** With the app backgrounded (not killed) when
      the alert arrives, the cache should refresh, not just show the banner.

---

## 5. The screen recording Apple asked for

From the rejection: *"reply to this and add a screen recording showing the persistent
background location usage on a physical device. Include the recording in the Notes field
of the App Review Information section."*

Record with iOS Control Center → Screen Recording. One continuous take, roughly 60s:

1. Start on the trip form. Show the **"Share your location with these contacts while
   you're out"** toggle and switch it **on**.
2. Send the trip. Show the iOS **"Allow While Using / Always"** prompt and choose Always.
3. Show the **blue background-location indicator** in the status bar.
4. **Background the app** (swipe home). Leave it backgrounded, indicator still visible.
5. Open the packet page in Safari (the contact's share link) and show **"Last known
   position"** with a timestamp.
6. Return to the app and **check in**. Show the blue indicator **disappear** — this is the
   part that proves tracking is scoped to an active trip.

Point 6 matters most: it answers "does this app need persistent location" with a feature
that visibly stops when the trip ends.

---

## 6. Build budget

As of build 35 (2026-09-17), **1 iOS build left** in this billing period. Build 34 was
superseded before submission and is irrelevant.

That is the reason §4 is written as one sitting rather than a loop: there is room for
exactly one round of "found a bug, fixed it, rebuilt". Work through the whole list and
collect every problem before asking for another build.
