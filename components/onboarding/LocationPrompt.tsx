import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text } from "@/components/ui/Text";
import { palette } from "@/constants/design";

interface Props {
  visible: boolean;
  // Kick off the OS permission flow (foreground → Always). Async.
  onEnable: () => void | Promise<void>;
  onDismiss: () => void;
  busy?: boolean;
}

// Contextual "enable Always location" explainer, shown the first time the
// user favorites a zone (not at launch). Framing the ask at the moment
// the value is obvious — you just saved a zone you care about keeping
// fresh — converts far better than a cold prompt on first open.
export function LocationPrompt({ visible, onEnable, onDismiss, busy }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable
        onPress={onDismiss}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        {/* Swallow taps on the card so the backdrop press doesn't close it. */}
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: palette.ink[900],
            borderWidth: 1.5,
            borderColor: palette.frost[500],
            borderRadius: 16,
            padding: 22,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              backgroundColor: palette.frost[500] + "1A",
              borderWidth: 1,
              borderColor: palette.frost[500],
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <Ionicons name="location" size={22} color={palette.frost[400]} />
          </View>

          <Text
            variant="display"
            style={{
              fontSize: 20,
              lineHeight: 24,
              color: palette.ink[50],
              letterSpacing: -0.2,
              marginBottom: 10,
            }}
          >
            Keep this zone fresh off-grid
          </Text>

          <Text
            className="text-ink-200"
            style={{ fontSize: 14, lineHeight: 21 }}
          >
            You just saved a zone. If you allow location{" "}
            <Text className="text-ink-100" style={{ fontSize: 14 }}>
              Always
            </Text>
            , the app refreshes your saved zones’ avalanche and weather data in
            the background as you drive toward the trailhead — so you have the
            latest forecast even after you lose service or close the app.
          </Text>

          <Text
            className="text-ink-300"
            style={{ fontSize: 12, lineHeight: 18, marginTop: 12 }}
          >
            We never read, store, or share your location — the movement is only
            a signal to refresh. Choose “Always Allow” when iOS asks.
          </Text>

          {/* Enable */}
          <Pressable
            onPress={onEnable}
            disabled={busy}
            style={({ pressed }) => ({
              marginTop: 20,
              paddingVertical: 14,
              borderRadius: 999,
              alignItems: "center",
              backgroundColor: pressed ? palette.frost[500] : palette.frost[400],
              opacity: busy ? 0.6 : 1,
            })}
          >
            <Text
              variant="mono"
              weight="bold"
              style={{ fontSize: 13, letterSpacing: 1.4, color: palette.ink[950] }}
            >
              {busy ? "REQUESTING…" : "ENABLE LOCATION"}
            </Text>
          </Pressable>

          {/* Not now */}
          <Pressable
            onPress={onDismiss}
            disabled={busy}
            style={({ pressed }) => ({
              marginTop: 6,
              paddingVertical: 12,
              alignItems: "center",
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text
              variant="mono"
              className="text-ink-300"
              style={{ fontSize: 12, letterSpacing: 1.2 }}
            >
              NOT NOW
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
