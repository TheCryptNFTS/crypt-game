import React from "react";
import { CryptMatchBoard } from "../components/live-match/CryptMatchBoard";
import { useRemoteCryptMatch, MatchView } from "../game-ui/useRemoteCryptMatch";

type PlayerId = "P1" | "P2";

type Props = {
  matchId: string;
  initialView: MatchView;
  initialVersion: number;
  mySeat: PlayerId;
  /** Leave the match and return to the lobby. */
  onLeave: () => void;
};

/**
 * PvP match screen. Drives the SHARED `CryptMatchBoard` from the
 * server-authoritative `useRemoteCryptMatch` hook. Single-player is untouched.
 */
export default function RemoteCryptMatchPage({ matchId, initialView, initialVersion, mySeat, onLeave }: Props) {
  const remote = useRemoteCryptMatch({ matchId, initialView, initialVersion, mySeat, onLeave });

  const banner = (() => {
    if (remote.winner) return null;
    if (remote.reconnecting) {
      return <p className="live-deckhint">Reconnecting to the signal…</p>;
    }
    if (!remote.myTurn) {
      return <p className="live-deckhint">Opponent's turn — holding the line.</p>;
    }
    if (remote.pending) {
      return <p className="live-deckhint">Submitting move…</p>;
    }
    return <p className="live-deckhint">Your turn.</p>;
  })();

  return (
    <div className="crypt-shell">
      <div className="crypt-shell__bg" />
      <CryptMatchBoard
        mySeat={mySeat}
        match={remote.match}
        winner={remote.winner}
        activePlayer={remote.activePlayer}
        selectedHandId={remote.selectedHandId}
        selectedBoardId={remote.selectedBoardId}
        inspectId={remote.inspectId}
        combatLog={remote.combatLog}
        selectedHandCard={remote.selectedHandCard}
        mulliganAvailable={remote.mulliganAvailable}
        energy={remote.energy}
        maxEnergy={remote.maxEnergy}
        deckSource={remote.deckSource}
        affordableCostFor={remote.affordableCostFor}
        setSelectedHandId={remote.setSelectedHandId}
        setSelectedBoardId={remote.setSelectedBoardId}
        setInspectId={remote.setInspectId}
        endTurn={remote.endTurn}
        playSelectedUnit={remote.playSelectedUnit}
        playSelectedArtifact={remote.playSelectedArtifact}
        equipSelectedToUnit={remote.equipSelectedToUnit}
        attackUnit={remote.attackUnit}
        attackFace={remote.attackFace}
        mulligan={remote.mulligan}
        resetMatch={remote.resetMatch}
        statusBanner={banner}
      />
    </div>
  );
}
