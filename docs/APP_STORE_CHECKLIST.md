# App Store submission checklist — Avy Comparison 1.0

Inventory taken 2026-09-09 in App Store Connect (app 6765956364). Builds 19 and 20
(v1.0.0) are "Ready to Submit" on TestFlight; build 20 is the candidate. Everything
below is unset unless marked ✅. Draft values are proposals — edit, then paste.

## A. Blockers (ASC will not accept the submission without these)

- [ ] **Privacy policy URL** (App Privacy → Edit). Need a hosted page. Proposal: a
      static page on the AvalancheComparison web app domain, or a GitHub Pages doc in
      this repo. Must cover: forecast data caching, push tokens, background location
      (trigger only, never read), observation submissions to NAC (name, email, optional
      phone, photos, coordinates → sent to avalanche.org, not stored by us), no
      analytics/ads, no account. Add a section for Trip Plan before that ships.
- [ ] **App Privacy questionnaire** (Get Started → Publish). Based on the code today:
      - Contact Info · Name, Email, Phone — collected, **not linked** to identity by us
        (sent to NAC when the user submits an observation), used for App Functionality.
      - Location · Precise — collected for observation submissions only (user-entered
        or GPS fix), App Functionality, not linked. Note: the Always-location trigger
        never reads coordinates; do not declare it as collected for tracking.
      - Photos — collected (observation photos), App Functionality, not linked.
      - User Content — observation text, App Functionality, not linked.
      - Identifiers · Device ID — push token stored in `device_tokens`, App
        Functionality, not linked.
      - Diagnostics — none (no crash/analytics SDK in package.json).
      - Tracking: **No**.
- [ ] **Category** (App Information). Primary: **Weather**. Secondary: **Sports**
      (or Navigation). Weather is what reviewers and users expect for forecasts.
- [ ] **Age rating** (Set Up Age Ratings). All "None/No" except: Unrestricted Web
      Access = No (observation viewer opens NAC pages in-app — if that's a WebView to
      arbitrary links say Yes); Medical/Treatment info = None. Expect 4+.
- [ ] **Content rights** — "does not contain, show, or access third-party content"
      is *false*: forecasts are NAC/center content. Declare that you have the rights
      (public API, attribution shown) — see NAC terms note in
      `docs/NAC_PRODUCTION_ACCESS.md`.
- [ ] **Pricing** — Add Pricing → Free. **Availability** — United States only for 1.0
      (NAC data is US-only; avoids DSA/EU trader verification).
- [ ] **Screenshots** — 0 of 10. Need 6.9" (iPhone 16 Pro Max class) set at minimum;
      ASC reuses them for smaller sizes. Suggested 5: home zone tiles, zone forecast
      with danger rose, problems detail, weather stations, observation form. Capture on
      device from build 20 (Settings → screenshot), no simulator here.
- [ ] **Description** (4,000 max). Draft:
      > Compare avalanche forecasts side by side. Avy Comparison pulls the daily
      > forecast for every zone you care about — danger ratings by elevation,
      > avalanche problems, the forecaster's discussion, NWS weather, and nearby
      > SNOTEL and weather-station readings — into one screen, so you can see how
      > conditions differ across the range before you pick an objective.
      >
      > Built for people who actually go out: your saved zones refresh in the
      > background and stay on your phone after you lose service. Submit
      > observations to your local avalanche center straight from the field.
      >
      > Forecast data is provided by the National Avalanche Center and its member
      > forecasting centers (avalanche.org). Always read the full forecast and make
      > your own decisions in the field.
- [ ] **Keywords** (100 chars): `avalanche,forecast,backcountry,ski,snowmachine,
      snow,danger,CNFAIC,NWAC,SNOTEL,weather,touring`
- [ ] **Support URL** — needs a real page (same host as the privacy policy; a
      mailto is not accepted).
- [ ] **Copyright** — `2026 Kai Myers` (or K.AI Consulting).
- [ ] **Build** — Add Build → 20.
- [ ] **App Review Information**: uncheck **Sign-in required** (there is no login);
      fill contact first/last/phone/email; paste the Always-location note from
      `docs/APP_REVIEW_NOTES.md` into Notes, plus: "Observation submission currently
      targets the National Avalanche Center *staging* API by design (labeled TEST
      MODE in-app) pending production credentials; test submissions are expected."
- [ ] **Version release** — currently "automatically after review, no earlier than
      Sep 9 2026 5 PM". Prefer **Manually release** for 1.0 so you can flip staging →
      prod NAC first if credentials land during review.

## B. Already fine

- ✅ Encryption: `ITSAppUsesNonExemptEncryption: false` in app.json — no upload needed.
- ✅ Bundle id, SKU, primary language, Apple ID, standard EULA.
- ✅ Builds 19/20 processed, "Ready to Submit", 60+ days before expiry.
- ✅ Submit config in `eas.json` (ASC app id, team id) for future auto-submits.

## C. Review-risk items (not blockers, but decide before submitting)

- Always-location (Guideline 5.1.1): note is drafted; the contextual prompt only
  fires on first favorite, which reviewers may never hit. Consider a line in Notes
  telling them how to trigger it (star a zone).
- Staging NAC target: harmless, but a reviewer tapping REPORT sees "TEST MODE".
  Either ship as-is with the note above, or hide the FAB behind a flag for 1.0.
- Apple asks for a demo of background behavior only if they can't verify; the
  note covers it.
- Regulated medical device declaration is only required if category is Medical/
  Health & Fitness — we are Weather, so skip.

## D. Order of operations

1. Host privacy policy + support page (blocks two fields and the privacy questionnaire).
2. Fill App Information (category, age rating, content rights) — saves instantly.
3. Pricing (Free) + availability (US).
4. Complete App Privacy → Publish.
5. Screenshots from a device on build 20.
6. Fill version metadata, attach build 20, fix review info, set manual release.
7. Add for Review.
