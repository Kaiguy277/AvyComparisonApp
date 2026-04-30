import { useState } from "react";
import { Pressable, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";

interface CollapsibleProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  rightAccessory?: ReactNode;
}

export function Collapsible({
  title,
  children,
  defaultOpen = false,
  className = "",
  rightAccessory,
}: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View className={`rounded-lg border border-border ${className}`}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between px-3 py-2.5"
      >
        <View className="flex-1 flex-row items-center gap-2">
          {typeof title === "string" ? (
            <Text className="text-sm font-medium text-foreground">{title}</Text>
          ) : (
            title
          )}
        </View>
        <View className="flex-row items-center gap-2">
          {rightAccessory}
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color="#6b7280"
          />
        </View>
      </Pressable>
      {open ? <View className="px-3 pb-3">{children}</View> : null}
    </View>
  );
}
