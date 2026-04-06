export type Faction = "STONE" | "IRON" | "BRONZE" | "SILVER" | "GOLD" | "GOD";

export function normalizeFaction(value: string): Faction {
  const v = value.trim().toUpperCase();

  if (v === "STONE") return "STONE";
  if (v === "IRON") return "IRON";
  if (v === "BRONZE") return "BRONZE";
  if (v === "SILVER") return "SILVER";
  if (v === "GOLD") return "GOLD";
  if (v === "GOD") return "GOD";
  if (v === "NEUTRAL") return "GOD";

  throw new Error(`Unknown faction: ${value}`);
}

export function isFaction(value: string): value is Faction {
  return ["STONE", "IRON", "BRONZE", "SILVER", "GOLD", "GOD"].includes(
    value.trim().toUpperCase()
  );
}
