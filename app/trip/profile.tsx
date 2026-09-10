// Profile vault: everything that prefills a trip plan. Saved on every
// change (debounced) so a half-finished profile still helps.

import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { ZoneScreenContainer, ZoneScreenHeader } from "@/components/avalanche/ZoneScreenChrome";
import { CollapsibleSection } from "@/components/observation/CollapsibleSection";
import { AddButton, ContactsEditor, GearEditor, PartyEditor, SubjectEditor, VehicleEditor } from "@/components/trip/editors";
import { newId } from "@/lib/tripPlan/ids";
import { emptyProfile, loadProfile, saveProfile, type TripProfile } from "@/lib/tripPlan/store";

type Section = "you" | "vehicles" | "gear" | "people" | "partners";

export default function TripProfileScreen() {
  const [profile, setProfile] = useState<TripProfile>(emptyProfile());
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<Set<Section>>(new Set(["you"]));
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProfile().then((p) => {
      setProfile(p);
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

  const toggle = (s: Section) =>
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });

  if (!loaded) return <ZoneScreenContainer><Stack.Screen options={{ headerShown: false }} /></ZoneScreenContainer>;

  const s = profile.subject;
  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader eyebrow="TRIP PLAN" title="Your profile" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 64 }} keyboardShouldPersistTaps="handled">
          <Text className="text-ink-300" style={{ fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
            This is what Search and Rescue asks a reporting party for. Fill in what you can; every trip plan
            starts from here. Medical notes, address, and date of birth are kept in the device keychain and only
            leave the phone inside a plan you send.
            {savedAt ? `\nSaved ${savedAt}.` : ""}
          </Text>

          <CollapsibleSection
            eyebrow="ABOUT YOU"
            summary={s.fullName ? `${s.fullName}${s.phone ? ` · ${s.phone}` : ""}` : null}
            open={open.has("you")}
            complete={!!s.fullName && !!s.phone}
            onToggle={() => toggle("you")}
          >
            <SubjectEditor value={s} onChange={(v) => update((p) => ({ ...p, subject: v }))} />
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="VEHICLES"
            summary={profile.vehicles.length ? profile.vehicles.map((v) => v.label).join(", ") : null}
            open={open.has("vehicles")}
            complete={profile.vehicles.length > 0}
            onToggle={() => toggle("vehicles")}
          >
            <View style={{ gap: 12 }}>
              {profile.vehicles.map((v, i) => (
                <View key={v.id} style={{ gap: 10, padding: 12, borderRadius: 10, backgroundColor: palette.ink[900] }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Pressable onPress={() => update((p) => ({ ...p, defaultVehicleId: v.id }))} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Ionicons name={profile.defaultVehicleId === v.id ? "radio-button-on" : "radio-button-off"} size={18} color={palette.frost[400]} />
                      <Text variant="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: palette.ink[400] }}>DEFAULT</Text>
                    </Pressable>
                    <Pressable onPress={() => update((p) => ({ ...p, vehicles: p.vehicles.filter((_, j) => j !== i) }))} hitSlop={10}>
                      <Ionicons name="close-circle-outline" size={20} color={palette.ink[400]} />
                    </Pressable>
                  </View>
                  <VehicleEditor value={v} onChange={(nv) => update((p) => ({ ...p, vehicles: p.vehicles.map((x, j) => (j === i ? nv : x)) }))} />
                </View>
              ))}
              <AddButton
                label="Add a vehicle"
                onPress={() =>
                  update((p) => {
                    const id = newId();
                    return {
                      ...p,
                      vehicles: [...p.vehicles, { id, label: "", type: "truck" }],
                      defaultVehicleId: p.defaultVehicleId ?? id,
                    };
                  })
                }
              />
            </View>
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="GEAR & COMMS"
            summary={profile.gear.satDeviceType ? `Sat: ${profile.gear.satDeviceType}` : profile.gear.overnightGear ? "Set" : null}
            open={open.has("gear")}
            complete={!!(profile.gear.satDeviceType || profile.gear.overnightGear || profile.gear.clothingColors)}
            onToggle={() => toggle("gear")}
          >
            <GearEditor value={profile.gear} onChange={(g) => update((p) => ({ ...p, gear: g }))} />
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="YOUR PEOPLE"
            summary={profile.contacts.length ? profile.contacts.map((c) => c.displayName).join(", ") : null}
            open={open.has("people")}
            complete={profile.contacts.length > 0}
            onToggle={() => toggle("people")}
          >
            <Text className="text-ink-300" style={{ fontSize: 12, lineHeight: 17, marginBottom: 4 }}>
              The people you&apos;d hand a trip plan to. Pick from them in one tap when you send.
            </Text>
            <ContactsEditor
              value={profile.contacts}
              onChange={(c) => update((p) => ({ ...p, contacts: c }))}
              saved={[]}
              newId={newId}
              max={10}
            />
          </CollapsibleSection>

          <CollapsibleSection
            eyebrow="USUAL PARTNERS"
            summary={profile.party.length ? profile.party.map((m) => m.name).join(", ") : null}
            open={open.has("partners")}
            complete={profile.party.length > 0}
            onToggle={() => toggle("partners")}
          >
            <PartyEditor value={profile.party} onChange={(m) => update((p) => ({ ...p, party: m }))} />
          </CollapsibleSection>
        </ScrollView>
      </KeyboardAvoidingView>
    </ZoneScreenContainer>
  );
}
