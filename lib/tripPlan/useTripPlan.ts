// React hook for the active trip plan: loads it, flushes the outbox on
// foreground + reconnect, polls status while a plan is live.

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "expo-router";

import { pendingFor } from "./outbox";
import {
  dismissActivePlan,
  flushTripPlanOutbox,
  queueCancel,
  queueCheckIn,
  refreshActivePlan,
} from "./send";
import { loadActivePlan, loadTripHistory, subscribeActivePlan, type ActivePlan } from "./store";

export interface UseTripPlan {
  plan: ActivePlan | null;
  // Past (closed) trips, newest first. Local to the device.
  history: ActivePlan[];
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
  const [history, setHistory] = useState<ActivePlan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingActions, setPending] = useState(0);
  const syncing = useRef(false);

  const reload = useCallback(async () => {
    const [p, h] = await Promise.all([loadActivePlan(), loadTripHistory()]);
    setPlan(p);
    setHistory(h);
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

  // Any write to the stored plan, from any screen or task, reloads this copy.
  useEffect(() => subscribeActivePlan(() => void reload()), [reload]);

  // Coming back to a screen also asks the SERVER, not just local storage:
  // a contact can close the trip from the web page ("I heard from them"),
  // and nothing on the phone knows until it asks. Cheap when there is no
  // plan — refreshActivePlan returns early and an empty outbox makes no
  // request.
  useFocusEffect(
    useCallback(() => {
      void sync();
    }, [sync]),
  );

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

  return { plan, history, loaded, pendingActions, reload, sync, checkIn, cancel, dismiss };
}
