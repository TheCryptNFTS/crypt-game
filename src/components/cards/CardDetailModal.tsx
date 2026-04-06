import type { RenderManifestEntry } from "../../types/renderManifest";

type CardDetailModalProps = {
  entry: RenderManifestEntry | null;
  onClose: () => void;
};

export default function CardDetailModal({ entry, onClose }: CardDetailModalProps) {
  if (!entry) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={entry.name}
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[color:var(--color-crypt-border)] bg-[color:var(--color-crypt-panel)] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">{entry.name}</h2>
            <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">
              {entry.role} · {entry.faction}
              {entry.rarity ? ` · ${entry.rarity}` : ""}
              {entry.cost != null ? ` · cost ${entry.cost}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        {entry.imageUrl && (
          <img
            src={entry.imageUrl}
            alt=""
            className="mt-4 w-full max-w-xs rounded-lg border border-zinc-700"
          />
        )}

        {entry.keywords && entry.keywords.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-medium text-zinc-400">Keywords</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {entry.keywords.map((k) => (
                <span key={k} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200">
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {entry.traits && entry.traits.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-medium text-zinc-400">Traits</div>
            <ul className="mt-2 space-y-1 text-sm text-zinc-300">
              {entry.traits.map((t, i) => (
                <li key={`${t.trait_type}-${i}`}>
                  <span className="text-zinc-500">{String(t.trait_type)}:</span>{" "}
                  {String(t.value)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {entry.externalUrl && (
          <a
            href={entry.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm text-[color:var(--color-crypt-ice)] underline"
          >
            View external profile
          </a>
        )}
      </div>
    </div>
  );
}
