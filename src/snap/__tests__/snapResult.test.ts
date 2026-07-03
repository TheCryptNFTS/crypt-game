import { describe, it, expect } from "vitest";
import {
  summarizeSnapResult,
  shareText,
  challengeUrl,
  dailySeed,
  dailyUrl,
  dailyShareText,
  todayStr,
  isDailyDate,
} from "../snapResult";
import type { SnapCard, SnapLane, SnapState } from "../types";

function card(name: string, power: number): SnapCard {
  return { instanceId: `i_${name}_${power}`, cardId: name, name, cost: 1, power, keyword: null };
}

function lane(index: 0 | 1 | 2, p1: SnapCard[], p2: SnapCard[]): SnapLane {
  return { index, P1: p1, P2: p2 };
}

/** Minimal settled state — only the fields summarizeSnapResult reads. */
function settled(opts: {
  winner: SnapState["winner"];
  lanes: SnapLane[];
  seed?: number;
}): SnapState {
  const outcomes = opts.lanes.map((l) => {
    const p1 = l.P1.reduce((s, c) => s + c.power, 0);
    const p2 = l.P2.reduce((s, c) => s + c.power, 0);
    return { index: l.index, p1Power: p1, p2Power: p2, winner: (p1 > p2 ? "P1" : p2 > p1 ? "P2" : "DRAW") as SnapState["winner"] };
  });
  return {
    seed: opts.seed ?? 12345,
    idCounter: 0,
    rngCursor: 0,
    turn: 6,
    active: "P1",
    players: { P1: { seat: "P1", deck: [], hand: [], energy: 6 }, P2: { seat: "P2", deck: [], hand: [], energy: 6 } },
    lanes: opts.lanes,
    winner: opts.winner,
    outcomes,
    log: [],
  };
}

describe("summarizeSnapResult", () => {
  it("returns null for a live match", () => {
    const s = settled({ winner: null, lanes: [lane(0, [], []), lane(1, [], []), lane(2, [], [])] });
    expect(summarizeSnapResult(s)).toBeNull();
  });

  it("titles a clean sweep Gravebreaker and totals power", () => {
    const s = settled({
      winner: "P1",
      lanes: [
        lane(0, [card("A", 8)], [card("x", 3)]),
        lane(1, [card("B", 6)], [card("y", 5)]),
        lane(2, [card("C", 7)], [card("z", 2)]),
      ],
    });
    const r = summarizeSnapResult(s)!;
    expect(r.verdict).toBe("WIN");
    expect(r.cryptsWon).toBe(3);
    expect(r.title).toBe("Gravebreaker");
    expect(r.power).toBe(21);
    expect(r.foePower).toBe(10);
  });

  it("titles a 2-of-3 win Bone Warden and picks widest-margin best Crypt", () => {
    const s = settled({
      winner: "P1",
      lanes: [
        lane(0, [card("A", 10)], [card("x", 2)]), // +8 margin → best (Ash Court)
        lane(1, [card("B", 3)], [card("y", 4)]), // lost by 1 → closest
        lane(2, [card("C", 6)], [card("z", 1)]),
      ],
    });
    const r = summarizeSnapResult(s)!;
    expect(r.cryptsWon).toBe(2);
    expect(r.title).toBe("Bone Warden");
    expect(r.bestCrypt).toBe("Ash Court");
    expect(r.closestCrypt).toBe("Ironworks");
    expect(r.mvp).toBe("A");
  });

  it("titles a defeat Crypt Duelist and still names a best (strongest) Crypt", () => {
    const s = settled({
      winner: "P2",
      lanes: [
        lane(0, [card("A", 2)], [card("x", 9)]),
        lane(1, [card("B", 4)], [card("y", 9)]),
        lane(2, [card("C", 1)], [card("z", 9)]),
      ],
    });
    const r = summarizeSnapResult(s)!;
    expect(r.verdict).toBe("DEFEAT");
    expect(r.title).toBe("Crypt Duelist");
    expect(r.bestCrypt).toBe("Ironworks"); // strongest committed lane (4 power)
  });

  it("titles a draw Signal Heretic", () => {
    const s = settled({
      winner: "DRAW",
      lanes: [
        lane(0, [card("A", 5)], [card("x", 5)]),
        lane(1, [card("B", 5)], [card("y", 5)]),
        lane(2, [card("C", 5)], [card("z", 5)]),
      ],
    });
    expect(summarizeSnapResult(s)!.title).toBe("Signal Heretic");
  });
});

describe("shareText / challengeUrl", () => {
  it("builds a clean, emoji-free recap with the seed link", () => {
    const s = settled({
      winner: "P1",
      seed: 777,
      lanes: [
        lane(0, [card("A", 10)], [card("x", 2)]),
        lane(1, [card("B", 3)], [card("y", 4)]),
        lane(2, [card("C", 6)], [card("z", 1)]),
      ],
    });
    const r = summarizeSnapResult(s)!;
    const text = shareText(r, "https://crypt.example");
    expect(text).toContain("Crypt Trial: WIN, 19-7.");
    expect(text).toContain("Same deck. Same draw. Same opponent.");
    // 2026-07-03: the link now names the target and carries it as ?beat= so the
    // recipient lands with a score to beat instead of a cold board.
    expect(text).toContain("Beat my 19: https://crypt.example/snap?seed=777&beat=19");
    // Brand discipline: no emoji, no price/token words.
    expect(text).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(text.toLowerCase()).not.toMatch(/hex|nft|token|price|floor|\$/);
  });

  it("challengeUrl encodes the seed", () => {
    expect(challengeUrl(42, "https://x.io")).toBe("https://x.io/snap?seed=42");
  });
});

describe("Daily Crypt Trial", () => {
  it("dailySeed is deterministic and date-specific", () => {
    // Same date → same seed, always.
    expect(dailySeed("2026-07-01")).toBe(dailySeed("2026-07-01"));
    // Different dates → different seeds (no collision on adjacent days).
    expect(dailySeed("2026-07-01")).not.toBe(dailySeed("2026-07-02"));
    // Always a valid unsigned 32-bit integer in the engine's seed domain.
    const s = dailySeed("2026-07-01");
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xffffffff);
  });

  it("todayStr is a zero-padded UTC YYYY-MM-DD (the global daily boundary)", () => {
    // LOOP SPINE 2026-07-03: the daily's identity is the UTC date, so every
    // timezone shares one seed and "new trial at midnight UTC" is true.
    expect(todayStr(new Date(Date.UTC(2026, 6, 1)))).toBe("2026-07-01"); // month 6 = July
    expect(todayStr(new Date(Date.UTC(2026, 0, 9)))).toBe("2026-01-09");
    expect(isDailyDate(todayStr())).toBe(true);
  });

  it("todayStr flips at the UTC midnight boundary regardless of local zone", () => {
    // 23:59:59.999Z and 00:00:00.000Z straddle the boundary by 1ms — the
    // daily identity must differ, and must NOT depend on the runner's TZ.
    expect(todayStr(new Date("2026-07-01T23:59:59.999Z"))).toBe("2026-07-01");
    expect(todayStr(new Date("2026-07-02T00:00:00.000Z"))).toBe("2026-07-02");
    // A time that is "yesterday" in UTC-negative zones and "tomorrow" in
    // UTC-positive zones still keys to its UTC date.
    expect(todayStr(new Date("2026-03-15T04:30:00.000Z"))).toBe("2026-03-15");
  });

  it("isDailyDate accepts YYYY-MM-DD and rejects junk", () => {
    expect(isDailyDate("2026-07-01")).toBe(true);
    expect(isDailyDate("today")).toBe(false);
    expect(isDailyDate("2026-7-1")).toBe(false);
    expect(isDailyDate("")).toBe(false);
  });

  it("dailyUrl points at the shared ?daily link", () => {
    expect(dailyUrl("2026-07-01", "https://x.io")).toBe("https://x.io/snap?daily=2026-07-01");
  });

  it("dailyShareText leads with the comparable score and stays brand-clean", () => {
    const s = settled({
      winner: "P1",
      seed: 999,
      lanes: [
        lane(0, [card("A", 10)], [card("x", 2)]),
        lane(1, [card("B", 3)], [card("y", 4)]),
        lane(2, [card("C", 6)], [card("z", 1)]),
      ],
    });
    const r = summarizeSnapResult(s)!;
    const text = dailyShareText(r, "2026-07-01", "https://crypt.example");
    expect(text).toContain("Today's Crypt Trial: WIN, 19.");
    expect(text).toContain("Same deck. Same draw. Same opponent.");
    expect(text).toContain("Beat my 19: https://crypt.example/snap?daily=2026-07-01&beat=19");
    // Same brand discipline as shareText: no emoji, no price/token words.
    expect(text).not.toMatch(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(text.toLowerCase()).not.toMatch(/hex|nft|token|price|floor|\$/);
  });
});
