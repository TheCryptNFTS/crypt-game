import { useState } from "react";
import { useRenderManifest } from "../hooks/useRenderManifest";
import CardFrame from "../components/cards/CardFrame";
import CardDetailModal from "../components/cards/CardDetailModal";
import type { RenderManifestEntry } from "../types/renderManifest";

export default function CollectionPage() {
  const { commanders, playable } = useRenderManifest();
  const [selected, setSelected] = useState<RenderManifestEntry | null>(null);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Collection</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Local render manifest — commanders and playable cards only.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[color:var(--color-crypt-accent)]">
          Commanders
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {commanders.map((entry) => (
            <CardFrame key={entry.id} entry={entry} onClick={() => setSelected(entry)} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[color:var(--color-crypt-ice)]">
          Playable cards
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {playable.map((entry) => (
            <CardFrame key={entry.id} entry={entry} onClick={() => setSelected(entry)} />
          ))}
        </div>
      </section>

      <CardDetailModal entry={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
