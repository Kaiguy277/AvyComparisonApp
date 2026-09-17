# App Store review notes

## To paste into App Store Connect (1.0, updated 2026-09-17 after the 2.5.4 rejection)

This is the text for *App Review Information → Notes*. Edit here first, then re-paste.
**The LOCATION paragraph was rewritten after build 32 was rejected** — the old one
described a background-location wake that no longer exists, so do not resurrect it.

```
LOCATION
Whumpf requests location only as "When In Use", and only for one feature: when a user is recording an avalanche observation, the location field offers a "Use current location" button that fills in the coordinates and elevation of the observation site. Location is read at that moment and nowhere else. The user can also type coordinates manually or pick the spot on a map, so the feature is fully usable with location denied.

Build 32 declared the "location" UIBackgroundModes key for a background-refresh wake. That has been removed entirely: this build declares only "fetch" and "remote-notification", it never requests Always authorization, and the Info.plist no longer contains NSLocationAlwaysUsageDescription or NSLocationAlwaysAndWhenInUseUsageDescription. Background refresh now runs solely through Background App Refresh and silent push.

OBSERVATION SUBMISSION
Tapping "Send observation" does not file the report directly. Whumpf is waiting on production API access from the National Avalanche Center, so the app says so plainly and offers to send the completed observation to the avalanche center by email instead, with a PDF copy and the user's photos attached. Nothing is submitted to a live forecasting system until that access is granted. You can complete the form and tap the button to see the explanation; choosing "Save a PDF" exercises the whole flow without sending anything.

USER-GENERATED CONTENT
The Observations tab for each zone shows public field observations (text and photos) retrieved read-only from the National Avalanche Center's public API (api.avalanche.org). They are submitted by the public to, and published by, the regional avalanche centers. Users cannot post into this feed from within Whumpf, and there are no user accounts, profiles, comments or messaging. Each observation links to its original page on the avalanche center's site.

No sign-in is required; all features are available without an account.
```

---

Paste the whole block into **App Store Connect → your version → App Review
Information → Notes** before resubmitting. Say plainly what each permission is for and
which user action triggers it; a reviewer who has to infer it rejects faster.

---

## 1.1 — App Review Notes (paste this INSTEAD of the 1.0 block when submitting 1.1)

1.1 re-introduces the `location` background mode, this time behind a real feature. Apple
asked for a screen recording; attach it (see `docs/RELEASE_1_1_CHECKLIST.md` §5) and say
so in the notes. Do not submit 1.1 without it.

```
BACKGROUND LOCATION — LIVE TRIP TRACKING
Whumpf lets a backcountry traveller leave a trip plan with chosen contacts before going out: where they are going, when they expect to be back, and what to do if they are not. In 1.1 the user can additionally share their live position with those contacts for the duration of that trip.

This is what the "location" UIBackgroundMode is for, and the coordinates are the feature itself, not a trigger. While a trip is open, the app records the party's position and sends it to the contacts' page, so if someone does not check in, the people deciding whether to call it in can tell rescuers where the party was and which direction they were travelling. That is the first question a search team asks.

Scope, which is enforced in code:
- It is off by default and is a per-trip choice, not a global setting. The toggle is on the trip form ("Share your location with these contacts while you're out").
- It only runs while that trip is open. Checking in, cancelling, or the plan closing tears the background task down, and the server refuses any position posted for a closed trip.
- The trail is visible only to the contacts holding that trip's share link, and it is deleted with the trip plan (seven days after it closes).

A screen recording made on a physical device is attached, showing the toggle, the iOS Always prompt, the blue background-location indicator while the app is backgrounded, the contact's page showing the last known position, and the indicator disappearing on check-in.

Location is also read in the foreground, once, when the user taps "Use current location" to fill in the coordinates and elevation of an avalanche observation.

OBSERVATION SUBMISSION
Tapping "Send observation" does not file the report directly. Whumpf is waiting on production API access from the National Avalanche Center, so the app says so plainly and offers to send the completed observation to the avalanche center by email instead, with a PDF copy and the user's photos attached. Nothing is submitted to a live forecasting system until that access is granted. You can complete the form and tap the button to see the explanation; choosing "Save a PDF" exercises the whole flow without sending anything.

USER-GENERATED CONTENT
The Observations tab for each zone shows public field observations (text and photos) retrieved read-only from the National Avalanche Center's public API (api.avalanche.org). They are submitted by the public to, and published by, the regional avalanche centers. Users cannot post into this feed from within Whumpf, and there are no user accounts, profiles, comments or messaging. Each observation links to its original page on the avalanche center's site.

No sign-in is required; all features are available without an account.
```

**Why this should clear 2.5.4 where build 32 did not.** The rejection said Apple could not
locate any feature requiring persistent location — correctly, because there was none; the
monitor existed only to wake the app. Here the position is transmitted to third parties
the user nominated, for a stated safety purpose, and the app is visibly useless for that
purpose without it. The scoping (per-trip, stops on check-in) is the other half: it shows
the permission is used for the feature and nothing else.

---

## Location — history and the 2.5.4 rejection (internal note, do not paste)

**Build 32 was rejected on 2026-09-17 under Guideline 2.5.4.** Apple's words:
"The app declares support for location in the UIBackgroundModes key in your Info.plist
file but we are unable to locate any features that require persistent location."

They were right, and the prior review note made it easy for them: it openly explained
that the app registered a significant-location-change monitor it never read, purely to
get iOS to relaunch the app after force-quit. An earlier internal note in this file
claimed a reviewer pushback would be "an appeal, not a code change." **That was wrong.**
Apple does not accept a background mode used as a wake trick, however honestly it is
described — the whole test is whether a *user-facing feature* requires persistent
location, and none did.

**What was removed (2026-09-17):**
- `lib/locationWake.ts` and `components/onboarding/LocationPrompt.tsx` — deleted.
- The first-favorite Always-location explainer and the "LOCATION OFF · LIMITED REFRESH"
  banner in `app/index.tsx` — deleted.
- `registerLocationWakeIfPermitted()` from `app/_layout.tsx`.
- `isIosBackgroundLocationEnabled` → false, and both `locationAlways*` strings dropped
  from the `expo-location` config in `app.json`.

**What remains, and why it is legitimate:** `components/observation/LocationField.tsx`
uses `requestForegroundPermissionsAsync` + `getCurrentPositionAsync` when the user taps
"Use current location" while filling in an observation. That is a real, visible,
user-initiated feature, so When In Use is justified.

**The cost we accepted:** background refresh no longer survives a force-quit. Background
App Refresh and silent push still cover the ordinary case (app backgrounded, not killed).
Apple's suggestion to "use the significant-change location service" instead is a dead end
here — sig-change still requires Always authorization, and we still have no feature that
needs it, so it would invite a 5.1.1 rejection next.

**Do not reintroduce background location** without first shipping a genuine feature that
requires persistent location (e.g. live trip tracking that a partner can watch), and be
ready to supply the screen recording on a physical device that Apple asked for.

**Verification:** `npx expo config --type introspect` must show
`UIBackgroundModes: ['fetch', 'remote-notification']` and exactly one NSLocation key
(`NSLocationWhenInUseUsageDescription`). `plugins/withTrimmedPermissions.js` enforces
this by deleting the keys expo-location and expo-image-picker add unconditionally.

## Observation submission — reviewer note

> Tapping "Send observation" does not file the report directly. Whumpf is waiting on
> production API access from the National Avalanche Center, so the app says so plainly
> and offers to send the completed observation to the avalanche center by email
> instead, with a PDF copy and the user's photos attached. Nothing is submitted to a
> live forecasting system until that access is granted. A reviewer can complete the
> form and tap the button to see the explanation; choosing "Save a PDF" exercises the
> whole flow without sending anything.
