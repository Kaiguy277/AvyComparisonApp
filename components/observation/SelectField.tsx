import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { FieldError, FieldLabel } from "./formPrimitives";

// iOS-style tap-to-open select. Renders as a single-tap field that
// pops a bottom sheet with the option list. Tap = single-select with
// auto-close; toggle list with checkmarks for multi-select. Designed
// for gloved use — every row is ≥56pt tall.

interface Option<V extends string = string> {
  value: V;
  label: string;
  // Optional one-line description shown beneath the label in the picker.
  hint?: string;
}

// ──────────────────── single-select ──────────────────────────────────

interface SelectFieldProps<V extends string> {
  label: string;
  hint?: string;
  required?: boolean;
  help?: { title: string; body: string };
  // Title shown at the top of the bottom sheet.
  pickerTitle?: string;
  options: readonly Option<V>[];
  value: V | undefined;
  onChange: (next: V) => void;
  error?: string;
  // Placeholder text when nothing is selected yet.
  placeholder?: string;
  // Allow clearing back to undefined.
  clearable?: boolean;
}

export function SelectField<V extends string>({
  label,
  hint,
  required,
  help,
  pickerTitle,
  options,
  value,
  onChange,
  error,
  placeholder = "Tap to choose",
  clearable,
}: SelectFieldProps<V>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View>
      <FieldLabel label={label} hint={hint} required={required} help={help} />
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, currently ${selected?.label ?? "not set"}`}
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
        <Text
          style={{
            fontSize: 16,
            lineHeight: 22,
            color: selected ? palette.ink[100] : palette.ink[400] + "DD",
            flex: 1,
          }}
          numberOfLines={1}
        >
          {selected?.label ?? placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={palette.ink[300]}
        />
      </Pressable>
      <FieldError message={error} />

      <PickerSheet
        visible={open}
        title={pickerTitle ?? label}
        onClose={() => setOpen(false)}
      >
        {clearable ? (
          <PickerRow
            label="None"
            selected={!value}
            onPress={() => {
              setOpen(false);
              onChange("" as V);
            }}
          />
        ) : null}
        {options.map((opt) => (
          <PickerRow
            key={opt.value}
            label={opt.label}
            hint={opt.hint}
            selected={opt.value === value}
            onPress={() => {
              onChange(opt.value);
              setOpen(false);
            }}
          />
        ))}
      </PickerSheet>
    </View>
  );
}

// ──────────────────── multi-select ───────────────────────────────────

interface MultiSelectFieldProps<V extends string> {
  label: string;
  hint?: string;
  required?: boolean;
  pickerTitle?: string;
  options: readonly Option<V>[];
  value: readonly V[];
  onChange: (next: V[]) => void;
  error?: string;
  placeholder?: string;
  // Format the closed-state label from the selection. Defaults to a
  // comma-joined label list.
  formatSelected?: (selected: Option<V>[]) => string;
}

export function MultiSelectField<V extends string>({
  label,
  hint,
  required,
  pickerTitle,
  options,
  value,
  onChange,
  error,
  placeholder = "Tap to choose",
  formatSelected,
}: MultiSelectFieldProps<V>) {
  const [open, setOpen] = useState(false);
  const selected = options.filter((o) => value.includes(o.value));
  const display =
    selected.length === 0
      ? placeholder
      : formatSelected
        ? formatSelected(selected)
        : selected.map((s) => s.label).join(", ");

  const toggle = (v: V) => {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  };

  return (
    <View>
      <FieldLabel label={label} hint={hint} required={required} />
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${selected.length} selected`}
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
        <Text
          style={{
            fontSize: 16,
            lineHeight: 22,
            color: selected.length > 0 ? palette.ink[100] : palette.ink[400] + "DD",
            flex: 1,
          }}
          numberOfLines={2}
        >
          {display}
        </Text>
        <Ionicons name="chevron-down" size={18} color={palette.ink[300]} />
      </Pressable>
      <FieldError message={error} />

      <PickerSheet
        visible={open}
        title={pickerTitle ?? label}
        onClose={() => setOpen(false)}
        footerLabel={`${selected.length} selected`}
        onDone={() => setOpen(false)}
      >
        {options.map((opt) => (
          <PickerRow
            key={opt.value}
            label={opt.label}
            hint={opt.hint}
            selected={value.includes(opt.value)}
            multi
            onPress={() => toggle(opt.value)}
          />
        ))}
      </PickerSheet>
    </View>
  );
}

// ──────────────────── shared bottom-sheet chrome ─────────────────────

function PickerSheet({
  visible,
  title,
  onClose,
  children,
  footerLabel,
  onDone,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footerLabel?: string;
  onDone?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(15,13,11,0.55)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={() => {
            /* swallow taps so the backdrop only closes from outside the sheet */
          }}
          style={{
            backgroundColor: palette.ink[800],
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            paddingBottom: insets.bottom + 8,
            maxHeight: "80%",
          }}
        >
          {/* Drag handle */}
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
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 18,
              paddingBottom: 8,
            }}
          >
            <Text
              variant="display"
              className="text-ink-100"
              style={{ fontSize: 18, lineHeight: 22 }}
            >
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={palette.ink[300]} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 4 }}
          >
            {children}
          </ScrollView>
          {onDone ? (
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 8,
                paddingBottom: 4,
                borderTopWidth: 0.5,
                borderColor: palette.ink[500] + "55",
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Text
                variant="mono"
                style={{
                  fontSize: 12,
                  letterSpacing: 1.2,
                  color: palette.ink[300],
                  flex: 1,
                }}
              >
                {footerLabel?.toUpperCase()}
              </Text>
              <Pressable
                onPress={onDone}
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
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PickerRow({
  label,
  hint,
  selected,
  onPress,
  multi,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 10,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: pressed ? palette.ink[900] : "transparent",
      })}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: multi ? 6 : 11,
          borderWidth: selected ? 0 : 1.5,
          borderColor: palette.ink[500],
          backgroundColor: selected ? palette.frost[400] : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected ? (
          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
        ) : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 16,
            lineHeight: 21,
            color: selected ? palette.ink[100] : palette.ink[200],
          }}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            className="text-ink-400"
            style={{ fontSize: 12, lineHeight: 16, marginTop: 2 }}
          >
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
