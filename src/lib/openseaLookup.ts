import openseaAssets from "../data/openseaAssets.json";

export type OpenSeaCommander = {
  tokenId?: string;
  name: string;
  traits?: Record<string, string> | Array<{ trait_type?: string; value?: string }>;
  faction?: string | null;
  [key: string]: any;
};

export type OpenSeaCard = {
  tokenId?: string;
  name: string;
  traits?: Record<string, string> | Array<{ trait_type?: string; value?: string }>;
  faction?: string | null;
  rarity?: string | null;
  [key: string]: any;
};

const COMMANDERS = ((openseaAssets as any).commanders ?? []) as OpenSeaCommander[];
const CARDS = ((openseaAssets as any).cards ?? []) as OpenSeaCard[];

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function getAllOpenSeaCommanders(): OpenSeaCommander[] {
  return COMMANDERS;
}

export function getAllOpenSeaCards(): OpenSeaCard[] {
  return CARDS;
}

export function findCommanderByName(name: string): OpenSeaCommander | undefined {
  const target = normalize(name);
  return COMMANDERS.find((item) => normalize(item.name) === target);
}

export function findCardByName(name: string): OpenSeaCard | undefined {
  const target = normalize(name);
  return CARDS.find((item) => normalize(item.name) === target);
}

export function normalizeTraits(input: any): Record<string, string> {
  if (!input) return {};

  if (Array.isArray(input)) {
    const out: Record<string, string> = {};
    for (const item of input) {
      const key = item?.trait_type;
      const value = item?.value;
      if (key && value) out[String(key)] = String(value);
    }
    return out;
  }

  if (typeof input === "object") {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(input)) {
      out[String(k)] = String(v);
    }
    return out;
  }

  return {};
}
