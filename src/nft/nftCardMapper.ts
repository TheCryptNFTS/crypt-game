export type RawNft = {
    id: string;
    name?: string;
    traits?: Record<string, string>;
  };
  
  export type GeneratedNftCard = {
    id: string;
    nftId: string;
    name: string;
    type: "unit";
    faction: string;
    rarity: string;
    cost: number;
    stats: {
      attack: number;
      health: number;
      speed: number;
      armor: number;
    };
    keywords: string[];
    traits: Record<string, string>;
  };
  
  function slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }
  
  function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
  
  function getFaction(traits: Record<string, string>): string {
    const skin = (traits["Skins"] || "").toLowerCase();
    const background = (traits["Backgrounds"] || "").toLowerCase();
  
    if (
      skin.includes("mosaic") ||
      skin.includes("stone") ||
      background.includes("onyx") ||
      background.includes("ruby")
    ) {
      return "STONE";
    }
  
    if (
      skin.includes("bronze") ||
      background.includes("amber") ||
      background.includes("gold")
    ) {
      return "BRONZE";
    }
  
    return "CRYPT";
  }
  
  function getRarity(traits: Record<string, string>): string {
    const traitCount = Object.keys(traits).length;
  
    if (traitCount >= 5) return "epic";
    if (traitCount >= 4) return "rare";
    return "common";
  }
  
  function buildStats(traits: Record<string, string>) {
    const mouth = (traits["Mouth"] || "").toLowerCase();
    const eyes = (traits["Eyes"] || "").toLowerCase();
    const headwear = (traits["Headwears"] || "").toLowerCase();
    const skin = (traits["Skins"] || "").toLowerCase();
  
    let attack = 3;
    let health = 10;
    let speed = 2;
    let armor = 0;
  
    if (mouth.includes("mace")) attack += 2;
    if (mouth.includes("sting")) attack += 1;
    if (eyes.includes("eye patch")) attack += 1;
    if (eyes.includes("broken")) speed += 1;
    if (headwear.includes("chained")) armor += 2;
    if (headwear.includes("cap")) speed += 1;
    if (skin.includes("mosaic")) health += 2;
  
    return {
      attack: clamp(attack, 1, 10),
      health: clamp(health, 1, 30),
      speed: clamp(speed, 1, 10),
      armor: clamp(armor, 0, 10)
    };
  }
  
  function buildKeywords(traits: Record<string, string>): string[] {
    const keywords: string[] = [];
  
    const eyes = (traits["Eyes"] || "").toLowerCase();
    const headwear = (traits["Headwears"] || "").toLowerCase();
    const mouth = (traits["Mouth"] || "").toLowerCase();
  
    if (eyes.includes("broken")) keywords.push("RUSH");
    if (headwear.includes("chained")) keywords.push("GUARD");
    if (mouth.includes("mace")) keywords.push("CRUSH");
  
    return keywords;
  }
  
  export function mapNftToCard(nft: RawNft): GeneratedNftCard {
    const traits = nft.traits ?? {};
    const stats = buildStats(traits);
  
    return {
      id: `nft_unit_${slugify(nft.id)}`,
      nftId: nft.id,
      name: nft.name?.trim() || `Crypt #${nft.id}`,
      type: "unit",
      faction: getFaction(traits),
      rarity: getRarity(traits),
      cost: clamp(Math.ceil((stats.attack + stats.health / 5 + stats.armor) / 3), 1, 10),
      stats,
      keywords: buildKeywords(traits),
      traits
    };
  }