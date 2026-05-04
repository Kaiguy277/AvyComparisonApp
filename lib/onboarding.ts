import AsyncStorage from "@react-native-async-storage/async-storage";

// Versioned so we can re-show the intro if we add a new permission ask
// later without forcing existing installs through it (just bump the key).
export const ONBOARDING_KEY = "avy-onboarding-v1";

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "true";
  } catch {
    return false;
  }
}

export async function markOnboardingComplete(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
  } catch {}
}
