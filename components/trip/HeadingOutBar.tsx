// Bottom action bar for the home screen: HEADING OUT (your people) on
// the left, REPORT OBS on the right. When a trip is live the left pill
// becomes I'M BACK and a thin status strip appears above the bar.
//
// Replaces the single REPORT FAB and the top-of-page card: the two
// actions people take from the truck belong together, at thumb height.

import { Alert, View } from "react-native";
import { Touchable } from "@/components/ui/Touchable";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { useTripPlan } from "@/lib/tripPlan/useTripPlan";
import { formatLocal } from "@/lib/tripPlan/packet";
import { loadProfile } from "@/lib/tripPlan/store";

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
  // First run goes to the profile with its intro, not straight to the
  // composer: there is nothing to confirm until the one-time setup exists.
  const goNew = async () => {
    Haptics.selectionAsync().catch(() => {});
    const p = await loadProfile().catch(() => null);
    const ready = !!p?.subject.fullName && !!p?.subject.phone;
    router.push((ready ? "/trip/new" : "/trip/profile?intro=1") as never);
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
        <Touchable
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
            // Opaque: this sits over the zone list.
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
        </Touchable>
      ) : null}

      <View pointerEvents="box-none" style={{ flexDirection: "row", gap: 12 }}>
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

// One solid pill. Structure matters on iOS: the shadow lives on an outer
// View and the clipping/pressed state on the inner Pressable — putting a
// shadow and `overflow: "hidden"` on the same view clips the shadow, and a
// translucent wrapper let the page show through the button.
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
        borderRadius: 28,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: rim,
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Touchable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => ({
          height: 58,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 12,
          borderRadius: 28,
          overflow: "hidden",
          backgroundColor: pressed ? "#00000022" : "transparent",
        })}
      >
        {/* Icon + label sit in their own centred row instead of being
            direct children of the Pressable: on device the label kept
            rendering below the pill's bottom edge. Two causes, both pinned
            here — the mono face's default line box is taller than its point
            size, so `lineHeight` is explicit; and Text scales with the
            system Dynamic Type setting by default, which overflows a
            fixed-height button, so scaling is off for this chrome. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Ionicons name={icon} size={18} color={fg} />
          <Text
            variant="mono"
            weight="bold"
            numberOfLines={1}
            allowFontScaling={false}
            style={{
              fontSize: 12,
              lineHeight: 14,
              letterSpacing: 0.6,
              color: fg,
              textAlign: "center",
              includeFontPadding: false,
            }}
          >
            {label}
          </Text>
        </View>
      </Touchable>
    </View>
  );
}
