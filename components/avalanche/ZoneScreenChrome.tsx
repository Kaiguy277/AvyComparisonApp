import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";

// Shared chrome (frame + header) for the per-zone sub-screens. Each
// section route (problems / weather / stations / discussion) wears the
// same shell so the navigation feels consistent.
//
// Underscore prefix tells expo-router to ignore this as a route.

export function ZoneScreenContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: palette.ink[950] }}>
      {children}
    </View>
  );
}

export function ZoneScreenHeader({
  eyebrow,
  title,
  count,
  rightAction,
}: {
  eyebrow: string;
  title: string;
  count?: number;
  // Optional trailing action (e.g. a "+ Report" button on the obs list).
  rightAction?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: 0.5,
        borderColor: palette.ink[700],
      }}
    >
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          // If this screen is the first in the stack — a cold launch from a
          // notification or link — router.back() does nothing at all, and the
          // back button becomes a dead end. Fall back to the home screen.
          if (router.canGoBack()) router.back();
          else router.replace("/" as never);
        }}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={24} color={palette.ink[100]} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text
          variant="mono"
          weight="medium"
          className="text-ink-400"
          style={{ fontSize: 10, letterSpacing: 1.4 }}
        >
          {eyebrow}
          {typeof count === "number" ? ` · ${count}` : ""}
        </Text>
        <Text
          variant="display"
          className="text-ink-50"
          style={{ fontSize: 18, lineHeight: 22, marginTop: 2 }}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      {rightAction}
    </View>
  );
}
