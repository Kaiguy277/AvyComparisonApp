// Field groups shared by the composer and the profile screen. Each is a
// controlled block: `value` in, `onChange(next)` out. No validation here —
// the screens run the zod schema and pass errors down.

import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import {
  Chip,
  ChipPicker,
  FieldLabel,
  TextField,
  YesNoSwitch,
} from "@/components/observation/formPrimitives";
import { GearGrid } from "@/components/trip/GearGrid";
import {
  EXPERIENCE_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
  type ClothingToday,
  type Contact,
  type GearProfile,
  type PartyMember,
  type SubjectProfile,
  type VehicleProfile,
} from "@/lib/tripPlan/schema";

type Errors = Record<string, string>;

// ─────────────────────────── you: identity / medical / experience ──────────

type SubjectProps = {
  value: SubjectProfile;
  onChange: (next: SubjectProfile) => void;
  errors?: Errors;
};

function useSet(value: SubjectProfile, onChange: (n: SubjectProfile) => void) {
  return <K extends keyof SubjectProfile>(k: K, v: SubjectProfile[K]) => onChange({ ...value, [k]: v });
}

// Name + how to reach you. The two required-to-send fields live here.
export function ContactInfoEditor({ value, onChange, errors = {} }: SubjectProps) {
  const set = useSet(value, onChange);
  return (
    <View style={{ gap: 12 }}>
      <TextField label="Full name" required value={value.fullName ?? ""} onChangeText={(t) => set("fullName", t)} error={errors["subject.fullName"]} autoCapitalize="words" textContentType="name" />
      <Row>
        <TextField label="Cell number" required value={value.phone ?? ""} onChangeText={(t) => set("phone", t)} error={errors["subject.phone"]} keyboardType="phone-pad" textContentType="telephoneNumber" />
        <TextField label="Carrier" value={value.cellCarrier ?? ""} onChangeText={(t) => set("cellCarrier", t)} placeholder="GCI, Verizon…" />
      </Row>
    </View>
  );
}

// What a searcher would use to recognise you.
export function DescriptionEditor({ value, onChange, errors = {} }: SubjectProps) {
  const set = useSet(value, onChange);
  return (
    <View style={{ gap: 12 }}>
      <Row>
        <TextField label="Date of birth" value={value.dateOfBirth ?? ""} onChangeText={(t) => set("dateOfBirth", t)} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" error={errors["subject.dateOfBirth"]} />
        <TextField label="Sex" value={value.sex ?? ""} onChangeText={(t) => set("sex", t)} />
      </Row>
      <Row>
        <TextField label="Height" value={value.height ?? ""} onChangeText={(t) => set("height", t)} placeholder={"5'10\""} />
        <TextField label="Weight" value={value.weight ?? ""} onChangeText={(t) => set("weight", t)} placeholder="170 lb" />
        <TextField label="Build" value={value.build ?? ""} onChangeText={(t) => set("build", t)} placeholder="Medium" />
      </Row>
      <Row>
        <TextField label="Hair" value={value.hair ?? ""} onChangeText={(t) => set("hair", t)} placeholder="Brown, short" />
        <TextField label="Eyes" value={value.eyes ?? ""} onChangeText={(t) => set("eyes", t)} placeholder="Blue" />
      </Row>
      <TextField label="Distinguishing marks" value={value.distinguishingMarks ?? ""} onChangeText={(t) => set("distinguishingMarks", t)} placeholder="Tattoos, scars, glasses, beard…" />
      <TextField label="Home address" value={value.homeAddress ?? ""} onChangeText={(t) => set("homeAddress", t)} textContentType="fullStreetAddress" />
    </View>
  );
}

// Kept in the device keychain; only leaves the phone inside a trip you send.
export function MedicalEditor({ value, onChange }: SubjectProps) {
  const set = useSet(value, onChange);
  return (
    <View style={{ gap: 12 }}>
      <TextField label="Medical conditions" value={value.medicalConditions ?? ""} onChangeText={(t) => set("medicalConditions", t)} multiline rows={2} placeholder="Asthma, diabetes, heart condition… or 'none'" />
      <TextField label="Medications" hint="What happens if a dose is missed?" value={value.medications ?? ""} onChangeText={(t) => set("medications", t)} multiline rows={2} placeholder="Name, dose, how often" />
      <Row>
        <TextField label="Allergies" value={value.allergies ?? ""} onChangeText={(t) => set("allergies", t)} placeholder="Penicillin, bees…" />
        <TextField label="Eyesight" value={value.eyesightNote ?? ""} onChangeText={(t) => set("eyesightNote", t)} placeholder="Contacts; spares in pack" />
      </Row>
    </View>
  );
}

export function ExperienceEditor({ value, onChange }: SubjectProps) {
  const set = useSet(value, onChange);
  return (
    <View style={{ gap: 12 }}>
      <View>
        <FieldLabel label="Backcountry experience" />
        <ChipPicker options={EXPERIENCE_OPTIONS} selected={value.experienceLevel} onSelect={(v) => set("experienceLevel", v)} size="sm" />
      </View>
      <TextField label="Avalanche training" value={value.avalancheTraining ?? ""} onChangeText={(t) => set("avalancheTraining", t)} placeholder="AIARE 1 (2024), Rec 2, Pro 1…" />
      <View>
        <FieldLabel label="Do you often go out alone?" />
        <YesNoSwitch value={value.goesOutAlone ?? false} onChange={(v) => set("goesOutAlone", v)} />
      </View>
    </View>
  );
}

// ─────────────────────────── vehicle ───────────────────────────────────────

export function VehicleEditor({
  value,
  onChange,
  error,
}: {
  value: VehicleProfile;
  onChange: (next: VehicleProfile) => void;
  error?: string;
}) {
  const set = <K extends keyof VehicleProfile>(k: K, v: VehicleProfile[K]) =>
    onChange({ ...value, [k]: v });
  const isSled = value.type === "snowmachine" || value.type === "trailer";
  return (
    <View style={{ gap: 14 }}>
      <View>
        <FieldLabel label="Type" required />
        <ChipPicker options={VEHICLE_TYPE_OPTIONS} selected={value.type} onSelect={(v) => set("type", v)} size="sm" />
      </View>
      {value.type !== "dropped_off" ? (
        <>
          <Row>
            <TextField label="Color" required value={value.color ?? ""} onChangeText={(t) => set("color", t)} error={error} />
            <TextField label="Year" value={value.year ?? ""} onChangeText={(t) => set("year", t)} keyboardType="number-pad" />
          </Row>
          <Row>
            <TextField label="Make" value={value.make ?? ""} onChangeText={(t) => set("make", t)} placeholder="Toyota" />
            <TextField label="Model" value={value.model ?? ""} onChangeText={(t) => set("model", t)} placeholder="Tacoma" />
          </Row>
          <Row>
            <TextField label="Plate" value={value.plate ?? ""} onChangeText={(t) => set("plate", t)} autoCapitalize="characters" />
            <TextField label="State" value={value.plateState ?? ""} onChangeText={(t) => set("plateState", t)} autoCapitalize="characters" placeholder="AK" />
          </Row>
          {isSled ? (
            <TextField label="Sled registration / trailer plate" value={value.registration ?? ""} onChangeText={(t) => set("registration", t)} />
          ) : null}
          <TextField label="Notes" value={value.notes ?? ""} onChangeText={(t) => set("notes", t)} placeholder="Rack, topper, bumper sticker…" />
        </>
      ) : null}
      <TextField label="Label" hint="Just for you, so you can pick it next time." value={value.label} onChangeText={(t) => set("label", t)} placeholder="The truck" />
    </View>
  );
}

// ─────────────────────────── gear + clothing ───────────────────────────────

export function GearEditor({
  value,
  onChange,
  compact,
}: {
  value: GearProfile;
  onChange: (next: GearProfile) => void;
  compact?: boolean;
}) {
  const set = <K extends keyof GearProfile>(k: K, v: GearProfile[K]) => onChange({ ...value, [k]: v });
  return (
    <View style={{ gap: 14 }}>
      <View>
        <FieldLabel label="Tap what you carry" hint="Owned items light up. A few ask one follow-up question." />
        <GearGrid value={value} onChange={onChange} />
      </View>
      {!compact ? (
        <>
          <TextField label="Skis / board / sled description" value={value.skiOrSledDescription ?? ""} onChangeText={(t) => set("skiOrSledDescription", t)} placeholder="Orange Skidoo Summit 850 · white Blizzard skis" />
          <TextField label="Usual clothing colors" hint="Default for 'as seen from the air'. You can change it per trip." value={value.clothingColors ?? ""} onChangeText={(t) => set("clothingColors", t)} placeholder="Red shell, black pants, orange pack" />
          <TextField label="Tent / bivy color" value={value.tentColor ?? ""} onChangeText={(t) => set("tentColor", t)} />
          <TextField label="Food for" value={value.foodDays ?? ""} onChangeText={(t) => set("foodDays", t)} placeholder="1 day" />
          <TextField label="Anything else" value={value.other ?? ""} onChangeText={(t) => set("other", t)} />
        </>
      ) : null}
    </View>
  );
}

export function ClothingEditor({
  value,
  onChange,
}: {
  value: ClothingToday;
  onChange: (next: ClothingToday) => void;
}) {
  const set = <K extends keyof ClothingToday>(k: K, v: ClothingToday[K]) => onChange({ ...value, [k]: v });
  return (
    <View style={{ gap: 14 }}>
      <Row>
        <TextField label="Jacket color" value={value.shell ?? ""} onChangeText={(t) => set("shell", t)} />
        <TextField label="Pants color" value={value.pants ?? ""} onChangeText={(t) => set("pants", t)} />
      </Row>
      <Row>
        <TextField label="Pack color" value={value.pack ?? ""} onChangeText={(t) => set("pack", t)} />
        <TextField label="Helmet color" value={value.helmet ?? ""} onChangeText={(t) => set("helmet", t)} />
      </Row>
    </View>
  );
}

// ─────────────────────────── party ─────────────────────────────────────────

export function PartyEditor({
  value,
  onChange,
}: {
  value: PartyMember[];
  onChange: (next: PartyMember[]) => void;
}) {
  const update = (i: number, patch: Partial<PartyMember>) =>
    onChange(value.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <View style={{ gap: 12 }}>
      {value.map((m, i) => (
        <View key={i} style={{ gap: 10, padding: 12, borderRadius: 10, backgroundColor: palette.ink[900] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="mono" weight="medium" style={{ fontSize: 10, letterSpacing: 1.4, color: palette.ink[400] }}>
              PARTNER {i + 1}
            </Text>
            <Pressable onPress={() => onChange(value.filter((_, j) => j !== i))} hitSlop={10}>
              <Ionicons name="close-circle-outline" size={20} color={palette.ink[400]} />
            </Pressable>
          </View>
          <TextField label="Name" required value={m.name} onChangeText={(t) => update(i, { name: t })} autoCapitalize="words" />
          <TextField label="Phone" value={m.phone ?? ""} onChangeText={(t) => update(i, { phone: t })} keyboardType="phone-pad" />
          <TextField label="Their emergency contact" value={m.emergencyContact ?? ""} onChangeText={(t) => update(i, { emergencyContact: t })} placeholder="Name + number" />
          <TextField label="Their vehicle (if separate)" value={m.vehicleNote ?? ""} onChangeText={(t) => update(i, { vehicleNote: t })} />
        </View>
      ))}
      <AddButton label={value.length === 0 ? "Add a partner" : "Add another"} onPress={() => onChange([...value, { name: "" }])} />
      {value.length === 0 ? (
        <Text className="text-ink-400" style={{ fontSize: 12, lineHeight: 17 }}>
          Going solo? Leave this empty. SAR wants every name in the party.
        </Text>
      ) : null}
    </View>
  );
}

// ─────────────────────────── contacts ──────────────────────────────────────

export function ContactsEditor({
  value,
  onChange,
  saved,
  onSaveContact,
  errors = {},
  newId,
  max = 5,
}: {
  value: Contact[];
  onChange: (next: Contact[]) => void;
  saved: Contact[];
  onSaveContact?: (c: Contact) => void;
  errors?: Errors;
  newId: () => string;
  max?: number;
}) {
  const update = (i: number, patch: Partial<Contact>) =>
    onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));
  const addBlank = () => onChange([...value, { id: newId(), displayName: "", email: "" }]);
  const addSaved = (c: Contact) => {
    if (value.some((v) => v.id === c.id)) return;
    onChange([...value, c]);
  };

  const pickFromPhone = async () => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        addBlank();
        return;
      }
      const picked = await Contacts.presentContactPickerAsync();
      if (!picked) return;
      const name = [picked.firstName, picked.lastName].filter(Boolean).join(" ") || picked.name || "";
      const email = picked.emails?.[0]?.email ?? "";
      const phone = picked.phoneNumbers?.[0]?.number ?? "";
      onChange([...value, { id: newId(), displayName: name, email, phone }]);
    } catch {
      addBlank();
    }
  };

  const unusedSaved = saved.filter((s) => !value.some((v) => v.id === s.id));

  return (
    <View style={{ gap: 12 }}>
      {unusedSaved.length > 0 && value.length < max ? (
        <View>
          <FieldLabel label="Your people" hint="Tap to add." />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {unusedSaved.map((c) => (
              <Chip key={c.id} label={c.displayName.toUpperCase()} selected={false} onPress={() => addSaved(c)} size="sm" />
            ))}
          </View>
        </View>
      ) : null}
      {value.map((c, i) => (
        <View key={c.id} style={{ gap: 10, padding: 12, borderRadius: 10, backgroundColor: palette.ink[900] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="mono" weight="medium" style={{ fontSize: 10, letterSpacing: 1.4, color: palette.ink[400] }}>
              CONTACT {i + 1}
            </Text>
            <View style={{ flexDirection: "row", gap: 14 }}>
              {onSaveContact && !saved.some((s) => s.id === c.id) && c.displayName && c.email ? (
                <Pressable onPress={() => onSaveContact(c)} hitSlop={10}>
                  <Text variant="mono" style={{ fontSize: 10, letterSpacing: 1.2, color: palette.frost[400] }}>SAVE</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => remove(i)} hitSlop={10}>
                <Ionicons name="close-circle-outline" size={20} color={palette.ink[400]} />
              </Pressable>
            </View>
          </View>
          <TextField label="Name" required value={c.displayName} onChangeText={(t) => update(i, { displayName: t })} autoCapitalize="words" error={errors[`contacts.${i}.displayName`]} />
          <TextField label="Email" required hint="Where the overdue reminders go." value={c.email} onChangeText={(t) => update(i, { email: t })} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} error={errors[`contacts.${i}.email`]} />
          <TextField label="Phone" value={c.phone ?? ""} onChangeText={(t) => update(i, { phone: t })} keyboardType="phone-pad" error={errors[`contacts.${i}.phone`]} />
        </View>
      ))}
      {value.length < max ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <AddButton label="From contacts" icon="people-outline" onPress={pickFromPhone} />
          <AddButton label="Type it in" icon="create-outline" onPress={addBlank} />
        </View>
      ) : null}
      {errors["contacts"] ? (
        <Text style={{ fontSize: 12, color: palette.aspen[400] }}>{errors["contacts"]}</Text>
      ) : null}
    </View>
  );
}

// ─────────────────────────── bits ──────────────────────────────────────────

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      {Array.isArray(children)
        ? children.map((c, i) => (
            <View key={i} style={{ flex: 1 }}>
              {c}
            </View>
          ))
        : children}
    </View>
  );
}

export function AddButton({
  label,
  onPress,
  icon = "add-circle-outline",
}: {
  label: string;
  onPress: () => void;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 48,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 10,
        borderWidth: 0.5,
        borderStyle: "dashed",
        borderColor: palette.ink[500],
        backgroundColor: pressed ? palette.ink[900] : "transparent",
      })}
    >
      <Ionicons name={icon} size={18} color={palette.ink[300]} />
      <Text variant="mono" weight="medium" style={{ fontSize: 12, letterSpacing: 1.1, color: palette.ink[200] }}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}
