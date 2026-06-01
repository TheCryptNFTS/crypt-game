import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CatalogLoader } from "../components/CatalogLoader";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import CommanderCard from "../components/cards/CommanderCard";
import { useRenderManifest } from "../hooks/useRenderManifest";
import { clearSessionStub, getSessionStub } from "../lib/appSession";
import { loadStoredCommanderId } from "../lib/deckBuilderStorage";
import { getProgressSnapshot } from "../lib/localProgress";
import {
  fetchCosmetics,
  fetchMatchHistory,
  fetchMyRanking,
  rankLabelForRating,
  type CosmeticUnlock,
  type MatchHistoryEntry,
  type MyRanking,
} from "../services/ladderApi";

/** Presentation labels for the known tier-frame cosmetic ids. */
const COSMETIC_LABELS: Record<string, string> = {
  frame_awakened: "Awakened frame",
  frame_ascendant: "Ascendant frame",
  frame_mythic: "Mythic frame",
  frame_sovereign: "Sovereign frame",
};

function cosmeticLabel(id: string): string {
  return COSMETIC_LABELS[id] ?? id.replace(/^frame_/, "").replace(/_/g, " ");
}

/** Compact relative time like "just now" / "2h ago" / "3d ago". */
function relativeTime(then: number, now: number): string {
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/**
 * Pilot dossier — closed alpha: identity, local ledger; no wallet verification in this build.
 */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { entryById, loading, error, ready } = useRenderManifest();
  const commanderId = loadStoredCommanderId();
  const commanderEntry = entryById.get(commanderId);
  const session = getSessionStub();
  const [tick, setTick] = useState(0);
  const [ranking, setRanking] = useState<MyRanking | null>(null);
  const [cosmetics, setCosmetics] = useState<CosmeticUnlock[] | null>(null);
  const [history, setHistory] = useState<MatchHistoryEntry[] | null>(null);

  useEffect(() => {
    let live = true;
    fetchMyRanking().then((r) => {
      if (live) setRanking(r);
    });
    fetchCosmetics().then((c) => {
      if (live) setCosmetics(c);
    });
    fetchMatchHistory(10).then((h) => {
      if (live) setHistory(h);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 4000);
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const snap = useMemo(() => getProgressSnapshot(Date.now()), [tick]);
  const level = Math.floor(snap.passXp / 100) + 1;

  const onSignOut = () => {
    clearSessionStub();
    navigate("/", { replace: true });
  };

  return (
    <CatalogLoader loading={loading} error={error} ready={ready}>
      <CryptPageFrame
        eyebrow="Dossier · Crypt Legends"
        title={session === "guest" ? "Guest legend" : "Dossier"}
        lead={
          <>
            Legend rank <strong>{level}</strong> from pass XP (device) ·{" "}
            <span className="text-[color:var(--color-crypt-muted)]">Unranked—ladder sealed</span>
          </>
        }
      >
        <div className="crypt-profile-after-head mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--color-crypt-border)] pb-6">
          <div className="crypt-profile-hero-badge-slot" aria-label="Account status">
            <span className="crypt-profile-badge crypt-profile-badge--guest">Guest · device vault</span>
            <p className="crypt-profile-badge-note">
              Accounts and cloud dossiers are not wired—your legend stays on this device.
            </p>
          </div>
        </div>

        <p className="crypt-lore-whisper">
          Your legend grows in the dark—progress stays on this device until the vault shares it.
        </p>

        <section className="crypt-profile-section" aria-label="Recent duels">
          <div className="crypt-profile-section-label">Recent duels</div>
          {history && history.length > 0 ? (
            <ul className="crypt-duel-list">
              {history.map((h) => {
                const win = h.result.toLowerCase() === "win";
                const up = h.ratingDelta >= 0;
                return (
                  <li key={h.matchId} className="crypt-duel-row">
                    <span
                      className={["crypt-duel-result", win ? "crypt-duel-result--win" : "crypt-duel-result--loss"]
                        .join(" ")}
                    >
                      {win ? "WIN" : "LOSS"}
                    </span>
                    <span
                      className={["crypt-duel-delta", up ? "crypt-duel-delta--up" : "crypt-duel-delta--down"]
                        .join(" ")}
                    >
                      {up ? "+" : "−"}
                      {Math.abs(h.ratingDelta)}
                    </span>
                    <span className="crypt-duel-time">{relativeTime(h.createdAt, Date.now())}</span>
                  </li>
                );
              })}
            </ul>
          ) : snap.lastMatchSummary ? (
            <p className="crypt-profile-recent-match">{snap.lastMatchSummary}</p>
          ) : (
            <p className="crypt-profile-secondary">No verdict yet—claim a duel from Play.</p>
          )}
          <p className="crypt-profile-secondary">
            Ledger {snap.cryptBalance} $CRYPT · {snap.passXp} pass XP (device)
          </p>
        </section>

        <section className="crypt-profile-section" aria-label="Commander focus">
          <div className="crypt-profile-section-label">Commander · loadout</div>
          <div className="crypt-profile-commander-row">
            {commanderEntry ? (
              <div className="flex justify-center sm:justify-start">
                <CommanderCard entry={commanderEntry} scale="table" />
              </div>
            ) : (
              <div className="crypt-profile-placeholder">Vault index loading…</div>
            )}
            <div>
              <p className="mt-0 text-sm font-medium text-[color:var(--color-crypt-text)]">
                {commanderEntry?.name ?? commanderId}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-crypt-muted)]">
                Mirrored from{" "}
                <Link to="/deck" className="text-[color:var(--color-crypt-ice)] underline-offset-2 hover:underline">
                  Loadout forge
                </Link>
                . Independent favorite picks arrive when dossiers cloud-save.
              </p>
            </div>
          </div>
        </section>

        <section className="crypt-profile-section" aria-label="OG Skull cosmetics roadmap">
          <div className="crypt-profile-section-label">OG Skulls · frames (roadmap)</div>
          <p className="crypt-profile-secondary">
            Crypt OG Skulls may one day wear vault frames—vanity only, no stat lift per policy (
            <span className="whitespace-nowrap">docs/ENTITLEMENT_POLICY.md</span>). This build verifies nothing; the
            preview is concept art.
          </p>
          <div className="crypt-holder-prestige-preview">
            {commanderEntry ? (
              <CommanderCard entry={commanderEntry} scale="table" variant="catalog" />
            ) : (
              <div className="crypt-profile-placeholder" style={{ minHeight: 120 }}>
                Commander art
              </div>
            )}
            <span className="crypt-holder-prestige-label">Concept—no entitlement in this build</span>
          </div>
        </section>

        <section className="crypt-profile-section" aria-label="Wallet link">
          <div className="crypt-profile-section-label">Vault link</div>
          <div className="crypt-profile-locked-row">
            <div className="crypt-profile-locked-copy">
              <p className="crypt-profile-locked-title">Sealed</p>
              <p className="crypt-profile-secondary">
                No connect or proof-of-hold flow ships here. If accounts arrive later, optional import might bind Crypt OG
                Skulls and Crypt Digital Trading Cards to field identity—policy TBD, inactive now.
              </p>
            </div>
            <button type="button" className="crypt-profile-wallet-placeholder" disabled>
              Unavailable
            </button>
          </div>
        </section>

        <section className="crypt-profile-section" aria-label="Rank">
          <div className="crypt-profile-section-label">Rank · competitive</div>
          {ranking ? (
            <div className="crypt-profile-rank-row">
              <div className="crypt-profile-rank-main">
                <span className="crypt-profile-rank-tier">{rankLabelForRating(ranking.rating)}</span>
                <span className="crypt-profile-rank-rating">{ranking.rating} MMR</span>
              </div>
              <p className="crypt-profile-secondary">
                #{ranking.position} on the ladder · {ranking.wins}W–{ranking.losses}L
                {ranking.currentStreak > 1 ? ` · ⬡ STREAK ${ranking.currentStreak}` : ""}
              </p>
            </div>
          ) : (
            <div className="crypt-profile-placeholder">
              Play a ranked duel to enter the ladder
            </div>
          )}
          <p className="crypt-profile-secondary">
            <Link
              to="/leaderboard"
              className="text-[color:var(--color-crypt-ice)] underline-offset-2 hover:underline"
            >
              View season ladder →
            </Link>
          </p>
        </section>

        <section className="crypt-profile-section" aria-label="Cosmetic unlocks">
          <div className="crypt-profile-section-label">Cosmetics · unlocked</div>
          {cosmetics && cosmetics.length > 0 ? (
            <div className="crypt-profile-cosmetic-strip">
              {cosmetics.map((c) => (
                <span key={c.cosmeticId} className="crypt-profile-cosmetic-chip">
                  ⬡ {cosmeticLabel(c.cosmeticId)}
                </span>
              ))}
            </div>
          ) : (
            <div className="crypt-profile-placeholder">Badges sync when server progress ships</div>
          )}
        </section>

        <div className="crypt-profile-signout">
          <button type="button" className="crypt-profile-signout-btn" onClick={onSignOut}>
            Close dossier · return to gate
          </button>
          <p className="mt-3 text-xs text-[color:var(--color-crypt-muted)]">
            Clears guest stub on device only—no remote sign-out yet.
          </p>
        </div>
      </CryptPageFrame>
    </CatalogLoader>
  );
}
