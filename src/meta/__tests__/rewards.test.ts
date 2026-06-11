import { describe, it, expect } from "vitest";
import {
  createRewardsState,
  applyMatchToRewards,
  SIGIL_REWARDS,
  FIRST_WIN_BONUS,
  type MatchResult,
} from "../rewards";

const DAY = 86_400_000;
const WIN: MatchResult = { won: true };
const LOSS: MatchResult = { won: false };

describe("first-win-of-the-day bonus", () => {
  it("pays base + bonus on the first win of a day", () => {
    const s0 = createRewardsState(0);
    const s1 = applyMatchToRewards(s0, WIN, 0);
    expect(s1.sigil).toBe(SIGIL_REWARDS.win + FIRST_WIN_BONUS);
    expect(s1.firstWinDay).toBe(0);
  });

  it("pays base only on the second win of the SAME day", () => {
    let s = createRewardsState(0);
    s = applyMatchToRewards(s, WIN, 0); // first win → base + bonus
    const afterFirst = s.sigil;
    s = applyMatchToRewards(s, WIN, DAY / 2); // same day → base only
    expect(s.sigil).toBe(afterFirst + SIGIL_REWARDS.win);
  });

  it("pays the bonus again on the first win of the NEXT day", () => {
    let s = createRewardsState(0);
    s = applyMatchToRewards(s, WIN, 0); // day 0 bonus
    s = applyMatchToRewards(s, WIN, DAY / 2); // day 0 again, no bonus
    const beforeNextDay = s.sigil;
    s = applyMatchToRewards(s, WIN, DAY + 100); // day 1 → bonus again
    expect(s.sigil).toBe(beforeNextDay + SIGIL_REWARDS.win + FIRST_WIN_BONUS);
    expect(s.firstWinDay).toBe(1);
  });

  it("never pays the bonus on a loss, and a loss doesn't consume the day", () => {
    let s = createRewardsState(0);
    s = applyMatchToRewards(s, LOSS, 0); // loss → base loss only, no bonus, day not stamped
    expect(s.sigil).toBe(SIGIL_REWARDS.loss);
    expect(s.firstWinDay ?? null).toBe(null);
    s = applyMatchToRewards(s, WIN, DAY / 2); // first WIN of the day still earns the bonus
    expect(s.sigil).toBe(SIGIL_REWARDS.loss + SIGIL_REWARDS.win + FIRST_WIN_BONUS);
  });

  it("migrates older state with no firstWinDay (treated as eligible)", () => {
    const legacy = { ...createRewardsState(0) };
    delete (legacy as { firstWinDay?: number | null }).firstWinDay;
    const s = applyMatchToRewards(legacy, WIN, 0);
    expect(s.sigil).toBe(SIGIL_REWARDS.win + FIRST_WIN_BONUS);
  });
});
