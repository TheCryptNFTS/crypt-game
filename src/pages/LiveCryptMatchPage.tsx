import React, { useState } from "react";
import "../styles/crypt-match.css";
import "../styles/live-crypt-match.css";
import { CryptMatchBoard } from "../components/live-match/CryptMatchBoard";
import { PvpLobby, EnteredMatch } from "../components/live-match/PvpLobby";
import RemoteCryptMatchPage from "./RemoteCryptMatchPage";
import { useLocalCryptMatch } from "../game-ui/useLocalCryptMatch";

type Props = {
  /** Card ids (`tcg_<tokenId>`) the connected wallet owns. When present, they
   *  become P1's deck. Omitted/empty → shared demo deck. */
  ownedCardIds?: string[];
  /** Connected wallet address (lowercased), used to pre-fill PvP sign-in. */
  walletAddress?: string | null;
};

type Mode = "solo" | "lobby" | "pvp";

/**
 * The Play screen. SINGLE-PLAYER is the default mode and is fully unchanged in
 * behavior. A "PvP" toggle opens the matchmaking lobby; once in a match the
 * server-authoritative `RemoteCryptMatchPage` renders the SAME board UI.
 */
export default function LiveCryptMatchPage({ ownedCardIds, walletAddress }: Props = {}) {
  const [mode, setMode] = useState<Mode>("solo");
  const [match, setMatch] = useState<EnteredMatch | null>(null);

  // Single-player engine. Always instantiated so solo stays the live default;
  // the hook is cheap and only its UI is hidden while in PvP.
  const local = useLocalCryptMatch(ownedCardIds);

  const modeToggle = (
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
