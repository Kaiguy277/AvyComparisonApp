// Offline outbox for trip-plan server actions.
//
// Every action the client sends (create, check-in, cancel) is enqueued
// first and flushed when online. Entries are idempotent by id; the server
// dedupes. FIFO per plan: a check-in never overtakes the create that
// mints the plan.
//
// Backoff: 5s · 15s · 45s · 2m15s · …, capped at 15 minutes. `create`
// gives up after 24h (the user needs to know it never sent); `check_in`
// and `cancel` retry forever — they must eventually land.

import AsyncStorage from "@react-native-async-storage/async-storage";

export const OUTBOX_KEY = "avy-tripplan-outbox-v1";

export type OutboxAction = "create" | "check_in" | "cancel";

export interface OutboxEntry {
  id: string; // idempotency key
  action: OutboxAction;
  planId: string;
  body: Record<string, unknown>;
  attempts: number;
  nextAttemptAt: number; // epoch ms
  createdAt: number;
  lastError?: string;
}

export interface SendResult {
  ok: boolean;
  status: number; // 0 = network error
  body?: unknown;
  error?: string;
}

export type Sender = (entry: OutboxEntry) => Promise<SendResult>;

export const BACKOFF = {
  baseMs: 5_000,
  factor: 3,
  capMs: 15 * 60_000,
  createGiveUpMs: 24 * 3_600_000,
} as const;

export function nextDelayMs(attempts: number): number {
  // attempts = number of failures so far (≥1).
  const raw = BACKOFF.baseMs * Math.pow(BACKOFF.factor, Math.max(0, attempts - 1));
  return Math.min(BACKOFF.capMs, raw);
}

// 4xx that will never succeed on retry → drop. 429 and 5xx/network → retry.
export function isTerminalStatus(status: number): boolean {
  return status === 400 || status === 403 || status === 404 || status === 409 || status === 410;
}

export async function loadOutbox(): Promise<OutboxEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
  } catch {
    return [];
  }
}

export async function saveOutbox(entries: OutboxEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
  } catch {}
}

export async function enqueue(
  entry: Omit<OutboxEntry, "attempts" | "nextAttemptAt" | "createdAt">,
  now: number = Date.now(),
): Promise<OutboxEntry> {
  const entries = await loadOutbox();
  const existing = entries.find((e) => e.id === entry.id);
  if (existing) return existing;
  const full: OutboxEntry = { ...entry, attempts: 0, nextAttemptAt: now, createdAt: now };
  entries.push(full);
  await saveOutbox(entries);
  return full;
}

export interface FlushOutcome {
  sent: OutboxEntry[];
  dropped: { entry: OutboxEntry; result: SendResult }[];
  deferred: OutboxEntry[];
  results: Map<string, SendResult>;
}

let flushing = false;

// Process the queue in order. Stops at the first entry that must retry
// so FIFO ordering holds (a later check-in waits behind a failed create).
// Entries whose nextAttemptAt is in the future are skipped only if they
// belong to a *different* plan than a blocked one — simpler: any
// not-yet-due entry also blocks later entries for the same plan.
export async function flushOutbox(
  send: Sender,
  now: number = Date.now(),
): Promise<FlushOutcome> {
  const outcome: FlushOutcome = { sent: [], dropped: [], deferred: [], results: new Map() };
  if (flushing) return outcome;
  flushing = true;
  try {
    const entries = await loadOutbox();
    const blockedPlans = new Set<string>();
    const remaining: OutboxEntry[] = [];

    for (const entry of entries) {
      if (blockedPlans.has(entry.planId)) {
        remaining.push(entry);
        outcome.deferred.push(entry);
        continue;
      }
      if (entry.nextAttemptAt > now) {
        blockedPlans.add(entry.planId);
        remaining.push(entry);
        outcome.deferred.push(entry);
        continue;
      }
      if (
        entry.action === "create" &&
        now - entry.createdAt > BACKOFF.createGiveUpMs
      ) {
        outcome.dropped.push({
          entry,
          result: { ok: false, status: 0, error: "gave_up" },
        });
        continue;
      }

      let result: SendResult;
      try {
        result = await send(entry);
      } catch (err) {
        result = { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
      }
      outcome.results.set(entry.id, result);

      if (result.ok) {
        outcome.sent.push(entry);
        continue;
      }
      if (isTerminalStatus(result.status)) {
        outcome.dropped.push({ entry, result });
        blockedPlans.add(entry.planId);
        continue;
      }
      const attempts = entry.attempts + 1;
      const retry: OutboxEntry = {
        ...entry,
        attempts,
        nextAttemptAt: now + nextDelayMs(attempts),
        lastError: result.error ?? `HTTP ${result.status}`,
      };
      remaining.push(retry);
      outcome.deferred.push(retry);
      blockedPlans.add(entry.planId);
    }

    await saveOutbox(remaining);
    return outcome;
  } finally {
    flushing = false;
  }
}

export async function outboxDepth(): Promise<number> {
  return (await loadOutbox()).length;
}

export async function pendingFor(planId: string): Promise<OutboxEntry[]> {
  return (await loadOutbox()).filter((e) => e.planId === planId);
}

// Remove every queued action for one plan. Only for a plan that is already
// closed, where a queued check-in or cancel can at best be recorded as late.
export async function dropPendingFor(planId: string): Promise<void> {
  const all = await loadOutbox();
  await saveOutbox(all.filter((e) => e.planId !== planId));
}

export async function clearOutbox(): Promise<void> {
  await saveOutbox([]);
}
