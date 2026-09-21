# Opening prompt for the next session (device pass on Kai's iPhone)

Paste the block below as the first message of a new Claude Code session, from the repo root.
Rewritten 2026-09-20, when the Mac setup finished and build 39 went to TestFlight. It points
at the SESSION HANDOFF in `LOG.md` rather than repeating it, so the two can't drift.

**The previous version of this file is superseded.** It was written for the move to the Mac
and told the session to "tell me if Xcode, CocoaPods or fastlane are missing" — a question
that let a *present but unusable* Xcode 15.3 through. Ask for versions, not existence.

```
We're continuing Whumpf (the avalanche app). The Mac is fully set up now and build 39 is in
TestFlight. What's left needs my actual iPhone, so I'll be doing the tapping.

Before anything else, read CLAUDE.md, the SESSION HANDOFF at the top of LOG.md, and the
newest entries in JOURNAL.md. The handoff is the current status.

Goal: get Whumpf 1.0 submitted to App Review. In this order:

1. Confirm the toolchain still reports what the handoff says — xcodebuild -version and
   xcodebuild -showsdks (want Xcode 16.2 / iOS 18.2), pod --version, ruby -v, eas whoami.
   Version numbers, not "is it installed".

2. Install build 39 from TestFlight on my phone, then walk docs/RELEASE_CHECKLIST.md §4
   with me. Highest value, in order: push decoupling (amber ALERTS OFF, not
   PERMISSION-DENIED), trip tracking with the blue location indicator, and confirming
   check-in stops it. Read the app's own diagnostic lines off the screen.

3. While my phone is plugged in, read its crash logs and confirm what actually crashed
   build 33 on upgrade. That cause is still only inferred.

4. Help me record the §5 screen recording. It must be on the physical device — Apple asked
   for that specifically. Point 6 (blue indicator disappearing on check-in) matters most.

5. Diagnose the 9-minute trip-create delay from build 35 — still UNDIAGNOSED. The cause is
   in the trip-plans edge-function logs for 2026-09-18 00:20–00:32 UTC, which only the
   Supabase dashboard shows.

6. Then App Privacy labels, and submission.

Ground rules:
- Check with me before anything outward-facing or irreversible: submitting for review,
  publishing the privacy labels, spending money, or deleting production data.
- Never run `supabase db push`. Migration history has diverged; the handoff explains how
  to apply migrations safely.
- trip-plan-page and legal always deploy with --no-verify-jwt.
- Verify by behaviour, not artifacts. Look at the screen, submit the form, read the row.
  Rebuilds are free now (local builds), so there is no reason to guess.
- Keep LOG.md and JOURNAL.md updated as you go, not just at the end.
```
