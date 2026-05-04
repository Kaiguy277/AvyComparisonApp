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

type PushState = "idle" | "granted" | "denied";

// First-launch intro that asks for the two permissions the app needs to
// keep the offline snapshot fresh. Only push notifications can be granted
// programmatically — Background App Refresh is a Settings-app toggle, so
// for that we deep-link the user there and trust them to flip it.
export function PermissionsIntro({ visible, onComplete }: Props) {
  const insets = useSafeAreaInsets();
  const [pushState, setPushState] = useState<PushState>("idle");
  const [busy, setBusy] = useState(false);

  const handleEnableNotifications = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const granted = await registerPushNotifications();
      // registerPushNotifications returns the token on success or null if
      // the user denied / on web / on simulator. We can also re-query
      // permissions to give the user clearer status.
      const perms = await Notifications.getPermissionsAsync();
      setPushState(perms.granted ? "granted" : "denied");
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
            service. Two iOS settings need to be on for that to work.
          </Text>

          <PermissionRow
            icon="notifications-outline"
            title="Push Notifications"
            body="Lets the server wake the app to refresh the snapshot every time the cache updates. We never send banners or sounds — only silent wake-ups."
            state={pushState}
          />

          <PermissionRow
            icon="refresh-outline"
            title="Background App Refresh"
            body="Lets iOS run a backup refresh task on its own schedule. Belt-and-suspenders for when the silent push gets held back."
          />

          <Pressable
            onPress={handleEnableNotifications}
            disabled={busy || pushState === "granted"}
            style={({ pressed }) => ({
              marginTop: 20,
              paddingVertical: 14,
              paddingHorizontal: 16,
              borderWidth: 2,
              borderColor: palette.ink[700],
              backgroundColor:
                pushState === "granted"
                  ? palette.ink[800]
                  : pressed
                    ? palette.aspen[500]
                    : palette.aspen[400],
              opacity: busy ? 0.6 : 1,
            })}
          >
            <Text
              variant="display"
              style={{
                fontSize: 14,
                letterSpacing: 1.4,
                color: palette.ink[700],
                textAlign: "center",
              }}
            >
              {pushState === "granted"
                ? "✓ NOTIFICATIONS ENABLED"
                : pushState === "denied"
                  ? "DENIED — OPEN SETTINGS TO ENABLE"
                  : busy
                    ? "REQUESTING…"
                    : "ENABLE NOTIFICATIONS"}
            </Text>
          </Pressable>

          {Platform.OS === "ios" ? (
            <Pressable
              onPress={handleOpenSettings}
              style={({ pressed }) => ({
                marginTop: 10,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderWidth: 2,
                borderColor: palette.ink[700],
                backgroundColor: pressed ? palette.ink[800] : "transparent",
              })}
            >
              <Text
                variant="display"
                style={{
                  fontSize: 14,
                  letterSpacing: 1.4,
                  color: palette.ink[100],
                  textAlign: "center",
                }}
              >
                OPEN iOS SETTINGS
              </Text>
              <Text
                variant="mono"
                className="text-ink-400"
                style={{
                  fontSize: 10,
                  letterSpacing: 1,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                THEN: GENERAL → BACKGROUND APP REFRESH → ON
              </Text>
            </Pressable>
          ) : null}

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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  state?: PushState;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 14,
        marginBottom: 16,
        padding: 14,
        borderWidth: 1.5,
        borderColor: palette.ink[700],
        backgroundColor: palette.ink[900],
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
          backgroundColor:
            state === "granted"
              ? "#52BA4A"
              : state === "denied"
                ? "#FCA5A5"
                : palette.ink[800],
        }}
      >
        <Ionicons
          name={state === "granted" ? "checkmark" : icon}
          size={18}
          color={
            state === "granted" || state === "denied"
              ? palette.ink[700]
              : palette.ink[100]
          }
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
      </View>
    </View>
  );
}
