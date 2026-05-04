import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import Constants from "expo-constants";

import { supabase } from "./supabase";
import { refreshFavoritesSnapshot } from "./backgroundRefresh";

// Background notification task — runs in headless JS when iOS/Android
// delivers a silent push (`_contentAvailable: true` on iOS, data-only on
// Android). Body just forwards to the shared snapshot refresh.
//
// defineTask must be at module scope so the runtime is bound by the time
// the OS dispatches; importing this file from app/_layout.tsx achieves
// that ordering.
export const PUSH_REFRESH_TASK = "avy.push-refresh";

TaskManager.defineTask(PUSH_REFRESH_TASK, async ({ error }) => {
  if (error) {
    console.warn("[push-task] dispatched with error", error);
    return;
  }
  try {
    await refreshFavoritesSnapshot("push");
  } catch (err) {
    console.warn("[push-task] threw", err);
  }
});

// While the app is foregrounded, silent-push payloads still trigger this
// foreground handler. We don't want to surface a banner — just refresh
// the snapshot quietly. (Real user-facing notifications would set the
// shouldShow* fields true.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Web has no native notifications API in Expo. Calls are no-ops there.
const isSupported = Platform.OS === "ios" || Platform.OS === "android";

// Register the device for silent pushes and upsert its Expo push token
// into the device_tokens table. Idempotent — safe to call on every launch.
export async function registerPushNotifications(): Promise<string | null> {
  if (!isSupported) return null;
  if (!Device.isDevice) {
    // Push tokens aren't issued on iOS Simulator / Android Emulator.
    console.log("[push] skip — not a physical device");
    return null;
  }
  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted && existing.canAskAgain !== false) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) {
      console.log("[push] permission not granted");
      return null;
    }

    // expo-notifications needs the EAS projectId to mint tokens that route
    // through Expo's push service. Pulled from app.json's `extra.eas.projectId`.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } })
        .easConfig?.projectId;
    if (!projectId) {
      console.warn("[push] no EAS projectId configured");
      return null;
    }
    const tokenResp = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResp.data;

    // Subscribe a notification channel on Android so silent pushes deliver
    // even when notification UI is suppressed.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
        showBadge: false,
      });
    }

    // Wire the background notification handler so silent pushes route to
    // the TaskManager task even when the app is backgrounded.
    await Notifications.registerTaskAsync(PUSH_REFRESH_TASK);

    // Upsert into Supabase so the fan-out function can target this device
    // next time the cache refreshes.
    await supabase
      .from("device_tokens")
      .upsert(
        {
          token,
          platform: Platform.OS,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "token" },
      );

    console.log(`[push] registered ${token.slice(0, 24)}…`);
    return token;
  } catch (err) {
    console.warn("[push] register failed", err);
    return null;
  }
}
