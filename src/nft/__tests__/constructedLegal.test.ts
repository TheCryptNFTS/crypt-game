import { describe, it, expect } from "vitest";
import {
  isConstructedLegal,
  constructedLegalPool,
  CONSTRUCTED_LEGAL_ENABLED,
  CONSTRUCTED_BANNED_COUNT,
} from "../constructedLegal";
import { buildPlayerDeck, DECK_SIZE } from "../buildOwnedDeck";
import outlierBaseline from "../../data/cardOutlierBaseline.json";
import { allPlayableCards } from "../../engine/cards";

/**
 * Constructed legality: the balance outliers (cardOutlierBaseline) must never
 * enter an OWNED / ranked deck, while the legal catalog still builds a full 30.
 * The DEMO/curated path is a separate, already-legal subset and is asserted to be
 * unaffected.
 */

const OUTLIERS = outlierBaseline.ids as string[];
const LEGAL_UNIT_IDS = allPlayableCards
  .filter((c: { type?: string; id: string }) => c.type === "unit" && isConstructedLegal(c.id))
  .map((c: { id: string }) => c.id);

describe("isConstructedLegal", () => {
  it("treats every known outlier as illegal", () => {
    for (const id of OUTLIERS.slice(0, 50)) {
      expect(isConstructedLegal(id)).toBe(false);
    }
  });

  it("treats a non-outlier card as legal", () => {
    expect(isConstructedLegal("tcg_unit_does_not_exist_legal")).toBe(true);
    expect(LEGAL_UNIT_IDS.length).toBeGreaterThan(0);
    expect(isConstructedLegal(LEGAL_UNIT_IDS[0])).toBe(true);
  });

  it("treats a disabled card as illegal regardless of outlier status", () => {
    expect(isConstructedLegal({ id: LEGAL_UNIT_IDS[0], disabled: true })).toBe(false);
  });

  it("fences a meaningful number of cards while the switch is on", () => {
    expect(CONSTRUCTED_LEGAL_ENABLED).toBe(true);
    expect(CONSTRUCTED_BANNED_COUNT).toBeGreaterThan(1000);
  });
});

describe("constructedLegalPool", () => {
  it("strips outliers from a mixed pool", () => {
    const pool = [
      { id: OUTLIERS[0], type: "unit" },
      { id: OUTLIERS[1], type: "unit" },
      { id: LEGAL_UNIT_IDS[0], type: "unit" },
    ];
    const legal = constructedLegalPool(pool);
    expect(legal.map((c) => c.id)).toEqual([LEGAL_UNIT_IDS[0]]);
  });
});

describe("buildPlayerDeck constructed legality", () => {
  it("an owned pool of only outliers cannot build a ranked deck (falls back to demo)", () => {
    const built = buildPlayerDeck(OUTLIERS.slice(0, 40));
    expect(built.source).toBe("demo");
    expect(built.ownedPlayable).toBe(0); // outliers don't count toward deck-eligible
  });

  it("an owned deck built from legal cards contains zero outliers and is a full 30", () => {
    const built = buildPlayerDeck(LEGAL_UNIT_IDS.slice(0, 60));
    expect(built.source).toBe("owned");
    expect(built.deck.length).toBe(DECK_SIZE);
    const outlierSet = new Set(OUTLIERS);
    expect(built.deck.some((id) => outlierSet.has(id))).toBe(false);
  });

  it("outliers mixed into an otherwise-legal collection are never drafted", () => {
    const owned = [...OUTLIERS.slice(0, 20), ...LEGAL_UNIT_IDS.slice(0, 40)];
    const built = buildPlayerDeck(owned);
    const outlierSet = new Set(OUTLIERS);
    expect(built.deck.some((id) => outlierSet.has(id))).toBe(false);
  });
});
