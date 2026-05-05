import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";
import { refreshFavoritesSnapshot } from "./backgroundRefresh";

export const PUSH_REFRESH_TASK = "avy.push-refresh";
const PUSH_DIAG_KEY = "avy-push-diagnostic-v1";

// Expo Go ships an older notifications module without
// getExpoPushTokenAsync support for arbitrary projectIds, and doesn't
// route silent pushes through the headless JS task. Detect it and skip
// the module-level wiring so the visual preview on phone doesn't crash.
const isExpoGo = Constants.appOwnership === "expo";

if (!isExpoGo) {
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

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

const isSupported =
  !isExpoGo && (Platform.OS === "ios" || Platform.OS === "android");

// Diagnostic record persisted to AsyncStorage on every registration
// attempt. Surfaced in the UI so the user can see what's failing on
// TestFlight builds without needing native console access.
export interface PushDiagnostic {
  at: string; // ISO of attempt
  step:
    | "skipped-unsupported"
    | "skipped-not-device"
    | "skipped-offline"
    | "permission-denied"
    | "no-project-id"
    | "expo-token-error"
    | "supabase-upsert-error"
    | "ok";
  message?: string;
  tokenPrefix?: string;
}

// True when the failure looks like "device is offline, retry later"
// rather than a real registration bug. Used to demote noisy network
// failures to a quiet "skipped-offline" diagnostic instead of yelling
// at the user when they reasonably can't be online.
function looksLikeNetworkError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("network") ||
    m.includes("failed to fetch") ||
    m.includes("offline") ||
    m.includes("could not connect")
  );
}

async function writeDiagnostic(d: PushDiagnostic): Promise<void> {
  try {
    await AsyncStorage.setItem(PUSH_DIAG_KEY, JSON.stringify(d));
  } catch {}
}

export async function readPushDiagnostic(): Promise<PushDiagnostic | null> {
  try {
    const raw = await AsyncStorage.getItem(PUSH_DIAG_KEY);
    return raw ? (JSON.parse(raw) as PushDiagnostic) : null;
  } catch {
    return null;
  }
}

// Internal: run the registration steps assuming permission state is
// already what the caller wants it to be. If the user hasn't granted
// permission, returns early without prompting.
async function runRegistration(
  options: { allowPrompt: boolean },
): Promise<string | null> {
  const at = new Date().toISOString();

  if (!isSupported) {
    await writeDiagnostic({
      at,
      step: "skipped-unsupported",
      message: `isExpoGo=${isExpoGo} platform=${Platform.OS}`,
    });
    return null;
  }
  if (!Device.isDevice) {
    await writeDiagnostic({ at, step: "skipped-not-device" });
    return null;
  }

  try {
    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (
      !granted &&
      options.allowPrompt &&
      existing.canAskAgain !== false
    ) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) {
      await writeDiagnostic({
        at,
        step: "permission-denied",
        message: `granted=${existing.granted} canAsk=${existing.canAskAgain}`,
      });
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } })
        .easConfig?.projectId;
    if (!projectId) {
      await writeDiagnostic({ at, step: "no-project-id" });
      return null;
    }

    let token: string;
    try {
      const tokenResp = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      token = tokenResp.data;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err);
      // Network failures fetching the Expo token are expected when
      // offline — demote to a quiet "skipped-offline" so we don't
      // alarm the user. The next online launch retries.
      const step = looksLikeNetworkError(message)
        ? "skipped-offline"
        : "expo-token-error";
      await writeDiagnostic({ at, step, message });
      console.warn(`[push] ${step}`, err);
      return null;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
        showBadge: false,
      });
    }

    await Notifications.registerTaskAsync(PUSH_REFRESH_TASK);

    const { error: upsertError } = await supabase
      .from("device_tokens")
      .upsert(
        {
          token,
          platform: Platform.OS,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "token" },
      );

    if (upsertError) {
      const step = looksLikeNetworkError(upsertError.message)
        ? "skipped-offline"
        : "supabase-upsert-error";
      await writeDiagnostic({
        at,
        step,
        message: upsertError.message,
        tokenPrefix: token.slice(0, 24),
      });
      console.warn(`[push] ${step}`, upsertError);
      return null;
    }

    await writeDiagnostic({
      at,
      step: "ok",
      tokenPrefix: token.slice(0, 24),
    });
    console.log(`[push] registered ${token.slice(0, 24)}…`);
    return token;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const step = looksLikeNetworkError(message)
      ? "skipped-offline"
      : "expo-token-error";
    await writeDiagnostic({
      at,
      step,
      message: step === "expo-token-error" ? `unexpected: ${message}` : message,
    });
    console.warn(`[push] ${step}`, err);
    return null;
  }
}

// Try to register if the user already has permission. Never prompts.
// Safe to call on every launch — idempotent on success, just rewrites
// the same token + bumps last_seen.
export async function registerIfPermitted(): Promise<string | null> {
  return runRegistration({ allowPrompt: false });
}

// Used by the onboarding modal: requests permission if the user
// hasn't already decided, then registers.
export async function requestAndRegister(): Promise<string | null> {
  return runRegistration({ allowPrompt: true });
}

// Backwards-compatible alias for callsites that imported the old name.
// Old name auto-prompted; keep that semantic here.
export const registerPushNotifications = requestAndRegister;
