# Trip Plan ("Tell a loved one") Feature Specification

Status: Draft v1 — 2026-09-09
Purpose: Let a backcountry user pre-enter everything a search-and-rescue incident
commander asks for, hand it to one or more trusted contacts with a return time and a
worry-by time, and make sure those contacts are nudged, with the full packet in hand,
if the user does not check in.

Decisions captured in the 2026-09-09 spec session with Kai are marked **[decided]**.
Everything else is the author's proposal and is open to change.

---

## 1. Problem Statement

Backcountry users in Alaska leave a trip plan verbally, in a text, or not at all. When a
party is overdue, the person at home has to reconstruct the vehicle, trailhead, route,
party, gear, and medical picture from memory while on the phone with 911, and every
missing detail costs the incident commander (IC) time in the first hour, when a search
is most likely to succeed. The Alaska State Troopers publish a one-page Wilderness Trip
Plan and ask the public to fill it out and leave it with someone; almost nobody does.

The Trip Plan feature is the in-app version of that form, built around the fact that
the user's phone will be out of service for the whole trip.

It solves these operational problems:

- **The plan never gets written.** Prefill from a saved profile (person, vehicle, gear,
  favorite areas) reduces a plan to: pick area, set times, pick contacts, send.
- **The contact has nothing in hand when it matters.** The packet is a web page the
  contact can open on any phone, with no app, containing every field the Troopers and
  the Lost Person Questionnaire ask for, in the order an IC asks for them.
- **Nobody notices the deadline.** The server, not the phone, watches the worry-by time
  and nudges every contact if there is no check-in.
- **Contacts act in isolation.** With several contacts, whoever hears from the user or
  calls the Troopers first can record it, and every other contact is told.
- **"Running late" has no path.** A contact who gets a one-bar text from the user can
  extend the worry-by time from the packet page.

### 1.1 Important boundary

The feature does **not**:

- Contact SAR, 911, or the Alaska State Troopers itself. The contact makes that call.
  The packet tells them exactly what to say and whom to call.
- Track the user's live location. There is no location sharing; the user's phone is
  assumed to be unreachable from departure to return.
- Replace an avalanche beacon, a satellite messenger, or a PLB. Satellite-device details
  are *recorded* in the packet so SAR can use them; the app never talks to the device.
- Guarantee delivery. Every channel (Messages, email, push, later SMS) is best-effort;
  the design layers channels so that a single failure is not silent.

---

## 2. Goals and Non-Goals

### 2.1 Goals

- A user with a saved profile can create and send a complete plan in under 60 seconds.
- A user with no account and no saved profile can still create and send a plan **[decided]**.
- The packet is a superset of the Alaska State Troopers Wilderness Trip Plan and of the
  AK DPS "information to provide when reporting" list, and covers the trip-relevant
  sections of the standard Lost Person Questionnaire (see Section 5).
- A plan has one or more contacts **[decided]**. Each receives the packet link at
  creation and every nudge and status change afterward.
- The worry-by alarm lives on the server **[decided]**; it fires if no check-in arrives,
  independent of the user's phone.
- Delivery in v1 is the iOS share sheet for the initial packet plus a server-sent email
  nudge and a push to contacts who have the app **[decided]**. SMS via Twilio is added
  without client changes once the number is registered.
- The user's "I'm back" check-in works offline: it queues and sends on first reconnect
  **[decided]**.
- A contact can extend the worry-by time from the packet page **[decided]**.
- A contact can record "I've heard from them" and "I've started a search"; every other
  contact is notified **[decided]**.
- Plans are deleted 7 days after they close **[decided]**; the share link dies with them.
- Satellite-messenger share-page URL and message address are plain packet fields
  **[decided]**.
- An account (optional) prefills person, vehicle, gear, party, and favorite areas
  **[decided]**.

### 2.2 Non-Goals (v1)

- Live location, breadcrumbs, or track import from Garmin or others.
- Automatic check-in on reconnect (a user with one bar who is hurt must not cancel their
  own alarm).
- Two-sided free editing of a sent plan. The user edits before sending; after that only
  check-in, extend, and status events exist.
- Trip history as a feature. Retention is a safety window, not an archive.
- Group plans authored collaboratively by several app users.
- Android. The app is iPhone-first; the packet page is platform-neutral by design.
- Escalation to agencies. The packet ends the chain at the human contact.

---

## 3. System Overview

### 3.1 Main components

1. `TripPlanComposer` (app, expo-router screens under `app/trip/`)
   - Multi-step form: Where & when → Who's going → Vehicle → Gear & comms → Contacts →
     Review & send.
   - Prefills from `ProfileVault`; every prefilled field is editable per plan.
   - Produces a validated `TripPlanDraft` (zod) and hands it to `TripPlanStore`.
2. `TripPlanStore` (app, `lib/tripPlan/`)
   - Local persistence of the active plan, the draft, and an **outbox** of pending
     server actions (create, check-in, cancel) keyed for idempotent replay.
   - Flushes the outbox on app foreground and on NetInfo reconnect.
3. `ProfileVault` (app + server)
   - Anonymous mode: profile blocks in AsyncStorage (non-sensitive) and SecureStore
     (medical, home address).
   - Account mode: the same blocks synced to Postgres under Supabase Auth, RLS
     `auth.uid()`.
4. `trip-plans` (edge function, JSON API)
   - `create`, `check_in`, `cancel`, `extend`, `contact_action`, `get_status`.
   - Authenticates user actions with a per-plan secret and contact actions with a
     per-contact share token (Section 8).
5. `trip-plan-page` (edge function, HTML)
   - Server-renders the packet for a share token. No JS framework; works on any phone.
   - Hosts the contact actions as plain forms posting to `trip-plans`.
6. `trip-plan-sweeper` (pg_cron → edge function every 5 minutes)
   - Finds active plans past `worry_by` with unsent nudges, sends them, records them.
   - Purges closed plans older than 7 days.
7. `Notifier` (edge `_shared/notify.ts`)
   - Adapters: `email` (Resend, v1), `push` (existing `device_tokens` + APNs path),
     `sms` (Twilio, post-v1). Fan-out to all contacts of a plan for a given event.

### 3.2 Layers

| Layer | Concern | Lives in |
|---|---|---|
| UI | screens, share sheet, contact picker | `app/trip/*`, `components/trip/*` |
| Domain | schema, packet field list, state machine, formatting | `lib/tripPlan/schema.ts`, `packet.ts`, `state.ts` |
| Sync | outbox, retry, idempotency | `lib/tripPlan/outbox.ts` |
| Server API | validation, auth, state transitions | `supabase/functions/trip-plans` |
| Presentation (web) | packet HTML, contact actions | `supabase/functions/trip-plan-page` |
| Scheduling | overdue sweep, retention purge | pg_cron + `trip-plan-sweeper` |
| Notification | channel adapters, templates | `supabase/functions/_shared/notify.ts` |
| Storage | tables, RLS, secrets | `supabase/migrations/2026MMDD_trip_plans.sql` |

### 3.3 External dependencies

- Supabase: Postgres, edge functions (Deno), pg_cron, `pg_net` (already used by the
  refresh cron), Supabase Auth (account mode only).
- Resend (email nudges). Not yet provisioned for this project; the AK RFP Hub project
  already uses it, so the pattern is known.
- Twilio (SMS, post-v1). Requires A2P 10DLC registration; start it now **[decided]**.
- iOS share sheet (`expo-sharing` / `Share` API), `expo-contacts` (contact picker),
  `expo-secure-store`, `@react-native-community/netinfo` (already a dependency),
  `expo-notifications` (already), `expo-location` (already, for the "where I am now"
  pin).
- Existing forecast cache (`forecast_cache`) for the danger snapshot in the packet.
- Existing `function_secrets` table and `x-cron-key` gate for the sweeper.

---

## 4. Core Domain Model

All timestamps are stored as UTC ISO-8601 with a separate IANA timezone field for
display. All identifiers are UUIDv4 unless stated.

### 4.1 `TripPlan`

One trip, from creation to close.

Fields:
- `id` (uuid) — primary key.
- `status` (enum) — `active | overdue | closed`. See Section 6.
- `close_reason` (enum, nullable) — `checked_in | cancelled_by_user | contact_heard_from |
  search_started | expired`. Null while not closed.
- `owner_user_id` (uuid, nullable) — Supabase Auth user in account mode; null in
  anonymous mode.
- `owner_device_id` (text) — random per-install id; identifies the anonymous owner.
- `plan_secret_hash` (text) — SHA-256 of the per-plan secret the client holds. User
  actions must present the secret.
- `timezone` (text) — IANA zone of the trip, default `America/Anchorage`.
- `depart_at` (timestamptz) — planned departure.
- `return_by` (timestamptz) — planned return, shown to contacts as "expected back".
- `worry_by` (timestamptz) — when the server starts nudging. Must be ≥ `return_by`.
  Default proposal: `return_by + 3h` (the drive out plus a stop).
- `worry_by_original` (timestamptz) — value at creation; extensions do not overwrite it.
- `packet` (jsonb) — the frozen `PacketSnapshot` (Section 4.7). Written once at create.
- `nudge_1_sent_at`, `nudge_2_sent_at` (timestamptz, nullable).
- `created_at`, `closed_at` (timestamptz).
- `purge_after` (timestamptz, nullable) — `closed_at + 7 days`.

### 4.2 `PlanContact`

One trusted person attached to one plan.

Fields:
- `id` (uuid).
- `plan_id` (uuid, FK, cascade delete).
- `display_name` (text) — as the user typed or picked it.
- `phone_e164` (text, nullable) — normalized; required once SMS ships.
- `email` (text, nullable) — required in v1 because email is the nudge channel.
  Normalized trim + lowercase.
- `share_token_hash` (text) — SHA-256 of the 128-bit URL token for this contact.
  Per-contact tokens let the page say who did what.
- `app_device_id` (text, nullable) — set if the contact is a known app install
  (matched by phone/email opt-in, post-v1); enables push.
- `last_opened_at` (timestamptz, nullable) — first-open receipt is shown to the user.
- `created_at`.

### 4.3 `PlanEvent`

Append-only log of everything that happened to a plan. The packet page's timeline and
the fan-out logic both read from it.

Fields:
- `id` (bigserial).
- `plan_id` (uuid, FK).
- `type` (enum) — `created | sent_via_share | opened | nudge_sent | extended |
  heard_from | search_started | checked_in | cancelled | closed | purge_scheduled`.
- `actor` (enum) — `user | contact | system`.
- `contact_id` (uuid, nullable) — for contact-actor events.
- `payload` (jsonb) — e.g. `{ "new_worry_by": "...", "note": "text from Kai 6:10pm" }`.
- `at` (timestamptz).

### 4.4 `SubjectProfile` (client-side block; server copy only in account mode)

The user as SAR needs to know them. Prefills the packet's Person section.

Fields:
- `full_name` (text), `date_of_birth` (date), `sex` (text, free), `phone_e164` (text).
- `home_address` (text) — SecureStore.
- `height`, `weight`, `build`, `hair`, `eyes`, `distinguishing_marks` (text, nullable).
- `photo_uri` (text, nullable) — local; uploaded into the packet at create.
- `medical_conditions`, `medications`, `allergies` (text, nullable) — SecureStore.
- `eyesight_note` (text, nullable) — e.g. "contacts, spares in pack".
- `experience_level` (enum) — `novice | intermediate | advanced | professional`.
- `avalanche_training` (text, nullable) — e.g. "AIARE 1 2024".
- `overnight_capable` (bool) — can they survive a night out with what they carry.
- `usual_partners` (text, nullable).

### 4.5 `VehicleProfile`

Fields:
- `id` (uuid) — a user may save several (truck, sled trailer).
- `label` (text) — "Tacoma".
- `type` (enum) — `car | truck | snowmachine | trailer | airplane | boat | other`.
- `make`, `model`, `year`, `color`, `plate`, `plate_state` (text; plate nullable).
- `notes` (text, nullable) — "rack, black topper".

### 4.6 `GearProfile`

Fields (all nullable unless noted):
- `beacon` (bool, default true), `shovel` (bool), `probe` (bool), `airbag` (bool).
- `sat_device_type` (text) — "inReach Mini 2".
- `sat_share_url` (text) — public MapShare page **[decided]**.
- `sat_message_address` (text) — inReach email/SMS address **[decided]**.
- `radio` (text) — "BCA Link 2.0, ch 1".
- `overnight_gear` (text) — "bivy, stove, 1 day food".
- `clothing_colors` (text) — "red shell, black pants, orange pack".
- `tent_color` (text).
- `ski_or_sled_description` (text) — "orange Skidoo Summit 850, reg AK1234AB" or
  "white Blizzard skis, black skins".
- `firearm` (text).
- `other` (text).

### 4.7 `PacketSnapshot`

The frozen JSON stored on the plan and rendered by the page. Built client-side from the
profile blocks plus per-plan fields, validated server-side. Field list is Section 5.

### 4.8 `PartyMember`

Fields: `name` (text), `phone_e164` (text, nullable), `emergency_contact` (text,
nullable), `vehicle_note` (text, nullable), `is_app_user` (bool). Stored inside the
packet, not as a table, in v1.

### 4.9 `OutboxEntry` (client only)

Fields: `id` (uuid, also the idempotency key), `action` (`create | check_in | cancel`),
`plan_id`, `body` (json), `attempts` (int), `next_attempt_at`, `created_at`.

### 4.10 Normalization rules

- Phone numbers are stored E.164. Parse with `libphonenumber-js` using default region
  `US`; a number that fails to parse is rejected at the form with a message, never
  stored raw.
- Emails: trim, lowercase, must match a permissive RFC-5322 shape; rejected otherwise.
- Times: the form captures local wall-clock in the plan's `timezone`; the client
  converts to UTC once, at draft validation. Invariant: `depart_at < return_by ≤
  worry_by`. `worry_by - return_by ≤ 48h` (guards a typo like the wrong day).
- Text fields: trim; collapse runs of whitespace; max 2,000 chars each; packet JSON max
  64 KB; photo max 1 MB after client resize (1024 px long edge, JPEG 0.8).
- Tokens: 16 random bytes → base64url (22 chars). Only SHA-256 hashes are stored.
  Comparison is constant-time on the hash.
- Idempotency: `create` is keyed by client-generated `plan_id`; `check_in` and `cancel`
  by `(plan_id, action)`. Replays return the current plan state with 200, never 409.

---

## 5. The Packet

### 5.1 Sources

The packet field set is the union of three references, verified 2026-09-09:

1. **Alaska State Troopers Wilderness Trip Plan** (dps.alaska.gov, April 2026 PDF) —
   the form Troopers ask the public to leave with someone. Fields: name, DOB, address,
   phone; leave/return dates; travel mode; vehicle description; place and route; gear
   checklist (map, compass, GPS, VHF, tent + color, sleeping bag, flashlight, batteries,
   food for N days, fuel, matches, extra clothing, gun type/caliber, cell number,
   other); other people who know about the trip; "call the Troopers if I don't return
   by ___ o'clock on ___"; agency phone numbers.
2. **AK DPS "information to provide when reporting":** full name/age/description;
   clothing and gear; last known location and time; travel plans, route, destination;
   experience level; vehicle/plate/aircraft/vessel; medical conditions and medications.
3. **Lost Person Questionnaire (long form, Latah SAR Council, ICS-style)** — what an IC
   or investigator asks the reporting party. The trip-relevant sections are C (subject),
   D (physical description), E (plans: start, destination, via, expected return, group
   size, done trip before, vehicle + location + plate, alternative routes, who it was
   discussed with), F (clothing incl. "overall coloration as seen from the air", last
   seen when/where, direction of travel), G (experience: familiar with area, training,
   overnight experience, goes out alone), I (health, meds and consequences of lack,
   eyesight), J (equipment incl. skis/snowmobile description, radio, fire, food,
   navigation competency), K (contacts the subject would make on reaching civilization),
   M (group overdue: leader, experience, actions if separated), N (actions taken so far).

Sections H (habits/personality), L (lost child), and O (media/family) are left to the
interview; they are either not knowable in advance or inappropriate to pre-collect.

### 5.2 Packet fields, in the order the page renders them

The order is the order an IC asks. Required-for-send fields are marked **R**; the rest
are shown on the page as "not provided" when empty so the IC knows it was not merely
omitted from the page.

**Header (always visible, above the fold)**
- Subject full name **R**, age (from DOB), photo if provided.
- Status line: `Expected back <return_by local>` · `Worry by <worry_by local>` ·
  current plan status and time since worry-by if overdue.
- Big "What to do now" block (Section 9.2).
- Subject's cell number **R**; satellite device share URL and message address if set.

**1. Where and when**
- Zone / area name **R** (from the zone catalogue or free text), trailhead name **R**,
  trailhead coordinates (from map pin or GPS; decimal degrees, 5 dp) **R when pin set**.
- Objective / route description **R** (free text, prompt: "peak, drainage, loop, where
  you'll park").
- Alternate plans (free text).
- Departure **R**, expected return **R**, worry-by **R**, all local with zone shown.
- Travel mode **R** (`ski | splitboard | snowmachine | snowshoe | foot | mixed | other`).
- Has done this trip before (bool). Familiar with area (bool).
- Forecast snapshot for the zone on the depart date: danger by elevation band, listed
  problems, issued-at, center name. Pulled from `forecast_cache` at create; "not
  available" if the zone has no forecast.

**2. Party**
- Party size **R** (≥1). For each member: name **R**, phone, emergency contact,
  separate vehicle note. Subject is member 1.
- Leader / most experienced (name). Plan if separated (free text).

**3. Vehicle**
- Type **R**, make/model/year/color **R when type ≠ foot**, plate + state, where parked
  (free text; defaults to the trailhead), snowmachine registration if applicable,
  trailer description.

**4. Description of the subject**
- Height, weight, build, hair, eyes, distinguishing marks.
- Clothing today: shell color, pants color, pack color, helmet color — "as seen from the
  air" one-liner is composed from these.
- Tent / bivy color if carried.

**5. Gear and comms**
- Beacon (Y/N) **R**, shovel, probe, airbag.
- Satellite device: type, share URL, message address.
- Radio and channel. Cell carrier (helps SAR request a ping).
- Overnight capability: gear list, food for N days, fuel, fire.
- Navigation: map/GPS/compass, competency note.
- Skis/board/sled description. Firearm.

**6. Health**
- Medical conditions, medications (and consequence of missing a dose), allergies,
  eyesight note. Rendered from SecureStore-backed profile blocks; see Section 15.

**7. Experience**
- Level, avalanche training, overnight experience, goes out alone (bool).

**8. People who know about this trip**
- The plan's contacts (name + phone/email), plus any free-text "others who know".
- Contacts the subject would call on reaching town (from LPQ section K): defaults to
  contact 1.

**9. Timeline (live)**
- Every `PlanEvent` in order: sent, opened by whom, nudges, extensions, heard-from,
  search started, checked in.

**10. Actions taken so far**
- A free-text field on the page that any contact can append to (stored as
  `heard_from`/note events), so the reporting party can tell the IC what has already
  been done.

### 5.3 Completeness score

The Review step shows a completeness bar computed as `filled_weighted / total_weighted`
with weights: header and section 1 fields ×3, party/vehicle ×2, everything else ×1. The
user can send at any score above the **R** threshold; the score exists to nudge, not
block. The score is also shown on the packet page header so the IC knows what to ask
the reporting party for.

---

## 6. Plan Lifecycle (state machine)

### 6.1 States

- `active` — created, before `worry_by`.
- `overdue` — `now ≥ worry_by` and no closing event. Set by the sweeper, not by the
  client (the client may be offline; the page derives it from time anyway).
- `closed` — terminal, with `close_reason`.

### 6.2 Transitions

| From | Event | To | Actor | Side effects |
|---|---|---|---|---|
| — | `create` | `active` | user | mint tokens, snapshot packet, event `created` |
| `active` | `sent_via_share` | `active` | user | event only (client reports the share sheet completed) |
| `active`/`overdue` | `opened` | same | contact | `last_opened_at`, event; user push "Alex opened your plan" |
| `active`/`overdue` | `extend(new_worry_by)` | same, `overdue`→`active` if new time is in the future | contact or user | event; notify all contacts |
| `active` | sweeper finds `now ≥ worry_by` | `overdue` | system | nudge 1 to all contacts |
| `overdue` | sweeper finds `now ≥ nudge_1_sent_at + 60m` and no nudge 2 | `overdue` | system | nudge 2 |
| `active`/`overdue` | `check_in` | `closed(checked_in)` | user | notify all contacts "checked in"; `purge_after` |
| `active` | `cancel` | `closed(cancelled_by_user)` | user | notify all contacts "trip cancelled" |
| `active`/`overdue` | `heard_from(note)` | `closed(contact_heard_from)` | contact | notify all contacts + user push |
| `active`/`overdue` | `search_started(note)` | `closed(search_started)` | contact | notify all contacts + user push; page switches to "search in progress" mode and stays readable |
| `overdue` | `worry_by + 72h` with no action | `closed(expired)` | system | final email to contacts "no check-in was ever recorded"; `purge_after` |

`closed` accepts no further transitions except `purge`. A `check_in` arriving after
`search_started` is recorded as an event and notifies everyone ("Kai's phone reported a
check-in at 21:40") but does not reopen or re-close the plan; a human already owns the
situation.

### 6.3 Idempotency

- `create` with an existing `plan_id` returns the existing plan (200) if the secret
  matches, 403 otherwise.
- `check_in`/`cancel` on a closed plan return 200 with the current state and record a
  `checked_in`/`cancelled` event flagged `late: true` if the plan is already closed.
- `extend` to a time earlier than the current `worry_by` is rejected (400
  `extend_backwards`); contacts can only buy time, never shorten it.
- Contact actions on a purged plan return 410 and the page renders "This plan has
  expired and been deleted."

### 6.4 Only one active plan per owner

A device or account may have at most one plan in `active`/`overdue`. Creating a new one
while one exists prompts: "You have an active plan for Turnagain Pass until 6 PM. Check
in on that one first, or cancel it." This prevents a stale plan from firing after the
user has clearly moved on, and keeps the home-screen card unambiguous.

---

## 7. Client: Composer, Store, Outbox

### 7.1 Entry points

- Home screen: a persistent "Trip plan" card. No plan → "Tell someone where you're
  going." Active plan → area, expected back, worry-by, contacts' open receipts, and a
  large **I'm back** button. Overdue (derived from time locally) → same card in the
  warning color with "Your contacts were nudged at 6:00 PM" if the app knows.
- Zone screen: "Plan a trip here" prefills the area and today's forecast snapshot.
- iOS Lock Screen / Live Activity: out of scope for v1; noted as an extension.

### 7.2 Composer steps and validation

Each step validates its slice on Next; the Review step validates the merged draft with
the full zod schema (the same lesson as observation B15). The schema lives in
`lib/tripPlan/schema.ts` and is shared with the server via the `_shared` copy plus a
drift test, mirroring the zone-catalogue guard.

Step order and prefill sources:

1. Where & when — area (favorites first, then catalogue, then "custom"), trailhead
   (map pin, GPS "use my location", or text), route, alternates, times. Times default to
   depart = now rounded up to 15 min, return = depart + 8h, worry = return + 3h.
2. Party — subject prefilled; add members from contacts or typed.
3. Vehicle — saved vehicles as chips; "on foot / dropped off" option.
4. Gear & comms — saved gear profile with today's clothing colors editable.
5. Contacts — from `expo-contacts` picker or typed; each needs email (v1) and phone.
   Minimum 1, maximum 5.
6. Review & send — completeness bar, full packet preview identical to the page, a
   consent line ("Your contacts will receive a link to everything above"), **Send**.

### 7.3 Send sequence

```
1. validate merged draft → PacketSnapshot
2. plan_id = uuid(); plan_secret = random(16B); persist locally (SecureStore for the secret)
3. enqueue outbox create {plan_id, secret_hash, packet, contacts, times}
4. flush outbox now (online) → server returns {plan, contacts:[{id, share_url}]}
5. present iOS share sheet with the per-contact link + a short text
   ("Kai's trip plan: Turnagain Pass, back by 6 PM. If you haven't heard by 9 PM,
   open this: <url>"). One share per contact (loop), or one combined message if the
   user picks "send one text to everyone" (links are per contact; the message
   contains all).
6. report sent_via_share events for the contacts shared
7. show the active-plan card
```

If step 4 fails (offline at the trailhead), the plan is saved locally as `pending` and
the card says "Not sent yet — you're offline. Connect to send." The share sheet is not
offered until the server has minted links, because the links do not exist yet. This is
the one place the feature is honest about needing signal: create the plan **at home**.
The composer says so on the first screen.

### 7.4 Check-in

**I'm back** → confirmation sheet ("Tell Alex and Jordan you're back safe?") →
enqueue `check_in` → flush. Offline: the card shows "Check-in queued — will send when
you have signal" and the outbox flushes on NetInfo reconnect and on foreground. Local
notification 10 minutes later if still unsent: "Your check-in hasn't sent yet."

### 7.5 Outbox

- Storage: AsyncStorage key `avy-tripplan-outbox-v1`, array of `OutboxEntry`.
- Flush triggers: app foreground, NetInfo `isInternetReachable` → true, after any
  enqueue, and a 60 s timer while the app is foregrounded and entries exist.
- Retry: exponential backoff 5 s, 15 s, 45 s, 2 m, 5 m, cap 15 m; unlimited attempts
  for `check_in` (it must eventually land); `create` gives up after 24 h and marks the
  local plan `failed` with a visible error.
- Serialized: one flush at a time, entries in FIFO order; a `check_in` for a plan whose
  `create` is still pending waits behind it.
- Idempotency keys are the entry ids; the server dedupes.

### 7.6 Local persistence

- `avy-tripplan-active-v1` (AsyncStorage): the active plan summary (id, times, area,
  contacts' names, status, share urls).
- `avy-tripplan-secret-<plan_id>` (SecureStore): the plan secret.
- `avy-tripplan-profile-v1` (AsyncStorage) + `avy-tripplan-profile-secure-v1`
  (SecureStore): profile blocks in anonymous mode.
- `avy-tripplan-draft-v1`: the in-progress composer draft (survives backgrounding).

---

## 8. Server API: `trip-plans` edge function

Single function, `action` discriminator in the JSON body, POST only. CORS as the other
functions (Section: Tier 2 cleanup). Uses the anon key for transport; authorization is
by secret/token as below. Rate limited per IP via a small `rate_limits` table: 30
requests per 5 minutes per IP for `contact_action`, 10 per minute for `create`.

### 8.1 Authentication

- **User actions** (`create`, `check_in`, `cancel`, `get_status`, `extend` by user):
  body includes `plan_id` and `plan_secret`; server compares `sha256(plan_secret)` to
  `plan_secret_hash` in constant time. Account mode additionally accepts a Supabase JWT
  and matches `owner_user_id`; either credential suffices.
- **Contact actions** (`opened`, `extend`, `heard_from`, `search_started`, `note`):
  body includes `share_token`; server hashes and looks up the `PlanContact`.
- **System** (`sweep`, `purge`): `x-cron-key` header checked against `function_secrets`,
  same gate as `send-snapshot-pushes`.

### 8.2 Messages

`create`:
```json
{
  "action": "create",
  "plan_id": "0b9c…",
  "plan_secret": "k3…22chars",
  "owner_device_id": "d-…",
  "timezone": "America/Anchorage",
  "depart_at": "2026-12-06T17:00:00Z",
  "return_by": "2026-12-07T03:00:00Z",
  "worry_by": "2026-12-07T06:00:00Z",
  "contacts": [
    { "display_name": "Alex", "phone_e164": "+19075550100", "email": "alex@example.com" }
  ],
  "packet": { "...PacketSnapshot..." },
  "photo_base64": null
}
```
Response 201:
```json
{
  "plan": { "id": "0b9c…", "status": "active", "worry_by": "…" },
  "contacts": [
    { "id": "c1…", "display_name": "Alex", "share_url": "https://<host>/functions/v1/trip-plan-page?t=…" }
  ]
}
```

`check_in` / `cancel`:
```json
{ "action": "check_in", "plan_id": "0b9c…", "plan_secret": "…", "client_at": "2026-12-07T02:41:00Z", "idempotency_key": "e7…" }
```
Response 200: `{ "plan": { "status": "closed", "close_reason": "checked_in", "closed_at": "…" }, "late": false }`.

`extend` (contact):
```json
{ "action": "extend", "share_token": "…", "new_worry_by": "2026-12-07T08:00:00Z", "note": "Kai texted 'running late, out by 10' at 6:12" }
```
Response 200: `{ "plan": { "status": "active", "worry_by": "…" } }`.

`contact_action`:
```json
{ "action": "heard_from" | "search_started" | "note" | "opened", "share_token": "…", "note": "Called AST Palmer post, case #…" }
```

`get_status` (user, polled by the card on foreground): returns plan, contacts with
`last_opened_at`, and the last 20 events.

### 8.3 Validation and error surface

| Error class | HTTP | Caller effect | System effect |
|---|---|---|---|
| `invalid_body` (zod) | 400 | show field error; do not retry | none |
| `invalid_times` | 400 | same | none |
| `unauthorized` | 403 | drop the outbox entry; surface "This plan is no longer yours" | log |
| `plan_not_found` | 404 | drop entry; clear local plan | log |
| `plan_gone` | 410 | page shows expired notice | none |
| `extend_backwards` | 400 | page shows message | none |
| `rate_limited` | 429 | outbox backs off; page shows "try again" | log |
| `notify_failed` | 200 with `warnings[]` | user card shows "Email to Alex failed — share the link another way" | event `nudge_failed`, retried by sweeper |
| `internal` | 500 | outbox retries | log with plan_id only |

Notification failure never fails the action that caused it. The state transition
commits first, notifications run after, and failures are recorded as events for the
sweeper to retry (up to 3 attempts, 10 minutes apart).

---

## 9. Packet page: `trip-plan-page`

### 9.1 Rendering

- `GET /trip-plan-page?t=<share_token>`. Looks up the contact by token hash, loads the
  plan, renders HTML with inline CSS only (no external assets, works on a weak
  connection and in an SMS preview). Sets `noindex, nofollow`, `Cache-Control:
  no-store`, `Referrer-Policy: no-referrer`.
- First render for a contact records `opened` (once per contact per 6 hours to avoid
  spamming the user's push).
- The page shows the header, the "What to do now" block, then Sections 1–10 in order,
  then a "Print / save as PDF" hint (native browser print) so the reporting party can
  read from paper if their phone dies.
- Photo served from the same function via `?t=…&photo=1`, not from a public bucket.
- Status is computed from `now` versus `worry_by` server-side at render time, so the
  page is correct even if the sweeper is late.

### 9.2 "What to do now" block (copy is part of the spec)

Before worry-by:
> Kai is expected back by **6:00 PM**. If you haven't heard from them by **9:00 PM**,
> this page will tell you what to do. If they text you they're running late, tap
> **Extend** below so nobody worries early.

Overdue:
> Kai was due back **3 hours ago** and hasn't checked in. Try their phone first:
> **(907) 555-0100**. If you can't reach them: **call 911** (or the nearest Alaska
> State Troopers post) and say *"I'm reporting an overdue backcountry party"* — then
> read them this page from the top. Do not wait; there is no waiting period to report
> a missing person in Alaska. Then tap **I've started a search** so the other contacts
> know.

After `heard_from`:
> **Alex heard from Kai at 9:40 PM** ("texted from Girdwood"). Nothing more to do.

After `search_started`:
> **Jordan called the Troopers at 10:15 PM** (note: "AST Palmer, case 26-1234"). Keep
> this page open; it has everything they will ask for. Stay reachable.

After `checked_in`:
> Kai checked in at 8:05 PM. This page will be deleted in 7 days.

The Troopers' phone line is `911` plus a per-plan optional "local agency number" field
the user can fill (mirrors the AK form). The app does not hardcode post numbers.

### 9.3 Contact actions (plain HTML forms)

- **Extend**: quick picks +1h, +3h, "until tomorrow 9 AM", or a datetime input; optional
  note ("what did they say, and when"). Posts `extend`.
- **I've heard from them**: note required-ish (prompt "what did they say, when, how");
  posts `heard_from`. Closes the plan. All contacts notified.
- **I've started a search**: note (agency, case number); posts `search_started`. Closes
  the plan into search mode. All contacts notified.
- **Add a note**: appends to the "Actions taken so far" timeline. Does not change state.
- Every action re-renders the page with the new timeline; no JS needed. Progressive JS
  adds a confirm dialog and copies the phone number.

### 9.4 Token semantics

- One token per contact, 22-char base64url, only the hash stored.
- A token is valid until `purge_after`. There is no revocation in v1 beyond cancel/purge.
- Token in the URL query, not the path, so that a forwarded link still works but the
  page warns: "This link was made for Alex. If you're someone else, you can still read
  it; actions will be recorded under Alex's name."

---

## 10. Sweeper and Notifications

### 10.1 Schedule

pg_cron job `trip_plan_sweep`, `*/5 * * * *`, `net.http_post` to `trip-plan-sweeper`
with `x-cron-key` from `function_secrets` (same DO-block pattern as the forecast
refresh jobs, so the secret never enters SQL text). Second job `trip_plan_purge`,
daily 09:00 UTC.

### 10.2 Sweep algorithm

```
function sweep(now):
  for plan in plans where status in (active, overdue) and worry_by <= now:
    if plan.status == active:
      set status = overdue
      send_nudge(plan, 1); set nudge_1_sent_at = now
    else if plan.nudge_2_sent_at is null and now >= plan.nudge_1_sent_at + 60min:
      send_nudge(plan, 2); set nudge_2_sent_at = now
    else if now >= plan.worry_by + 72h:
      close(plan, expired); notify_all(plan, "expired")
  for event in events where type = nudge_failed and attempts < 3 and next_attempt <= now:
    retry_notify(event)
```

Each plan is processed inside a transaction with `SELECT … FOR UPDATE SKIP LOCKED` so
two overlapping sweeps cannot double-send.

### 10.3 Channels

- `email` (v1, Resend): from `trips@<domain>` with reply-to none. Templates:
  `plan_shared` (only if the user chose "also email"), `nudge_1`, `nudge_2`,
  `extended`, `heard_from`, `search_started`, `checked_in`, `cancelled`, `expired`.
  Every email body is short: one sentence of status, the packet link, the "what to do
  now" text. The packet itself is never in the email body (an inbox is a worse place
  for medical notes than a link that expires).
- `push` (v1, existing APNs path): to the *user* for `opened`, `extended`,
  `heard_from`, `search_started`; to contacts only when `app_device_id` is set
  (post-v1 matching).
- `sms` (post-v1, Twilio): same templates, 160-char variants; replaces `email` as the
  primary nudge channel when `phone_e164` is present, email becomes the fallback.
  Adding it means implementing `_shared/notify/sms.ts` and flipping `NUDGE_CHANNELS`.
- `share sheet` (v1, client-only): the initial delivery. The server does not know
  whether the user actually sent anything; the client reports `sent_via_share` when
  the share sheet resolves with `action: sharedAction`, and the card shows "Sent to
  Alex ✓ / Jordan — not sent" until each contact opens the link.

### 10.4 Fan-out rule

Any state-changing contact action notifies **all** contacts on the plan, including the
actor, via every configured channel, and pushes the user **[decided]**. Notification
copy names the actor: "Jordan marked that they heard from Kai."

---

## 11. Identity and Prefill

### 11.1 Anonymous mode (required)

- No login. `owner_device_id` is a random UUID generated at first use and kept in
  SecureStore. It identifies the plan's owner for `get_status` only in combination
  with the plan secret.
- Profile blocks live on the device. Medical, home address, and DOB in SecureStore;
  the rest in AsyncStorage. Nothing profile-related touches the server until a plan is
  created, at which point the relevant fields are copied into that plan's packet.
- Losing the phone loses the profile and the active plan's secret. The plan still fires
  for contacts; the user simply cannot check in from the app. The packet page's
  "heard from" action covers this (they call a contact).

### 11.2 Account mode (optional, prefill only)

- Supabase Auth, Apple Sign-In first (App Review expects it when any third-party login
  is offered; offering only Apple avoids the requirement entirely). Email magic link as
  the second option.
- Tables `user_profiles`, `user_vehicles`, `user_gear`, `user_party_members`,
  `user_favorite_areas`, all RLS `owner = auth.uid()`. Sensitive columns (medical,
  address, DOB) encrypted at rest with `pgsodium` column encryption; the edge function
  decrypts only when building a packet.
- Sync is last-write-wins by `updated_at` per block. The device remains the source of
  truth while editing; the server copy exists to prefill a fresh install.
- Favorites already exist as a preference; account mode adds "saved areas" with
  trailhead pin + usual route text on top of the favorite zone.
- Account mode never gates any Trip Plan feature; it only removes typing.

### 11.3 Merge rule at compose time

For each profile field: plan-local edit > account value > device value > empty. The
composer shows a small "from your profile" tag on prefilled fields so the user sees
what will be sent.

---

## 12. Configuration cheat sheet

| Key | Where | Type | Default | Reload |
|---|---|---|---|---|
| `EXPO_PUBLIC_TRIP_PLAN_PAGE_BASE` | `.env` (tracked) | url | `https://<project>.supabase.co/functions/v1/trip-plan-page` | build |
| `TRIP_WORRY_DEFAULT_OFFSET_H` | client const | int | 3 | build |
| `TRIP_WORRY_MAX_OFFSET_H` | client + server | int | 48 | build/deploy |
| `TRIP_MAX_CONTACTS` | client + server | int | 5 | build/deploy |
| `TRIP_NUDGE_2_DELAY_MIN` | server | int | 60 | deploy |
| `TRIP_EXPIRE_AFTER_H` | server | int | 72 | deploy |
| `TRIP_RETENTION_DAYS` | server | int | 7 | deploy |
| `NUDGE_CHANNELS` | server | list | `["email","push"]` | deploy |
| `RESEND_API_KEY` | Supabase secret | string | — | deploy |
| `TWILIO_*` | Supabase secret | string | — | deploy (post-v1) |
| `TRIP_RATE_CREATE_PER_MIN` | server | int | 10 | deploy |
| `TRIP_RATE_CONTACT_PER_5MIN` | server | int | 30 | deploy |
| `TRIP_PHOTO_MAX_BYTES` | client + server | int | 1,048,576 | build/deploy |
| `TRIP_PACKET_MAX_BYTES` | server | int | 65,536 | deploy |

Unknown keys are ignored. Client and server copies of shared limits are covered by the
drift test (Section 17).

---

## 13. Observability

- **Logging**: edge functions log `{fn, action, plan_id, contact_id?, outcome,
  duration_ms}` as one JSON line per request. Never log packet contents, tokens,
  secrets, emails, or phone numbers; the redaction helper strips known keys before
  `console.log`. Plan ids are UUIDs and safe to log.
- **Events table is the audit trail.** Every notification attempt is a `PlanEvent`
  (`nudge_sent` / `nudge_failed` with channel and provider message id). Operators can
  reconstruct "did Alex get the 9 PM email" from the table alone.
- **Metrics (derived by SQL, no new infra):** plans created/day, share-sheet completion
  rate, first-open latency per contact, overdue rate, nudge delivery failure rate by
  channel, check-in latency after `return_by`, extend usage, `search_started` count.
- **Client**: outbox depth and oldest-entry age are shown in the existing debug mode
  screen; a `check_in` pending > 10 min raises a local notification (Section 7.4).
- **Alerts (manual for now):** a daily SQL in the Supabase dashboard listing plans with
  `nudge_failed` and no successful channel. Proper alerting is an extension.

---

## 14. Failure Model

### 14.1 Failure classes and recovery

1. **Client validation / draft loss** — form errors block Next; draft persists across
   backgrounding. Recovery: none needed.
2. **Offline at create** — plan saved `pending`; no links; card explains. Recovery:
   outbox flush on reconnect, then the share sheet is offered from the card.
3. **Offline at check-in** — queued with unlimited retries; local reminder at 10 min.
   Recovery: automatic. If the phone never reconnects, the contact-side `heard_from`
   is the path.
4. **Server down at create** — same as offline from the client's view. Recovery: retry.
5. **Notification provider down** — action commits; `nudge_failed` event; sweeper
   retries 3× at 10 min; user card shows a warning with the link to share manually.
6. **Sweeper stalls** (cron not firing) — the page still computes status from time and
   tells the contact what to do when they open it; the initial share-sheet message
   already told the contact the worry-by time. This is why the contact is the second
   alarm.
7. **Token leak / forwarded link** — page warns; actions are logged under the token's
   owner; retention bounds exposure. Recovery: user cancels the plan (kills tokens).
8. **Lost or dead phone** — plan fires normally for contacts; user cannot check in;
   contacts use `heard_from`.
9. **Clock skew** — server time is authoritative for all transitions; client-supplied
   `client_at` is recorded for the timeline only.

### 14.2 Restart recovery

Server state is entirely in Postgres; the sweeper is stateless. Client state is the
outbox plus the active-plan summary; on launch the app flushes the outbox, then calls
`get_status` for the active plan and reconciles (a plan closed server-side by a contact
clears the local card with a message).

### 14.3 Operator intervention points

- Flip `NUDGE_CHANNELS` to add SMS without a client release.
- Manually close or extend a plan via SQL in an emergency (an `admin_note` event type
  exists for that, so the timeline says an operator did it).
- Adjust retention, expiry, and nudge spacing by redeploying the function with new
  constants.

---

## 15. Security and Privacy

### 15.1 Trust boundary

Trusted: the Supabase project (service role inside edge functions), pg_cron. Untrusted:
every request body, every share token holder, every contact-entered note (rendered
escaped), the user's own device storage (the plan secret authorizes, it does not
identify a person).

### 15.2 Data classification

- **Sensitive**: medical, medications, allergies, DOB, home address, photo, plate,
  phone numbers, emails, trailhead coordinates while the plan is active.
- Stored: in the plan row's `packet` JSON (needed to render the page) and, in account
  mode, in encrypted profile columns. Never in logs, never in emails/SMS bodies, never
  in push payloads (push carries only "Alex opened your plan").
- Retention: `purge_after = closed_at + 7 days` **[decided]**; the purge job hard-deletes
  the plan, contacts, events, and photo. Expired plans purge 7 days after expiry.
- Cancel deletes immediately? No: cancel closes with a 7-day window like any close, so a
  mistaken cancel can still be read by contacts who already had the link. Documented in
  the UI ("Contacts can still open the link for 7 days").

### 15.3 Access control

- Postgres: all trip-plan tables have RLS enabled with **no** policies for `anon` or
  `authenticated`; only the service role (edge functions) reads or writes. Account-mode
  profile tables have `auth.uid()` policies. This mirrors the `device_tokens` lockdown.
- Edge: per-plan secret for user actions, per-contact token for contact actions, cron
  key for system actions, constant-time hash comparison, rate limits.
- Web page: `no-store`, `noindex`, no external resources, CSP `default-src 'none';
  style-src 'unsafe-inline'; img-src 'self'; form-action 'self'`.

### 15.4 App Store and legal

- Privacy nutrition label changes: Health & Fitness (medical notes), Contact Info,
  Identifiers (device id), Location (trailhead, user-entered), Photos. Linked to the
  user? In anonymous mode, not linked to identity; in account mode, linked. Declare the
  stricter case.
- Privacy policy must describe the packet, who receives it, retention, and the fact
  that contacts can forward the link.
- In-app disclosure at Review: "Everything above will be visible to the contacts you
  chose, via a link that works without the app, for the trip plus 7 days."
- App Review note: the feature does not contact emergency services; add to
  `docs/APP_REVIEW_NOTES.md`.
- Disclaimer copy on the composer's first screen and the page footer: the app is a
  planning aid, does not monitor your safety, and does not contact rescuers.

### 15.5 Secrets

Provider keys are Supabase function secrets, referenced by env name, never in the repo.
The tracked `.env` carries only public values (page base URL). The cron key stays in
`function_secrets` as today.

---

## 16. Reference Algorithms

```
function createPlan(draft):
  packet = buildPacket(draft, profile)             # merge rule 11.3
  assert validatePacket(packet)                    # zod, shared schema
  plan_id = uuid4(); secret = randomBase64url(16)
  secureStore.set("avy-tripplan-secret-"+plan_id, secret)
  local.active = {plan_id, status:"pending", ...summary(draft)}
  outbox.enqueue({id: uuid4(), action:"create", plan_id,
                  body:{plan_id, plan_secret: secret, packet, contacts, times}})
  flushOutbox()

function flushOutbox():
  if flushing or !online: return
  flushing = true
  for entry in outbox.fifo():
    if entry.next_attempt_at > now: continue
    res = post("trip-plans", entry.body)
    if res.ok:
      outbox.remove(entry); applyServerState(res.plan, res.contacts)
      if entry.action == "create": offerShareSheet(res.contacts)
    elif res.status in (400, 403, 404, 410):
      outbox.remove(entry); surface(res.error)
    else:
      entry.attempts += 1
      entry.next_attempt_at = now + min(15m, 5s * 3^entry.attempts)
      break                                          # keep FIFO order
  flushing = false

function serverCreate(body):
  validate(body)                                      # zod + time invariants
  if exists(plan_id):
    return secretMatches ? 200 existing : 403
  if activePlanExists(owner_device_id or owner_user_id): return 409 active_plan_exists
  tokens = for c in contacts: {token: randomBase64url(16), hash: sha256(token)}
  tx:
    insert plan(status=active, packet, worry_by_original=worry_by, secret_hash)
    insert contacts(with hashes)
    insert event(created, user)
  return 201 {plan, contacts: [{id, share_url: BASE + "?t=" + token}]}

function contactAction(body):
  contact = lookupByTokenHash(sha256(body.share_token)) or 404
  plan = contact.plan; if plan.purged: 410
  switch body.action:
    opened:         recordOpen(contact, throttle=6h); pushUser(plan, "opened", contact)
    extend:         if body.new_worry_by <= plan.worry_by: 400 extend_backwards
                    if body.new_worry_by - plan.return_by > 48h: 400 invalid_times
                    plan.worry_by = body.new_worry_by; if plan.status==overdue and now < worry_by: status=active
                    event(extended, contact, payload); notifyAll(plan, "extended", actor=contact)
    heard_from:     if plan.status != closed: close(plan, contact_heard_from)
                    event(heard_from, contact, note); notifyAll(...); pushUser(...)
    search_started: if plan.status != closed: close(plan, search_started)
                    event(search_started, contact, note); notifyAll(...); pushUser(...)
    note:           event(note, contact, note)
  return 200 {plan}

function sweep(now):                                 # every 5 min, SKIP LOCKED per row
  for plan in selectForUpdate(status in (active,overdue) and worry_by <= now):
    if plan.status == active:
      plan.status = overdue; plan.nudge_1_sent_at = now
      notifyAll(plan, "nudge_1")
    elif plan.nudge_2_sent_at is null and now >= plan.nudge_1_sent_at + NUDGE_2_DELAY:
      plan.nudge_2_sent_at = now; notifyAll(plan, "nudge_2")
    elif now >= plan.worry_by + EXPIRE_AFTER:
      close(plan, expired); notifyAll(plan, "expired")
  retryFailedNotifications(now)

function notifyAll(plan, template, actor=null):
  for contact in plan.contacts:
    for channel in NUDGE_CHANNELS:
      if !channel.canReach(contact): continue
      try: id = channel.send(contact, render(template, plan, contact, actor))
           event(nudge_sent, system, {channel, provider_id: id, template})
      catch e: event(nudge_failed, system, {channel, template, attempts:1, next_attempt: now+10m})

function purge(now):
  for plan in plans where purge_after <= now:
    deletePhoto(plan); delete plan cascade          # contacts, events
```

---

## 17. Test and Validation Matrix

### 17.1 Core conformance (Vitest, no network; `TZ=America/Anchorage`)

Schema and packet
- Rejects `worry_by < return_by`, `return_by ≤ depart_at`, `worry_by - return_by > 48h`.
- Accepts a minimal packet with only **R** fields; completeness score computed as
  specified for three fixture packets (empty, minimal, full).
- Phone normalization: `(907) 555-0100` → `+19075550100`; `555-0100` rejected; UK
  number with country code accepted.
- Email normalization trims and lowercases; rejects `a@b`.
- Packet JSON over 64 KB rejected; photo over 1 MB rejected client-side before encode.
- Local wall-clock → UTC conversion is correct across the DST change in November.
- Shared-schema drift test: client and `_shared` copies of the schema and limits agree.

State machine (pure function `transition(plan, event, now)`)
- Every row of the table in Section 6.2 produces the expected state and side-effect
  list; every disallowed transition throws a named error.
- `extend` backwards rejected; `extend` from `overdue` to a future time returns `active`.
- `check_in` after `search_started` records `late: true`, leaves the plan closed with
  `search_started`.
- Expiry only after `worry_by + 72h` and only from `overdue`.

Outbox
- FIFO order preserved; a failed `create` blocks a later `check_in` for the same plan.
- Backoff sequence is 5 s, 15 s, 45 s, 2 m 15 s, capped at 15 m.
- 400/403/404/410 drop the entry; 429/5xx/network retry.
- Replay of the same entry id after a successful response is a no-op.

Merge rule
- Plan-local value beats account value beats device value; "from your profile" tag set
  only for non-local values.

### 17.2 Extension conformance

- If SMS is implemented: 160-char templates render without truncating the link; the
  channel is skipped for contacts without `phone_e164`; email becomes the fallback.
- If account mode is implemented: RLS denies cross-user reads (SQL test via
  `set role authenticated` + JWT claims); sync is last-write-wins by `updated_at`.
- If contact push matching is implemented: a contact who is an app user gets push and
  email; unmatched contacts get email only.

### 17.3 Real integration (needs the Supabase project and provider keys)

- Create → email delivered to a test inbox with a working link; page renders all ten
  sections; `opened` event recorded once per 6 h.
- Sweeper on a plan with `worry_by` set 6 minutes in the past sends nudge 1; 60 minutes
  later nudge 2; no third nudge; expiry at 72 h (use shortened constants in a test
  deploy).
- Two overlapping sweeps (call the function twice concurrently) send exactly one nudge.
- Contact `extend` from the page moves `worry_by`, re-renders, and emails all contacts.
- Purge deletes plan, contacts, events, photo; page returns 410.
- Anon role cannot select from any trip-plan table.
- Device: create at home online → force airplane mode → **I'm back** queues → restore →
  sends, contacts emailed. Force-quit between queue and reconnect still sends on next
  launch.

---

## 18. Implementation Checklist

### 18.1 MVP (v1) definition of done

Backend
- [ ] Migration: `trip_plans`, `trip_plan_contacts`, `trip_plan_events`, `rate_limits`;
      RLS enabled, no anon/authenticated policies; indexes on `(status, worry_by)`,
      `purge_after`, `share_token_hash`, `plan_secret_hash`.
- [ ] `trip-plans` edge function with all actions, zod validation, constant-time
      hash compare, rate limiting, redacted logging.
- [ ] `trip-plan-page` edge function: HTML render, photo route, contact action forms,
      security headers, 410 on purged.
- [ ] `_shared/notify.ts` with `email` (Resend) and `push` adapters; templates in
      Section 10.3.
- [ ] `trip-plan-sweeper` + pg_cron jobs (`*/5` sweep, daily purge) wired with the
      `function_secrets` key; SKIP LOCKED.
- [ ] Resend domain + API key provisioned as a function secret.

Client
- [ ] `lib/tripPlan/{schema,packet,state,outbox,store}.ts` + tests (17.1).
- [ ] `app/trip/new.tsx` composer (6 steps), `app/trip/index.tsx` active plan, home
      card, zone-screen entry point.
- [ ] Anonymous profile vault (AsyncStorage + SecureStore) with an edit screen.
- [ ] Share-sheet send, `sent_via_share` reporting, per-contact sent/opened status.
- [ ] Offline check-in with reminder notification.
- [ ] Review-step disclosure and first-screen disclaimer copy.

Release
- [ ] Privacy policy and nutrition labels updated; App Review note added.
- [ ] `docs/APP_REVIEW_NOTES.md` section for Trip Plan.
- [ ] LOG/JOURNAL entries; `docs/specs` updated to Status: Final when shipped.

### 18.2 Recommended extensions (post-v1, in rough order)

- [ ] SMS channel via Twilio once 10DLC clears; flip `NUDGE_CHANNELS`.
- [ ] Account mode (Apple Sign-In) with encrypted profile sync and saved areas.
- [ ] Contact-side "I'm an app user" matching for push.
- [ ] Web check-in for the user from a borrowed phone (a user-token link).
- [ ] Live Activity / Lock Screen card for the active plan.
- [ ] Party members as first-class profiles with their own contacts.
- [ ] Garmin MapShare embed on the page (public share pages allow iframe).
- [ ] Operator alerting on repeated notification failure.

### 18.3 Operational validation before enabling for TestFlight

- [ ] Send a real plan to two personal contacts; verify open receipts and nudge timing
      end to end with real inboxes.
- [ ] Verify the packet page renders on iOS Safari, Android Chrome, and desktop, and
      prints to one or two pages.
- [ ] Have someone unfamiliar with the app read the overdue page and say out loud what
      they would do. Fix the copy until they get it right the first time.
- [ ] Confirm the purge actually deletes (query the tables after the window).

---

## 19. Open Questions

1. Should the initial share-sheet message include the worry-by instructions in the text
   itself, in case the contact never taps the link? Proposal: yes, two sentences.
2. Snowmachine users: is a registration number field enough, or do they need a
   trailer plate too? Proposal: both, in the vehicle block.
3. Should the page show the forecast snapshot to contacts, or only to SAR? Contacts may
   panic at "Considerable". Proposal: show it, folded by default, labeled "for
   rescuers."
4. Do we want a "worry-by passed but I'm fine, just no signal" contact action distinct
   from "heard from"? Proposal: no; `extend` with a note covers it.
5. Whether Apple's review treats a feature that stores medical notes as needing
   HealthKit-style disclosures beyond the nutrition label. Check during the App Store
   listing work.

---

## Sources consulted for the packet

- Alaska State Troopers, Search and Rescue page and Wilderness Trip Plan PDF (April
  2026): https://dps.alaska.gov/ast/search-and-rescue/
- Latah Search and Rescue Council, Lost Person Questionnaire (long form):
  https://www.latahsar.org/images/Document/ICS_forms/RP_Interview_long.pdf
- Kodiak Island SAR, Initial Response Incident Commander forms: https://kisar.org/check-lists/
