import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { AvalancheEntryCard } from "./AvalancheEntry";
import {
  ChipPicker,
  FieldLabel,
  FormSection,
  TextField,
  YesNoSwitch,
} from "./formPrimitives";
import {
  HELP_COPY,
  INSTABILITY_DISTRIBUTION_OPTIONS,
  PHOTO_USAGE_OPTIONS,
} from "@/lib/observation/constants";
import {
  emptyAvalancheEntry,
  type AvalancheEntryForm,
  type ObservationForm,
} from "@/lib/observation/schema";

// Detail expansion. Wraps three concerns into one collapsible block:
// - Signs of instability (cracking / collapsing / avalanches observed)
// - Avalanche records (only when avalanches_observed is true)
// - Privacy & contact (private, photo usage, show name, phone)
//
// Default state: collapsed. The header doubles as the expand/collapse
// affordance and sits where the "MORE DETAIL" placeholder used to be
// in slice 5.

interface Props {
  open: boolean;
  onToggle: () => void;
  form: ObservationForm;
  onChange: (next: ObservationForm) => void;
  errors?: Record<string, string>;
}

export function DetailSection({
  open,
  onToggle,
  form,
  onChange,
  errors,
}: Props) {
  const update = <K extends keyof ObservationForm>(
    key: K,
    value: ObservationForm[K],
  ) => onChange({ ...form, [key]: value });

  const updateInstability = <
    K extends keyof ObservationForm["instability"],
  >(
    key: K,
    value: ObservationForm["instability"][K],
  ) => update("instability", { ...form.instability, [key]: value });

  return (
    <View
      style={{
        marginBottom: 12,
        borderRadius: 12,
        backgroundColor: palette.ink[800],
        borderWidth: 0.5,
        borderColor: palette.ink[500] + "55",
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={onToggle}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={
          open ? "Collapse more detail" : "Expand more detail"
        }
        style={({ pressed }) => ({
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: pressed ? palette.ink[900] : "transparent",
        })}
      >
        <View style={{ flex: 1 }}>
          <Text
            variant="mono"
            weight="medium"
            style={{
              fontSize: 9,
              letterSpacing: 1.4,
              color: palette.ink[400],
            }}
          >
            MORE DETAIL
          </Text>
          <Text
            className="text-ink-200"
            style={{ fontSize: 13, lineHeight: 18, marginTop: 4 }}
          >
            {open
              ? "Tap to collapse."
              : "Saw avalanches, cracking, or collapsing? Want to control privacy or photo credit?"}
          </Text>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={18}
          color={palette.ink[300]}
        />
      </Pressable>

      {open ? (
        <View style={{ padding: 14, paddingTop: 0, gap: 12 }}>
          {/* INSTABILITY */}
          <View
            style={{
              padding: 14,
              borderRadius: 10,
              backgroundColor: palette.ink[900],
              borderWidth: 0.5,
              borderColor: palette.ink[500] + "55",
              gap: 14,
            }}
          >
            <Text
              variant="mono"
              weight="medium"
              style={{
                fontSize: 9,
                letterSpacing: 1.4,
                color: palette.ink[400],
                marginBottom: 4,
              }}
            >
              SIGNS OF INSTABILITY
            </Text>

            {/* Avalanches observed */}
            <YesNoQuestion
              label="Did you see avalanches?"
              value={form.instability.avalanches_observed}
              onChange={(v) => updateInstability("avalanches_observed", v)}
            />
            {form.instability.avalanches_observed ? (
              <View style={{ gap: 12, paddingLeft: 12 }}>
                <Text
                  className="text-ink-300"
                  style={{ fontSize: 12, lineHeight: 17 }}
                >
                  Add details for each slide in the Avalanches section below.
                </Text>
                <YesNoQuestion
                  label="Did you trigger one?"
                  value={form.instability.avalanches_triggered}
                  onChange={(v) =>
                    updateInstability("avalanches_triggered", v)
                  }
                />
                {form.instability.avalanches_triggered ? (
                  <YesNoQuestion
                    label="Were you caught?"
                    value={form.instability.avalanches_caught}
                    onChange={(v) =>
                      updateInstability("avalanches_caught", v)
                    }
                  />
                ) : null}
              </View>
            ) : null}

            {/* Cracking */}
            <YesNoQuestion
              label="Cracking?"
              hint="Shooting cracks in the snow as you traveled."
              help={{ title: "Cracking", body: HELP_COPY.cracking }}
              value={form.instability.cracking}
              onChange={(v) => {
                updateInstability("cracking", v);
                if (!v) {
                  updateInstability("cracking_description", undefined);
                }
              }}
            />
            {form.instability.cracking ? (
              <View style={{ paddingLeft: 12 }}>
                <FieldLabel label="How widespread was the cracking?" required />
                <ChipPicker
                  options={INSTABILITY_DISTRIBUTION_OPTIONS}
                  selected={form.instability.cracking_description}
                  onSelect={(v) => updateInstability("cracking_description", v)}
                  size="sm"
                />
                {errors?.["instability.cracking_description"] ? (
                  <Text
                    style={{
                      fontSize: 11,
                      color: palette.aspen[400],
                      marginTop: 4,
                    }}
                  >
                    {errors["instability.cracking_description"]}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Collapsing */}
            <YesNoQuestion
              label="Collapsing / 'whumpfing'?"
              hint="Felt the snow settle under you with a thump."
              help={{ title: "Collapsing", body: HELP_COPY.collapsing }}
              value={form.instability.collapsing}
              onChange={(v) => {
                updateInstability("collapsing", v);
                if (!v) {
                  updateInstability("collapsing_description", undefined);
                }
              }}
            />
            {form.instability.collapsing ? (
              <View style={{ paddingLeft: 12 }}>
                <FieldLabel
                  label="How widespread was the collapsing?"
                  required
                />
                <ChipPicker
                  options={INSTABILITY_DISTRIBUTION_OPTIONS}
                  selected={form.instability.collapsing_description}
                  onSelect={(v) =>
                    updateInstability("collapsing_description", v)
                  }
                  size="sm"
                />
                {errors?.["instability.collapsing_description"] ? (
                  <Text
                    style={{
                      fontSize: 11,
                      color: palette.aspen[400],
                      marginTop: 4,
                    }}
                  >
                    {errors["instability.collapsing_description"]}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* AVALANCHE RECORDS */}
          {form.instability.avalanches_observed ? (
            <FormSection
              eyebrow="AVALANCHES"
              hint="Add a record per slide you observed. Trigger, aspect, size, and elevation are the most useful for forecasters."
            >
              {form.avalanches.map((entry, i) => (
                <AvalancheEntryCard
                  key={i}
                  index={i}
                  total={form.avalanches.length}
                  value={entry}
                  onChange={(next) => {
                    const list = [...form.avalanches];
                    list[i] = next;
                    update("avalanches", list);
                  }}
                  onRemove={() => {
                    update(
                      "avalanches",
                      form.avalanches.filter((_, idx) => idx !== i),
                    );
                  }}
                  errors={errors}
                />
              ))}
              <Pressable
                onPress={() =>
                  update("avalanches", [
                    ...form.avalanches,
                    emptyAvalancheEntry(form.start_date),
                  ])
                }
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: palette.ink[500] + "AA",
                  backgroundColor: pressed ? palette.ink[900] : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 6,
                })}
              >
                <Ionicons name="add" size={14} color={palette.ink[300]} />
                <Text
                  variant="mono"
                  weight="medium"
                  style={{
                    fontSize: 11,
                    letterSpacing: 1.4,
                    color: palette.ink[300],
                  }}
                >
                  ADD AVALANCHE
                </Text>
              </Pressable>
              {errors?.avalanches ? (
                <Text
                  style={{
                    fontSize: 11,
                    color: palette.aspen[400],
                    marginTop: 4,
                  }}
                >
                  {errors.avalanches}
                </Text>
              ) : null}
              <TextField
                label="Avalanche summary"
                hint="Optional — anything that didn't fit in the per-slide records."
                value={form.avalanches_summary ?? ""}
                onChangeText={(t) => update("avalanches_summary", t)}
                multiline
                rows={3}
                placeholder="e.g. We crossed crowns from a previous wind event on the same aspect"
              />
            </FormSection>
          ) : null}

          {/* PRIVACY & CONTACT */}
          <View
            style={{
              padding: 14,
              borderRadius: 10,
              backgroundColor: palette.ink[900],
              borderWidth: 0.5,
              borderColor: palette.ink[500] + "55",
              gap: 14,
            }}
          >
            <Text
              variant="mono"
              weight="medium"
              style={{
                fontSize: 9,
                letterSpacing: 1.4,
                color: palette.ink[400],
                marginBottom: 4,
              }}
            >
              PRIVACY & CONTACT
            </Text>

            <YesNoQuestion
              label="Make this observation private?"
              hint="Private observations are only visible to forecasters at the avalanche center, not the public."
              value={form.private}
              onChange={(v) => update("private", v)}
            />

            <View>
              <FieldLabel label="Photo usage" required />
              <ChipPicker
                options={PHOTO_USAGE_OPTIONS}
                selected={form.photoUsage}
                onSelect={(v) => update("photoUsage", v)}
                size="sm"
              />
            </View>

            <YesNoQuestion
              label="Show your name publicly?"
              hint="If no, your observation appears as 'Anonymous'. Email is always private."
              value={form.show_name}
              onChange={(v) => update("show_name", v)}
            />

            <TextField
              label="Phone"
              hint="Optional. Never shared publicly. The center may call if they want to follow up on what you saw."
              value={form.phone ?? ""}
              onChangeText={(t) => update("phone", t)}
              keyboardType="phone-pad"
              placeholder="(555) 555-5555"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function YesNoQuestion({
  label,
  hint,
  help,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  help?: { title: string; body: string };
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <FieldLabel label={label} hint={hint} help={help} />
      <YesNoSwitch value={value} onChange={onChange} />
    </View>
  );
}
