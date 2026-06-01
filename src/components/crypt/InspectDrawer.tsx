import React from "react";
import { InspectState } from "../../ui/cryptTypes";
import { factionTheme } from "../../ui/cryptTheme";
import { FactionBadge, SyncBadge, RarityBadge } from "./MatchBadges";

type InspectDrawerProps = {
  state: InspectState;
  onClose: () => void;
};

export function InspectDrawer({ state, onClose }: InspectDrawerProps) {
  if (!state.open) return null;

  const { commander, card } = state;
  const theme = factionTheme[card.faction];
  const commanderSource = card.modifierSources?.commander ?? null;
  const equipmentSources = card.modifierSources?.equipment ?? [];
  const artifactSources = card.modifierSources?.artifact ?? [];

  return (
    <div className="crypt-inspect">
      <div className="crypt-inspect__backdrop" onClick={onClose} />
      <aside
        className="crypt-inspect__panel"
        style={{
          borderColor: theme.edge,
          boxShadow: theme.shadow
        }}
      >
        <button type="button" className="crypt-inspect__close" onClick={onClose}>
          ×
        </button>

        <div className="crypt-inspect__hero">
          <img src={card.imageUrl} alt={card.name} className="crypt-inspect__image" />
          <div className="crypt-inspect__hero-meta">
            <FactionBadge faction={card.faction} />
            <SyncBadge level={card.syncLevel} label={card.syncLabel} />
            <RarityBadge label={commander.rarityLabel} />
          </div>
        </div>

        <div className="crypt-inspect__section">
          <div className="crypt-inspect__title">{card.name}</div>
          <div className="crypt-inspect__subtitle">
            Synced to {commander.name}
          </div>
        </div>

        <div className="crypt-inspect__section">
          <div className="crypt-inspect-grid">
            <div>ATK {card.liveStats.attack}</div>
            <div>HP {card.liveStats.health}</div>
            <div>ARM {card.liveStats.armor}</div>
            <div>SPD {card.liveStats.speed}</div>
            <div>CRIT {card.liveStats.crit}</div>
            <div>UTIL {card.liveStats.utility}</div>
          </div>
        </div>

        <div className="crypt-inspect__section">
          <h3>Commander Sync</h3>
          <p className="crypt-inspect__body">
            {commander.headline}
          </p>

          {commanderSource ? (
            <div className="crypt-source-block">
              <div className="crypt-source-block__label">Commander Source</div>
              <ul>
                {commanderSource.audit.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
                {commanderSource.audit.exactTraitMatches.map((match) => (
                  <li key={match}>Exact Match: {match}</li>
                ))}
                {commanderSource.audit.categoryMatches.map((match) => (
                  <li key={match}>Category Sync: {match}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="crypt-inspect__section">
          <h3>Trait Package</h3>
          <div className="crypt-commander-hero__traits">
            {Object.entries(card.traits).map(([key, value]) => (
              <div className="crypt-trait-chip" key={`${key}-${value}`}>
                <span className="crypt-trait-chip__k">{key}</span>
                <span className="crypt-trait-chip__v">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="crypt-inspect__section">
          <h3>Passives</h3>
          <ul className="crypt-list">
            {card.passives.map((passive) => (
              <li key={passive}>{passive}</li>
            ))}
          </ul>
        </div>

        <div className="crypt-inspect__section">
          <h3>Commander Tags</h3>
          <div className="crypt-tag-row">
            {card.commanderTags.map((tag) => (
              <span className="crypt-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {equipmentSources.length ? (
          <div className="crypt-inspect__section">
            <h3>Equipment Sources</h3>
            {equipmentSources.map((source, index) => (
              <div className="crypt-source-block" key={`equip-${index}`}>
                <div className="crypt-source-block__label">Equipment Sync {index + 1}</div>
                <ul>
                  {source.audit.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}

        {artifactSources.length ? (
          <div className="crypt-inspect__section">
            <h3>Artifact Sources</h3>
            {artifactSources.map((source, index) => (
              <div className="crypt-source-block" key={`artifact-${index}`}>
                <div className="crypt-source-block__label">Artifact Sync {index + 1}</div>
                <ul>
                  {source.audit.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
      </aside>
    </div>
  );
}
