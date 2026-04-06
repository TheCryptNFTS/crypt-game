import { useMemo } from "react";
import manifest from "../data/renderManifest.json";
import type { RenderManifest, RenderManifestEntry } from "../types/renderManifest";

const typedManifest = manifest as RenderManifest;

export function useRenderManifest() {
  return useMemo(() => {
    const entryById = new Map<string, RenderManifestEntry>();
    for (const entry of typedManifest.commanders) {
      entryById.set(entry.id, entry);
    }
    for (const entry of typedManifest.playable) {
      entryById.set(entry.id, entry);
    }

    return {
      manifest: typedManifest,
      entryById,
      commanders: typedManifest.commanders,
      playable: typedManifest.playable,
    };
  }, []);
}
