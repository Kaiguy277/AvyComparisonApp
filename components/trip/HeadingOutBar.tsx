// Bottom action bar for the home screen: HEADING OUT (your people) on
// the left, REPORT OBS on the right. When a trip is live the left pill
// becomes I'M BACK and a thin status strip appears above the bar.
//
// Replaces the single REPORT FAB and the top-of-page card: the two
// actions people take from the truck belong together, at thumb height.

import { Alert, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { useTripPlan } from "@/lib/tripPlan/useTripPlan";
import { formatLocal } from "@/lib/tripPlan/packet";

const RED = "#DC2626";

export function HeadingOutBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plan, loaded, checkIn, pendingActions } = useTripPlan();

  const live = !!plan && plan.status !== "closed";
  const overdue = live && Date.now() >= Date.parse(plan!.worryBy);
  const closed = !!plan && plan.status === "closed";

  const goHub = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push("/trip" as never);
  };
  const goNew = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push("/trip/new" as never);
  };
  const confirmBack = () => {
    if (!plan) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const names = plan.contacts.map((c) => c.displayName).join(" and ");
    Alert.alert("You're back?", `Tell ${names} you're back safe.`, [
      { text: "Not yet", style: "cancel" },
      { text: "I'm back", onPress: () => checkIn() },
    ]);
  };

  const leftLabel = live ? (plan!.checkInQueuedAt ? "SENDING…" : "I'M BACK") : "HEADING OUT";
  const leftBg = live ? (overdue ? RED : palette.ink[50]) : palette.frost[500];
  const leftRim = live ? (overdue ? "#B91C1C" : palette.ink[100]) : palette.frost[600];
  const leftFg = live && !overdue ? palette.ink[950] : "#FFFFFF";

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 14,
        gap: 8,
        zIndex: 1000,
        elevation: 1000,
      }}
    >
      {loaded && plan ? (
        <Pressable
          onPress={goHub}
          style={{
            alignSelf: "stretch",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderRadius: 12,
            borderWidth: 0.5,
            borderColor: overdue ? RED : closed ? palette.ink[500] : palette.frost[400],
            backgroundColor: overdue ? "#FEE2E2" : palette.ink[800],
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.18,
            shadowRadius: 4,
            elevation: 6,
          }}
        >
          <Ionicons
            name={closed ? "checkmark-circle-outline" : overdue ? "alert-circle-outline" : "people-outline"}
            size={16}
            color={overdue ? RED : closed ? palette.ink[400] : palette.frost[400]}
          />
          <Text className="text-ink-200" style={{ fontSize: 12, flex: 1 }} numberOfLines={1}>
            {closed
              ? `${plan.areaName} · closed`
              : overdue
                ? `${plan.areaName} · overdue — your people were reminded`
                : `${plan.areaName} · back by ${formatLocal(plan.returnBy, plan.timezone, { withDate: true })}`}
            {pendingActions > 0 ? " · syncing…" : ""}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={palette.ink[400]} />
        </Pressable>
      ) : null}

      <View pointerEvents="box-none" style={{ flexDirection: "row", gap: 10 }}>
        <Pill
          label={leftLabel}
          icon={live ? "home-outline" : "people-outline"}
          bg={leftBg}
          rim={leftRim}
          fg={leftFg}
          onPress={live ? confirmBack : goNew}
          disabled={live && !!plan!.checkInQueuedAt}
          accessibilityLabel={live ? "I'm back — tell your people" : "Heading out — let your people know"}
        />
        <Pill
          label="REPORT OBS"
          icon="add"
          bg={palette.aspen[500]}
          rim={palette.aspen[600]}
          fg="#FFFFFF"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push("/observation/new" as never);
          }}
          accessibilityLabel="Report a new observation"
        />
      </View>
    </View>
  );
}

function Pill({
  label,
  icon,
  bg,
  rim,
  fg,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  bg: string;
  rim: string;
  fg: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 30,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: rim,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.28,
        shadowRadius: 5,
        elevation: 8,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => ({
          height: 58,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderRadius: 30,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name={icon} size={22} color={fg} />
        <Text
          variant="mono"
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{ fontSize: 13, letterSpacing: 1.2, color: fg }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
