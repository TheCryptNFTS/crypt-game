import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CatalogLoader } from "../components/CatalogLoader";
import { CryptPageFrame } from "../components/layout/CryptPageFrame";
import CommanderCard from "../components/cards/CommanderCard";
import { useRenderManifest } from "../hooks/useRenderManifest";
import { clearSessionStub, getSessionStub } from "../lib/appSession";
import { loadStoredCommanderId } from "../lib/deckBuilderStorage";
import { getProgressSnapshot } from "../lib/localProgress";

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

        <section className="crypt-profile-section" aria-label="Recent duel">
          <div className="crypt-profile-section-label">Last verdict</div>
          {snap.lastMatchSummary ? (
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
          <div className="crypt-profile-placeholder">
            Ladder sealed until MMR, seasons, and server truth exist
          </div>
        </section>

        <section className="crypt-profile-section" aria-label="Achievements">
          <div className="crypt-profile-section-label">Achievements</div>
          <div className="crypt-profile-placeholder">Badges sync when server progress ships</div>
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
