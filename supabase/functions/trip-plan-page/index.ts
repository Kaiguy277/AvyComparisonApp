// The packet page a contact opens. GET ?t=<share_token>. Server-rendered
// HTML, inline CSS only, no external assets, works on any phone and prints.
// Contact actions are plain forms that POST here and are forwarded to the
// trip-plans function's contact actions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { displayStatus } from "../_shared/trip-plan-state.ts";
import {
  loadContacts,
  loadEvents,
  loadLocations,
  loadPlan,
  log,
  pageBase,
  serviceClient,
  toState,
  type ContactRowFull,
  type PlanRowFull,
} from "../_shared/trip-plan-common.ts";
import { utcToWallTime, wallTimeToUtc } from "../_shared/zoned-time.ts";

const SECURITY_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; base-uri 'none'",
};

serve(async (req) => {
  const url = new URL(req.url);
  const supabase = serviceClient();

  if (req.method === "POST") {
    // Form actions: forward to trip-plans, then re-render.
    const form = await req.formData();
    const token = String(form.get("t") ?? "");
    const action = String(form.get("action") ?? "");
    const note = String(form.get("note") ?? "").slice(0, 1000);
    const extendHours = Number(form.get("extend_hours") ?? 0);
    const extendUntil = String(form.get("extend_until") ?? "");
    const body: Record<string, unknown> = { action, share_token: token, note: note || undefined };
    const back = (m: string) =>
      Response.redirect(`${pageBase()}?t=${encodeURIComponent(token)}&m=${encodeURIComponent(m)}`, 303);
    if (action === "extend") {
      const contact = await contactByToken(supabase, token);
      const plan = contact ? await loadPlan(supabase, contact.plan_id) : null;
      if (plan) {
        const base = Math.max(Date.now(), Date.parse(plan.worry_by));
        if (extendUntil) {
          // datetime-local submits a wall-clock time with NO zone. It must be
          // read in the plan's timezone — the page labels the field with it —
          // not the runtime's, which is UTC. Reading it as UTC made every
          // "pick a time" extension land 8-9 hours early and get rejected.
          const at = wallTimeToUtc(extendUntil, plan.timezone);
          if (at === null) return back("That time didn't come through. Try picking it again.");
          body.new_worry_by = new Date(at).toISOString();
        } else if (extendHours > 0) {
          body.new_worry_by = new Date(base + extendHours * 3_600_000).toISOString();
        } else {
          // "Extend to that time" with no time picked used to resolve to the
          // current worry-by and fail as a cryptic "extend_backwards".
          return back("Pick a time, or use one of the +1 / +3 / +12 hour buttons.");
        }
      }
    }
    const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/trip-plans`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify(body),
    });
    // Show the server's sentence, not its error code. "extend_backwards" means
    // nothing to someone deciding whether their friend is missing.
    let msg = "";
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      msg = j.message
        ? `Couldn't record that: ${j.message}`
        : `Couldn't record that (${j.error ?? res.status}).`;
    }
    // Redirect to the public page URL, not the runtime's internal path.
    return Response.redirect(`${pageBase()}?t=${encodeURIComponent(token)}${msg ? `&m=${encodeURIComponent(msg)}` : ""}`, 303);
  }

  const token = url.searchParams.get("t") ?? "";
  const flash = url.searchParams.get("m") ?? "";
  if (!token) return html(404, page("Not found", "<p>This link is incomplete.</p>"));

  const contact = await contactByToken(supabase, token);
  if (!contact) return html(404, page("Not found", "<p>This trip plan link isn't valid. It may have been deleted.</p>"));
  const plan = await loadPlan(supabase, contact.plan_id);
  if (!plan || (plan.purge_after && Date.parse(plan.purge_after) <= Date.now())) {
    return html(410, page("Expired", "<p>This trip plan has expired and been deleted.</p>"));
  }

  // Record the open (throttled server-side in trip-plans; here we call it
  // directly to avoid an HTTP hop).
  const now = Date.now();
  const last = contact.last_opened_at ? Date.parse(contact.last_opened_at) : 0;
  if (now - last > 6 * 3_600_000) {
    await supabase.from("trip_plan_contacts").update({ last_opened_at: new Date(now).toISOString() }).eq("id", contact.id);
    await supabase.from("trip_plan_events").insert({ plan_id: plan.id, type: "opened", actor: "contact", contact_id: contact.id });
  }

  const contacts = await loadContacts(supabase, plan.id);
  const events = await loadEvents(supabase, plan.id, 100);
  // Only query the trail when the owner actually opted in.
  const locations = plan.tracking_enabled
    ? await loadLocations(supabase, plan.id, 200)
    : [];
  log({ fn: "trip-plan-page", plan_id: plan.id, contact_id: contact.id, status: 200 });
  return html(200, render(plan, contact, contacts, events, locations, token, flash));
});

async function contactByToken(supabase: ReturnType<typeof serviceClient>, token: string) {
  if (!token || token.length > 64) return null;
  const { data } = await supabase.from("trip_plan_contacts").select("*").eq("share_token", token).maybeSingle();
  return (data as ContactRowFull | null) ?? null;
}

function html(status: number, body: string): Response {
  return new Response(body, { status, headers: SECURITY_HEADERS });
}

// ── rendering ──────────────────────────────────────────────────────────────

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function fmt(iso: string | null | undefined, tz: string, withDate = true): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      ...(withDate ? { weekday: "short", month: "short", day: "numeric" } : {}),
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function ago(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

const CSS = `
:root{--bg:#F6EFDD;--ink:#1B1916;--muted:#5C534A;--line:#A89A82;--warn:#B25437;--ok:#2D5F95;--danger:#ED1C24}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 -apple-system,system-ui,Segoe UI,Roboto,sans-serif;padding:16px}
main{max-width:720px;margin:0 auto}h1{font-size:26px;margin:0 0 4px}h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);margin:28px 0 8px;border-bottom:1px solid var(--line);padding-bottom:4px}
.trail{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px}
.trail th{text-align:left;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:4px 8px 4px 0}
.trail td{padding:3px 8px 3px 0;border-top:1px solid rgba(128,128,128,.25);font-variant-numeric:tabular-nums}
details summary{cursor:pointer;margin-top:10px;font-size:14px}
.status{display:flex;gap:16px;flex-wrap:wrap;margin:8px 0 16px;font-size:15px}.status b{display:block;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.box{border:1.5px solid var(--ink);border-radius:12px;padding:16px;margin:12px 0}.box.warn{border-color:var(--danger);background:#fff2f0}.box.ok{border-color:var(--ok);background:#eef4fb}
.big{font-size:22px;font-weight:700}.tel{font-size:22px;font-weight:700;text-decoration:none;color:var(--ink)}
dl{display:grid;grid-template-columns:minmax(120px,1fr) 2fr;gap:6px 12px;margin:0}dt{color:var(--muted);font-size:14px}dd{margin:0;word-break:break-word}.na{color:var(--line);font-style:italic}
form{margin:10px 0}button,.btn{font:inherit;font-weight:600;padding:12px 16px;border-radius:10px;border:1.5px solid var(--ink);background:#fff;cursor:pointer;margin:4px 6px 4px 0}button.primary{background:var(--ink);color:#fff}button.danger{background:var(--danger);border-color:var(--danger);color:#fff}
textarea,input[type=datetime-local]{font:inherit;width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:#fff;margin:6px 0}
.timeline li{margin:6px 0}.small{font-size:13px;color:var(--muted)}.flash{background:#fff7d6;border:1px solid #e0c65a;padding:10px;border-radius:8px}
details summary{cursor:pointer;font-weight:600}img.photo{max-width:160px;border-radius:8px;float:right;margin:0 0 8px 12px}
@media print{button,form,.noprint{display:none}body{background:#fff}}
`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(title)}</title><style>${CSS}</style></head><body><main>${body}<p class="small" style="margin-top:32px">Sent from Whumpf · This page was shared by the person named above so you know where they are and what to do if they don't come back. It does not monitor their safety or contact rescuers.</p></main></body></html>`;
}

function row(label: string, value: unknown): string {
  const v = value === undefined || value === null || value === "" || value === false ? "" : value === true ? "Yes" : String(value);
  return `<dt>${esc(label)}</dt><dd>${v ? esc(v) : '<span class="na">not provided</span>'}</dd>`;
}

function render(
  plan: PlanRowFull,
  me: ContactRowFull,
  contacts: ContactRowFull[],
  events: Awaited<ReturnType<typeof loadEvents>>,
  locations: Awaited<ReturnType<typeof loadLocations>>,
  token: string,
  flash: string,
): string {
  // deno-lint-ignore no-explicit-any
  const d = plan.packet.draft as any;
  const tz = plan.timezone;
  const now = Date.now();
  const status = displayStatus(toState(plan), now);
  const s = d.subject ?? {};
  const g = d.gear ?? {};
  const c = d.clothingToday ?? {};
  const v = d.vehicle;
  const name = s.fullName ?? "The subject";
  const first = String(name).split(/\s+/)[0];
  const phone = s.phone ?? "";
  const nameOf = (id: string | null) => contacts.find((x) => x.id === id)?.display_name ?? "A contact";
  const lastEvent = (t: string) => events.find((e) => e.type === t);
  const tel = phone ? `<a class="tel" href="tel:${esc(phone)}">${esc(phone)}</a>` : '<span class="na">no number</span>';
  const agency = d.localAgencyPhone ? ` or the local agency at <a class="tel" href="tel:${esc(d.localAgencyPhone)}">${esc(d.localAgencyPhone)}</a>` : "";

  let action = "";
  if (plan.status === "closed") {
    const r = plan.close_reason;
    if (r === "checked_in") action = `<div class="box ok"><div class="big">${esc(first)} checked in at ${fmt(plan.closed_at, tz)}.</div><p>Trip plan closed. This page will be deleted in 7 days.</p></div>`;
    else if (r === "cancelled_by_user") action = `<div class="box ok"><div class="big">${esc(first)} cancelled this trip.</div><p>No action needed.</p></div>`;
    else if (r === "contact_heard_from") { const e = lastEvent("heard_from"); action = `<div class="box ok"><div class="big">${esc(nameOf(e?.contact_id ?? null))} heard from ${esc(first)} at ${fmt(e?.at, tz)}.</div>${e?.payload?.note ? `<p>“${esc(e.payload.note)}”</p>` : ""}<p>Nothing more to do.</p></div>`; }
    else if (r === "search_started") { const e = lastEvent("search_started"); action = `<div class="box warn"><div class="big">${esc(nameOf(e?.contact_id ?? null))} called for a search at ${fmt(e?.at, tz)}.</div>${e?.payload?.note ? `<p>“${esc(e.payload.note)}”</p>` : ""}<p><b>Keep this page open — it has everything rescuers will ask for. Stay reachable.</b></p></div>`; }
    else action = `<div class="box warn"><div class="big">This plan expired with no check-in recorded.</div><p>If you know ${esc(first)} is fine, no action is needed. If not, call <a class="tel" href="tel:911">911</a> now.</p></div>`;
  } else if (status === "overdue") {
    action = `<div class="box warn"><div class="big">${esc(first)} was due back ${esc(ago(now - Date.parse(plan.return_by)))} ago and hasn't checked in.</div>
<ol>
<li>Try their phone first: ${tel}</li>
<li>If you can't reach them: <b>call <a class="tel" href="tel:911">911</a></b>${agency} and say <i>“I'm reporting an overdue backcountry party.”</i> Then read them this page from the top.</li>
<li>Do not wait. There is no waiting period to report a missing person in Alaska.</li>
<li>Then tap <b>I've started a search</b> below so the other contacts know.</li>
</ol></div>`;
  } else {
    action = `<div class="box"><div class="big">${esc(first)} is expected back by ${fmt(plan.return_by, tz)}.</div><p>If you haven't heard from ${esc(first)} by <b>${fmt(plan.worry_by, tz)}</b>, come back to this page — it will tell you what to do. If they text you that they're running late, tap <b>Extend</b> below so nobody worries early.</p></div>`;
  }

  const actions = plan.status === "closed" ? "" : `
<h2>Actions</h2>
<div class="noprint">
<details><summary>Extend the worry-by time</summary>
<form method="post"><input type="hidden" name="t" value="${esc(token)}"><input type="hidden" name="action" value="extend">
<p>What did ${esc(first)} say, and when?</p><textarea name="note" rows="2" placeholder="Texted at 6:10: “running late, out by 9”"></textarea>
<button name="extend_hours" value="1">+1 hour</button><button name="extend_hours" value="3">+3 hours</button><button name="extend_hours" value="12">+12 hours</button>
<p class="small">Or pick a later time (${esc(tz)}):</p><input type="datetime-local" name="extend_until" value="${esc(utcToWallTime(Date.parse(plan.worry_by), tz))}" min="${esc(utcToWallTime(Date.parse(plan.worry_by), tz))}"><button type="submit" class="primary">Extend to that time</button></form></details>
<details><summary>I've heard from ${esc(first)} — they're fine</summary>
<form method="post"><input type="hidden" name="t" value="${esc(token)}"><input type="hidden" name="action" value="heard_from">
<textarea name="note" rows="2" placeholder="How and when did you hear from them?"></textarea><button type="submit" class="primary">Mark heard from — closes the plan</button></form></details>
<details><summary>I've started a search / called the Troopers</summary>
<form method="post"><input type="hidden" name="t" value="${esc(token)}"><input type="hidden" name="action" value="search_started">
<textarea name="note" rows="2" placeholder="Agency, case number, who you spoke to"></textarea><button type="submit" class="danger">Record that a search has started</button></form></details>
<details><summary>Add a note (actions taken so far)</summary>
<form method="post"><input type="hidden" name="t" value="${esc(token)}"><input type="hidden" name="action" value="note">
<textarea name="note" rows="2" placeholder="e.g. Drove to the trailhead at 8pm, truck is still there"></textarea><button type="submit">Add note</button></form></details>
</div>`;

  const f = plan.packet.forecast as { centerName?: string; zoneName?: string; issuedAt?: string | null; dangerByBand?: { upper: string | null; middle: string | null; lower: string | null } | null; problems?: string[] } | null;
  const forecast = f
    ? `<details><summary>Avalanche forecast on the trip day (for rescuers)</summary><dl>${row("Center", f.centerName)}${row("Zone", f.zoneName)}${row("Issued", f.issuedAt ? fmt(f.issuedAt, tz) : "")}${row("Danger — upper / middle / lower", f.dangerByBand ? `${f.dangerByBand.upper ?? "—"} / ${f.dangerByBand.middle ?? "—"} / ${f.dangerByBand.lower ?? "—"}` : "")}${row("Problems", (f.problems ?? []).join(", "))}</dl></details>`
    : "";

  const party = (d.party ?? []) as { name: string; phone?: string; emergencyContact?: string; vehicleNote?: string }[];
  const partyHtml = party.length
    ? party.map((p, i) => `<dl>${row(`Member ${i + 2}`, p.name)}${row("Phone", p.phone)}${row("Their emergency contact", p.emergencyContact)}${row("Vehicle", p.vehicleNote)}</dl>`).join("<hr>")
    : '<p class="na">Travelling alone (no other party members listed).</p>';

  // Today's colors win; fall back to the profile's usual colors.
  const u = g.usualColors ?? {};
  const col = (k: "shell" | "pants" | "pack" | "helmet") => c[k] || u[k];
  const fromAir = [
    col("shell") && `${col("shell")} jacket`,
    col("pants") && `${col("pants")} pants`,
    col("pack") && `${col("pack")} pack`,
    col("helmet") && `${col("helmet")} helmet`,
    g.skiOrSledColor && `${g.skiOrSledColor} skis/sled`,
    g.tentColor && `${g.tentColor} tent`,
  ].filter(Boolean).join(", ");

  const timeline = events.length
    ? `<ul class="timeline">${[...events].reverse().map((e) => `<li><b>${fmt(e.at, tz)}</b> — ${esc(describeEvent(e, nameOf))}</li>`).join("")}</ul>`
    : '<p class="na">No activity yet.</p>';

  const others = contacts.map((x) => `${x.display_name}${x.phone_e164 ? ` · ${x.phone_e164}` : ""}${x.id === me.id ? " (you)" : ""}`).join("<br>");

  // Live position. The single most useful thing on this page to someone
  // deciding whether to call it in, so it sits directly under the status
  // line rather than down with the packet detail. Coordinates are shown in
  // plain decimal degrees because that is what a dispatcher will ask for.
  let tracking = "";
  if (locations.length > 0) {
    const last = locations[0];
    const fix = `${last.lat.toFixed(5)}, ${last.lng.toFixed(5)}`;
    const age = ago(now - Date.parse(last.at));
    const acc = last.accuracy_m ? ` · ±${Math.round(last.accuracy_m)} m` : "";
    const stale = now - Date.parse(last.at) > 3 * 3_600_000;
    const maps = `https://maps.apple.com/?ll=${last.lat},${last.lng}&q=${encodeURIComponent(first + "'s last position")}`;
    const gmaps = `https://www.google.com/maps/search/?api=1&query=${last.lat},${last.lng}`;

    // Oldest-first so the trail reads as a journey out from the trailhead.
    const trail = [...locations].reverse();
    const rows = trail
      .map(
        (l) =>
          `<tr><td>${fmt(l.at, tz)}</td><td>${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}</td></tr>`,
      )
      .join("");

    tracking = `
<h2>Last known position</h2>
<div class="box${stale ? " warn" : ""}">
<div class="big">${esc(fix)}</div>
<p>Recorded ${esc(age)} ago${acc}. ${stale ? "<b>This fix is more than three hours old.</b> " : ""}Position sharing runs only while the trip is open, so it stops when ${esc(first)} checks in.</p>
<p><a href="${esc(maps)}">Open in Apple Maps</a> · <a href="${esc(gmaps)}">Open in Google Maps</a></p>
</div>
<details><summary>Route travelled (${trail.length} point${trail.length === 1 ? "" : "s"}) — read these to a dispatcher</summary>
<table class="trail"><thead><tr><th>Time</th><th>Coordinates</th></tr></thead><tbody>${rows}</tbody></table>
</details>`;
  } else if (plan.tracking_enabled) {
    tracking = `
<h2>Last known position</h2>
<div class="box"><p>${esc(first)} turned on location sharing, but no position has come through yet — that usually means no cell coverage since leaving. Positions will appear here as soon as the phone finds signal.</p></div>`;
  }

  const body = `
${flash ? `<p class="flash">${esc(flash)}</p>` : ""}
<p class="small">Shared with <b>${esc(me.display_name)}</b> · status: <b>${status.toUpperCase()}</b></p>
<h1>${esc(name)}</h1>
<div class="status"><div><b>Expected back</b>${fmt(plan.return_by, tz)}</div><div><b>Worry by</b>${fmt(plan.worry_by, tz)}</div><div><b>Area</b>${esc(d.areaName)}</div><div><b>Cell</b>${tel}</div></div>
${g.satShareUrl ? `<p><b>Satellite device:</b> ${esc(g.satDeviceType ?? "")} — <a href="${esc(g.satShareUrl)}">live share page</a>${g.satMessageAddress ? ` · message: ${esc(g.satMessageAddress)}` : ""}</p>` : ""}
${action}
${tracking}
${actions}

<h2>1. Where and when</h2>
<dl>${row("Area / zone", d.areaName)}${row("Trailhead", d.trailheadName)}${row("Trailhead coordinates", d.trailhead ? `${d.trailhead.lat}, ${d.trailhead.lng}` : "")}${row("Route / objective", d.route)}${row("Alternate plans", d.alternates)}${row("Travel mode", d.travelMode)}${row("Departed", fmt(plan.depart_at, tz))}${row("Expected back", fmt(plan.return_by, tz))}${row("Worry by", fmt(plan.worry_by, tz))}${row("Has done this trip before", d.doneBefore)}${row("Familiar with area", d.familiarWithArea)}${row("Where parked", d.parkedAt)}</dl>
${forecast}

<h2>2. Party</h2>
<dl>${row("Party size", 1 + party.length)}${row("Leader / most experienced", d.leader)}${row("Plan if separated", d.ifSeparated)}</dl>${partyHtml}

<h2>3. Vehicle</h2>
${v ? `<dl>${row("Type", v.type)}${row("Vehicle", [v.year, v.color, v.make, v.model].filter(Boolean).join(" "))}${row("Plate", v.plate ? `${v.plate}${v.plateState ? ` (${v.plateState})` : ""}` : "")}${row("Registration", v.registration)}${row("Notes", v.notes)}</dl>` : '<p class="na">No vehicle (on foot or dropped off).</p>'}

<h2>4. Description of ${esc(first)}</h2>
${s.photoDataUri ? `<img class="photo" src="${esc(s.photoDataUri)}" alt="photo of ${esc(first)}">` : ""}
<dl>${row("Age / DOB", s.dateOfBirth)}${row("Sex", s.sex)}${row("Height", s.height)}${row("Weight", s.weight)}${row("Build", s.build)}${row("Hair", s.hair)}${row("Eyes", s.eyes)}${row("Distinguishing marks", s.distinguishingMarks)}${row("As seen from the air", fromAir || g.clothingColors)}${row("Home address", s.homeAddress)}</dl>

<h2>5. Gear and comms</h2>
<dl>${row("Beacon / shovel / probe", `${g.beacon ? "beacon" : "NO beacon"}, ${g.shovel ? "shovel" : "no shovel"}, ${g.probe ? "probe" : "no probe"}${g.airbag ? ", airbag pack" : ""}`)}${row("Carrying", (g.inventory ?? []).map((k: string) => ({beacon:"beacon",shovel:"shovel",probe:"probe",airbag:"airbag",sat:"satellite device",radio:"radio",first_aid:"first aid",headlamp:"headlamp",stove:"stove/fire",overnight:"overnight kit",map:"map/GPS",helmet:"helmet",repair:"repair kit",skins:"skins",firearm:"firearm"} as Record<string,string>)[k] ?? k).join(", "))}${row("Satellite device", g.satDeviceType)}${row("Sat share page", g.satShareUrl)}${row("Sat message address", g.satMessageAddress)}${row("Radio", g.radio)}${row("Cell carrier", s.cellCarrier)}${row("Overnight gear", g.overnightGear)}${row("Food for", g.foodDays)}${row("Fire / stove", g.fireAndStove)}${row("Navigation", g.navigation)}${row("Skis / board / sled", [g.skiOrSledColor, g.skiOrSledDescription].filter(Boolean).join(" — "))}${row("Firearm", g.firearm)}${row("Other", g.other)}</dl>

<h2>6. Health</h2>
<dl>${row("Medical conditions", s.medicalConditions)}${row("Medications", s.medications)}${row("Allergies", s.allergies)}${row("Eyesight", s.eyesightNote)}</dl>

<h2>7. Experience</h2>
<dl>${row("Level", s.experienceLevel)}${row("Avalanche training", s.avalancheTraining)}${row("Can survive a night out", d.overnightCapable ?? s.overnightCapable)}${row("Goes out alone", s.goesOutAlone)}</dl>

<h2>8. People who know about this trip</h2>
<p>${others}</p>${d.othersWhoKnow ? `<p>${esc(d.othersWhoKnow)}</p>` : ""}${d.notes ? `<p><b>Notes:</b> ${esc(d.notes)}</p>` : ""}

<h2>9. Timeline</h2>
${timeline}
<p class="small noprint">Tip: use your browser's Print / Save as PDF so you can read from paper if your phone dies.</p>`;

  return page(`Where ${name} is — ${d.areaName}`, body);
}

function describeEvent(
  e: { type: string; actor: string; contact_id: string | null; payload: Record<string, unknown> },
  nameOf: (id: string | null) => string,
): string {
  const who = e.actor === "contact" ? nameOf(e.contact_id) : e.actor === "user" ? "The subject" : "System";
  const note = e.payload?.note ? ` — “${e.payload.note}”` : "";
  switch (e.type) {
    case "created": return "Plan created.";
    case "opened": return `${who} opened this page.`;
    case "nudge_sent": return `Reminder (${e.payload?.template ?? "nudge"}) emailed to ${nameOf(e.contact_id)}.`;
    case "extended": return `${who} extended the worry-by time${note}.`;
    case "heard_from": return `${who} heard from the subject${note}.`;
    case "search_started": return `${who} recorded that a search has started${note}.`;
    case "checked_in": return e.payload?.late ? "The subject's phone checked in (after the plan was closed)." : "The subject checked in.";
    case "cancelled": return "The subject cancelled the plan.";
    case "note": return `${who}: ${e.payload?.note ?? ""}`;
    default: return e.type;
  }
}
