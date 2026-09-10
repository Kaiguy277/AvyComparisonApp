// Home-screen card for the trip plan feature. Three states: no plan
// (invite), live plan (status + big I'M BACK), closed plan (summary +
// dismiss). Designed to be glanceable from a truck seat.

import { Alert, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { useTripPlan } from "@/lib/tripPlan/useTripPlan";
import { formatLocal } from "@/lib/tripPlan/packet";

export function TripPlanHomeCard() {
  const router = useRouter();
  const { plan, loaded, pendingActions, checkIn, dismiss } = useTripPlan();
  if (!loaded) return null;

  const go = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push("/trip" as never);
  };

  if (!plan) {
    return (
      <Pressable
        onPress={go}
        style={({ pressed }) => ({
          marginTop: 8,
          marginHorizontal: 16,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 0.5,
          borderColor: palette.ink[500] + "88",
          backgroundColor: pressed ? palette.ink[900] : palette.ink[800],
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        })}
      >
        <Ionicons name="paper-plane-outline" size={18} color={palette.frost[400]} />
        <View style={{ flex: 1 }}>
          <Text variant="mono" weight="medium" style={{ fontSize: 11, letterSpacing: 1.4, color: palette.frost[400] }}>
            TRIP PLAN
          </Text>
          <Text className="text-ink-200" style={{ fontSize: 12, marginTop: 2 }}>
            Tell someone where you&apos;re going before you lose signal.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.ink[400]} />
      </Pressable>
    );
  }

  const now = Date.now();
  const overdue = plan.status !== "closed" && now >= Date.parse(plan.worryBy);
  const closed = plan.status === "closed";
  const accent = closed ? palette.ink[400] : overdue ? "#DC2626" : palette.frost[400];
  const back = formatLocal(plan.returnBy, plan.timezone, { withDate: true });

  const confirmCheckIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const names = plan.contacts.map((c) => c.displayName).join(" and ");
    Alert.alert("You're back?", `Tell ${names} you're back safe and close this plan.`, [
      { text: "Not yet", style: "cancel" },
      { text: "I'm back", style: "default", onPress: () => checkIn() },
    ]);
  };

  return (
    <View
      style={{
        marginTop: 8,
        marginHorizontal: 16,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: accent,
        backgroundColor: overdue ? "rgba(252, 165, 165, 0.10)" : palette.ink[800],
        overflow: "hidden",
      }}
    >
      <Pressable onPress={go} style={{ paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Ionicons name={closed ? "checkmark-circle-outline" : overdue ? "alert-circle-outline" : "paper-plane-outline"} size={18} color={accent} />
        <View style={{ flex: 1 }}>
          <Text variant="mono" weight="medium" style={{ fontSize: 11, letterSpacing: 1.4, color: accent }}>
            {closed
              ? plan.closeReason === "checked_in"
                ? "CHECKED IN"
                : plan.closeReason === "cancelled_by_user"
                  ? "PLAN CANCELLED"
                  : plan.closeReason === "search_started"
                    ? "SEARCH STARTED"
                    : plan.closeReason === "contact_heard_from"
                      ? "CLOSED BY CONTACT"
                      : "PLAN EXPIRED"
              : overdue
                ? "OVERDUE · CONTACTS NUDGED"
                : plan.sync === "pending"
                  ? "TRIP PLAN · NOT SENT YET"
                  : plan.sync === "failed"
                    ? "TRIP PLAN · SEND FAILED"
                    : "TRIP PLAN · LIVE"}
          </Text>
          <Text className="text-ink-200" style={{ fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {plan.areaName} · back by {back}
            {pendingActions > 0 ? " · syncing…" : ""}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.ink[400]} />
      </Pressable>
      {!closed ? (
        <Pressable
          onPress={confirmCheckIn}
          disabled={!!plan.checkInQueuedAt}
          style={({ pressed }) => ({
            marginHorizontal: 12,
            marginBottom: 12,
            height: 52,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: plan.checkInQueuedAt ? palette.ink[500] : pressed ? palette.ink[100] : palette.ink[50],
          })}
        >
          <Text variant="mono" weight="bold" style={{ fontSize: 14, letterSpacing: 1.6, color: palette.ink[950] }}>
            {plan.checkInQueuedAt ? "CHECK-IN QUEUED…" : "I'M BACK"}
          </Text>
        </Pressable>
      ) : (
        <Pressable onPress={dismiss} style={{ paddingHorizontal: 16, paddingBottom: 12 }} hitSlop={8}>
          <Text variant="mono" style={{ fontSize: 11, letterSpacing: 1.2, color: palette.ink[400] }}>DISMISS</Text>
        </Pressable>
      )}
    </View>
  );
}
