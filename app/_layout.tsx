import "../global.css";
import { useEffect } from "react";
import { View } from "react-native";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import {
  useFonts as useSerifFonts,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from "@expo-google-fonts/instrument-sans";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";

import { palette } from "@/constants/design";
// TaskManager.defineTask in both modules runs at import-time so iOS can
// dispatch into the headless JS runtime when the OS wakes the app for
// either a scheduled BG fetch or a silent push delivery. registerIfPermitted
// runs every launch in no-prompt mode; the in-app onboarding modal is
// what triggers the actual iOS permission request via requestAndRegister.
import { registerBackgroundRefresh } from "@/lib/backgroundRefresh";
import { registerIfPermitted } from "@/lib/pushNotifications";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.ink[950],
    card: palette.ink[900],
    text: palette.ink[100],
    border: palette.ink[700],
    primary: palette.frost[400],
    notification: palette.frost[400],
  },
  fonts: {
    regular: { fontFamily: "InstrumentSans_400Regular", fontWeight: "400" as const },
    medium: { fontFamily: "InstrumentSans_500Medium", fontWeight: "500" as const },
    bold: { fontFamily: "InstrumentSans_700Bold", fontWeight: "700" as const },
    heavy: { fontFamily: "InstrumentSans_700Bold", fontWeight: "700" as const },
  },
};

export default function RootLayout() {
  const [loaded] = useSerifFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  // Register the background refresh task on every launch. iOS persists
  // registrations across launches but re-registering is a cheap no-op,
  // and it's the cleanest place to run after permissions/state are ready.
  //
  // Push registration also runs every launch but in a no-prompt mode —
  // if the user already granted notification permission anywhere
  // (onboarding modal, iOS Settings), we mint a token and upsert it.
  // If permission isn't granted, we no-op silently. The onboarding
  // modal's "Enable Notifications" button is what asks; this is the
  // backstop that ensures every launch retries until it succeeds.
  useEffect(() => {
    registerBackgroundRefresh();
    registerIfPermitted();
  }, []);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: palette.ink[950] }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navTheme}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.ink[950] },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="zone/[zoneId]/index" />
            <Stack.Screen name="zone/[zoneId]/problems" />
            <Stack.Screen name="zone/[zoneId]/forecast" />
            <Stack.Screen name="zone/[zoneId]/nws" />
            <Stack.Screen name="zone/[zoneId]/stations" />
          </Stack>
          <StatusBar style="dark" />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
