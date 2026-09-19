// One past trip, read-only. Reached from PAST TRIPS on the trip hub.
//
// Exists because the app used to keep only the current trip: once a trip
// closed and was dismissed there was no way back to it, and the server
// deletes a plan seven days after it closes. History is local to the phone.

import { useCallback, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { Touchable } from "@/components/ui/Touchable";
import { palette } from "@/constants/design";
import { ZoneScreenContainer, ZoneScreenHeader } from "@/components/avalanche/ZoneScreenChrome";
import { PlanCard } from "@/components/trip/PlanCard";
import { loadTripHistory, removeFromHistory, type ActivePlan } from "@/lib/tripPlan/store";

export default function PastTripScreen() {
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const [trip, setTrip] = useState<ActivePlan | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      loadTripHistory().then((h) => setTrip(h.find((t) => t.planId === planId) ?? null));
    }, [planId]),
  );

  // Back normally pops to the hub. If this screen was somehow the first one
  // (nothing to go back to), send them to the hub rather than doing nothing
  // — a back button that silently no-ops is one of the dead ends Kai hit.
  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/trip" as never);
  };

  const confirmRemove = () => {
    if (!trip) return;
    Alert.alert(
      "Remove this trip?",
      "It's deleted from this phone. Your people's copy on the web was already deleted, or will be within seven days of the trip closing.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await removeFromHistory(trip.planId);
            leave();
          },
        },
      ],
    );
  };

  if (trip === undefined) {
    return (
      <ZoneScreenContainer>
        <Stack.Screen options={{ headerShown: false }} />
      </ZoneScreenContainer>
    );
  }

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader eyebrow="PAST TRIP" title={trip ? trip.areaName : "Trip not found"} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 14 }}>
        {trip ? (
          <>
            {/* No actions passed: a closed trip can't be checked in,
                cancelled, resent or dismissed from here. */}
            <PlanCard plan={trip} />
            <Touchable onPress={confirmRemove} hitSlop={8} style={{ alignSelf: "center", padding: 10 }}>
              <Text variant="mono" style={{ fontSize: 11, letterSpacing: 1.2, color: palette.ink[400] }}>
                REMOVE FROM HISTORY
              </Text>
            </Touchable>
          </>
        ) : (
          <View style={{ gap: 12 }}>
            <Text className="text-ink-200" style={{ fontSize: 14, lineHeight: 20 }}>
              This trip isn&apos;t in your history any more — it may have been removed.
            </Text>
            <Button variant="outline" onPress={() => router.replace("/trip" as never)}>
              GO TO YOUR TRIPS
            </Button>
          </View>
        )}
      </ScrollView>
    </ZoneScreenContainer>
  );
}
