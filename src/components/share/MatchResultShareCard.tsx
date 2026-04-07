import type { RenderManifestEntry } from "../../types/renderManifest";

export type MatchResultShareCardProps = {
  outcome: string;
  turns: number;
  cryptDelta: number;
  passXpDelta: number;
  commanderEntry: RenderManifestEntry | undefined;
};

/**
 * Social-ready layout (screenshot / future image export). No canvas dependency.
 */
export default function MatchResultShareCard({
  outcome,
  turns,
  cryptDelta,
  passXpDelta,
  commanderEntry,
}: MatchResultShareCardProps) {
  const name = commanderEntry?.name ?? "Commander";
  const img = commanderEntry?.imageUrl;

  return (
    <div className="crypt-share-card" aria-label="Shareable result card">
      <div className="crypt-share-card-glow" aria-hidden />
      <div className="crypt-share-card-inner">
        <div className="crypt-share-card-brand">
          <span className="crypt-share-card-mark" aria-hidden />
          <span className="crypt-share-card-word">CRYPT</span>
          <span className="crypt-share-card-alpha">Crypt Legends · closed alpha</span>
        </div>
        <div className="crypt-share-card-body">
          <div className="crypt-share-card-art">
            {img ? (
              <img src={img} alt="" className="crypt-share-card-img" draggable={false} referrerPolicy="no-referrer" />
            ) : (
              <div className="crypt-share-card-art-fallback" aria-hidden>
                —
              </div>
            )}
          </div>
          <div className="crypt-share-card-copy">
            <p className="crypt-share-card-outcome">{outcome}</p>
            <p className="crypt-share-card-commander">{name}</p>
            <p className="crypt-share-card-meta">
              {turns} turns · +{cryptDelta} $CRYPT · +{passXpDelta} pass XP
            </p>
          </div>
        </div>
        <p className="crypt-share-card-foot">Crypt Legends · device ledger · closed alpha</p>
      </div>
    </div>
  );
}
