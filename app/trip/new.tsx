// Trip plan composer. One long scroll of collapsible sections; sections
// that a template or the profile already filled start collapsed, so the
// trailhead case is: check the times, check the contacts, SEND.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import NetInfo from "@react-native-community/netinfo";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { ZoneScreenContainer, ZoneScreenHeader } from "@/components/avalanche/ZoneScreenChrome";
import { CollapsibleSection } from "@/components/observation/CollapsibleSection";
import { ChipPicker, FieldLabel, TextField, YesNoSwitch } from "@/components/observation/formPrimitives";
import { LocationField } from "@/components/observation/LocationField";
import { SelectField } from "@/components/observation/SelectField";
import { DateTimeField } from "@/components/trip/DateTimeField";
import {
  ClothingEditor,
  ContactsEditor,
  GearEditor,
  PartyEditor,
  SubjectEditor,
  VehicleEditor,
} from "@/components/trip/editors";
import { VehicleCard, vehicleLine } from "@/components/trip/VehicleCards";
import { gearSummary } from "@/lib/tripPlan/gear";
import {
  TRAVEL_MODE_OPTIONS,
  TRIP_LIMITS,
  emptyDraft,
  tripPlanDraftSchema,
  type TripPlanDraftInput,
  type VehicleProfile,
} from "@/lib/tripPlan/schema";
import { completeness, shareMessage } from "@/lib/tripPlan/packet";
import { newId } from "@/lib/tripPlan/ids";
import { createPlan, flushTripPlanOutbox, markShared, PacketTooLargeError } from "@/lib/tripPlan/send";
import {
  loadActivePlan,
  loadDraft,
  loadProfile,
  loadTemplates,
  saveDraft,
  updateProfile,
  type TripProfile,
} from "@/lib/tripPlan/store";
import { forecastSnapshotFromZone } from "@/lib/tripPlan/forecast";
import { getZoneSnapshotForDate, loadFavorites, loadSnapshot } from "@/lib/offlineCache";
import { getZoneSession } from "@/lib/zoneSession";
import { AVAILABLE_ZONES } from "@/lib/zones";

type SectionKey = "where" | "when" | "party" | "vehicle" | "gear" | "you" | "contacts";
const ORDER: SectionKey[] = ["where", "when", "party", "vehicle", "gear", "you", "contacts"];

const H = 3_600_000;

export default function TripNewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ templateId?: string; zoneId?: string }>();
  const [draft, setDraft] = useState<TripPlanDraftInput>(() => emptyDraft());
  const [profile, setProfile] = useState<TripProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<Set<SectionKey>>(new Set(ORDER));
  const [sending, setSending] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [editVehicle, setEditVehicle] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  // ── seed: template > zone param > saved draft > profile defaults ──────
  useEffect(() => {
    (async () => {
      const [p, templates, favs, active] = await Promise.all([
        loadProfile(),
        loadTemplates(),
        loadFavorites(),
        loadActivePlan(),
      ]);
      if (active && active.status !== "closed") {
        Alert.alert(
          "You already have a live trip",
          `Check in on the ${active.areaName} trip first, or cancel it.`,
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }
      setProfile(p);
      setFavorites(favs ?? []);
      const defaultVehicle =
        p.vehicles.find((v) => v.id === p.defaultVehicleId) ?? p.vehicles[0] ?? null;
      const base = emptyDraft({
        subject: p.subject,
        gear: p.gear,
        vehicle: defaultVehicle,
        clothingToday: {},
        party: [],
        // Saved people are the default recipients — confirm, don't retype.
        contacts: p.contacts.slice(0, TRIP_LIMITS.maxContacts),
      });
      const tpl = params.templateId ? templates.find((t) => t.id === params.templateId) : undefined;
      const collapsed = new Set<SectionKey>();
      let next: TripPlanDraftInput = base;
      if (tpl) {
        const hours = tpl.usualTripHours;
        const depart = new Date();
        depart.setSeconds(0, 0);
        depart.setMinutes(Math.ceil(depart.getMinutes() / 15) * 15);
        const returnBy = new Date(depart.getTime() + hours * H);
        const worryBy = new Date(returnBy.getTime() + TRIP_LIMITS.defaultWorryOffsetHours * H);
        next = {
          ...base,
          zoneId: tpl.zoneId,
          areaName: tpl.areaName,
          trailheadName: tpl.trailheadName,
          trailhead: tpl.trailhead,
          route: tpl.route,
          alternates: tpl.alternates,
          travelMode: tpl.travelMode,
          vehicle: p.vehicles.find((v) => v.id === tpl.vehicleId) ?? defaultVehicle,
          party: tpl.party,
          contacts: p.contacts.filter((c) => tpl.contactIds.includes(c.id)),
          departAt: depart.toISOString(),
          returnBy: returnBy.toISOString(),
          worryBy: worryBy.toISOString(),
        };
        collapsed.add("where");
        if ((next.party ?? []).length > 0) collapsed.add("party");
      } else if (params.zoneId) {
        const z = AVAILABLE_ZONES.find((x) => x.id === params.zoneId);
        next = { ...base, zoneId: params.zoneId, areaName: z?.name ?? "" };
      } else {
        const saved = await loadDraft();
        if (saved) {
          next = {
            ...base,
            ...saved,
            subject: { ...p.subject, ...saved.subject },
            // A resumed draft never overrides profile defaults with nothing.
            vehicle: saved.vehicle ?? defaultVehicle,
            gear: { ...p.gear, ...saved.gear },
            contacts: saved.contacts && saved.contacts.length > 0 ? saved.contacts : base.contacts,
          };
        }
      }
      if (next.vehicle && (next.vehicle.color || next.vehicle.make)) collapsed.add("vehicle");
      if (p.gear.satDeviceType || p.gear.overnightGear) collapsed.add("gear");
      if (p.subject.fullName && p.subject.phone) collapsed.add("you");
      if ((next.contacts?.length ?? 0) > 0) collapsed.add("contacts");
      setOpen(new Set(ORDER.filter((k) => !collapsed.has(k))));
      setDraft(next);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.templateId, params.zoneId]);

  // Persist the draft while composing (not for template runs — those
  // are meant to be fire-and-forget).
  useEffect(() => {
    if (!ready || params.templateId) return;
    const t = setTimeout(() => saveDraft(draft), 400);
    return () => clearTimeout(t);
  }, [draft, ready, params.templateId]);

  const set = <K extends keyof TripPlanDraftInput>(k: K, v: TripPlanDraftInput[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    if (errors[k as string]) setErrors((e) => ({ ...e, [k as string]: "" }));
  };

  const toggle = (k: SectionKey) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const score = useMemo(() => completeness(draft), [draft]);

  const dates = {
    depart: new Date(draft.departAt),
    ret: new Date(draft.returnBy),
    worry: new Date(draft.worryBy),
  };
  const setDepart = (d: Date) => {
    const dur = dates.ret.getTime() - dates.depart.getTime();
    const gap = dates.worry.getTime() - dates.ret.getTime();
    const ret = new Date(d.getTime() + dur);
    setDraft((x) => ({
      ...x,
      departAt: d.toISOString(),
      returnBy: ret.toISOString(),
      worryBy: new Date(ret.getTime() + gap).toISOString(),
    }));
  };
  const setReturn = (d: Date) => {
    const gap = dates.worry.getTime() - dates.ret.getTime();
    setDraft((x) => ({
      ...x,
      returnBy: d.toISOString(),
      worryBy: new Date(d.getTime() + Math.max(gap, 0)).toISOString(),
    }));
    setErrors((e) => ({ ...e, returnBy: "", worryBy: "" }));
  };

  const zoneOptions = useMemo(() => {
    const fav = AVAILABLE_ZONES.filter((z) => favorites.includes(z.id));
    const rest = AVAILABLE_ZONES.filter((z) => !favorites.includes(z.id));
    return [...fav, ...rest].map((z) => ({ value: z.id, label: z.name, hint: favorites.includes(z.id) ? "Favorite" : undefined }));
  }, [favorites]);

  // ── send ─────────────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const parsed = tripPlanDraftSchema.safeParse(draft);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      // Open the first offending section.
      const first = parsed.error.issues[0]?.path[0];
      const sec: SectionKey =
        first === "contacts" ? "contacts"
        : first === "subject" ? "you"
        : first === "vehicle" ? "vehicle"
        : first === "returnBy" || first === "worryBy" || first === "departAt" ? "when"
        : "where";
      setOpen((o) => new Set([...o, sec]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setSending(true);
    try {
      // Forecast snapshot for the packet (best effort, from the cache).
      let forecast = null;
      if (draft.zoneId) {
        const snap = await loadSnapshot();
        const bundle = snap ? getZoneSnapshotForDate(snap, draft.zoneId) : undefined;
        const zone = bundle?.forecast ?? getZoneSession(draft.zoneId)?.forecast;
        forecast = forecastSnapshotFromZone(zone, draft.zoneId);
      }
      // Remember new contacts in the profile so next time is one tap.
      await updateProfile((p) => {
        const known = new Set(p.contacts.map((c) => c.id));
        const fresh = parsed.data.contacts.filter((c) => !known.has(c.id));
        return fresh.length ? { ...p, contacts: [...p.contacts, ...fresh] } : p;
      });

      const active = await createPlan(draft, forecast);
      const net = await NetInfo.fetch();
      const online = net.isConnected !== false && net.isInternetReachable !== false;
      if (!online) {
        Alert.alert(
          "Saved — not sent yet",
          "You're offline. It will send as soon as you have signal, and you'll be able to text the links from the Your People screen.",
          [{ text: "OK", onPress: () => router.replace("/trip" as never) }],
        );
        return;
      }
      await flushTripPlanOutbox();
      const after = await loadActivePlan();
      const withLinks = (after?.contacts ?? []).filter((c) => c.shareUrl);
      if (!after || after.sync !== "created" || withLinks.length === 0) {
        Alert.alert(
          "Saved — sending",
          after?.sync === "failed"
            ? `The server rejected it: ${after.syncError ?? "unknown error"}.`
            : "The server hasn't confirmed yet. Links will appear on the Your People screen once it does.",
          [{ text: "OK", onPress: () => router.replace("/trip" as never) }],
        );
        return;
      }
      // Share to each contact in turn via the iOS share sheet.
      for (const c of withLinks) {
        const message = shareMessage({
          subjectName: active.subjectName,
          areaName: active.areaName,
          returnBy: active.returnBy,
          worryBy: active.worryBy,
          timezone: active.timezone,
          url: c.shareUrl!,
        });
        const res = await Share.share({ message }, { subject: `Where ${active.subjectName} is going` });
        if (res.action === Share.sharedAction) await markShared(active.planId, c.id);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.replace("/trip" as never);
    } catch (err) {
      Alert.alert(
        "Couldn't send",
        err instanceof PacketTooLargeError ? err.message : err instanceof Error ? err.message : String(err),
      );
    } finally {
      setSending(false);
    }
  }, [draft, router]);

  if (!ready || !profile) {
    return (
      <ZoneScreenContainer>
        <Stack.Screen options={{ headerShown: false }} />
      </ZoneScreenContainer>
    );
  }

  const vehicle: VehicleProfile = draft.vehicle ?? { id: newId(), label: "", type: "truck" };
  const partySize = 1 + (draft.party?.length ?? 0);

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader eyebrow="YOUR PEOPLE" title={draft.areaName || "Where are you going?"} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12, borderRadius: 10, backgroundColor: palette.frost[400] + "15", borderWidth: 0.5, borderColor: palette.frost[400] + "55", flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Ionicons name="cellular-outline" size={16} color={palette.frost[400]} />
            <Text className="text-ink-200" style={{ fontSize: 12, lineHeight: 17, flex: 1 }}>
              Send this while you still have signal. Your people get a link that works without the app.
            </Text>
          </View>

          {/* WHERE */}
          <CollapsibleSection
            eyebrow="WHERE"
            summary={draft.areaName ? `${draft.areaName}${draft.trailheadName ? ` · ${draft.trailheadName}` : ""}` : null}
            open={open.has("where")}
            complete={!!draft.areaName && !!draft.trailheadName && !!draft.route}
            onToggle={() => toggle("where")}
          >
            <SelectField
              label="Forecast zone"
              hint="Favorites first. Pick 'custom' below if it's outside a zone."
              pickerTitle="Zone"
              options={zoneOptions}
              value={draft.zoneId}
              onChange={(id) => {
                const z = AVAILABLE_ZONES.find((x) => x.id === id);
                setDraft((d) => ({ ...d, zoneId: id, areaName: d.areaName || z?.name || "" }));
              }}
              clearable
              placeholder="Choose a zone"
            />
            <TextField label="Area name" required value={draft.areaName} onChangeText={(t) => set("areaName", t)} error={errors.areaName} placeholder="Turnagain Pass" />
            <TextField label="Trailhead / parking" required value={draft.trailheadName} onChangeText={(t) => set("trailheadName", t)} error={errors.trailheadName} placeholder="Tincan lot, mile 68" />
            <LocationField
              label="Trailhead pin"
              hint="Tap 'use my current location' when you're parked, or type it."
              required={false}
              value={draft.trailhead ?? { lat: 0, lng: 0 }}
              onChange={(p) => set("trailhead", p.lat === 0 && p.lng === 0 ? undefined : p)}
              error={errors["trailhead.lat"]}
            />
            <TextField label="Route / objective" required multiline rows={3} value={draft.route} onChangeText={(t) => set("route", t)} error={errors.route} placeholder="Up the common track to treeline, ski the low-angle glades, back the same way." />
            <TextField label="Alternate plans" multiline rows={2} value={draft.alternates ?? ""} onChangeText={(t) => set("alternates", t)} placeholder="If the wind's up we'll go to Sunburst instead." />
            <View>
              <FieldLabel label="Travel mode" required />
              <ChipPicker options={TRAVEL_MODE_OPTIONS} selected={draft.travelMode} onSelect={(v) => set("travelMode", v)} size="sm" />
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <FieldLabel label="Done this trip before?" />
                <YesNoSwitch value={!!draft.doneBefore} onChange={(v) => set("doneBefore", v)} />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel label="Know the area?" />
                <YesNoSwitch value={!!draft.familiarWithArea} onChange={(v) => set("familiarWithArea", v)} />
              </View>
            </View>
          </CollapsibleSection>

          {/* WHEN */}
          <CollapsibleSection
            eyebrow="WHEN"
            summary={`Back ${dates.ret.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · worry ${dates.worry.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
            open={open.has("when")}
            complete={!errors.returnBy && !errors.worryBy}
            onToggle={() => toggle("when")}
          >
            <DateTimeField label="Leaving" value={dates.depart} onChange={setDepart} quick={[{ label: "NOW", apply: () => new Date() }]} />
            <DateTimeField
              label="Expected back"
              required
              value={dates.ret}
              onChange={setReturn}
              minDate={dates.depart}
              error={errors.returnBy}
              quick={[
                { label: "+1H", apply: (d) => new Date(d.getTime() + H) },
                { label: "+2H", apply: (d) => new Date(d.getTime() + 2 * H) },
                { label: "6 PM", apply: (d) => { const n = new Date(d); n.setHours(18, 0, 0, 0); return n < dates.depart ? new Date(n.getTime() + 24 * H) : n; } },
              ]}
            />
            <DateTimeField
              label="Worry-by time"
              required
              hint="When your contacts should start the steps if they haven't heard from you. Pad for the drive out."
              value={dates.worry}
              onChange={(d) => { set("worryBy", d.toISOString()); setErrors((e) => ({ ...e, worryBy: "" })); }}
              minDate={dates.ret}
              error={errors.worryBy}
              quick={[
                { label: "BACK +2H", apply: () => new Date(dates.ret.getTime() + 2 * H) },
                { label: "BACK +3H", apply: () => new Date(dates.ret.getTime() + 3 * H) },
                { label: "BACK +6H", apply: () => new Date(dates.ret.getTime() + 6 * H) },
              ]}
            />
          </CollapsibleSection>

          {/* PARTY */}
          <CollapsibleSection
            eyebrow="WHO'S GOING"
            summary={partySize === 1 ? "Solo" : `${partySize} people`}
            open={open.has("party")}
            complete
            onToggle={() => toggle("party")}
          >
            {profile.party.length > 0 && (draft.party?.length ?? 0) === 0 ? (
              <View>
                <FieldLabel label="Usual partners" hint="Tap to add." />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {profile.party.map((m) => (
                    <Pressable key={m.name} onPress={() => set("party", [...(draft.party ?? []), m])} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: 0.5, borderColor: palette.ink[500] + "66" }}>
                      <Text variant="mono" weight="medium" style={{ fontSize: 12, letterSpacing: 1, color: palette.ink[200] }}>{m.name.toUpperCase()}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <PartyEditor value={draft.party ?? []} onChange={(m) => set("party", m)} />
            {(draft.party?.length ?? 0) > 0 ? (
              <>
                <TextField label="Leader / most experienced" value={draft.leader ?? ""} onChangeText={(t) => set("leader", t)} />
                <TextField label="Plan if separated" value={draft.ifSeparated ?? ""} onChangeText={(t) => set("ifSeparated", t)} placeholder="Regroup at the car by 5, otherwise call." />
              </>
            ) : null}
          </CollapsibleSection>

          {/* VEHICLE */}
          <CollapsibleSection
            eyebrow="VEHICLE"
            summary={draft.vehicle ? `${vehicleLine(draft.vehicle)}${draft.vehicle.plate ? ` · ${draft.vehicle.plate}` : ""}` : draft.travelMode === "foot" ? "On foot" : null}
            open={open.has("vehicle")}
            complete={!!draft.vehicle && (!!draft.vehicle.color || !!draft.vehicle.make || draft.vehicle.type === "dropped_off")}
            onToggle={() => toggle("vehicle")}
          >
            {profile.vehicles.length > 0 ? (
              <View style={{ gap: 8 }}>
                <FieldLabel label="Which one are you taking?" />
                {profile.vehicles.map((v) => (
                  <VehicleCard
                    key={v.id}
                    vehicle={v}
                    selected={draft.vehicle?.id === v.id}
                    onPress={() => { set("vehicle", v); setEditVehicle(false); }}
                  />
                ))}
                <VehicleCard
                  vehicle={{ id: "__dropped", label: "", type: "dropped_off" }}
                  selected={draft.vehicle?.type === "dropped_off"}
                  onPress={() => { set("vehicle", { id: newId(), label: "", type: "dropped_off" }); setEditVehicle(false); }}
                />
                <Pressable onPress={() => { if (!draft.vehicle || profile.vehicles.some((v) => v.id === draft.vehicle?.id)) set("vehicle", { id: newId(), label: "", type: "truck" }); setEditVehicle(true); }} hitSlop={8}>
                  <Text variant="mono" style={{ fontSize: 11, letterSpacing: 1.2, color: palette.frost[400] }}>DIFFERENT VEHICLE TODAY →</Text>
                </Pressable>
              </View>
            ) : null}
            {profile.vehicles.length === 0 || editVehicle ? (
              <VehicleEditor value={vehicle} onChange={(v) => set("vehicle", v)} error={errors.vehicle} />
            ) : null}
            <TextField label="Where it's parked" value={draft.parkedAt ?? ""} onChangeText={(t) => set("parkedAt", t)} placeholder="Defaults to the trailhead" />
          </CollapsibleSection>

          {/* GEAR + CLOTHING */}
          <CollapsibleSection
            eyebrow="GEAR & WHAT YOU'RE WEARING"
            summary={[draft.clothingToday?.shell && `${draft.clothingToday.shell} jacket`, gearSummary(draft.gear)].filter(Boolean).join(" · ") || null}
            open={open.has("gear")}
            complete={!!(draft.clothingToday?.shell || draft.clothingToday?.pack || draft.gear?.clothingColors)}
            onToggle={() => toggle("gear")}
          >
            <FieldLabel label="Today's colors" hint="What a helicopter would see." />
            <ClothingEditor value={draft.clothingToday ?? {}} onChange={(c) => set("clothingToday", c)} />
            <FieldLabel label="Confirm what's in the pack today" hint="Prefilled from your profile — tap to change." />
            <GearEditor value={{ beacon: true, shovel: true, probe: true, airbag: false, ...draft.gear }} onChange={(g) => set("gear", g)} compact />
          </CollapsibleSection>

          {/* YOU */}
          <CollapsibleSection
            eyebrow="ABOUT YOU"
            summary={draft.subject?.fullName ? `${draft.subject.fullName}${draft.subject.phone ? ` · ${draft.subject.phone}` : ""}` : null}
            open={open.has("you")}
            complete={!!draft.subject?.fullName && !!draft.subject?.phone}
            onToggle={() => toggle("you")}
          >
            <SubjectEditor value={draft.subject ?? {}} onChange={(s) => set("subject", s)} errors={errors} compact />
            <Pressable onPress={() => router.push("/trip/profile" as never)} hitSlop={8}>
              <Text variant="mono" style={{ fontSize: 11, letterSpacing: 1.2, color: palette.frost[400] }}>
                EDIT FULL PROFILE (DESCRIPTION, MEDICAL, EXPERIENCE) →
              </Text>
            </Pressable>
          </CollapsibleSection>

          {/* CONTACTS */}
          <CollapsibleSection
            eyebrow="WHO TO TELL"
            summary={(draft.contacts ?? []).length ? (draft.contacts ?? []).map((c) => c.displayName).join(", ") : null}
            open={open.has("contacts")}
            complete={(draft.contacts ?? []).length > 0}
            onToggle={() => toggle("contacts")}
          >
            <ContactsEditor
              value={draft.contacts ?? []}
              onChange={(c) => { set("contacts", c); setErrors((e) => ({ ...e, contacts: "" })); }}
              saved={profile.contacts}
              onSaveContact={(c) => updateProfile((p) => ({ ...p, contacts: [...p.contacts, c] })).then(setProfile)}
              errors={errors}
              newId={newId}
              max={TRIP_LIMITS.maxContacts}
            />
            <TextField label="Others who know about this trip" value={draft.othersWhoKnow ?? ""} onChangeText={(t) => set("othersWhoKnow", t)} placeholder="Names + numbers" />
            <TextField label="Local agency number (optional)" hint="Troopers post or ranger station for this area. 911 is always on the page." value={draft.localAgencyPhone ?? ""} onChangeText={(t) => set("localAgencyPhone", t)} keyboardType="phone-pad" error={errors.localAgencyPhone} />
          </CollapsibleSection>

          {/* REVIEW + SEND */}
          <View style={{ marginTop: 6, padding: 16, borderRadius: 14, backgroundColor: palette.ink[800], borderWidth: 0.5, borderColor: palette.ink[500] + "55", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text variant="mono" weight="medium" style={{ fontSize: 10, letterSpacing: 1.4, color: palette.ink[400] }}>PACKET COMPLETENESS</Text>
              <Text variant="mono" weight="bold" style={{ fontSize: 12, color: palette.ink[200] }}>{Math.round(score.score * 100)}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: palette.ink[900], overflow: "hidden" }}>
              <View style={{ width: `${Math.round(score.score * 100)}%`, height: 6, backgroundColor: score.score > 0.7 ? palette.frost[400] : palette.aspen[400] }} />
            </View>
            {score.missing.length > 0 ? (
              <Text className="text-ink-400" style={{ fontSize: 12, lineHeight: 17 }}>
                Missing: {score.missing.slice(0, 5).join(", ")}{score.missing.length > 5 ? ` +${score.missing.length - 5} more` : ""}. Fine to send — SAR would rather have something than nothing.
              </Text>
            ) : null}
            <Text className="text-ink-300" style={{ fontSize: 12, lineHeight: 17 }}>
              Everything above goes to the people you chose, via a link that works without the app, for the trip plus 7 days.
            </Text>
          </View>

          <Pressable
            onPress={send}
            disabled={sending}
            style={({ pressed }) => ({
              marginTop: 14,
              height: 58,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: sending ? palette.ink[500] : pressed ? palette.ink[100] : palette.ink[50],
            })}
          >
            <Text variant="mono" weight="bold" style={{ fontSize: 15, letterSpacing: 1.8, color: palette.ink[950] }}>
              {sending ? "SENDING…" : "SEND TO MY PEOPLE"}
            </Text>
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ alignSelf: "center", marginTop: 16, padding: 12 }}>
            <Text variant="mono" style={{ fontSize: 12, letterSpacing: 1.2, color: palette.ink[400] }}>CANCEL</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ZoneScreenContainer>
  );
}
