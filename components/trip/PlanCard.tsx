// The trip card: status, times, who you told and whether they opened it, the
// activity timeline, and — when live — I'M BACK / CANCEL. Shared by the hub
// (the current trip) and the past-trip screen (read-only: pass no actions).

import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Touchable } from "@/components/ui/Touchable";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { palette } from "@/constants/design";
import { formatLocal } from "@/lib/tripPlan/packet";
import type { ActivePlan } from "@/lib/tripPlan/store";

export function PlanCard({
  plan,
  pending,
  onCheckIn,
  onCancel,
  onShare,
  onDismiss,
}: {
  plan: ActivePlan;
  pending?: number;
  // All actions are optional: a past trip from history is read-only.
  onCheckIn?: () => void;
  onCancel?: () => void;
  onShare?: (contactId: string) => void;
  onDismiss?: () => void;
}) {
  const now = Date.now();
  const closed = plan.status === "closed";
  const overdue = !closed && now >= Date.parse(plan.worryBy);
  const accent = closed ? palette.ink[400] : overdue ? "#DC2626" : palette.frost[400];
  const fmt = (iso: string) => formatLocal(iso, plan.timezone, { withDate: true });
  const statusLine = closed
    ? {
        checked_in: "You checked in. Your people were told.",
        cancelled_by_user: "You cancelled this trip.",
        contact_heard_from: "One of your people marked that they heard from you.",
        search_started: "One of your people has started a search. If you are safe, call them now.",
        expired: "This trip expired without a check-in.",
      }[plan.closeReason ?? "expired"] ?? "Plan closed."
    : overdue
      ? "Past your worry-by time. Your people have been reminded."
      : plan.sync === "pending"
        ? "Not sent yet — connect to the internet to send it."
        : plan.sync === "failed"
          ? `Couldn't send: ${plan.syncError ?? "unknown error"}. Try again from a new trip.`
          : "Live. Tap I'M BACK when you're out.";

  return (
    <View style={{ borderRadius: 14, borderWidth: 0.5, borderColor: accent, backgroundColor: palette.ink[800], padding: 16, gap: 12 }}>
      <Text variant="mono" weight="medium" style={{ fontSize: 11, letterSpacing: 1.4, color: accent }}>
        {closed ? "CLOSED" : overdue ? "OVERDUE" : "LIVE"}
        {(pending ?? 0) > 0 ? " · SYNCING" : ""}
      </Text>
      <Text variant="display" className="text-ink-50" style={{ fontSize: 22, lineHeight: 26 }}>
        {plan.areaName}
      </Text>
      <Text className="text-ink-300" style={{ fontSize: 13 }}>{plan.trailheadName}</Text>
      <View style={{ flexDirection: "row", gap: 18 }}>
        <Stat label="BACK BY" value={fmt(plan.returnBy)} />
        <Stat label="WORRY BY" value={fmt(plan.worryBy)} />
      </View>
      <Text className="text-ink-200" style={{ fontSize: 13, lineHeight: 19 }}>{statusLine}</Text>

      <View style={{ gap: 8 }}>
        <Eyebrow>YOUR PEOPLE</Eyebrow>
        {plan.contacts.map((c) => (
          <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons
              name={c.lastOpenedAt ? "checkmark-done-outline" : c.sharedAt ? "checkmark-outline" : "ellipse-outline"}
              size={18}
              color={c.lastOpenedAt ? palette.frost[400] : palette.ink[400]}
            />
            <View style={{ flex: 1 }}>
              <Text className="text-ink-100" style={{ fontSize: 14 }}>{c.displayName}</Text>
              <Text className="text-ink-400" style={{ fontSize: 11 }}>
                {c.lastOpenedAt ? `Opened ${formatLocal(c.lastOpenedAt, plan.timezone, { withDate: true })}` : c.sharedAt ? "Sent · not opened yet" : c.shareUrl ? "Not sent yet" : "Waiting for server…"}
              </Text>
            </View>
            {!closed && c.shareUrl && onShare ? (
              <Touchable onPress={() => onShare(c.id)} hitSlop={8} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 0.5, borderColor: palette.ink[500] }}>
                <Text variant="mono" weight="medium" style={{ fontSize: 11, letterSpacing: 1.1, color: palette.ink[200] }}>
                  {c.sharedAt ? "RESEND" : "SEND"}
                </Text>
              </Touchable>
            ) : null}
          </View>
        ))}
      </View>

      {plan.events && plan.events.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Eyebrow>ACTIVITY</Eyebrow>
          {plan.events.slice(0, 6).map((e, i) => (
            <Text key={i} className="text-ink-300" style={{ fontSize: 12, lineHeight: 17 }}>
              {formatLocal(e.at, plan.timezone)} · {describe(e)}
            </Text>
          ))}
        </View>
      ) : null}

      {!closed && onCheckIn ? (
        <>
          <Touchable
            onPress={onCheckIn}
            disabled={!!plan.checkInQueuedAt}
            style={({ pressed }) => ({
              height: 58,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: plan.checkInQueuedAt ? palette.ink[500] : pressed ? palette.ink[100] : palette.ink[50],
            })}
          >
            <Text variant="mono" weight="bold" style={{ fontSize: 15, letterSpacing: 1.8, color: palette.ink[950] }}>
              {plan.checkInQueuedAt ? "CHECK-IN QUEUED — WILL SEND ON SIGNAL" : "I'M BACK"}
            </Text>
          </Touchable>
          {onCancel ? (
          <Touchable onPress={onCancel} hitSlop={8} style={{ alignSelf: "center", padding: 8 }}>
            <Text variant="mono" style={{ fontSize: 11, letterSpacing: 1.2, color: palette.ink[400] }}>CANCEL TRIP</Text>
          </Touchable>
          ) : null}
        </>
      ) : closed && onDismiss ? (
        <Button variant="outline" onPress={onDismiss}>DISMISS</Button>
      ) : null}
    </View>
  );
}

function describe(e: { type: string; contactName: string | null; note: string | null }): string {
  const who = e.contactName ?? "A contact";
  const note = e.note ? ` — "${e.note}"` : "";
  switch (e.type) {
    case "created": return "Plan created";
    case "opened": return `${who} opened the plan`;
    case "nudge_sent": return `Reminder sent to ${who}`;
    case "extended": return `${who} extended worry-by${note}`;
    case "heard_from": return `${who} heard from you${note}`;
    case "search_started": return `${who} started a search${note}`;
    case "checked_in": return "You checked in";
    case "cancelled": return "You cancelled";
    case "note": return `${who}: ${e.note ?? ""}`;
    default: return e.type;
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="mono" weight="medium" style={{ fontSize: 10, letterSpacing: 1.4, color: palette.ink[400] }}>{label}</Text>
      <Text className="text-ink-100" weight="semibold" style={{ fontSize: 15, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

export function Eyebrow({ children }: { children: string }) {
  return (
    <Text variant="mono" weight="medium" style={{ fontSize: 10, letterSpacing: 1.4, color: palette.ink[400] }}>{children}</Text>
  );
}
