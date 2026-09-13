# App Store review notes

## As pasted into App Store Connect (1.0, 2026-09-13)

This is the exact text in *App Review Information → Notes*. Edit here first, then
re-paste. The older per-topic drafts below are kept for their internal reasoning; the
location one had a stale "onboarding screen" verify step (the prompt actually appears
the first time a zone is favorited) and the old app name.

```
BACKGROUND LOCATION ("ALWAYS")
Whumpf is an avalanche-forecast app for backcountry travelers, who routinely drive out of cell service into remote mountain terrain. So the latest avalanche and weather data for a user's saved zones is already on the phone before they lose signal, the app refreshes that data in the background as they travel.

The app requests "Always" location for one purpose: to receive iOS significant-location-change events, used only as a trigger to run that background refresh. The app does not read, store, log, transmit, or share the device's location; the coordinates delivered with these events are never accessed by our code.

It is strictly opt-in. The request is shown in context with a plain-language explanation the first time the user adds a favorite zone, never at launch, and the app is fully functional without it (foreground use, pull-to-refresh, Background App Refresh and silent push all work with location denied).

How to verify: on the home screen, add a zone to your favorites; the explainer appears, and tapping enable shows the iOS prompt. Significant-location-change only fires on real coarse-location changes; in the simulator use Features > Location > Freeway Drive to trigger the refresh.

OBSERVATION SUBMISSION
Tapping "Send observation" does not file the report directly. Whumpf is waiting on production API access from the National Avalanche Center, so the app says so plainly and offers to send the completed observation to the avalanche center by email instead, with a PDF copy and the user's photos attached. Nothing is submitted to a live forecasting system until that access is granted. You can complete the form and tap the button to see the explanation; choosing "Save a PDF" exercises the whole flow without sending anything.

USER-GENERATED CONTENT
The Observations tab for each zone shows public field observations (text and photos) retrieved read-only from the National Avalanche Center's public API (api.avalanche.org). They are submitted by the public to, and published by, the regional avalanche centers. Users cannot post into this feed from within Whumpf, and there are no user accounts, profiles, comments or messaging. Each observation links to its original page on the avalanche center's site.

No sign-in is required; all features are available without an account.
```

---

Paste the relevant block into **App Store Connect → your version → App Review
Information → Notes** before submitting. Reviewers reject "Always" location
faster when they have to infer why it's requested — leading with a clear
explanation heads that off.

---

## Background location ("Always") — reviewer note

> Avy Comparison is an avalanche-forecast app for backcountry travelers. Users
> routinely drive from areas with cell service into remote mountain terrain that
> has none. So that the most recent avalanche and weather data for a user's saved
> zones is already on the device before they lose signal, the app refreshes that
> data in the background as the user travels toward the trailhead.
>
> The app requests "Always" location for a single purpose: to receive iOS
> significant-location-change events, which are used **only as a trigger** to run
> a background data refresh. The app does **not** read, store, log, transmit, or
> share the device's location — the coordinates delivered with these events are
> never accessed by our code. The event is used solely as a "the device has moved,
> refresh now" heartbeat. This is a standard mechanism for keeping content fresh
> after the app has been terminated on iOS.
>
> Background location is strictly **opt-in**: it is presented on a dedicated
> onboarding screen with a plain-language explanation, and the app is fully
> functional without it — foreground use, manual pull-to-refresh, Background App
> Refresh, and silent-push refresh all work with location permission denied.
>
> **How to verify:** In the app, star one or more forecast zones (Favorites), then
> grant location when prompted on the onboarding "Location · Always" screen. The
> "significant location change" API only fires on real cell-tower/coarse-location
> changes, so in the simulator you can exercise it via **Features → Location →
> Freeway Drive** (or Xcode's location simulation), which triggers the background
> refresh. No location data leaves the device at any point.

---

### Why this is defensible (internal note, do not paste)

- The Info.plist usage strings (`app.json` → `expo-location` plugin) already state
  the purpose and that location is not stored/shared/used for anything else.
- Location is iOS-only (`lib/locationWake.ts`) and used purely as a wake heartbeat
  (`refreshFavoritesSnapshot` never reads the coordinates).
- If a reviewer still rejects under Guideline 5.1.1, reply reiterating the above —
  background-refresh-via-location without collection is an accepted pattern (many
  weather apps ship it). It's an appeal, not a code change.
- Fallback if you'd rather not carry the risk at all: remove the location-wake
  path entirely (Background App Refresh + silent push still cover the common,
  not-force-quit case) — you lose only the force-quit-survival refresh.


---

## Observation submission — reviewer note

> Tapping "Send observation" does not file the report directly. Whumpf is waiting on
> production API access from the National Avalanche Center, so the app says so plainly
> and offers to send the completed observation to the avalanche center by email
> instead, with a PDF copy and the user's photos attached. Nothing is submitted to a
> live forecasting system until that access is granted. A reviewer can complete the
> form and tap the button to see the explanation; choosing "Save a PDF" exercises the
> whole flow without sending anything.
