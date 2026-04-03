import rawCommanders from "./commanders.json";
import { buildCommanderFromTraits, LoadedCommander } from "../engine/traitEngine";

type RawCommander = {
  id: string;
  name: string;
  isLegendary?: boolean;
  oneOfOne?: string;
  traits: {
    skin: string;
    eyes: string;
    headwear: string;
    mouth: string;
  };
};

export function loadCommanders(): LoadedCommander[] {
  return (rawCommanders as RawCommander[]).map((commander) =>
    buildCommanderFromTraits(commander)
  );
}

export function loadCommanderById(id: string): LoadedCommander | undefined {
  return loadCommanders().find((commander) => commander.id === id);
}

export default loadCommanders;