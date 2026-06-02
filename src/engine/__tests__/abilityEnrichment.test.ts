import { describe, it, expect } from "vitest";
import {
  ENABLE_ENRICHMENT,
  ENRICHMENT_FACTIONS,
  isUnitCard,
  compiledIsVanilla,
  gradeOf,
  enrichmentBandOf,
  bandValueCap,
  BAND_VALUE_CAP,
  enrichmentValuePoints,
  enrichmentV2SpecsFor,
  effectiveValueCapFor,
  enrichmentSpecsFor,
  ENRICHMENT_MAX_VALUE_POINTS,
  type EnrichableCard,
} from "../abilityEnrichment";
import type { EffectSpec } from "../abilityCompiler";

/**
 * Pure-helper coverage for the flag-gated enrichment layer. These exercise the
 * deterministic static-field functions (band keying, value accounting, unit-type
 * detection, vanilla detection) and the flag-gated isolation contract — all
 * without any match state or RNG.
 */

function card(over: Partial<EnrichableCard> = {}): EnrichableCard {
  return {
    id: "c1",
    faction: "STONE_KEEPERS",
    rarity: "common",
    keywords: [],
    rawTraits: {},
    type: "unit",
    ...over,
  };
}

describe("isUnitCard", () => {
  it("treats an explicit type:'unit' as a unit", () => {
    expect(isUnitCard(card({ type: "unit" }))).toBe(true);
    expect(isUnitCard(card({ type: "UNIT" }))).toBe(true);
  });

  it("treats explicit non-unit types as non-units", () => {
    expect(isUnitCard(card({ type: "equipment" }))).toBe(false);
    expect(isUnitCard(card({ type: "spell" }))).toBe(false);
  });

  it("falls back to sourceCardClass / sourceSubtype when type is absent", () => {
    expect(isUnitCard(card({ type: undefined, sourceCardClass: "character" }))).toBe(true);
    expect(isUnitCard(card({ type: undefined, sourceCardClass: "creature" }))).toBe(true);
    expect(isUnitCard(card({ type: undefined, sourceSubtype: "unit" }))).toBe(true);
    expect(isUnitCard(card({ type: undefined, sourceCardClass: "equipment" }))).toBe(false);
    expect(isUnitCard(card({ type: undefined, sourceCardClass: "artifact" }))).toBe(false);
    expect(isUnitCard(card({ type: undefined, sourceCardClass: "spell" }))).toBe(false);
  });
});

describe("gradeOf", () => {
  it("parses a numeric Grade trait", () => {
    expect(gradeOf(card({ rawTraits: { Grade: "75" } }))).toBe(75);
  });

  it("defaults a missing/non-numeric Grade to 0", () => {
    expect(gradeOf(card({ rawTraits: {} }))).toBe(0);
    expect(gradeOf(card({ rawTraits: { Grade: "abc" } }))).toBe(0);
    expect(gradeOf(card({ rawTraits: null }))).toBe(0);
  });
});

describe("compiledIsVanilla", () => {
  it("is vanilla when there is no authored ability", () => {
    expect(compiledIsVanilla(card({ rawTraits: {} }))).toBe(true);
    expect(compiledIsVanilla(card({ rawTraits: null }))).toBe(true);
  });

  it("a pure stat-line ability still compiles to zero ops (vanilla)", () => {
    expect(compiledIsVanilla(card({ rawTraits: { Ability: "+1 Attack. +1 Health." } }))).toBe(true);
  });
});

describe("enrichmentBandOf", () => {
  it("keys the band off the authored Grade", () => {
    expect(enrichmentBandOf(card({ rawTraits: { Grade: "85" } }))).toBe("legendary");
    expect(enrichmentBandOf(card({ rawTraits: { Grade: "80" } }))).toBe("legendary");
    expect(enrichmentBandOf(card({ rawTraits: { Grade: "70" } }))).toBe("epic");
    expect(enrichmentBandOf(card({ rawTraits: { Grade: "65" } }))).toBe("rare");
  });

  it("returns null below the 65 floor (commons keep the V1 chip)", () => {
    expect(enrichmentBandOf(card({ rawTraits: { Grade: "64" } }))).toBeNull();
    expect(enrichmentBandOf(card({ rawTraits: {} }))).toBeNull();
  });
});

describe("bandValueCap", () => {
  it("scales the cap rare < epic < legendary", () => {
    expect(bandValueCap("rare")).toBe(2);
    expect(bandValueCap("epic")).toBe(3);
    expect(bandValueCap("legendary")).toBe(4);
    expect(BAND_VALUE_CAP.rare).toBeLessThan(BAND_VALUE_CAP.legendary);
  });
});

describe("enrichmentValuePoints", () => {
  it("sums |attack|+|health| for a BUFF_SELF", () => {
    const specs: EffectSpec[] = [{ trigger: "ON_SUMMON", op: "BUFF_SELF", attack: 1, health: 1, raw: "" }];
    expect(enrichmentValuePoints(specs)).toBe(2);
  });

  it("counts a HEAL by its amount", () => {
    expect(enrichmentValuePoints([{ trigger: "ON_TURN_END", op: "HEAL", amount: 1, self: true, raw: "" }])).toBe(1);
  });

  it("counts a SUMMON_TOKEN body times its count", () => {
    const specs: EffectSpec[] = [
      { trigger: "ON_DEATH", op: "SUMMON_TOKEN", attack: 0, health: 1, token: "Rubble", count: 2, raw: "" },
    ];
    expect(enrichmentValuePoints(specs)).toBe(2);
  });

  it("counts a one-shot AURA_KEYWORD as 1 point", () => {
    expect(enrichmentValuePoints([{ trigger: "PASSIVE", op: "AURA_KEYWORD", keyword: "WARD", includeSelf: true, raw: "" } as EffectSpec])).toBe(1);
  });

  it("is empty -> 0 points", () => {
    expect(enrichmentValuePoints([])).toBe(0);
  });
});

describe("enrichmentV2SpecsFor", () => {
  it("returns [] for a sub-band (common) Grade", () => {
    expect(enrichmentV2SpecsFor(card({ rawTraits: { Grade: "50" } }))).toEqual([]);
  });

  it("emits a band-capped decision for a rare-Grade body", () => {
    const specs = enrichmentV2SpecsFor(card({ rawTraits: { Grade: "65" }, keywords: ["RUSH"] }));
    expect(specs.length).toBeGreaterThan(0);
    expect(enrichmentValuePoints(specs)).toBeLessThanOrEqual(bandValueCap("rare"));
  });

  it("every band's emitted specs stay at or below the band cap", () => {
    const grades: Array<[string, "rare" | "epic" | "legendary"]> = [
      ["65", "rare"],
      ["72", "epic"],
      ["88", "legendary"],
    ];
    const kwSets = [["RUSH"], ["DEATHRATTLE"], ["GUARD"], ["LIFESTEAL"], []];
    for (const [g, band] of grades) {
      for (const kw of kwSets) {
        const specs = enrichmentV2SpecsFor(card({ rawTraits: { Grade: g }, keywords: kw }));
        // The reported value-points cap is enforced by the function itself.
        const cap = bandValueCap(band);
        const v = enrichmentValuePoints(specs);
        expect(v).toBeLessThanOrEqual(cap);
      }
    }
  });
});

describe("effectiveValueCapFor", () => {
  it("returns the V1 flat cap for a common", () => {
    expect(effectiveValueCapFor(card({ rawTraits: { Grade: "50" } }))).toBe(ENRICHMENT_MAX_VALUE_POINTS);
  });

  it("returns the band cap for a V2 card", () => {
    expect(effectiveValueCapFor(card({ rawTraits: { Grade: "88" }, keywords: ["RUSH"] }))).toBe(bandValueCap("legendary"));
  });
});

describe("ENRICHMENT_FACTIONS", () => {
  it("covers all six factions", () => {
    for (const f of ["STONE_KEEPERS", "IRON_DEFENDERS", "BRONZE_GUARDIANS", "SILVER_SENTINELS", "GOLDEN_SOVEREIGNS", "GODS"] as const) {
      expect(ENRICHMENT_FACTIONS.has(f)).toBe(true);
    }
  });
});

describe("enrichmentSpecsFor — flag-gated isolation contract", () => {
  it("a non-enrichable faction is never enriched (regardless of flag)", () => {
    // All six real factions ARE enrichable, so we assert the structural guard via
    // a non-unit instead: a non-unit body is always [].
    expect(enrichmentSpecsFor(card({ type: "equipment", rarity: "common" }))).toEqual([]);
  });

  it("a non-vanilla body is left exactly as authored ([] from this layer)", () => {
    // An ability that compiles to a real op makes the card non-vanilla -> no enrich.
    const summoner = card({ rawTraits: { Ability: "Summon a 1/1 token." } });
    if (!compiledIsVanilla(summoner)) {
      expect(enrichmentSpecsFor(summoner)).toEqual([]);
    }
  });

  it("respects the master flag: OFF -> [] for every card; ON -> enriches a vanilla unit", () => {
    const vanillaUnit = card({ faction: "STONE_KEEPERS", type: "unit", rawTraits: {}, keywords: [] });
    if (ENABLE_ENRICHMENT) {
      // Live baseline default: a vanilla unit earns at least the V1 floor chip.
      expect(enrichmentSpecsFor(vanillaUnit).length).toBeGreaterThan(0);
    } else {
      // Isolation run (CRYPT_ENRICHMENT=0): the whole layer is inert.
      expect(enrichmentSpecsFor(vanillaUnit)).toEqual([]);
      expect(enrichmentSpecsFor(card({ rawTraits: { Grade: "88" }, keywords: ["RUSH"] }))).toEqual([]);
    }
  });

  it("is deterministic: identical inputs -> identical specs", () => {
    const c = card({ faction: "IRON_DEFENDERS", type: "unit", keywords: ["GUARD"], rawTraits: {} });
    expect(enrichmentSpecsFor(c)).toEqual(enrichmentSpecsFor(c));
  });
});
