import { describe, it, expect, beforeEach } from "vitest";
import { recordDaily, readDailyLedger, isNextUtcDay } from "../dailyLedger";

// LOOP SPINE 2026-07-03 — the device-local daily ledger must be honest:
// idempotent per date (replays never inflate the streak), streak only for
// consecutive UTC days, best monotonic forever.

// The suite runs in a node environment (no DOM) — give the module a real
// in-memory Storage shim so its try/catch paths exercise the happy path.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => void store.clear(),
};

beforeEach(() => {
  store.clear();
});

describe("isNextUtcDay", () => {
  it("recognizes consecutive UTC days, including month and year boundaries", () => {
    expect(isNextUtcDay("2026-07-01", "2026-07-02")).toBe(true);
    expect(isNextUtcDay("2026-07-31", "2026-08-01")).toBe(true);
    expect(isNextUtcDay("2026-12-31", "2027-01-01")).toBe(true);
  });
  it("rejects gaps, same-day, reverse order, and junk", () => {
    expect(isNextUtcDay("2026-07-01", "2026-07-03")).toBe(false);
    expect(isNextUtcDay("2026-07-01", "2026-07-01")).toBe(false);
    expect(isNextUtcDay("2026-07-02", "2026-07-01")).toBe(false);
    expect(isNextUtcDay("junk", "2026-07-01")).toBe(false);
  });
});

describe("recordDaily", () => {
  it("first-ever play returns prev=null so the certificate shows nothing", () => {
    const { prev, now } = recordDaily("2026-07-01", 42);
    expect(prev).toBeNull();
    expect(now).toEqual({ lastDate: "2026-07-01", streak: 1, best: 42 });
    expect(readDailyLedger()).toEqual(now);
  });

  it("same-day replays raise best but never the streak", () => {
    recordDaily("2026-07-01", 42);
    const a = recordDaily("2026-07-01", 55);
    expect(a.now).toEqual({ lastDate: "2026-07-01", streak: 1, best: 55 });
    const b = recordDaily("2026-07-01", 40); // worse replay
    expect(b.now.best).toBe(55);
    expect(b.now.streak).toBe(1);
  });

  it("consecutive UTC days grow the streak; a gap resets it; best survives", () => {
    recordDaily("2026-07-01", 42);
    expect(recordDaily("2026-07-02", 30).now.streak).toBe(2);
    expect(recordDaily("2026-07-03", 10).now.streak).toBe(3);
    const gapped = recordDaily("2026-07-06", 20); // missed two days
    expect(gapped.now.streak).toBe(1);
    expect(gapped.now.best).toBe(42);
  });

  it("prev reflects the state before the record (the honesty gate)", () => {
    recordDaily("2026-07-01", 42);
    const { prev } = recordDaily("2026-07-02", 30);
    expect(prev).toEqual({ lastDate: "2026-07-01", streak: 1, best: 42 });
  });
});
