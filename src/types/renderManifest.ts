export type RenderRole = "commander" | "unit" | "equipment" | "artifact";

export type RenderManifestEntry = {
  id: string;
  name: string;
  role: RenderRole;
  faction: string;
  rarity?: string;
  cost?: number;
  keywords?: string[];
  imageUrl?: string | null;
  animationUrl?: string | null;
  externalUrl?: string | null;
  traits?: Array<{ trait_type: string; value: string | number }>;
};

export type RenderManifest = {
  generatedAt: string;
  commanders: RenderManifestEntry[];
  playable: RenderManifestEntry[];
};
