// Persisted observer identity for the submit flow. AsyncStorage-backed,
// validated through the same Zod schema the form uses (so corrupt or
// out-of-date saved values just get ignored cleanly).
//
// Stored entirely on-device — never sent to our backend, only included
// in the observation payload when the user submits.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import {
  observerProfileSchema,
  type ObserverProfile,
} from "@/lib/observation/schema";

// Bump if the schema changes in a way that should invalidate older saves.
const OBSERVER_PROFILE_KEY = "avy-observer-profile-v1";

export async function loadObserverProfile(): Promise<ObserverProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(OBSERVER_PROFILE_KEY);
    if (!raw) return null;
    const parsed = observerProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveObserverProfile(
  profile: ObserverProfile,
): Promise<void> {
  try {
    const validated = observerProfileSchema.parse(profile);
    await AsyncStorage.setItem(
      OBSERVER_PROFILE_KEY,
      JSON.stringify(validated),
    );
  } catch {
    // Validation failures here mean the caller passed something the form
    // wouldn't accept — surface upstream by throwing.
    throw new Error("Invalid observer profile.");
  }
}

export async function clearObserverProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(OBSERVER_PROFILE_KEY);
  } catch {}
}

export async function markObserverProfileSubmitted(): Promise<void> {
  const current = await loadObserverProfile();
  if (!current) return;
  await saveObserverProfile({
    ...current,
    lastSubmittedAt: new Date().toISOString(),
  });
}

interface UseObserverProfileResult {
  profile: ObserverProfile | null;
  loaded: boolean;
  save: (next: ObserverProfile) => Promise<void>;
  clear: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useObserverProfile(): UseObserverProfileResult {
  const [profile, setProfile] = useState<ObserverProfile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const next = await loadObserverProfile();
    setProfile(next);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(async (next: ObserverProfile) => {
    await saveObserverProfile(next);
    setProfile(next);
  }, []);

  const clear = useCallback(async () => {
    await clearObserverProfile();
    setProfile(null);
  }, []);

  return { profile, loaded, save, clear, refresh };
}
