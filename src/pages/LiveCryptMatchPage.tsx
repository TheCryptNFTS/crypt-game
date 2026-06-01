import React, { useEffect, useState } from "react";
import "../styles/crypt-match.css";
import "../styles/live-crypt-match.css";
import { CryptMatchBoard } from "../components/live-match/CryptMatchBoard";
import { PvpLobby, EnteredMatch } from "../components/live-match/PvpLobby";
import RemoteCryptMatchPage from "./RemoteCryptMatchPage";
import { useLocalCryptMatch, LocalMatchOptions } from "../game-ui/useLocalCryptMatch";
import { TutorialCoach } from "../components/tutorial/TutorialCoach";

type Props = {
  /** Card ids (`tcg_<tokenId>`) the connected wallet owns. When present, they
   *  become P1's deck. Omitted/empty → shared demo deck. */
  ownedCardIds?: string[];
  /** Connected wallet address (lowercased), used to pre-fill PvP sign-in. */
  walletAddress?: string | null;
  /**
   * TUTORIAL MODE (additive, opt-in). When set, the page locks to a coached solo
   * match: it hides the PvP toggle, forces the starter deck + a weak opponent via
   * `localMatchOptions`, overlays step-by-step coaching, and calls
   * `onTutorialComplete` once the match is decided. Omitting `tutorial` leaves the
   * normal `/match` flow completely unchanged.
   */
  tutorial?: boolean;
  /** Overrides for the local engine (starter deck, easy opponent). */
  localMatchOptions?: LocalMatchOptions;
  /** Fired once with the winner ("P1" | "P2" | "DRAW") when a tutorial ends. */
  onTutorialComplete?: (winner: "P1" | "P2" | "DRAW") => void;
};

type Mode = "solo" | "lobby" | "pvp";

/**
 * The Play screen. SINGLE-PLAYER is the default mode and is fully unchanged in
 * behavior. A "PvP" toggle opens the matchmaking lobby; once in a match the
 * server-authoritative `RemoteCryptMatchPage` renders the SAME board UI.
 */
export default function LiveCryptMatchPage({
  ownedCardIds,
  walletAddress,
  tutorial = false,
  localMatchOptions,
  onTutorialComplete,
}: Props = {}) {
  const [mode, setMode] = useState<Mode>("solo");
  const [match, setMatch] = useState<EnteredMatch | null>(null);

  // Single-player engine. Always instantiated so solo stays the live default;
  // the hook is cheap and only its UI is hidden while in PvP.
  const local = useLocalCryptMatch(ownedCardIds, localMatchOptions);

  // Tutorial only: report the verdict exactly once when the match decides.
  const [reported, setReported] = useState(false);
  useEffect(() => {
    if (!tutorial || reported || !local.winner) return;
    setReported(true);
    onTutorialComplete?.(local.winner === "P2" ? "P2" : "P1");
  }, [tutorial, reported, local.winner, onTutorialComplete]);

  // In the tutorial we lock to coached solo — no PvP escape hatch.
  const modeToggle = tutorial ? null : (
    <div className="live-quick-buttons" style={{ justifyContent: "center", margin: "0 0 12px" }}>
      <button
        className={`live-btn ${mode === "solo" ? "live-btn--primary" : "live-btn--ghost"}`}
        onClick={() => {
          setMode("solo");
          setMatch(null);
        }}
      >
        Solo
      </button>
      <button
        className={`live-btn ${mode !== "solo" ? "live-btn--primary" : "live-btn--ghost"}`}
        onClick={() => setMode("lobby")}
      >
        PvP
      </button>
    </div>
  );

  if (mode === "pvp" && match) {
    return (
      <div className="crypt-shell">
        <div className="crypt-shell__bg" />
        <div className="live-match-shell">{modeToggle}</div>
        <RemoteCryptMatchPage
          matchId={match.matchId}
          initialView={match.view}
          initialVersion={match.version}
          mySeat={match.mySeat}
          onLeave={() => {
            setMatch(null);
            setMode("lobby");
          }}
        />
      </div>
    );
  }

  if (mode === "lobby") {
    return (
      <div className="crypt-shell">
        <div className="crypt-shell__bg" />
        <div className="live-match-shell">{modeToggle}</div>
        <PvpLobby
          walletAddress={walletAddress}
          onEnterMatch={(m) => {
            setMatch(m);
            setMode("pvp");
          }}
          onCancel={() => setMode("solo")}
        />
      </div>
    );
  }

  // SOLO (default). Renders the shared board from the local hook; mySeat="P1"
  // reproduces the original single-player perspective exactly.
  return (
    <div className="crypt-shell">
      <div className="crypt-shell__bg" />
      <div className="live-match-shell">{modeToggle}</div>
      {tutorial ? (
        <TutorialCoach
          turn={local.match.turn ?? 1}
          activePlayer={local.activePlayer}
          boardCount={
            (local.match.players?.P1?.board?.front ?? []).length +
            (local.match.players?.P1?.board?.back ?? []).length
          }
          winner={local.winner}
        />
      ) : null}
      <CryptMatchBoard
        mySeat="P1"
        match={local.match}
        winner={local.winner}
        activePlayer={local.activePlayer}
        selectedHandId={local.selectedHandId}
        selectedBoardId={local.selectedBoardId}
        inspectId={local.inspectId}
        combatLog={local.combatLog}
        selectedHandCard={local.selectedHandCard}
        mulliganAvailable={local.mulliganAvailable}
        energy={local.energy}
        maxEnergy={local.maxEnergy}
        deckSource={local.deckSource}
        affordableCostFor={local.affordableCostFor}
        setSelectedHandId={local.setSelectedHandId}
        setSelectedBoardId={local.setSelectedBoardId}
        setInspectId={local.setInspectId}
        endTurn={local.endTurn}
        playSelectedUnit={local.playSelectedUnit}
        playSelectedArtifact={local.playSelectedArtifact}
        equipSelectedToUnit={local.equipSelectedToUnit}
        attackUnit={local.attackUnit}
        attackFace={local.attackFace}
        mulligan={local.mulligan}
        resetMatch={local.resetMatch}
      />
    </div>
  );
}
