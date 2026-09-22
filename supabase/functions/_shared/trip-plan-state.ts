// Trip Plan lifecycle — pure state machine.
//
// IMPORTANT: this file is copied verbatim to
// supabase/functions/_shared/trip-plan-state.ts (Deno can't import from
// the app tree). lib/tripPlan/state.test.ts asserts the two are identical,
// so edit here and copy, never edit the copy.
//
// No imports. Times are epoch milliseconds so both runtimes agree.

export type PlanStatus = "active" | "overdue" | "closed";

export type CloseReason =
  | "checked_in"
  | "cancelled_by_user"
  | "contact_heard_from"
  | "search_started"
  | "expired";

export interface PlanState {
  status: PlanStatus;
  closeReason: CloseReason | null;
  returnBy: number;
  worryBy: number;
  nudge1SentAt: number | null;
  nudge2SentAt: number | null;
  closedAt: number | null;
}

export type PlanEvent =
  | { type: "check_in"; at: number }
  | { type: "cancel"; at: number }
  | { type: "extend"; at: number; newWorryBy: number }
  | { type: "heard_from"; at: number }
  | { type: "search_started"; at: number }
  | { type: "sweep"; at: number };

export type SideEffect =
  | { kind: "notify_all"; template: NotifyTemplate }
  | { kind: "push_user"; template: NotifyTemplate }
  | { kind: "record_late"; type: "check_in" | "cancel" };

export type NotifyTemplate =
  // Sent when the plan is created, so the contacts have the packet link and
  // the worry-by time from the moment the party leaves — not only once
  // something happens. See trip-plans create handler.
  | "heading_out"
  | "nudge_1"
  | "nudge_2"
  | "extended"
  | "heard_from"
  | "search_started"
  | "checked_in"
  | "cancelled"
  | "expired"
  | "late_check_in";

export const PLAN_TIMING = {
  nudge2DelayMs: 60 * 60_000,
  expireAfterMs: 72 * 3_600_000,
  maxExtendBeyondReturnMs: 48 * 3_600_000,
  retentionMs: 7 * 24 * 3_600_000,
} as const;

export class TransitionError extends Error {
  constructor(
    public code:
      | "extend_backwards"
      | "invalid_times"
      | "plan_closed"
      | "not_overdue",
    message: string,
  ) {
    super(message);
    this.name = "TransitionError";
  }
}

export interface TransitionResult {
  state: PlanState;
  effects: SideEffect[];
}

function close(s: PlanState, reason: CloseReason, at: number): PlanState {
  return { ...s, status: "closed", closeReason: reason, closedAt: at };
}

// Apply one event. Throws TransitionError for disallowed transitions;
// returns the new state plus the side effects the caller must perform.
export function transition(s: PlanState, ev: PlanEvent): TransitionResult {
  const closed = s.status === "closed";

  switch (ev.type) {
    case "check_in": {
      if (closed) {
        // Late check-in after a contact already closed it: record, notify,
        // do not reopen or re-close — a human owns the situation.
        return {
          state: s,
          effects: [
            { kind: "record_late", type: "check_in" },
            { kind: "notify_all", template: "late_check_in" },
          ],
        };
      }
      return {
        state: close(s, "checked_in", ev.at),
        effects: [{ kind: "notify_all", template: "checked_in" }],
      };
    }

    case "cancel": {
      if (closed) {
        return { state: s, effects: [{ kind: "record_late", type: "cancel" }] };
      }
      return {
        state: close(s, "cancelled_by_user", ev.at),
        effects: [{ kind: "notify_all", template: "cancelled" }],
      };
    }

    case "extend": {
      if (closed) throw new TransitionError("plan_closed", "Plan is closed.");
      if (ev.newWorryBy <= s.worryBy) {
        throw new TransitionError(
          "extend_backwards",
          "Contacts can only extend the worry-by time, not shorten it.",
        );
      }
      if (ev.newWorryBy - s.returnBy > PLAN_TIMING.maxExtendBeyondReturnMs) {
        throw new TransitionError(
          "invalid_times",
          "Worry-by must stay within 48 hours of the planned return.",
        );
      }
      const next: PlanState = {
        ...s,
        worryBy: ev.newWorryBy,
        // Extending past "now" clears overdue and re-arms the nudges.
        status: ev.at < ev.newWorryBy ? "active" : s.status,
        nudge1SentAt: ev.at < ev.newWorryBy ? null : s.nudge1SentAt,
        nudge2SentAt: ev.at < ev.newWorryBy ? null : s.nudge2SentAt,
      };
      return {
        state: next,
        effects: [
          { kind: "notify_all", template: "extended" },
          { kind: "push_user", template: "extended" },
        ],
      };
    }

    case "heard_from": {
      if (closed) return { state: s, effects: [] };
      return {
        state: close(s, "contact_heard_from", ev.at),
        effects: [
          { kind: "notify_all", template: "heard_from" },
          { kind: "push_user", template: "heard_from" },
        ],
      };
    }

    case "search_started": {
      if (closed) return { state: s, effects: [] };
      return {
        state: close(s, "search_started", ev.at),
        effects: [
          { kind: "notify_all", template: "search_started" },
          { kind: "push_user", template: "search_started" },
        ],
      };
    }

    case "sweep": {
      if (closed) return { state: s, effects: [] };
      if (ev.at < s.worryBy) return { state: s, effects: [] };
      if (s.status === "active") {
        return {
          state: { ...s, status: "overdue", nudge1SentAt: ev.at },
          effects: [{ kind: "notify_all", template: "nudge_1" }],
        };
      }
      // overdue
      if (
        s.nudge2SentAt === null &&
        s.nudge1SentAt !== null &&
        ev.at >= s.nudge1SentAt + PLAN_TIMING.nudge2DelayMs
      ) {
        return {
          state: { ...s, nudge2SentAt: ev.at },
          effects: [{ kind: "notify_all", template: "nudge_2" }],
        };
      }
      if (ev.at >= s.worryBy + PLAN_TIMING.expireAfterMs) {
        return {
          state: close(s, "expired", ev.at),
          effects: [{ kind: "notify_all", template: "expired" }],
        };
      }
      return { state: s, effects: [] };
    }
  }
}

// Status as the packet page should display it right now, independent of
// whether the sweeper has run yet.
export function displayStatus(s: PlanState, now: number): PlanStatus {
  if (s.status === "closed") return "closed";
  return now >= s.worryBy ? "overdue" : "active";
}

export function purgeAfter(s: PlanState): number | null {
  return s.closedAt === null ? null : s.closedAt + PLAN_TIMING.retentionMs;
}
