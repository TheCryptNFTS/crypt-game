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

  // STAT-MODIFICATION SIGNAL (predictability fix): faction identities + the 3+/4+
  // archetype snowball + trait resonance + auras silently raise a unit's stats
  // above its printed base (all ON in CORE_RULESET). The drawer is where a player
  // goes to understand WHY a unit is what it is, so we show the live value and,
  // when it differs from the printed base, the base in parens tinted buff/nerf.
  const base = card.baseStats;
  const live = card.liveStats;
  const BUFF = "#6EE7A8";
  const NERF = "#F2777A";
  const statCell = (label: string, liveVal: number, baseVal: number) => {
    const delta = liveVal - baseVal;
    const color = delta > 0 ? BUFF : delta < 0 ? NERF : undefined;
    return (
      <div style={color ? { color } : undefined}>
        {label} {liveVal}
        {delta !== 0 ? <small> (base {baseVal})</small> : null}
      </div>
    );
  };

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
            {statCell("ATK", live.attack, base.attack)}
            {statCell("HP", live.health, base.health)}
            {statCell("ARM", live.armor, base.armor)}
            {statCell("SPD", live.speed, base.speed)}
            {statCell("CRIT", live.crit, base.crit)}
            {statCell("UTIL", live.utility, base.utility)}
          </div>
          {/* UX audit FIX 4: CRIT/UTIL never appear on card faces and ARM/SPD are
              not self-evident — define them in one line so the stat grid isn't bare
              jargon for a newcomer. */}
          <p
            className="crypt-inspect__body"
            style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5, opacity: 0.85 }}
          >
            ATK damage · HP health · ARM blocks damage · SPD attack order ·
            CRIT extra-damage chance · UTIL ability power
          </p>
        </div>

        <div className="crypt-inspect__section">
          <h3>Commander Sync</h3>
          <p className="crypt-inspect__body">
            {commander.headline}
          </p>
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

        {/* UX audit FIX 4: the dense source-audit blocks (why a stat got synced)
            are systems-speak that buried the first read. They now live behind a
            "Why these stats?" disclosure so the panel opens to art + stats +
            passives; the audit trail is one tap away for anyone who wants it. */}
        {(commanderSource || equipmentSources.length > 0 || artifactSources.length > 0) ? (
          <details className="crypt-inspect__section">
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Why these stats?</summary>

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
          </details>
        ) : null}
      </aside>
    </div>
  );
}
