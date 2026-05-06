import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Hidden debug toggle for diagnostics that are useful while bringing up a
// new feature but become noise once we trust it. The only entry point in
// the UI is a long-press on the wordmark — discoverable enough for the
// developer / power user, invisible to everyone else.
//
// Default: ON. We're still validating the wake pipeline in production
// builds and the BG WAKE line is the load-bearing diagnostic for that
// validation. Flip to default OFF once the pipeline is trusted.

const DEBUG_KEY = "avy-debug-mode-v1";
const DEFAULT_ON = true;

// Module-level cache + listeners so multiple components stay in sync
// without each one paying for its own AsyncStorage read on every render.
let cachedValue: boolean | null = null;
const listeners = new Set<(value: boolean) => void>();

function notify(value: boolean): void {
  cachedValue = value;
  listeners.forEach((fn) => fn(value));
}

// AsyncStorage values: "true" / "false" / null (unset). Unset uses
// DEFAULT_ON. The user's explicit toggle always writes a literal so
// flipping default later doesn't override their choice.
function parse(raw: string | null): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return DEFAULT_ON;
}

export function useDebugMode(): boolean {
  const [enabled, setEnabled] = useState<boolean>(cachedValue ?? DEFAULT_ON);

  useEffect(() => {
    let cancelled = false;
    if (cachedValue === null) {
      AsyncStorage.getItem(DEBUG_KEY)
        .then((raw) => {
          if (cancelled) return;
          cachedValue = parse(raw);
          setEnabled(cachedValue);
        })
        .catch(() => {});
    }
    listeners.add(setEnabled);
    return () => {
      cancelled = true;
      listeners.delete(setEnabled);
    };
  }, []);

  return enabled;
}

export async function toggleDebugMode(): Promise<boolean> {
  const next = !(cachedValue ?? DEFAULT_ON);
  try {
    await AsyncStorage.setItem(DEBUG_KEY, next ? "true" : "false");
  } catch {}
  notify(next);
  return next;
}
