// Trip Plan hub. Live plan → status, contacts, I'M BACK. No plan → the
// fast path: repeat last trip, saved trips, favorite zones, new plan.

import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Share, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { palette } from "@/constants/design";
import { ZoneScreenContainer, ZoneScreenHeader } from "@/components/avalanche/ZoneScreenChrome";
import { useTripPlan } from "@/lib/tripPlan/useTripPlan";
import { formatLocal, shareMessage } from "@/lib/tripPlan/packet";
import { markShared } from "@/lib/tripPlan/send";
import { loadProfile, loadTemplates, mostRecentTemplate, rankTemplates } from "@/lib/tripPlan/store";
import type { TripTemplate } from "@/lib/tripPlan/schema";
import { loadFavorites } from "@/lib/offlineCache";
import { AVAILABLE_ZONES } from "@/lib/zones";

export default function TripHubScreen() {
  const router = useRouter();
  const { plan, loaded, pendingActions, sync, checkIn, cancel, dismiss, reload } = useTripPlan();
  const [templates, setTemplates] = useState<TripTemplate[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [hasProfile, setHasProfile] = useState(false);

  useFocusEffect(
    useCallback(() => {
      reload();
      loadTemplates().then(setTemplates);
      loadFavorites().then((f) => setFavorites(f ?? []));
      loadProfile().then((p) => setHasProfile(!!p.subject.fullName && !!p.subject.phone));
    }, [reload]),
  );

  useEffect(() => {
    sync();
  }, [sync]);

  if (!loaded) return <ZoneScreenContainer><Stack.Screen options={{ headerShown: false }} /></ZoneScreenContainer>;

  const live = plan && plan.status !== "closed";
  const recent = mostRecentTemplate(templates);
  const ranked = rankTemplates(templates).filter((t) => t.id !== recent?.id).slice(0, 5);
  const favZones = AVAILABLE_ZONES.filter((z) => favorites.includes(z.id)).slice(0, 6);

  const shareTo = async (contactId: string) => {
    if (!plan) return;
    const c = plan.contacts.find((x) => x.id === contactId);
    if (!c?.shareUrl) return;
    const message = shareMessage({
      subjectName: plan.subjectName,
      areaName: plan.areaName,
      returnBy: plan.returnBy,
      worryBy: plan.worryBy,
      timezone: plan.timezone,
      url: c.shareUrl,
    });
    const res = await Share.share({ message });
    if (res.action === Share.sharedAction) {
      await markShared(plan.planId, contactId);
      reload();
    }
  };

  const confirmCancel = () => {
    Alert.alert("Cancel this trip?", "Your people will be told the trip is off.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel trip", style: "destructive", onPress: () => cancel() },
    ]);
  };

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader
        eyebrow={live ? "YOUR PEOPLE KNOW" : "PLAN FOR THE WORST · HOPE FOR THE BEST"}
        title={live ? plan!.areaName : "Let your people know"}
        rightAction={
          <Pressable onPress={() => router.push("/trip/profile" as never)} hitSlop={10}>
            <Ionicons name="person-circle-outline" size={26} color={palette.ink[200]} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }}>
        {plan ? (
          <PlanCard
            plan={plan}
            pending={pendingActions}
            onCheckIn={() =>
              Alert.alert("You're back?", "Tell your people you're back safe.", [
                { text: "Not yet", style: "cancel" },
                { text: "I'm back", onPress: () => checkIn() },
              ])
            }
            onCancel={confirmCancel}
            onShare={shareTo}
            onDismiss={dismiss}
          />
        ) : null}

        {!live ? (
          <>
            {!hasProfile ? (
              <Card accent={palette.aspen[400]} eyebrow="FIRST TIME · 2 MINUTES">
                <Text className="text-ink-200" style={{ fontSize: 14, lineHeight: 20 }}>
                  Set up your profile once — you, your car, your gear, your people — and every trip after
                  this is a couple of taps from the truck.
                </Text>
                <Button variant="primary" className="mt-3" onPress={() => router.push("/trip/profile" as never)}>
                  SET UP MY PROFILE
                </Button>
              </Card>
            ) : null}

            {recent ? (
              <QuickRow
                icon="refresh-outline"
                eyebrow="REPEAT LAST TRIP"
                title={recent.label}
                subtitle={`${recent.trailheadName} · ${recent.usualTripHours}h · ${recent.contactIds.length} contact${recent.contactIds.length === 1 ? "" : "s"}`}
                onPress={() => router.push(`/trip/new?templateId=${encodeURIComponent(recent.id)}` as never)}
                primary
              />
            ) : null}

            {ranked.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Eyebrow>SAVED TRIPS · MOST USED</Eyebrow>
                {ranked.map((t) => (
                  <QuickRow
                    key={t.id}
                    icon="bookmark-outline"
                    title={t.label}
                    subtitle={`${t.trailheadName} · used ${t.useCount}×`}
                    onPress={() => router.push(`/trip/new?templateId=${encodeURIComponent(t.id)}` as never)}
                  />
                ))}
              </View>
            ) : null}

            {favZones.length > 0 ? (
              <View style={{ gap: 8 }}>
                <Eyebrow>YOUR FAVORITE ZONES</Eyebrow>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {favZones.map((z) => (
                    <Pressable
                      key={z.id}
                      onPress={() => router.push(`/trip/new?zoneId=${encodeURIComponent(z.id)}` as never)}
                      style={({ pressed }) => ({
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderRadius: 999,
                        borderWidth: 0.5,
                        borderColor: palette.ink[500] + "88",
                        backgroundColor: pressed ? palette.ink[900] : palette.ink[800],
                      })}
                    >
                      <Text variant="mono" weight="medium" style={{ fontSize: 12, letterSpacing: 1, color: palette.ink[200] }}>
                        {z.name.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Button variant={recent ? "outline" : "primary"} size="lg" onPress={() => router.push("/trip/new" as never)}>
              I&apos;M HEADING OUT
            </Button>

            <Text className="text-ink-400" style={{ fontSize: 12, lineHeight: 17, marginTop: 4 }}>
              Your people get a link with everything Search and Rescue will ask for, plus a reminder if you
              haven&apos;t checked in by your worry-by time. Send it while you still have signal. This app
              does not contact rescuers — your person does, with everything in hand.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </ZoneScreenContainer>
  );
}

// ─────────────────────────── pieces ────────────────────────────────────────

function PlanCard({
  plan,
  pending,
  onCheckIn,
  onCancel,
  onShare,
  onDismiss,
}: {
  plan: NonNullable<ReturnType<typeof useTripPlan>["plan"]>;
  pending: number;
  onCheckIn: () => void;
  onCancel: () => void;
  onShare: (contactId: string) => void;
  onDismiss: () => void;
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
        {pending > 0 ? " · SYNCING" : ""}
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
            {!closed && c.shareUrl ? (
              <Pressable onPress={() => onShare(c.id)} hitSlop={8} style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 0.5, borderColor: palette.ink[500] }}>
                <Text variant="mono" weight="medium" style={{ fontSize: 11, letterSpacing: 1.1, color: palette.ink[200] }}>
                  {c.sharedAt ? "RESEND" : "SEND"}
                </Text>
              </Pressable>
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

      {!closed ? (
        <>
          <Pressable
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
          </Pressable>
          <Pressable onPress={onCancel} hitSlop={8} style={{ alignSelf: "center", padding: 8 }}>
            <Text variant="mono" style={{ fontSize: 11, letterSpacing: 1.2, color: palette.ink[400] }}>CANCEL TRIP</Text>
          </Pressable>
        </>
      ) : (
        <Button variant="outline" onPress={onDismiss}>DISMISS</Button>
      )}
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

function Eyebrow({ children }: { children: string }) {
  return (
    <Text variant="mono" weight="medium" style={{ fontSize: 10, letterSpacing: 1.4, color: palette.ink[400] }}>{children}</Text>
  );
}

function Card({ children, eyebrow, accent }: { children: React.ReactNode; eyebrow: string; accent: string }) {
  return (
    <View style={{ borderRadius: 14, borderWidth: 0.5, borderColor: accent, backgroundColor: palette.ink[800], padding: 16 }}>
      <Text variant="mono" weight="medium" style={{ fontSize: 10, letterSpacing: 1.6, color: accent, marginBottom: 8 }}>{eyebrow}</Text>
      {children}
    </View>
  );
}

function QuickRow({ icon, eyebrow, title, subtitle, onPress, primary }: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  eyebrow?: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        minHeight: 64,
        borderRadius: 12,
        borderWidth: primary ? 1 : 0.5,
        borderColor: primary ? palette.frost[400] : palette.ink[500] + "88",
        backgroundColor: pressed ? palette.ink[900] : primary ? palette.frost[400] + "14" : palette.ink[800],
      })}
    >
      <Ionicons name={icon} size={22} color={primary ? palette.frost[400] : palette.ink[300]} />
      <View style={{ flex: 1 }}>
        {eyebrow ? <Text variant="mono" weight="medium" style={{ fontSize: 10, letterSpacing: 1.4, color: palette.frost[400] }}>{eyebrow}</Text> : null}
        <Text className="text-ink-100" weight="semibold" style={{ fontSize: 16 }}>{title}</Text>
        <Text className="text-ink-400" style={{ fontSize: 12, marginTop: 1 }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={palette.ink[400]} />
    </Pressable>
  );
}
