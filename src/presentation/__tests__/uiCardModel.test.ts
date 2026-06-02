import { describe, it, expect } from "vitest";
import { toUICardDisplay } from "../uiCardModel";
import type { RenderManifestEntry } from "../../types/renderManifest";

/**
 * Mapping tests for toUICardDisplay: name/faction fallbacks, visual-tier
 * derivation, keyword copying, ability trimming, and trait curation routing.
 */

function entry(over: Partial<RenderManifestEntry> = {}): RenderManifestEntry {
  return {
    id: "card-1",
    name: "Test Card",
    role: "unit",
    faction: "STONE_KEEPERS",
    ...over,
  };
}

describe("toUICardDisplay", () => {
  it("maps the straightforward fields", () => {
    const d = toUICardDisplay(entry({ rarity: "rare", cost: 3, keywords: ["GUARD"] }));
    expect(d.id).toBe("card-1");
    expect(d.name).toBe("Test Card");
    expect(d.faction).toBe("STONE_KEEPERS");
    expect(d.rarityLabel).toBe("rare");
    expect(d.cost).toBe(3);
    expect(d.keywords).toEqual(["GUARD"]);
  });

  it("derives visualTier 'sacred' for commanders, 'tactical' otherwise", () => {
    expect(toUICardDisplay(entry({ role: "commander" })).visualTier).toBe("sacred");
    expect(toUICardDisplay(entry({ role: "unit" })).visualTier).toBe("tactical");
    expect(toUICardDisplay(entry({ role: "equipment" })).visualTier).toBe("tactical");
  });

  it("falls back to id when name is blank/whitespace", () => {
    expect(toUICardDisplay(entry({ name: "   " })).name).toBe("card-1");
    expect(toUICardDisplay(entry({ name: "" })).name).toBe("card-1");
  });

  it("trims a name with surrounding whitespace", () => {
    expect(toUICardDisplay(entry({ name: "  Hero  " })).name).toBe("Hero");
  });

  it("falls back to em-dash for a blank faction", () => {
    expect(toUICardDisplay(entry({ faction: "" })).faction).toBe("—");
    expect(toUICardDisplay(entry({ faction: "   " })).faction).toBe("—");
  });

  it("normalizes missing rarity/cost to null", () => {
    const d = toUICardDisplay(entry({}));
    expect(d.rarityLabel).toBeNull();
    expect(d.cost).toBeNull();
  });

  it("preserves cost === 0 (does not collapse to null)", () => {
    expect(toUICardDisplay(entry({ cost: 0 })).cost).toBe(0);
  });

  it("treats blank rarity as null", () => {
    expect(toUICardDisplay(entry({ rarity: "  " })).rarityLabel).toBeNull();
  });

  it("copies the keywords array (no aliasing of the source)", () => {
    const src = entry({ keywords: ["A", "B"] });
    const d = toUICardDisplay(src);
    expect(d.keywords).toEqual(["A", "B"]);
    expect(d.keywords).not.toBe(src.keywords);
  });

  it("defaults keywords to [] when absent or non-array", () => {
    expect(toUICardDisplay(entry({ keywords: undefined })).keywords).toEqual([]);
    expect(toUICardDisplay(entry({ keywords: "GUARD" as unknown as string[] })).keywords).toEqual([]);
  });

  it("trims ability text and defaults to empty string", () => {
    expect(toUICardDisplay(entry({ ability: "  Deal 2.  " })).ability).toBe("Deal 2.");
    expect(toUICardDisplay(entry({ ability: undefined })).ability).toBe("");
    expect(toUICardDisplay(entry({ ability: 5 as unknown as string })).ability).toBe("");
  });

  it("maps image/animation/external URLs with null fallbacks", () => {
    const withUrls = toUICardDisplay(
      entry({ imageUrl: "i", animationUrl: "a", externalUrl: "e" })
    );
    expect(withUrls.imageUrl).toBe("i");
    expect(withUrls.animationUrl).toBe("a");
    expect(withUrls.externalUrl).toBe("e");

    const bare = toUICardDisplay(entry({}));
    expect(bare.imageUrl).toBeNull();
    expect(bare.animationUrl).toBeNull();
    expect(bare.externalUrl).toBeNull();
  });

  it("returns no display traits for non-commander roles", () => {
    const d = toUICardDisplay(
      entry({ role: "unit", traits: [{ trait_type: "Eyes", value: "Hex" }] })
    );
    expect(d.traitsForDisplay).toEqual([]);
  });

  it("curates commander traits in priority order with cleaned values", () => {
    const d = toUICardDisplay(
      entry({
        role: "commander",
        traits: [
          { trait_type: "Mouth", value: "Grin" },
          { trait_type: "Backgrounds", value: "Void" },
          { trait_type: "Eyes", value: "none" }, // noise -> dropped
        ],
      })
    );
    // Backgrounds (priority 0) sorts before Mouth; "none" Eyes is filtered out.
    expect(d.traitsForDisplay).toEqual([
      { label: "Backgrounds", value: "Void" },
      { label: "Mouth", value: "Grin" },
    ]);
  });
});
