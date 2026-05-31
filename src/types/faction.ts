export type Faction =
  | "STONE_KEEPERS"
  | "IRON_DEFENDERS"
  | "BRONZE_GUARDIANS"
  | "SILVER_SENTINELS"
  | "GOLDEN_SOVEREIGNS"
  | "GODS";

export function normalizeFaction(value: string | null | undefined): Faction {
  const raw = String(value ?? "").trim();

  const normalized = raw
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  switch (normalized) {
    case "STONE":
    case "STONE_KEEPER":
    case "STONE_KEEPERS":
      return "STONE_KEEPERS";

    case "IRON":
    case "IRON_DEFENDER":
    case "IRON_DEFENDERS":
      return "IRON_DEFENDERS";

    case "BRONZE":
    case "BRONZE_GUARDIAN":
    case "BRONZE_GUARDIANS":
      return "BRONZE_GUARDIANS";

    case "SILVER":
    case "SILVER_SENTINEL":
    case "SILVER_SENTINELS":
      return "SILVER_SENTINELS";

    case "GOLD":
    case "GOLDEN":
    case "GOLDEN_SOVEREIGN":
    case "GOLDEN_SOVEREIGNS":
      return "GOLDEN_SOVEREIGNS";

    case "GOD":
    case "GODS":
      return "GODS";

    default:
      throw new Error(`Unknown faction: ${value}`);
  }
}
