export type CryptFaction =
  | "STONE"
  | "IRON"
  | "BRONZE"
  | "SILVER"
  | "GOLD"
  | "GOD";

export type CryptCardKind = "commander" | "unit" | "equipment" | "artifact";

export type SyncLevel = "none" | "category" | "exact" | "legendary" | "oneOfOne";

export type StatLine = {
  attack: number;
  health: number;
  armor: number;
  speed: number;
  crit: number;
  utility: number;
  cost?: number;
};

export type ModifierAudit = {
  reasons: string[];
  exactTraitMatches: string[];
  categoryMatches: string[];
  nameMatch: boolean;
  factionMatch: boolean;
};

export type ModifierSource = {
  stats: Partial<StatLine>;
  commanderTags: string[];
  passives: string[];
  audit: ModifierAudit;
};

export type CommanderVM = {
  id: string;
  name: string;
  faction: CryptFaction;
  imageUrl: string;
  rarityLabel: "Standard" | "Legendary" | "One of One";
  traits: Record<string, string>;
  headline: string;
  doctrine: string;
  battleCallout: string;
};

export type PlayCardVM = {
  id: string;
  name: string;
  faction: CryptFaction;
  kind: CryptCardKind;
  imageUrl: string;
  syncLevel: SyncLevel;
  syncLabel?: string;
  traits: Record<string, string>;
  baseStats: StatLine;
  liveStats: StatLine;
  keywords: string[];
  // Keywords currently granted by a continuous aura (re-derived each recompute).
  // Surfaced so the UI can mirror the engine's `unitHasKeyword` (printed OR aura)
  // when deciding attack affordance — a RUSH that arrives via aura still attacks.
  auraKeywords?: string[];
  commanderTags: string[];
  passives: string[];
  exhausted?: boolean;
  // Set the turn a unit enters play (cleared at its controller's next turn start,
  // or immediately for RUSH). The board reads this to avoid lighting a "STRIKE"
  // affordance on a unit the engine would reject as summoning-sick.
  summoningSick?: boolean;
  selected?: boolean;
  equipped?: boolean;
  damaged?: boolean;
  modifierSources?: {
    commander?: ModifierSource | null;
    equipment?: ModifierSource[];
    artifact?: ModifierSource[];
  };
};

export type InspectState =
  | {
      open: false;
    }
  | {
      open: true;
      commander: CommanderVM;
      card: PlayCardVM;
    };
