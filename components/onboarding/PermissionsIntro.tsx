import { useState } from "react";
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";
import { registerPushNotifications } from "@/lib/pushNotifications";

interface Props {
  visible: boolean;
  onComplete: () => void;
}

type PermState = "idle" | "granted" | "denied";

// First-launch intro that asks for the two permissions the app needs to
// keep the offline snapshot fresh. Only push notifications can be granted
// programmatically — Background App Refresh is a Settings-app toggle, so
// for that we deep-link the user there and trust them to flip it.
export function PermissionsIntro({ visible, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [pushState, setPushState] = useState<PermState>("idle");
  const [busy, setBusy] = useState(false);

  const handleEnableNotifications = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // If the user denied previously and iOS will no longer show the
      // prompt, deep-link them to Settings. Without this branch a
      // "DENIED · TAP TO RETRY" tap silently no-ops because
      // requestPermissionsAsync just returns the existing denial.
      const existing = await Notifications.getPermissionsAsync();
      if (!existing.granted && !existing.canAskAgain) {
        Linking.openSettings().catch(() => {});
        return;
      }
      const granted = await registerPushNotifications();
      const after = await Notifications.getPermissionsAsync();
      setPushState(after.granted ? "granted" : "denied");
      if (granted) console.log("[onboarding] push token registered");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenSettings = () => {
    // iOS doesn't expose a deep link directly to Background App Refresh.
    // openSettings() drops the user on this app's settings page where
    // they can flip both Notifications and Background App Refresh.
    Linking.openSettings().catch(() => {});
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View
        style={{
          flex: 1,
          backgroundColor: palette.ink[950],
          paddingTop: insets.top,
        }}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: 32 + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Wordmark — matches hero strip lettering. */}
          <Text
            variant="display"
            style={{
              fontSize: 36,
              lineHeight: 38,
              color: palette.ink[50],
              letterSpacing: -0.5,
            }}
          >
            AVY
          </Text>
          <Text
            variant="display"
            style={{
              fontSize: 14,
              lineHeight: 16,
              color: palette.aspen[400],
              letterSpacing: 1.5,
              marginTop: 4,
            }}
          >
            FORECAST CARDS
          </Text>

          <View
            style={{
              height: 2,
              backgroundColor: palette.ink[700],
              marginTop: 18,
              marginBottom: 24,
            }}
          />

          <Text
            variant="display"
            style={{
              fontSize: 22,
              lineHeight: 26,
              color: palette.ink[50],
              letterSpacing: -0.3,
              marginBottom: 12,
            }}
          >
            STAY CURRENT OFF-GRID
          </Text>
          <Text
            className="text-ink-200"
            style={{ fontSize: 15, lineHeight: 22, marginBottom: 22 }}
          >
            This app keeps avalanche + weather data fresh in the background
            so you have the latest forecast even when you drop out of
            service. These two iOS settings make that reliable — the more
            you grant, the fresher your offline cache.
          </Text>

          <PermissionRow
            icon="notifications-outline"
            title="Push Notifications"
            body="Lets the server wake the app to refresh the snapshot every time the cache updates. We never send banners or sounds — only silent wake-ups."
            state={pushState}
            busy={busy && pushState === "idle"}
            ctaHint="TAP TO ENABLE"
            onPress={handleEnableNotifications}
          />

          <PermissionRow
            icon="refresh-outline"
            title="Background App Refresh"
            body="Lets iOS run a backup refresh task on its own schedule. Belt-and-suspenders for when the silent push gets held back."
            ctaHint={
              Platform.OS === "ios"
                ? "TAP TO OPEN iOS SETTINGS · GENERAL → BACKGROUND APP REFRESH"
                : undefined
            }
            onPress={
              Platform.OS === "ios" ? handleOpenSettings : undefined
            }
          />

          <Pressable
            onPress={onComplete}
            style={({ pressed }) => ({
              marginTop: 24,
              paddingVertical: 12,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text
              variant="mono"
              className="text-ink-300"
              style={{
                fontSize: 12,
                letterSpacing: 1.4,
                textAlign: "center",
                textDecorationLine: "underline",
              }}
            >
              CONTINUE
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

function PermissionRow({
  icon,
  title,
  body,
  state,
  busy,
  ctaHint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  state?: PermState;
  busy?: boolean;
  // Small all-caps line below the body explaining the action — only
  // shows while the row is still actionable. Disappears once granted.
  ctaHint?: string;
  // When provided, the entire card becomes tappable. The big card
  // shape already reads as a button, so this matches user expectation
  // — they tap the card, not a small button below it.
  onPress?: () => void;
}) {
  const granted = state === "granted";
  const denied = state === "denied";
  // The card stays interactive when "denied" so the user can re-trigger
  // (e.g., the iOS Settings deep link from a denied notification grant).
  const interactive = !!onPress && !granted && !busy;

  const body_view = (
    <View
      style={{
        flexDirection: "row",
        gap: 14,
        marginBottom: 16,
        padding: 14,
        borderWidth: 1.5,
        borderColor: granted
          ? "#52BA4A"
          : denied
            ? "#DC2626"
            : interactive
              ? palette.frost[500]
              : palette.ink[700],
        backgroundColor: palette.ink[900],
        opacity: busy ? 0.6 : 1,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderWidth: 1.5,
          borderColor: palette.ink[700],
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: granted
            ? "#52BA4A"
            : denied
              ? "#DC2626"
              : palette.ink[800],
        }}
      >
        <Ionicons
          name={granted ? "checkmark" : icon}
          size={18}
          color={granted || denied ? palette.ink[700] : palette.ink[100]}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          variant="display"
          style={{
            fontSize: 13,
            lineHeight: 16,
            color: palette.ink[50],
            letterSpacing: 0.4,
          }}
        >
          {title.toUpperCase()}
        </Text>
        <Text
          className="text-ink-200"
          style={{ fontSize: 12, lineHeight: 17, marginTop: 4 }}
        >
          {body}
        </Text>
        {!granted && ctaHint ? (
          <Text
            variant="mono"
            weight="bold"
            style={{
              fontSize: 10,
              letterSpacing: 1.2,
              color: denied ? "#DC2626" : palette.frost[400],
              marginTop: 8,
            }}
          >
            {busy ? "REQUESTING…" : denied ? "DENIED · TAP TO RETRY" : ctaHint}
          </Text>
        ) : null}
      </View>
      {interactive ? (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={palette.ink[400]}
          style={{ alignSelf: "center" }}
        />
      ) : null}
    </View>
  );

  if (!onPress) return body_view;

  return (
    <Pressable
      onPress={onPress}
      disabled={!interactive}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      {body_view}
    </Pressable>
  );
}
