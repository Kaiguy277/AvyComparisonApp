import { ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import {
  ZoneScreenContainer,
  ZoneScreenHeader,
} from "@/components/avalanche/ZoneScreenChrome";
import { AVAILABLE_ZONES, ZONE_TO_CENTER } from "@/lib/zones";

// Submit observation — entry point. The actual form sections are wired
// up in slices 5 and 6 of the observation submit feature; this scaffold
// gives us a real route + header so the entry-point work in this slice
// has somewhere to land.
//
// Accepts optional query params:
//   ?zoneId=<slug>   — pre-selects a zone (and its center)
//   ?lat=&lng=       — pre-fills the location point
// Without params, the user picks a center themselves on the form.

export default function ObservationNewScreen() {
  const params = useLocalSearchParams<{
    zoneId?: string;
    lat?: string;
    lng?: string;
  }>();

  const zone = params.zoneId
    ? AVAILABLE_ZONES.find((z) => z.id === params.zoneId)
    : undefined;
  const centerAbbr = params.zoneId ? ZONE_TO_CENTER[params.zoneId] : undefined;

  const subtitle = zone
    ? `${zone.name} · ${centerAbbr ?? "Center"}`
    : "Pick a center";

  return (
    <ZoneScreenContainer>
      <Stack.Screen options={{ headerShown: false }} />
      <ZoneScreenHeader eyebrow="REPORT OBSERVATION" title={subtitle} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: palette.ink[900],
            borderWidth: 0.5,
            borderColor: palette.ink[700],
          }}
        >
          <Text
            variant="mono"
            weight="medium"
            className="text-aspen-400"
            style={{ fontSize: 10, letterSpacing: 1.4, marginBottom: 8 }}
          >
            COMING IN THE NEXT SLICE
          </Text>
          <Text
            className="text-ink-100"
            style={{ fontSize: 14, lineHeight: 21 }}
          >
            The form will go here — name, location, what you observed, and
            optional avalanche detail. This route + header is in place so
            the entry points (home FAB and per-zone Observations header)
            have somewhere to land.
          </Text>
        </View>

        {params.lat && params.lng ? (
          <Text
            variant="mono"
            className="text-ink-400"
            style={{ fontSize: 10, letterSpacing: 1.2 }}
          >
            PRE-FILL · {Number(params.lat).toFixed(4)},{" "}
            {Number(params.lng).toFixed(4)}
          </Text>
        ) : null}
      </ScrollView>
    </ZoneScreenContainer>
  );
}
