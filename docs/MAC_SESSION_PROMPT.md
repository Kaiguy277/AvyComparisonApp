# Opening prompt for the Mac session

Paste the block below as the first message of a new Claude Code session on the Mac,
from the repo root. Written 2026-09-18, when the project moved off the Linux desktop
because EAS's free iOS cloud builds were used up until Oct 1.

It points at the SESSION HANDOFF in `LOG.md` rather than repeating it, so the two can't
drift apart. If the handoff has been superseded, update this prompt too.

```
We're continuing Whumpf (the avalanche app) on my Mac. I moved over from my Linux
desktop because EAS's free iOS cloud builds are used up until Oct 1, and this Mac
can build locally and run the iOS Simulator.

Before anything else, read CLAUDE.md, the SESSION HANDOFF at the top of LOG.md,
and the newest entries in JOURNAL.md. The handoff is the current status.

Goal: get Whumpf 1.0 submitted to App Review. In this order:

1. Setup. Pull main, npm install, make sure eas-cli is logged in (k.ai_consulting),
   and run the gates. Expect 168 tests. Tell me if Xcode, CocoaPods or fastlane are
   missing before we try to build.

2. Look before building. Run the app in the iOS Simulator (npx expo run:ios) and
   check the screens that were written on Linux without ever being seen: the home
   bar pill and "Your trips" strip, the trip hub with PAST TRIPS, the past-trip
   screen, the "Go to trip" alert, the ZONES NEAR YOU strip, and temperature
   formatting. Take screenshots, and fix any layout problems before we build.

3. Build 37 locally (eas build --local) and submit it to TestFlight.

4. With my phone plugged in, read its crash logs to confirm what actually crashed
   build 33 on upgrade. That cause was only inferred on Linux. Then help me through
   the device checklist in docs/RELEASE_CHECKLIST.md.

5. Diagnose the 9-minute trip-create delay from build 35. It happened with good
   signal, and the cause is in the trip-plans edge function logs for 2026-09-18
   00:20–00:32 UTC, not in the code.

6. Then App Privacy labels, the screen recording, and submission.

Ground rules:
- Check with me before anything outward-facing or irreversible: submitting for
  review, publishing the privacy labels, spending money, or deleting production data.
- Never run `supabase db push`. Migration history has diverged; the handoff
  explains how to apply migrations safely.
- trip-plan-page and legal always deploy with --no-verify-jwt.
- Verify by behaviour, not artifacts. Look at the screen, submit the form, read
  the row. This project's recurring bug is checking the easy thing instead.
- Keep LOG.md and JOURNAL.md updated as you go, not just at the end.
```
