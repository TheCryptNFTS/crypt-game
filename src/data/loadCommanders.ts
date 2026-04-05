import commanders from "./commanders.json";
import { buildCommanderFromTraits, LoadedCommander } from "../engine/traitEngine";

type RawCommander = {
  id: string;
  name: string;
  traits: {
    skin: string;
    eyes: string;
    headwear: string;
    mouth: string;
  };
  isLegendary?: boolean;
  oneOfOne?: string;
};

const commanderList = commanders as RawCommander[];

export const loadedCommanders: LoadedCommander[] = commanderList.map((commander) =>
  buildCommanderFromTraits(commander)
);

export function loadCommanders(): LoadedCommander[] {
  return loadedCommanders;
}

export function getLoadedCommanderById(id: string): LoadedCommander {
  const commander = loadedCommanders.find((item) => item.id === id);

  if (!commander) {
    throw new Error(`Commander not found: ${id}`);
  }

  return commander;
}

export default loadedCommanders;