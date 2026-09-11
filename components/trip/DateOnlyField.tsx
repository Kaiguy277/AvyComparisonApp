// Date-of-birth style picker: a wheel in a sheet, never a keyboard. The
// value is a plain YYYY-MM-DD string so it round-trips through the zod
// schema unchanged.

import { useState } from "react";
import { Modal, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { Touchable } from "@/components/ui/Touchable";
import { palette } from "@/constants/design";
import { FieldCard, FieldError, FieldLabel } from "@/components/observation/formPrimitives";

const MIN = new Date(1915, 0, 1);

function toKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromKey(key: string | undefined): Date | null {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function pretty(key: string | undefined): string {
  const d = fromKey(key);
  if (!d) return "Tap to choose";
  return d.toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" });
}

export function DateOnlyField({
  label,
  hint,
  value,
  onChange,
  error,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  onChange: (next: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  // Default the wheel to a plausible adult birth year rather than today,
  // so nobody has to spin through 30 years of months.
  const fallback = new Date(1990, 0, 1);
  const [draft, setDraft] = useState<Date>(fromKey(value) ?? fallback);
  const insets = useSafeAreaInsets();
  const max = new Date();

  const openPicker = () => {
    setDraft(fromKey(value) ?? fallback);
    setOpen(true);
  };

  const onAndroid = (e: DateTimePickerEvent, next?: Date) => {
    setOpen(false);
    if (e.type !== "dismissed" && next) onChange(toKey(next));
  };

  return (
    <View>
      <Touchable onPress={openPicker} accessibilityRole="button" accessibilityLabel={label}>
        <FieldCard filled={!!fromKey(value)} error={!!error}>
          <FieldLabel label={label} hint={hint} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 26 }}>
            <Ionicons name="calendar-outline" size={18} color={palette.ink[300]} />
            <Text
              style={{
                fontSize: 16,
                lineHeight: 22,
                flex: 1,
                color: fromKey(value) ? palette.ink[100] : palette.ink[400] + "DD",
              }}
            >
              {pretty(value)}
            </Text>
            <Ionicons name="chevron-down" size={18} color={palette.ink[300]} />
          </View>
        </FieldCard>
      </Touchable>
      <FieldError message={error} />

      {Platform.OS === "android" && open ? (
        <DateTimePicker value={draft} mode="date" display="spinner" maximumDate={max} minimumDate={MIN} onChange={onAndroid} />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Touchable
            onPress={() => setOpen(false)}
            style={{ flex: 1, backgroundColor: "rgba(15,13,11,0.55)", justifyContent: "flex-end" }}
          >
            <Touchable
              onPress={() => undefined}
              style={{
                backgroundColor: palette.ink[800],
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                paddingBottom: insets.bottom + 12,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  borderBottomWidth: 0.5,
                  borderColor: palette.ink[500] + "55",
                }}
              >
                <Touchable onPress={() => setOpen(false)} hitSlop={10}>
                  <Text style={{ fontSize: 15, color: palette.ink[300] }}>Cancel</Text>
                </Touchable>
                <Text variant="mono" weight="medium" allowFontScaling={false} style={{ fontSize: 11, letterSpacing: 1.4, color: palette.ink[400] }}>
                  {label.toUpperCase()}
                </Text>
                <Touchable
                  onPress={() => {
                    onChange(toKey(draft));
                    setOpen(false);
                  }}
                  hitSlop={10}
                >
                  <Text weight="semibold" style={{ fontSize: 15, color: palette.frost[400] }}>Done</Text>
                </Touchable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                maximumDate={max}
                minimumDate={MIN}
                onChange={(_e, d) => d && setDraft(d)}
                textColor={palette.ink[100]}
                style={{ alignSelf: "center" }}
              />
            </Touchable>
          </Touchable>
        </Modal>
      ) : null}
    </View>
  );
}
