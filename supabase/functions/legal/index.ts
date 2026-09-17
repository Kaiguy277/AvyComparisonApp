// Public privacy policy + support pages.
//
// The App Store requires a reachable privacy policy URL and a support URL
// before a build can be submitted. These are served from the project's own
// edge runtime so there's no extra host to keep alive:
//
//   https://avycomparison.supabase.co/functions/v1/legal/privacy
//   https://avycomparison.supabase.co/functions/v1/legal/support
//
// Deploy with --no-verify-jwt: a reviewer opens these in a plain browser.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const UPDATED = "September 11, 2026";
const CONTACT = "kai@kaiconsulting.ai";

const CSS = `
:root{--bg:#F6EFDD;--ink:#1B1916;--muted:#5C534A;--line:#A89A82;--link:#2D5F95}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);padding:24px 18px 64px;
 font:16px/1.6 -apple-system,system-ui,Segoe UI,Roboto,sans-serif}
main{max-width:720px;margin:0 auto}
h1{font-size:28px;line-height:1.2;margin:0 0 4px}
h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);
 margin:32px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
h3{font-size:17px;margin:22px 0 4px}
a{color:var(--link)}
.updated{color:var(--muted);font-size:14px;margin-bottom:8px}
ul{padding-left:20px}li{margin:6px 0}
.lead{font-size:17px}
table{width:100%;border-collapse:collapse;margin:10px 0}
th,td{text-align:left;vertical-align:top;padding:8px 10px 8px 0;border-bottom:1px solid var(--line);font-size:15px}
th{width:34%;color:var(--muted);font-weight:600}
footer{margin-top:40px;padding-top:12px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}
`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Whumpf</title><style>${CSS}</style></head>
<body><main>${body}
<footer>Whumpf · Built by Kai Myers, K.AI Consulting LLC, Anchorage, Alaska ·
<a href="mailto:${CONTACT}">${CONTACT}</a><br>
<a href="/functions/v1/legal/privacy">Privacy</a> · <a href="/functions/v1/legal/support">Support</a></footer>
</main></body></html>`;
}

const privacy = page(
  "Privacy Policy",
  `<h1>Privacy Policy</h1>
<p class="updated">Last updated ${UPDATED}</p>
<p class="lead">Whumpf shows avalanche and weather forecasts for the backcountry.
There are no accounts, no advertising, no analytics, and no tracking. Most of what the app
knows about you never leaves your phone.</p>

<h2>The short version</h2>
<ul>
<li>You can use the whole forecast side of the app without giving us anything.</li>
<li>Information you type into an observation goes to the National Avalanche Center, because
that is the point of submitting an observation.</li>
<li>Information you put in a trip plan goes to the people you choose to send it to, and is
deleted seven days after the trip closes.</li>
<li>We do not sell data, share it with advertisers, or use it to build a profile of you.
There are no third-party analytics or advertising SDKs in the app.</li>
</ul>

<h2>What stays on your device</h2>
<ul>
<li><strong>Your favorite zones and app settings.</strong></li>
<li><strong>Cached forecasts and weather observations</strong>, so the app works when you
lose service.</li>
<li><strong>Your observer details</strong> (name, email, optional phone) so you don't retype
them each time you submit an observation.</li>
<li><strong>Your trip profile</strong> — vehicle, gear, emergency contacts, description, and
any medical notes you choose to add. Medical notes, date of birth and home address are held
in the device keychain. None of this leaves the phone unless you send a trip plan.</li>
</ul>

<h2>What we send, and where</h2>
<table>
<tr><th>Avalanche observations</th><td>When you submit an observation, its contents go to the
National Avalanche Center (avalanche.org), which distributes it to the relevant avalanche
center. This includes your name and email, an optional phone number, your written
observation, the coordinates you set, and any photos you attach. Whether your name is shown
publicly is your choice in the form. We do not keep a copy on our servers.</td></tr>
<tr><th>Trip plans</th><td>When you send a trip plan, the details you entered and the
contacts you chose are stored on our server so we can show your contacts a web page and
email them if you don't check in. Contacts receive a link that works without the app.</td></tr>
<tr><th>Trip tracking</th><td>If you turn on location sharing for a trip, your position is
sent to our server while that trip is open, and shown to the contacts holding that trip's
share link. It stops when you check in or cancel, and the trail is deleted with the trip plan.
It is off unless you turn it on for that trip.</td></tr>
<tr><th>Push notification token</th><td>If you allow notifications, an anonymous device token
is stored so the server can wake the app to refresh your saved zones. It isn't linked to a
name or an account.</td></tr>
<tr><th>Nothing else</th><td>The app makes no other outbound requests carrying personal
information.</td></tr>
</table>

<h2>Location</h2>
<p>Location is used three ways, all of them optional:</p>
<ul>
<li><strong>Setting a point</strong> — when you tap "Use current location", the app reads your
position once to fill in the coordinates and elevation of an observation. You can type
coordinates by hand or pick the spot on a map instead.</li>
<li><strong>Trip plans</strong> — a trailhead location you choose is included in the plan you
send.</li>
<li><strong>Trip tracking, only if you turn it on</strong> — when you switch on location
sharing for a trip, the app records your position while that trip is open and sends it to our
server, so the contacts you chose can see where you are and which way you were heading. It is
<strong>off unless you switch it on for that specific trip</strong>, it is not a setting that
stays on between trips, and it <strong>stops when you check in or cancel</strong>. Only people
holding that trip's share link can see it, and the trail is deleted along with the trip plan.
This is the only circumstance in which the app records where you go.</li>
</ul>

<h2>Photos and camera</h2>
<p>Photos are used only where you add them: attached to an observation you submit, or as a
profile photo in a trip plan. The app does not browse your library on its own.</p>

<h2>How long things are kept</h2>
<ul>
<li><strong>Trip plans</strong> are deleted seven days after the trip closes, including
contacts, the shared page, and any photo in it. The link stops working at the same time.</li>
<li><strong>On-device data</strong> stays until you delete it or remove the app.</li>
<li><strong>Observations</strong> are held by the National Avalanche Center under its own
policies once submitted.</li>
</ul>

<h2>Service providers</h2>
<ul>
<li><strong>Supabase</strong> — hosts the backend, the forecast cache, and trip plan records.</li>
<li><strong>Resend</strong> — sends trip plan emails to the contacts you choose.</li>
<li><strong>Expo</strong> — delivers push notifications.</li>
<li><strong>The National Avalanche Center, NOAA/NWS, and Synoptic Data</strong> — sources for
forecast and weather information shown in the app.</li>
</ul>

<h2>Children</h2>
<p>The app is not directed at children under 13 and does not knowingly collect their
information.</p>

<h2>Your choices</h2>
<ul>
<li>Decline any permission and keep using the forecast features.</li>
<li>Cancel a trip plan at any time, which closes it and starts the deletion window.</li>
<li>Clear saved observer and trip details from within the app.</li>
<li>Email <a href="mailto:${CONTACT}">${CONTACT}</a> to ask what is held about you or to
request deletion.</li>
</ul>

<h2>Safety note</h2>
<p>This app repackages publicly available avalanche and weather information. It does not
replace the source forecast, and it does not monitor your safety or contact rescuers. Always
read the original forecast from your local avalanche center before making travel decisions.</p>

<h2>Changes</h2>
<p>If this policy changes in a way that affects what we collect, the date above changes and
the new version appears here.</p>`,
);

const support = page(
  "Support",
  `<h1>Support</h1>
<p class="updated">Last updated ${UPDATED}</p>
<p class="lead">Questions, bugs, or ideas: email
<a href="mailto:${CONTACT}">${CONTACT}</a>. It reaches the person who built the app, and
you'll get a real reply.</p>

<h2>What the app does</h2>
<p><em>Whumpf</em> is the sound a collapsing weak layer makes underfoot — one of the
clearest signs the snowpack is unstable. The app puts avalanche forecasts for several zones side by side, so you can compare
destinations instead of reading one forecast at a time. It covers 92 forecast zones across 28
avalanche centers. Each zone also carries nearby weather station and SNOTEL observations and
the National Weather Service point forecast, and your favorite zones are cached for use out of
service.</p>

<h2>Common questions</h2>

<h3>Why does a zone say EXPIRED?</h3>
<p>The forecast shown is past the expiry time its center set. Centers issue on their own
schedules and some pause outside the core season. The app keeps showing the last forecast it
has, marked expired, rather than showing nothing. Tap through to the center's own page for the
current product.</p>

<h3>Does the app track my location?</h3>
<p>Only if you ask it to, and only during a trip. Location sharing is off by default and is a
choice you make per trip — it is not a setting you turn on once and forget. While it is on,
your position goes to the contacts on that trip plan and nowhere else, and it stops when you
check in. The rest of the time the app only reads your location when you tap a button asking
it to.</p>

<h3>My forecasts aren't updating in the background.</h3>
<p>iOS turns off Background App Refresh in Low Power Mode, and pauses it when the battery is
low. Check Settings, then General, then Background App Refresh. Opening the app always fetches
fresh data.</p>

<h3>What happens when I submit an observation?</h3>
<p>It goes to the National Avalanche Center and on to the relevant avalanche center, the same
as submitting on their website. You choose whether your name appears publicly. After
submitting you can save a PDF copy of what you sent.</p>

<h3>How does the trip plan feature work?</h3>
<p>You fill in a profile once, then before a trip you pick where you're going, when you expect
to be back, and when your people should worry. They get a link with everything search and
rescue asks a reporting party for, and an email reminder if you haven't checked in by your
worry-by time. The app does not contact rescuers. Your person does, with the details in hand.
Send it while you still have service.</p>

<h3>Can I delete my data?</h3>
<p>Clear saved details from within the app, cancel any live trip plan, or email
<a href="mailto:${CONTACT}">${CONTACT}</a> and it will be removed.</p>

<h2>Reporting a bug</h2>
<p>Include your iPhone model and iOS version, what you were doing, and a screenshot if you
have one. If it involves a specific zone, name it.</p>

<h2>Data sources</h2>
<p>Avalanche forecasts from the National Avalanche Center and its member centers. Weather from
NOAA/NWS, Synoptic Data, and the NRCS SNOTEL network. This app is not affiliated with or
endorsed by any avalanche center.</p>`,
);

serve((req) => {
  const url = new URL(req.url);
  const wants = url.pathname.replace(/^.*\/legal\/?/, "").replace(/\/$/, "");
  const headers = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=900",
    "X-Content-Type-Options": "nosniff",
  };
  if (wants === "support") return new Response(support, { headers });
  if (wants === "privacy" || wants === "") return new Response(privacy, { headers });
  return new Response(privacy, { status: 404, headers });
});
