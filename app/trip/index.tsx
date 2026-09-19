// Trip Plan hub. Live plan → status, contacts, I'M BACK. No plan → the
// fast path: repeat last trip, saved trips, favorite zones, new plan.

import { useCallback, useEffect, useState } from "react";
import { Touchable } from "@/components/ui/Touchable";
import { Alert, ScrollView, Share, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { palette } from "@/constants/design";
import { ZoneScreenContainer, ZoneScreenHeader } from "@/components/avalanche/ZoneScreenChrome";
import { Eyebrow, PlanCard } from "@/components/trip/PlanCard";
import { useTripPlan } from "@/lib/tripPlan/useTripPlan";
import { shareMessage } from "@/lib/tripPlan/packet";
import { markShared } from "@/lib/tripPlan/send";
import { loadProfile, loadTemplates, mostRecentTemplate, rankTemplates } from "@/lib/tripPlan/store";
import type { TripTemplate } from "@/lib/tripPlan/schema";
import { loadFavorites } from "@/lib/offlineCache";
import { AVAILABLE_ZONES } from "@/lib/zones";

export default function TripHubScreen() {
  const router = useRouter();
  const { plan, history, loaded, pendingActions, sync, checkIn, cancel, dismiss, reload } = useTripPlan();
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
          <Touchable onPress={() => router.push("/trip/profile" as never)} hitSlop={10}>
            <Ionicons name="person-circle-outline" size={26} color={palette.ink[200]} />
          </Touchable>
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
                    <Touchable
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
                    </Touchable>
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

        {/* Past trips, shown in every state — including mid-trip. Before
            this, a trip that closed and was dismissed was simply gone. The
            current plan is excluded so a just-closed trip isn't listed twice. */}
        <PastTrips
          trips={history.filter((t) => t.planId !== plan?.planId)}
          onOpen={(id) => router.push(`/trip/history/${encodeURIComponent(id)}` as never)}
        />
      </ScrollView>
    </ZoneScreenContainer>
  );
}

const CLOSE_LABEL: Record<string, string> = {
  checked_in: "Checked in",
  cancelled_by_user: "Cancelled",
  contact_heard_from: "A contact heard from you",
  search_started: "Search started",
  expired: "Expired, no check-in",
};

function PastTrips({
  trips,
  onOpen,
}: {
  trips: NonNullable<ReturnType<typeof useTripPlan>["history"]>;
  onOpen: (planId: string) => void;
}) {
  if (trips.length === 0) return null;
  return (
    <View style={{ gap: 8, marginTop: 6 }}>
      <Eyebrow>{`PAST TRIPS · ${trips.length}`}</Eyebrow>
      {trips.slice(0, 10).map((t) => (
        <QuickRow
          key={t.planId}
          icon={t.closeReason === "search_started" || t.closeReason === "expired" ? "alert-circle-outline" : "checkmark-circle-outline"}
          title={t.areaName}
          subtitle={`${formatDay(t.departAt, t.timezone)} · ${CLOSE_LABEL[t.closeReason ?? ""] ?? "Closed"}`}
          onPress={() => onOpen(t.planId)}
        />
      ))}
    </View>
  );
}

function formatDay(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

// ─────────────────────────── pieces ────────────────────────────────────────

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
    <Touchable
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
    </Touchable>
  );
}
