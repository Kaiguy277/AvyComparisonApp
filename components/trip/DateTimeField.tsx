import { useState } from "react";
import { Touchable } from "@/components/ui/Touchable";
import { Modal, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { FieldCard, FieldError, FieldLabel } from "@/components/observation/formPrimitives";

// Date + time picker for trip times (future-allowed). iOS: spinner in a
// bottom sheet, committed on Done. Android: date dialog then time dialog.

interface Props {
  label: string;
  required?: boolean;
  hint?: string;
  value: Date;
  onChange: (next: Date) => void;
  minDate?: Date;
  error?: string;
  // Quick-adjust chips shown under the field (e.g. "+1h").
  quick?: { label: string; apply: (d: Date) => Date }[];
}

export function formatDateTime(d: Date): string {
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ${time}`;
}

export function DateTimeField({ label, required, hint, value, onChange, minDate, error, quick }: Props) {
  const [open, setOpen] = useState(false);
  const [androidStep, setAndroidStep] = useState<"date" | "time" | null>(null);
  const [draft, setDraft] = useState<Date>(value);
  const insets = useSafeAreaInsets();

  const openPicker = () => {
    setDraft(value);
    if (Platform.OS === "android") setAndroidStep("date");
    else setOpen(true);
  };

  const onAndroid = (e: DateTimePickerEvent, next?: Date) => {
    if (e.type === "dismissed" || !next) {
      setAndroidStep(null);
      return;
    }
    if (androidStep === "date") {
      setDraft(next);
      setAndroidStep("time");
    } else {
      const merged = new Date(draft);
      merged.setHours(next.getHours(), next.getMinutes(), 0, 0);
      setAndroidStep(null);
      onChange(merged);
    }
  };

  return (
    <View>
      <Touchable onPress={openPicker} accessibilityRole="button" accessibilityLabel={label}>
        <FieldCard filled error={!!error}>
          <FieldLabel label={label} hint={hint} required={required} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 26 }}>
            <Ionicons name="time-outline" size={18} color={palette.ink[300]} />
            <Text style={{ fontSize: 16, lineHeight: 22, color: palette.ink[100], flex: 1 }}>
              {formatDateTime(value)}
            </Text>
            <Ionicons name="chevron-down" size={18} color={palette.ink[300]} />
          </View>
        </FieldCard>
      </Touchable>
      {quick && quick.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {quick.map((q) => (
            <Touchable
              key={q.label}
              onPress={() => onChange(q.apply(value))}
              hitSlop={6}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: 999,
                borderWidth: 0.5,
                borderColor: palette.ink[500] + "66",
                backgroundColor: pressed ? palette.ink[900] : "transparent",
              })}
            >
              <Text variant="mono" weight="medium" style={{ fontSize: 12, letterSpacing: 1, color: palette.ink[200] }}>
                {q.label}
              </Text>
            </Touchable>
          ))}
        </View>
      ) : null}
      <FieldError message={error} />

      {Platform.OS === "android" && androidStep ? (
        <DateTimePicker
          value={draft}
          mode={androidStep}
          display="default"
          minimumDate={androidStep === "date" ? minDate : undefined}
          onChange={onAndroid}
        />
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
                <Text variant="mono" weight="medium" style={{ fontSize: 11, letterSpacing: 1.4, color: palette.ink[400] }}>
                  {label.toUpperCase()}
                </Text>
                <Touchable
                  onPress={() => {
                    onChange(draft);
                    setOpen(false);
                  }}
                  hitSlop={10}
                >
                  <Text weight="semibold" style={{ fontSize: 15, color: palette.frost[400] }}>Done</Text>
                </Touchable>
              </View>
              <DateTimePicker
                value={draft}
                mode="datetime"
                display="spinner"
                minuteInterval={5}
                minimumDate={minDate}
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
