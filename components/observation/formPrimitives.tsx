import { forwardRef, useState } from "react";
import {
  Modal,
  Pressable,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";

// Shared form primitives for the observation submission flow. Kept
// intentionally simple — local state only, no react-hook-form. Each
// field is a controlled component bound to the form state in the
// screen above.

// ─────────────────────────── Section / Label / Hint ─────────────────────

// Forward the underlying View ref so the screen can measureLayout on
// validation errors and scroll to the offending section.
export const FormSection = forwardRef<
  View,
  {
    eyebrow: string;
    title?: string;
    children: React.ReactNode;
    hint?: string;
  }
>(function FormSection({ eyebrow, title, children, hint }, ref) {
  return (
    <View
      ref={ref}
      style={{
        marginBottom: 12,
        padding: 14,
        borderRadius: 12,
        backgroundColor: palette.ink[800],
        borderWidth: 0.5,
        borderColor: palette.ink[500] + "55",
      }}
    >
      <Text
        variant="mono"
        weight="medium"
        style={{
          fontSize: 9,
          letterSpacing: 1.4,
          color: palette.ink[400],
          marginBottom: title ? 4 : 12,
        }}
      >
        {eyebrow}
      </Text>
      {title ? (
        <Text
          variant="display"
          className="text-ink-100"
          style={{ fontSize: 17, lineHeight: 22, marginBottom: 12 }}
        >
          {title}
        </Text>
      ) : null}
      {hint ? (
        <Text
          className="text-ink-300"
          style={{ fontSize: 12, lineHeight: 17, marginBottom: 12 }}
        >
          {hint}
        </Text>
      ) : null}
      <View style={{ gap: 14 }}>{children}</View>
    </View>
  );
});

export function FieldLabel({
  label,
  required,
  hint,
  help,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  // Optional longer explanation behind a "?" button. Useful for
  // jargon-heavy fields (cracking, collapsing, D-size, trigger).
  help?: { title: string; body: string };
}) {
  return (
    <View style={{ gap: 2, marginBottom: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text
          variant="mono"
          weight="medium"
          style={{
            fontSize: 10,
            letterSpacing: 1.3,
            color: palette.ink[300],
          }}
        >
          {label.toUpperCase()}
          {required ? (
            <Text style={{ color: palette.aspen[400] }}> *</Text>
          ) : null}
        </Text>
        {help ? <HelpButton title={help.title} body={help.body} /> : null}
      </View>
      {hint ? (
        <Text
          className="text-ink-400"
          style={{ fontSize: 11, lineHeight: 15 }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// Small "?" pill that pops a modal with a longer explanation. Used on
// technical fields where the inline hint isn't enough.
export function HelpButton({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Help: ${title}`}
        style={({ pressed }) => ({
          width: 16,
          height: 16,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed
            ? palette.frost[400] + "44"
            : palette.frost[400] + "22",
          borderWidth: 0.5,
          borderColor: palette.frost[400] + "88",
        })}
      >
        <Text
          variant="mono"
          weight="bold"
          style={{
            fontSize: 9,
            color: palette.frost[400],
            lineHeight: 11,
          }}
        >
          ?
        </Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(15,13,11,0.55)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: palette.ink[800],
              borderRadius: 14,
              padding: 22,
              borderWidth: 0.5,
              borderColor: palette.ink[500] + "55",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <Text
                variant="display"
                className="text-ink-100"
                style={{ fontSize: 18, lineHeight: 22 }}
              >
                {title}
              </Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={palette.ink[300]} />
              </Pressable>
            </View>
            <Text
              className="text-ink-200"
              style={{ fontSize: 14, lineHeight: 20 }}
            >
              {body}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Text
      style={{
        fontSize: 11,
        lineHeight: 15,
        color: palette.aspen[400],
        marginTop: 4,
      }}
    >
      {message}
    </Text>
  );
}

// ─────────────────────────── TextField ──────────────────────────────────

interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  multiline?: boolean;
  // Number of visible lines for multiline. Approx — RN doesn't measure
  // exactly. Defaults to 4 for multiline.
  rows?: number;
}

export function TextField({
  label,
  required,
  hint,
  error,
  multiline,
  rows = 4,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <FieldLabel label={label} required={required} hint={hint} />
      <TextInput
        {...props}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={palette.ink[400] + "AA"}
        style={{
          fontFamily: "InstrumentSans_400Regular",
          fontSize: 14,
          lineHeight: 19,
          color: palette.ink[100],
          backgroundColor: palette.ink[900],
          borderWidth: 0.5,
          borderColor: error
            ? palette.aspen[400]
            : focused
              ? palette.frost[400]
              : palette.ink[500] + "66",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          minHeight: multiline ? Math.max(72, rows * 19 + 24) : 44,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
      <FieldError message={error} />
    </View>
  );
}

// ─────────────────────────── Chip selectors ─────────────────────────────

interface Option<V extends string = string> {
  value: V;
  label: string;
}

// Single-select chip row. For longer option lists, wrap in a horizontal
// ScrollView at the call site.
export function ChipPicker<V extends string>({
  options,
  selected,
  onSelect,
  size = "md",
}: {
  options: readonly Option<V>[];
  selected: V | undefined;
  onSelect: (v: V) => void;
  size?: "sm" | "md";
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          selected={selected === opt.value}
          onPress={() => onSelect(opt.value)}
          size={size}
        />
      ))}
    </View>
  );
}

// Multi-select chip row.
export function MultiChipPicker<V extends string>({
  options,
  selected,
  onChange,
  size = "md",
}: {
  options: readonly Option<V>[];
  selected: readonly V[];
  onChange: (next: V[]) => void;
  size?: "sm" | "md";
}) {
  const toggle = (v: V) => {
    if (selected.includes(v)) onChange(selected.filter((s) => s !== v));
    else onChange([...selected, v]);
  };
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((opt) => (
        <Chip
          key={opt.value}
          label={opt.label}
          selected={selected.includes(opt.value)}
          onPress={() => toggle(opt.value)}
          size={size}
        />
      ))}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  size = "md",
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: "sm" | "md";
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        paddingHorizontal: size === "sm" ? 10 : 12,
        paddingVertical: size === "sm" ? 6 : 8,
        borderRadius: 999,
        borderWidth: 0.5,
        borderColor: selected ? palette.frost[400] : palette.ink[500] + "55",
        backgroundColor: selected
          ? palette.frost[400] + "22"
          : pressed
            ? palette.ink[900]
            : "transparent",
      })}
    >
      <Text
        variant="mono"
        weight="medium"
        style={{
          fontSize: size === "sm" ? 10 : 11,
          letterSpacing: 1.1,
          color: selected ? palette.frost[400] : palette.ink[200],
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─────────────────────────── Switch (yes/no) ────────────────────────────

export function YesNoSwitch({
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: palette.ink[900],
        borderWidth: 0.5,
        borderColor: palette.ink[500] + "55",
        borderRadius: 999,
        padding: 2,
      }}
    >
      {[
        { v: false, label: noLabel },
        { v: true, label: yesLabel },
      ].map(({ v, label }) => {
        const active = value === v;
        return (
          <Pressable
            key={String(v)}
            onPress={() => onChange(v)}
            hitSlop={4}
            style={{
              flex: 1,
              paddingVertical: 8,
              alignItems: "center",
              borderRadius: 999,
              backgroundColor: active ? palette.ink[100] : "transparent",
            }}
          >
            <Text
              variant="mono"
              weight="medium"
              style={{
                fontSize: 11,
                letterSpacing: 1.2,
                color: active ? palette.ink[800] : palette.ink[300],
              }}
            >
              {label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
