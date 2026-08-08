import { useState } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { FieldError, FieldLabel } from "./formPrimitives";

// Tap-to-open date field. Shows a friendly summary in a pill-shaped
// trigger ("Today" / "Yesterday" / "May 5") and opens the native
// iOS spinner picker in a bottom sheet on tap. On Android we use the
// default modal date dialog (which is what users expect there).

interface Props {
  label: string;
  required?: boolean;
  hint?: string;
  value: Date;
  onChange: (next: Date) => void;
  // Don't allow picking past this date (defaults to today).
  maxDate?: Date;
  // Don't allow picking before this date (defaults to ~30 days ago).
  minDate?: Date;
  error?: string;
}

const MS_PER_DAY = 86_400_000;

export function DateField({
  label,
  required,
  hint,
  value,
  onChange,
  maxDate,
  minDate,
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  // Buffer the value while the spinner is open on iOS — only commit on
  // Done so the user can scroll without firing onChange every tick.
  const [draft, setDraft] = useState<Date>(value);
  const insets = useSafeAreaInsets();

  const today = startOfDay(new Date());
  const max = maxDate ?? today;
  const min = minDate ?? new Date(today.getTime() - 30 * MS_PER_DAY);

  const handleAndroidChange = (
    event: DateTimePickerEvent,
    next?: Date,
  ) => {
    setOpen(false);
    if (event.type === "set" && next) onChange(next);
  };

  const handleIosChange = (
    _event: DateTimePickerEvent,
    next?: Date,
  ) => {
    if (next) setDraft(next);
  };

  const openPicker = () => {
    setDraft(value);
    setOpen(true);
  };

  return (
    <View>
      <FieldLabel label={label} hint={hint} required={required} />
      <Pressable
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}, currently ${formatLong(value)}`}
        style={({ pressed }) => ({
          minHeight: 52,
          paddingHorizontal: 14,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          borderRadius: 10,
          borderWidth: error ? 1 : 0.5,
          borderColor: error
            ? palette.aspen[400]
            : pressed
              ? palette.frost[400]
              : palette.ink[500] + "66",
          backgroundColor: palette.ink[900],
        })}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Ionicons name="calendar-outline" size={18} color={palette.ink[300]} />
          <Text
            style={{
              fontSize: 16,
              lineHeight: 22,
              color: palette.ink[100],
              flex: 1,
            }}
          >
            {formatLong(value)}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={palette.ink[300]} />
      </Pressable>
      <FieldError message={error} />

      {Platform.OS === "android" && open ? (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          maximumDate={max}
          minimumDate={min}
          onChange={handleAndroidChange}
        />
      ) : null}

      {Platform.OS === "ios" ? (
        <Modal
          visible={open}
          transparent
          animationType="slide"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            onPress={() => setOpen(false)}
            style={{
              flex: 1,
              backgroundColor: "rgba(15,13,11,0.55)",
              justifyContent: "flex-end",
            }}
          >
            <Pressable
              onPress={() => {}}
              style={{
                backgroundColor: palette.ink[800],
                borderTopLeftRadius: 18,
                borderTopRightRadius: 18,
                paddingBottom: insets.bottom + 12,
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  paddingTop: 10,
                  paddingBottom: 6,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: palette.ink[500] + "AA",
                  }}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 18,
                  paddingBottom: 4,
                }}
              >
                <Text
                  variant="display"
                  className="text-ink-100"
                  style={{ fontSize: 18, lineHeight: 22 }}
                >
                  {label}
                </Text>
                <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                  <Ionicons name="close" size={22} color={palette.ink[300]} />
                </Pressable>
              </View>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                themeVariant="light"
                maximumDate={max}
                minimumDate={min}
                onChange={handleIosChange}
                style={{ alignSelf: "stretch" }}
              />
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 8,
                  paddingBottom: 4,
                  borderTopWidth: 0.5,
                  borderColor: palette.ink[500] + "55",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <Pressable
                  onPress={() => {
                    onChange(draft);
                    setOpen(false);
                  }}
                  style={({ pressed }) => ({
                    paddingHorizontal: 22,
                    paddingVertical: 12,
                    borderRadius: 999,
                    backgroundColor: pressed
                      ? palette.frost[500]
                      : palette.frost[400],
                  })}
                >
                  <Text
                    variant="mono"
                    weight="bold"
                    style={{
                      fontSize: 12,
                      letterSpacing: 1.4,
                      color: "#FFFFFF",
                    }}
                  >
                    DONE
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatLong(d: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diff = Math.round(
    (today.getTime() - target.getTime()) / MS_PER_DAY,
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${WEEKDAY_LONG[d.getDay()]}, ${MONTH_LONG[d.getMonth()]} ${d.getDate()}`;
}
