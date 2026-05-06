import { useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "@/components/ui/Text";
import type { ObservationMedia } from "@/lib/api/avalanche";
import { stripObservationHtml } from "@/lib/observationText";

// Fullscreen swipeable photo viewer. Swipe left/right between photos,
// swipe down or tap the close icon to dismiss. Pinch-to-zoom is left
// out for now — expo-image handles `contain` sizing well enough that
// the full image fills the frame on portrait devices, and the design
// stays simple. Add zoom later if NAC starts shipping high-res that
// benefits from it.

const SWIPE_THRESHOLD = 50;     // px — horizontal swipe to advance
const DISMISS_THRESHOLD = 90;   // px — vertical drag to close

export function PhotoLightbox({
  media,
  initialIndex,
  onClose,
}: {
  media: ObservationMedia[];
  initialIndex: number;
  onClose: () => void;
}) {
  const visible = media.length > 0;
  const [index, setIndex] = useState(initialIndex);
  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  const insets = useSafeAreaInsets();
  const screen = Dimensions.get("window");
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const advance = (delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= media.length) return;
    setIndex(next);
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        runOnJS(advance)(e.translationX < 0 ? 1 : -1);
      } else if (e.translationY > DISMISS_THRESHOLD) {
        runOnJS(onClose)();
      }
      translateX.value = withTiming(0, { duration: 140 });
      translateY.value = withTiming(0, { duration: 140 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  if (!visible) return null;
  const current = media[index];

  return (
    <Modal
      visible
      animationType="fade"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={StyleSheet.absoluteFillObject}>
          <GestureDetector gesture={pan}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
              <Image
                // Keying on URL forces a fresh mount when index changes —
                // expo-image's transition prop otherwise occasionally
                // freezes on the prior frame when sources swap fast.
                key={current.full}
                source={{ uri: current.full }}
                placeholder={{ uri: current.thumbnail }}
                contentFit="contain"
                transition={150}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </GestureDetector>

          {/* Top chrome: close button + counter */}
          <View
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 0,
              right: 0,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
            }}
          >
            <Pressable
              onPress={onClose}
              hitSlop={16}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: pressed ? "#FFFFFF22" : "#00000099",
              })}
            >
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Text
              variant="mono"
              weight="bold"
              style={{ fontSize: 12, letterSpacing: 1.4, color: "#fff" }}
            >
              {`${index + 1} / ${media.length}`}
            </Text>
          </View>

          {/* Bottom caption + arrows */}
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              paddingBottom: insets.bottom + 12,
              paddingHorizontal: 16,
              paddingTop: 16,
              backgroundColor: "#000000B3",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Pressable
                onPress={() => advance(-1)}
                disabled={index === 0}
                hitSlop={12}
                style={({ pressed }) => ({
                  opacity: index === 0 ? 0.3 : pressed ? 0.6 : 1,
                  padding: 4,
                })}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </Pressable>

              <View style={{ flex: 1 }}>
                {current.caption ? (
                  <Text
                    style={{ fontSize: 13, lineHeight: 18, color: "#fff" }}
                    numberOfLines={4}
                  >
                    {stripObservationHtml(current.caption)}
                  </Text>
                ) : (
                  <Text
                    variant="mono"
                    style={{ fontSize: 11, letterSpacing: 0.6, color: "#aaa" }}
                  >
                    Swipe to navigate · drag down to close
                  </Text>
                )}
              </View>

              <Pressable
                onPress={() => advance(1)}
                disabled={index >= media.length - 1}
                hitSlop={12}
                style={({ pressed }) => ({
                  opacity:
                    index >= media.length - 1 ? 0.3 : pressed ? 0.6 : 1,
                  padding: 4,
                })}
              >
                <Ionicons name="chevron-forward" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

