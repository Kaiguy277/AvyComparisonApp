import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, UIManager, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ReactNode } from "react";
import { Text } from "./Text";
import { palette } from "@/constants/design";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  variant?: "default" | "flush";
  rightAccessory?: ReactNode;
  leadingAccent?: string;
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  className = "",
  variant = "default",
  rightAccessory,
  leadingAccent,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext({
      duration: 220,
      create: { type: "easeInEaseOut", property: "opacity" },
      update: { type: "easeInEaseOut" },
    });
    setOpen((v) => !v);
  };

  const wrapper =
    variant === "flush"
      ? "border-b border-ink-700/60"
      : "rounded-xl border border-ink-700/60 bg-ink-800/40";

  return (
    <View className={`${wrapper} ${className}`} style={{ borderWidth: 0.5, borderColor: palette.ink[700] }}>
      <Pressable
        onPress={toggle}
        className="flex-row items-center px-4 py-3.5"
      >
        {leadingAccent ? (
          <View
            style={{
              width: 3,
              height: 18,
              borderRadius: 2,
              backgroundColor: leadingAccent,
              marginRight: 10,
            }}
          />
        ) : null}
        <View className="flex-1 flex-row items-center gap-2">
          {typeof title === "string" ? (
            <Text variant="mono" weight="medium" className="text-[11px] uppercase tracking-[0.16em] text-ink-200">
              {title}
            </Text>
          ) : (
            title
          )}
        </View>
        <View className="flex-row items-center gap-2">
          {rightAccessory}
          <Ionicons
            name={open ? "remove" : "add"}
            size={16}
            color={palette.ink[300]}
          />
        </View>
      </Pressable>
      {open ? <View className="px-4 pb-4">{children}</View> : null}
    </View>
  );
}
