import { useCallback, useMemo, useState } from "react";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import { useMatchRewards } from "../meta/useMatchRewards";
import {
  COSMETIC_CATALOG,
  SEASON_TRACK,
  activeQuests,
  seasonTierForXp,
  type QuestView,
} from "../meta/rewards";

function QuestRow({ q }: { q: QuestView }) {
  const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
  return (
    <li className="crypt-profile-section" style={{ marginBottom: 12 }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-sm font-medium text-[color:var(--color-crypt-text)]">
            {q.title} {q.claimed ? "⬡" : ""}
          </p>
          <p className="m-0 text-xs text-[color:var(--color-crypt-muted)]">{q.description}</p>
        </div>
        <span className="text-xs text-[color:var(--color-crypt-ice)]">
          +{q.sigilReward} Sigil · +{q.seasonXpReward} XP
        </span>
      </div>
      <div
        aria-hidden
        style={{
          marginTop: 8,
          height: 6,
          borderRadius: 999,
          background: "var(--color-crypt-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: q.claimed ? "var(--color-crypt-ice)" : "var(--color-crypt-accent, #c9a227)",
          }}
        />
      </div>
      <p className="m-0 mt-1 text-xs text-[color:var(--color-crypt-muted)]">
        {q.progress}/{q.goal}
        {q.claimed ? " · complete" : ""}
      </p>
    </li>
  );
}

/**
 * REWARDS — retention loop surface: active daily/weekly quests, the season
 * reward track, the in-game Sigil balance, and the cosmetic shop. Everything
 * shown here is in-game-only; no hex, wallet, or on-chain value is involved.
 */
export default function RewardsPage() {
  // Stable clock so the page render is deterministic within a tick.
  const [nowFixed] = useState(() => Date.now());
  const now = useCallback(() => nowFixed, [nowFixed]);
  // No live match here — winner stays null; this view reads/spends the ledger.
  const { rewards, buyCosmetic } = useMatchRewards(null, "rewards-page", { now });

  const daily = useMemo(() => activeQuests(rewards, "daily"), [rewards]);
  const weekly = useMemo(() => activeQuests(rewards, "weekly"), [rewards]);
  const currentTier = seasonTierForXp(rewards.seasonXp);

  return (
    <CryptPageFrame
      eyebrow="Rewards · Crypt Legends"
      title="Quests & Season"
      lead={
        <>
          <strong>{rewards.sigil}</strong> Sigil · season tier{" "}
          <strong>{currentTier}</strong> ·{" "}
          <span className="text-[color:var(--color-crypt-muted)]">
            in-game soft currency only — never hex
          </span>
        </>
      }
    >
      <section className="crypt-profile-section" aria-label="Daily quests">
        <div className="crypt-profile-section-label">Daily quests</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {daily.map((q) => (
            <QuestRow key={q.id} q={q} />
          ))}
        </ul>
      </section>

      <section className="crypt-profile-section" aria-label="Weekly quests">
        <div className="crypt-profile-section-label">Weekly quests</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {weekly.map((q) => (
            <QuestRow key={q.id} q={q} />
          ))}
        </ul>
      </section>

      <section className="crypt-profile-section" aria-label="Season track">
        <div className="crypt-profile-section-label">
          Season track · {rewards.seasonXp} season XP
        </div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {SEASON_TRACK.map((t) => {
            const unlocked = currentTier >= t.tier;
            return (
              <li
                key={t.tier}
                className="flex items-center justify-between gap-3 py-2"
                style={{ borderBottom: "1px solid var(--color-crypt-border)" }}
              >
                <span className="text-sm text-[color:var(--color-crypt-text)]">
                  Tier {t.tier} · {t.label} {unlocked ? "⬡" : ""}
                </span>
                <span className="text-xs text-[color:var(--color-crypt-muted)]">
                  {t.xpThreshold} XP
                  {t.sigilReward ? ` · +${t.sigilReward} Sigil` : ""}
                  {t.cosmetic ? ` · ${t.cosmetic}` : ""}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="crypt-profile-section" aria-label="Cosmetic shop">
        <div className="crypt-profile-section-label">Cosmetics · spend Sigil</div>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {COSMETIC_CATALOG.map((c) => {
            const owned = rewards.cosmetics.includes(c.id);
            const affordable = rewards.sigil >= c.price;
            return (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 py-2"
                style={{ borderBottom: "1px solid var(--color-crypt-border)" }}
              >
                <span className="text-sm text-[color:var(--color-crypt-text)]">
                  ⬡ {c.label}
                </span>
                {owned ? (
                  <span className="text-xs text-[color:var(--color-crypt-ice)]">Owned</span>
                ) : (
                  <button
                    type="button"
                    className="crypt-profile-signout-btn"
                    disabled={!affordable}
                    onClick={() => buyCosmetic(c.id)}
                    style={{ opacity: affordable ? 1 : 0.5 }}
                  >
                    {c.price} Sigil
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </CryptPageFrame>
  );
}
