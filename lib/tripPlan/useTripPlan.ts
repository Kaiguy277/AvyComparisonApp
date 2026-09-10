// React hook for the active trip plan: loads it, flushes the outbox on
// foreground + reconnect, polls status while a plan is live.

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { pendingFor } from "./outbox";
import {
  dismissActivePlan,
  flushTripPlanOutbox,
  queueCancel,
  queueCheckIn,
  refreshActivePlan,
} from "./send";
import { loadActivePlan, type ActivePlan } from "./store";

export interface UseTripPlan {
  plan: ActivePlan | null;
  loaded: boolean;
  pendingActions: number;
  reload: () => Promise<void>;
  sync: () => Promise<void>;
  checkIn: () => Promise<void>;
  cancel: () => Promise<void>;
  dismiss: () => Promise<void>;
}

export function useTripPlan(): UseTripPlan {
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pendingActions, setPending] = useState(0);
  const syncing = useRef(false);

  const reload = useCallback(async () => {
    const p = await loadActivePlan();
    setPlan(p);
    setPending(p ? (await pendingFor(p.planId)).length : 0);
    setLoaded(true);
  }, []);

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      await flushTripPlanOutbox();
      await refreshActivePlan();
    } finally {
      syncing.current = false;
      await reload();
    }
  }, [reload]);

  useEffect(() => {
    reload().then(sync);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") sync();
    });
    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) sync();
    });
    return () => {
      sub.remove();
      unsubNet();
    };
  }, [reload, sync]);

  // While a plan is live, poll every 60s in the foreground for open
  // receipts and contact actions.
  useEffect(() => {
    if (!plan || plan.status === "closed") return;
    const t = setInterval(() => {
      if (AppState.currentState === "active") sync();
    }, 60_000);
    return () => clearInterval(t);
  }, [plan, sync]);

  const checkIn = useCallback(async () => {
    if (!plan) return;
    await queueCheckIn(plan.planId);
    await reload();
    await sync();
  }, [plan, reload, sync]);

  const cancel = useCallback(async () => {
    if (!plan) return;
    await queueCancel(plan.planId);
    await reload();
    await sync();
  }, [plan, reload, sync]);

  const dismiss = useCallback(async () => {
    await dismissActivePlan();
    await reload();
  }, [reload]);

  return { plan, loaded, pendingActions, reload, sync, checkIn, cancel, dismiss };
}
