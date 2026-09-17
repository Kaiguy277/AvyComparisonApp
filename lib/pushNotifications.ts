import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as TaskManager from "expo-task-manager";
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabase";
import { refreshFavoritesSnapshot } from "./backgroundRefresh";
import { cachePushToken, syncDeviceZones } from "./deviceZoneSync";

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

  // Foreground presentation policy. This only governs what happens when a
  // notification arrives while the app is OPEN — backgrounded delivery is
  // the system's call.
  //
  // Two kinds arrive here: the hourly silent refresh push (data only, no
  // title/body) which must stay invisible, and the daily forecast alert
  // which carries real copy and should be shown. Returning false for
  // everything — as this did before 1.1 — would silently swallow the
  // forecast alert for anyone who happened to have the app open.
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const { title, body } = notification.request.content;
      const isVisible = !!(title || body);
      return {
        shouldShowBanner: isVisible,
        shouldShowList: isVisible,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    },
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
    // LEGACY: written by 1.0 and earlier, when a denied alert permission
    // aborted registration entirely. No longer produced — kept in the union
    // because the last diagnostic is persisted in AsyncStorage and an
    // upgrading install can still read one back. See "ok-alerts-off".
    | "permission-denied"
    | "no-project-id"
    | "expo-token-error"
    | "supabase-register-error"
    // Registered for SILENT background refresh, but the user has not
    // granted alert permission, so visible forecast notifications can't be
    // delivered. This is a healthy state, not an error.
    | "ok-alerts-off"
    | "ok";
  message?: string;
  tokenPrefix?: string;
  // Whether alert (banner) permission was granted at registration time.
  alertsEnabled?: boolean;
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

    // NOTE: we deliberately do NOT bail when permission is denied.
    //
    // iOS hands out an APNs device token without notification
    // authorization — expo-notifications' getDevicePushTokenAsync simply
    // calls UIApplication.shared.registerForRemoteNotifications() with no
    // permission check (see PushTokenModule.swift). Authorization governs
    // whether we may *display* something, not whether the app can be woken
    // by a silent push. 1.0 returned here, which meant a user who declined
    // notifications also silently lost background refresh — our limitation,
    // not the platform's.
    //
    // So: register regardless, and record whether alerts are allowed so the
    // server can send silent refreshes to everyone while targeting visible
    // forecast alerts at the subset that can actually receive them.

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

    // Registration goes through a SECURITY DEFINER RPC, not a direct
    // upsert. PostgREST needs SELECT on the table to resolve an upsert's
    // ON CONFLICT target, and anon must never be able to read this table
    // (world-readable push tokens = anyone can push to every device — see
    // migration 20260807000000). The RPC writes; anon still can't read.
    // 3-arg overload (migration 20260917210000). The 2-arg form still
    // exists for installs from 1.0, which only registered when permission
    // was already granted.
    const { error: upsertError } = await supabase.rpc("register_device_token", {
      p_token: token,
      p_platform: Platform.OS,
      p_alerts_enabled: granted,
    });

    if (upsertError) {
      const step = looksLikeNetworkError(upsertError.message)
        ? "skipped-offline"
        : "supabase-register-error";
      await writeDiagnostic({
        at,
        step,
        message: upsertError.message,
        tokenPrefix: token.slice(0, 24),
        alertsEnabled: granted,
      });
      console.warn(`[push] ${step}`, upsertError);
      return null;
    }

    await writeDiagnostic({
      at,
      step: granted ? "ok" : "ok-alerts-off",
      tokenPrefix: token.slice(0, 24),
      alertsEnabled: granted,
    });
    console.log(
      `[push] registered ${token.slice(0, 24)}… alerts=${granted ? "on" : "off"}`,
    );

    // Cache the token and push the favourite-zone list so the daily forecast
    // alert can name the user's zones. Best-effort: registration has already
    // succeeded at this point and must not fail on a zone-sync hiccup.
    await cachePushToken(token);
    void syncDeviceZones();

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

// True once the device is registered for silent refresh but cannot show
// alerts — i.e. background refresh works, daily forecast notifications
// don't. Used to offer the user a way to turn alerts on.
export async function alertsAreOff(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    return !(await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

// Enable action for the push diagnostic line. If iOS will still show a
// prompt, request it; if the user already declined and iOS won't ask
// again, deep-link to Settings — the only remaining path. Re-registers
// either way so device_tokens.alerts_enabled reflects the new state.
// Returns true if alerts are permitted afterward.
export async function promptOrOpenNotificationSettings(): Promise<boolean> {
  if (!isSupported) return false;
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (!existing.granted && existing.canAskAgain === false) {
      Linking.openSettings().catch(() => {});
      // The user may flip it in Settings; the next launch (or the
      // diagnostic line's poll) re-registers with the updated value.
      return false;
    }
  } catch {
    // fall through to the request path
  }
  await requestAndRegister();
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}
