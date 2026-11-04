/**
 * The queue's tests. Each rule is tested twice: that it can fire, and that it can stay quiet.
 *
 * The clock is a number, so "an hour later" is one argument. Nothing here needs a browser, a timer or a fake
 * network, which is the point of keeping the rules out of the client script.
 */
import { describe, expect, it } from "vitest";
import {
  abandoned,
  backoffFor,
  dueForReplay,
  enqueue,
  pendingCount,
  recordFailure,
  recordSuccess,
  replayRequest,
} from "../src/index";
import type { QueueState } from "../src/index";

const T0 = 1_760_000_000_000; // an arbitrary epoch ms; the queue never formats it
const BACKOFF = [30_000, 60_000, 300_000];

const draft = (key: string, overrides: Partial<{ day: string; form: Record<string, string>; nowMs: number }> = {}) => ({
  key,
  day: overrides.day ?? "2026-11-09",
  form: overrides.form ?? { outcome: "completed", rpe: "6", legs: "2", idempotencyKey: key },
  nowMs: overrides.nowMs ?? T0,
});

const stateWith = (...keys: string[]): QueueState =>
  keys.reduce<QueueState>((state, key, index) => enqueue(state, draft(key, { nowMs: T0 + index })), { drafts: [] });

describe("enqueue is idempotent by key", () => {
  it("adds one draft for one key", () => {
    const state = enqueue({ drafts: [] }, draft("k1"));
    expect(pendingCount(state)).toBe(1);
    expect(state.drafts[0]?.key).toBe("k1");
    expect(state.drafts[0]?.attempts).toBe(0);
  });

  it("treats a double tap as one draft, not two", () => {
    const once = enqueue({ drafts: [] }, draft("k1"));
    const twice = enqueue(once, draft("k1", { nowMs: T0 + 5_000 }));
    expect(pendingCount(twice)).toBe(1);
    expect(twice.drafts[0]?.queuedAtMs).toBe(T0);
  });

  it("keeps arrival order, so the replay is oldest first", () => {
    const state = stateWith("a", "b", "c");
    expect(state.drafts.map((item) => item.key)).toEqual(["a", "b", "c"]);
  });

  it("does not share the form object with the caller", () => {
    const form = { outcome: "completed" };
    const state = enqueue({ drafts: [] }, { key: "k1", day: "2026-11-09", form, nowMs: T0 });
    form.outcome = "mutated";
    expect(state.drafts[0]?.form["outcome"]).toBe("completed");
  });
});

describe("nothing replays while offline", () => {
  it("returns no work when the network is gone", () => {
    const state = stateWith("a");
    expect(dueForReplay(state, { nowMs: T0 + 1, online: false, maxAttempts: 5, backoffMs: BACKOFF })).toEqual([]);
  });

  it("returns the drafts oldest first when online", () => {
    const state = stateWith("a", "b");
    const due = dueForReplay(state, { nowMs: T0 + 1, online: true, maxAttempts: 5, backoffMs: BACKOFF });
    expect(due.map((item) => item.key)).toEqual(["a", "b"]);
  });

  it("respects the backoff window of a failed draft", () => {
    const state = recordFailure(stateWith("a"), "a", { nowMs: T0, error: "network", backoffMs: BACKOFF });
    expect(dueForReplay(state, { nowMs: T0 + 1, online: true, maxAttempts: 5, backoffMs: BACKOFF })).toEqual([]);
    expect(dueForReplay(state, { nowMs: T0 + 30_000, online: true, maxAttempts: 5, backoffMs: BACKOFF })).toHaveLength(1);
  });
});

describe("a failure keeps the draft and says why", () => {
  it("counts the attempt, stores the server's detail and schedules a wait", () => {
    const state = recordFailure(stateWith("a"), "a", { nowMs: T0, error: "that did not save: invalid-entry", backoffMs: BACKOFF });
    const failed = state.drafts[0];
    expect(failed?.attempts).toBe(1);
    expect(failed?.lastError).toContain("invalid-entry");
    expect(failed?.nextAttemptAtMs).toBe(T0 + 30_000);
    expect(pendingCount(state)).toBe(1);
  });

  it("waits longer after each failure, capped at the last value", () => {
    expect(backoffFor(1, BACKOFF)).toBe(30_000);
    expect(backoffFor(2, BACKOFF)).toBe(60_000);
    expect(backoffFor(3, BACKOFF)).toBe(300_000);
    expect(backoffFor(9, BACKOFF)).toBe(300_000);
    expect(backoffFor(1, [])).toBe(0);
  });

  it("leaves other drafts untouched", () => {
    const state = recordFailure(stateWith("a", "b"), "a", { nowMs: T0, error: "x", backoffMs: BACKOFF });
    expect(state.drafts[1]?.attempts).toBe(0);
    expect(state.drafts[1]?.lastError).toBeNull();
  });
});

describe("success removes the draft, abandonment keeps it", () => {
  it("removes only the key that succeeded", () => {
    const state = recordSuccess(stateWith("a", "b"), "a");
    expect(state.drafts.map((item) => item.key)).toEqual(["b"]);
  });

  it("does nothing for an unknown key", () => {
    const state = recordSuccess(stateWith("a"), "zzz");
    expect(pendingCount(state)).toBe(1);
  });

  it("stops replaying a draft that hit the ceiling but never deletes it", () => {
    let state = stateWith("a");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      state = recordFailure(state, "a", { nowMs: T0, error: "still down", backoffMs: BACKOFF });
    }
    expect(abandoned(state, 3)).toHaveLength(1);
    expect(dueForReplay(state, { nowMs: T0 + 10_000_000, online: true, maxAttempts: 3, backoffMs: BACKOFF })).toEqual([]);
    expect(pendingCount(state)).toBe(1);
  });

  it("keeps a draft that is still under the ceiling out of the abandoned list", () => {
    const state = recordFailure(stateWith("a"), "a", { nowMs: T0, error: "x", backoffMs: BACKOFF });
    expect(abandoned(state, 3)).toEqual([]);
  });
});

describe("the replay request is the same write the browser would have made", () => {
  it("sends the stored form plus the offline source", () => {
    const state = stateWith("k1");
    const request = replayRequest(state.drafts[0]!);
    expect(request.key).toBe("k1");
    expect(request.day).toBe("2026-11-09");
    expect(request.body["source"]).toBe("offline-queue");
    expect(request.body["idempotencyKey"]).toBe("k1");
  });

  it("does not mutate the queued draft when building the request", () => {
    const state = stateWith("k1");
    const request = replayRequest(state.drafts[0]!);
    request.body["outcome"] = "mutated";
    expect(state.drafts[0]?.form["outcome"]).toBe("completed");
  });
});
