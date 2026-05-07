import { forwardRef, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";

// One section of the obs form, shaped like a wizard step that lives in
// a long scroll. Default collapsed → tap header to open. When the user
// taps "Done" the screen marks complete + auto-opens the next.
//
// State (open / completed) is owned by the parent so the screen can
// implement "only one open at a time" + auto-advance logic.

interface Props {
  eyebrow: string;
  // One-line snapshot of the section's contents — shown in the
  // collapsed header so the user can scan progress without expanding.
  // Pass null/empty when nothing has been entered yet.
  summary?: string | null;
  open: boolean;
  complete: boolean;
  // Disable interaction (e.g., section that shouldn't be edited yet).
  disabled?: boolean;
  onToggle: () => void;
  // "Done" button at the bottom of the body — only rendered when this
  // callback is provided. Skipping it produces a section that's always
  // open or closes only via header tap (e.g., the avalanche detail
  // section that depends on a parent toggle).
  onDone?: () => void;
  // Optional copy for the Done button. Defaults to "Done · Next →".
  doneLabel?: string;
  children: ReactNode;
}

export const CollapsibleSection = forwardRef<View, Props>(
  function CollapsibleSection(
    {
      eyebrow,
      summary,
      open,
      complete,
      disabled,
      onToggle,
      onDone,
      doneLabel,
      children,
    },
    ref,
  ) {
    return (
      <View
        ref={ref}
        style={{
          marginBottom: 12,
          borderRadius: 14,
          backgroundColor: palette.ink[800],
          borderWidth: open ? 1 : 0.5,
          borderColor: open
            ? palette.frost[400] + "AA"
            : complete
              ? palette.frost[400] + "55"
              : palette.ink[500] + "55",
          overflow: "hidden",
          opacity: disabled ? 0.45 : 1,
        }}
      >
        <Pressable
          onPress={disabled ? undefined : onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open, disabled }}
          accessibilityLabel={
            open
              ? `Collapse ${eyebrow.toLowerCase()}`
              : `Expand ${eyebrow.toLowerCase()}`
          }
          style={({ pressed }) => ({
            paddingVertical: 16,
            paddingHorizontal: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            backgroundColor: pressed ? palette.ink[900] : "transparent",
          })}
        >
          {/* Status dot */}
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: complete
                ? palette.frost[400]
                : open
                  ? palette.frost[400] + "55"
                  : palette.ink[500] + "55",
            }}
          />
          <View style={{ flex: 1 }}>
            <Text
              variant="mono"
              weight="medium"
              style={{
                fontSize: 10,
                letterSpacing: 1.4,
                color: complete ? palette.frost[400] : palette.ink[300],
              }}
            >
              {eyebrow}
            </Text>
            {summary ? (
              <Text
                className="text-ink-100"
                style={{ fontSize: 14, lineHeight: 19, marginTop: 4 }}
                numberOfLines={2}
              >
                {summary}
              </Text>
            ) : (
              <Text
                className="text-ink-400"
                style={{
                  fontSize: 13,
                  lineHeight: 18,
                  marginTop: 4,
                  fontStyle: "italic",
                }}
              >
                Tap to fill in
              </Text>
            )}
          </View>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={20}
            color={palette.ink[300]}
          />
        </Pressable>

        {open ? (
          <View style={{ padding: 16, paddingTop: 4, gap: 16 }}>
            {children}
            {onDone ? (
              <Pressable
                onPress={onDone}
                style={({ pressed }) => ({
                  marginTop: 4,
                  paddingVertical: 14,
                  borderRadius: 999,
                  backgroundColor: pressed
                    ? palette.frost[500]
                    : palette.frost[400],
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 8,
                })}
              >
                <Text
                  variant="mono"
                  weight="bold"
                  style={{
                    fontSize: 13,
                    letterSpacing: 1.4,
                    color: palette.ink[950],
                  }}
                >
                  {doneLabel ?? "DONE · NEXT"}
                </Text>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={palette.ink[950]}
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  },
);
