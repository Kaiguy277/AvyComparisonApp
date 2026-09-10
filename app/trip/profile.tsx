// Your profile — set up once. Everything here is what Search and Rescue
// asks a reporting party for and doesn't change trip to trip. Per-trip
// questions (who's going today, which car, what's in the pack, can you
// survive a night out) live in the composer instead.

import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { ZoneScreenContainer, ZoneScreenHeader } from "@/components/avalanche/ZoneScreenChrome";
import { CollapsibleSection } from "@/components/observation/CollapsibleSection";
import {
  AddButton,
  ContactInfoEditor,
  ContactsEditor,
  DescriptionEditor,
  ExperienceEditor,
  KitDetailsEditor,
  MedicalEditor,
  PartyEditor,
  VehicleEditor,
} from "@/components/trip/editors";
import { GearGrid } from "@/components/trip/GearGrid";
import { VehicleCard } from "@/components/trip/VehicleCards";
import { gearSummary } from "@/lib/tripPlan/gear";
import { newId } from "@/lib/tripPlan/ids";
import { gearProfileSchema } from "@/lib/tripPlan/schema";
import { emptyProfile, loadProfile, saveProfile, type TripProfile } from "@/lib/tripPlan/store";

type Section = "contact" | "people" | "vehicles" | "gear" | "medical" | "description" | "experience" | "partners";
const ORDER: Section[] = ["contact", "people", "vehicles", "gear", "medical", "description", "experience", "partners"];

export default function TripProfileScreen() {
  const router = useRouter();
  // `intro=1` arrives from the first tap of HEADING OUT: explain what this
  // is before asking for anything, and hand the user to the composer when
  // the two essential sections are done.
  const { intro } = useLocalSearchParams<{ intro?: string }>();
  const isIntro = intro === "1";
  const [profile, setProfile] = useState<TripProfile>(emptyProfile());
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<Set<Section>>(new Set());
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<string | null>(null);
  const [moreGear, setMoreGear] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProfile().then((p) => {
      setProfile(p);
      // Open the first section that still needs something.
      const first: Section | undefined = !p.subject.fullName || !p.subject.phone
        ? "contact"
        : p.contacts.length === 0
          ? "people"
          : p.vehicles.length === 0
            ? "vehicles"
            : undefined;
      setOpen(new Set(first ? [first] : []));
      setLoaded(true);
    });
  }, []);

  const update = (patch: (p: TripProfile) => TripProfile) => {
    setProfile((prev) => {
      const next = patch(prev);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        saveProfile(next)
          .then(() => setSavedAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })))
          .catch(() => {});
      }, 500);
      return next;
    });
  };

  // One open at a time keeps the page short; Done → next incomplete.
  const toggle = (s: Section) => setOpen((prev) => (prev.has(s) ? new Set() : new Set([s])));
  const next = (s: Section) => {
    const i = ORDER.indexOf(s);
    setOpen(new Set(i + 1 < ORDER.length ? [ORDER[i + 1]] : []));
  };

  if (!loaded) return <ZoneScreenContainer><Stack.Screen options={{ headerShown: false }} /></ZoneScreenContainer>;

  const s = profile.subject;
  const done = {
    contact: !!s.fullName && !!s.phone,
    people: profile.contacts.length > 0,
    vehicles: profile.vehicles.length > 0,
    gear: (profile.gear.inventory ?? []).length > 0,
    medical: !!(s.medicalConditions || s.medications || s.allergies),
    description: !!(s.height || s.hair || s.dateOfBirth || s.photoDataUri),
    experience: !!s.experienceLevel,
    partners: profile.party.length > 0,
  };
  const doneCount = Object.values(done).filter(Boolean).length;

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader eyebrow={isIntro ? "FIRST · SET UP ONCE" : "SET UP ONCE"} title="Your profile" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: palette.ink[900], overflow: "hidden" }}>
              <View style={{ width: `${Math.round((doneCount / ORDER.length) * 100)}%`, height: 4, backgroundColor: palette.frost[400] }} />
            </View>
            <Text variant="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: palette.ink[400] }}>
              {doneCount}/{ORDER.length}{savedAt ? ` · SAVED ${savedAt.toUpperCase()}` : ""}
            </Text>
          </View>
          {isIntro ? (
            <View
              style={{
                padding: 16,
                borderRadius: 14,
                borderWidth: 0.5,
                borderColor: palette.frost[400] + "88",
                backgroundColor: palette.frost[400] + "12",
                marginBottom: 14,
                gap: 8,
              }}
            >
              <Text variant="mono" weight="medium" style={{ fontSize: 10, letterSpacing: 1.6, color: palette.frost[400] }}>
                HOW THIS WORKS
              </Text>
              <Text className="text-ink-200" style={{ fontSize: 14, lineHeight: 20 }}>
                Before a trip you pick who to tell, where you&apos;re going, and when to worry. They get a link
                with everything Search and Rescue asks a reporting party for — and a reminder if you haven&apos;t
                checked in by your worry-by time.
              </Text>
              <Text className="text-ink-200" style={{ fontSize: 14, lineHeight: 20 }}>
                Most of that never changes, so you fill it in once here. After this, heading out is three taps.
              </Text>
              <Text className="text-ink-400" style={{ fontSize: 12, lineHeight: 17 }}>
                Sections 1 and 2 are all you need to send your first trip. The rest you can add any time — the
                more you fill in, the more rescuers have to work with.
              </Text>
            </View>
          ) : (
            <Text className="text-ink-300" style={{ fontSize: 13, lineHeight: 19, marginBottom: 14 }}>
              What rescuers ask for that doesn&apos;t change trip to trip. Fill in what you can, in any order.
              The first two matter most.
            </Text>
          )}

          <CollapsibleSection
            eyebrow="1 · HOW TO REACH YOU"
            summary={s.fullName ? `${s.fullName}${s.phone ? ` · ${s.phone}` : ""}` : null}
            open={open.has("contact")}
            complete={done.contact}
            onToggle={() => toggle("contact")}
            onDone={() => next("contact")}
          >
            <ContactInfoEditor value={s} onChange={(v) => update((p) => ({ ...p, subject: v }))} />
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="2 · YOUR PEOPLE"
            summary={profile.contacts.length ? profile.contacts.map((c) => c.displayName).join(", ") : null}
            open={open.has("people")}
            complete={done.people}
            onToggle={() => toggle("people")}
            onDone={() => next("people")}
          >
            <Text className="text-ink-300" style={{ fontSize: 12, lineHeight: 17, marginBottom: 4 }}>
              Who should be called if you don&apos;t come back. They get a link with everything on this page.
            </Text>
            <ContactsEditor value={profile.contacts} onChange={(c) => update((p) => ({ ...p, contacts: c }))} saved={[]} newId={newId} max={10} />
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="3 · YOUR VEHICLES"
            summary={profile.vehicles.length ? profile.vehicles.map((v) => [v.color, v.model].filter(Boolean).join(" ") || v.label).join(", ") : null}
            open={open.has("vehicles")}
            complete={done.vehicles}
            onToggle={() => toggle("vehicles")}
            onDone={() => next("vehicles")}
          >
            <View style={{ gap: 10 }}>
              {profile.vehicles.map((v, i) => (
                <View key={v.id} style={{ gap: 10 }}>
                  <VehicleCard
                    vehicle={v}
                    selected={editingVehicle === v.id}
                    onPress={() => setEditingVehicle(editingVehicle === v.id ? null : v.id)}
                    trailing={
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Pressable onPress={() => update((p) => ({ ...p, defaultVehicleId: v.id }))} hitSlop={8}>
                          <Text variant="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: profile.defaultVehicleId === v.id ? palette.frost[500] : palette.ink[400] }}>
                            {profile.defaultVehicleId === v.id ? "USUAL" : "SET USUAL"}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => update((p) => ({ ...p, vehicles: p.vehicles.filter((_, j) => j !== i) }))} hitSlop={10}>
                          <Ionicons name="close-circle-outline" size={20} color={palette.ink[400]} />
                        </Pressable>
                      </View>
                    }
                  />
                  {editingVehicle === v.id ? (
                    <View style={{ padding: 12, borderRadius: 10, backgroundColor: palette.ink[900] }}>
                      <VehicleEditor value={v} onChange={(nv) => update((p) => ({ ...p, vehicles: p.vehicles.map((x, j) => (j === i ? nv : x)) }))} />
                    </View>
                  ) : null}
                </View>
              ))}
              <AddButton
                label={profile.vehicles.length ? "Add another" : "Add your vehicle"}
                onPress={() =>
                  update((p) => {
                    const id = newId();
                    setEditingVehicle(id);
                    return { ...p, vehicles: [...p.vehicles, { id, label: "", type: "truck" }], defaultVehicleId: p.defaultVehicleId ?? id };
                  })
                }
              />
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="4 · WHAT YOU OWN"
            summary={gearSummary(profile.gear)}
            open={open.has("gear")}
            complete={done.gear}
            onToggle={() => toggle("gear")}
            onDone={() => next("gear")}
          >
            <Text className="text-ink-300" style={{ fontSize: 12, lineHeight: 17 }}>
              Tap what you own. On each trip you&apos;ll confirm what&apos;s actually in the pack.
            </Text>
            <GearGrid value={profile.gear} onChange={(g) => update((p) => ({ ...p, gear: gearProfileSchema.parse(g) }))} />
            <Pressable onPress={() => setMoreGear((m) => !m)} hitSlop={8}>
              <Text variant="mono" style={{ fontSize: 11, letterSpacing: 1.2, color: palette.frost[400] }}>
                {moreGear ? "HIDE KIT DETAILS" : "ADD COLORS, SKIS / SLED, TENT →"}
              </Text>
            </Pressable>
            {moreGear ? (
              <KitDetailsEditor value={profile.gear} onChange={(g) => update((p) => ({ ...p, gear: gearProfileSchema.parse(g) }))} />
            ) : null}
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="5 · MEDICAL"
            summary={done.medical ? [s.medicalConditions, s.medications].filter(Boolean).join(" · ") : null}
            open={open.has("medical")}
            complete={done.medical}
            onToggle={() => toggle("medical")}
            onDone={() => next("medical")}
          >
            <Text className="text-ink-300" style={{ fontSize: 12, lineHeight: 17 }}>
              Kept in the device keychain. Only leaves the phone inside a trip you send.
            </Text>
            <MedicalEditor value={s} onChange={(v) => update((p) => ({ ...p, subject: v }))} />
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="6 · WHAT YOU LOOK LIKE"
            summary={done.description ? [s.photoDataUri ? "Photo" : null, s.height, s.build, s.hair].filter(Boolean).join(" · ") : null}
            open={open.has("description")}
            complete={done.description}
            onToggle={() => toggle("description")}
            onDone={() => next("description")}
          >
            <DescriptionEditor value={s} onChange={(v) => update((p) => ({ ...p, subject: v }))} />
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="7 · EXPERIENCE"
            summary={s.experienceLevel ? `${s.experienceLevel}${s.avalancheTraining ? ` · ${s.avalancheTraining}` : ""}` : null}
            open={open.has("experience")}
            complete={done.experience}
            onToggle={() => toggle("experience")}
            onDone={() => next("experience")}
          >
            <ExperienceEditor value={s} onChange={(v) => update((p) => ({ ...p, subject: v }))} />
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="8 · USUAL PARTNERS"
            summary={profile.party.length ? profile.party.map((m) => m.name).join(", ") : null}
            open={open.has("partners")}
            complete={done.partners}
            onToggle={() => toggle("partners")}
            onDone={() => next("partners")}
            doneLabel="Done"
          >
            <PartyEditor value={profile.party} onChange={(m) => update((p) => ({ ...p, party: m }))} />
          </CollapsibleSection>

          {isIntro ? (
            <Pressable
              onPress={() => router.replace("/trip/new" as never)}
              disabled={!done.contact || !done.people}
              style={({ pressed }) => ({
                marginTop: 6,
                height: 56,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  !done.contact || !done.people
                    ? palette.ink[500]
                    : pressed
                      ? palette.frost[600]
                      : palette.frost[500],
              })}
            >
              <Text variant="mono" weight="bold" style={{ fontSize: 13, letterSpacing: 1.4, color: "#FFFFFF" }}>
                {!done.contact || !done.people ? "FINISH 1 AND 2 TO CONTINUE" : "CONTINUE — PLAN A TRIP"}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ZoneScreenContainer>
  );
}
