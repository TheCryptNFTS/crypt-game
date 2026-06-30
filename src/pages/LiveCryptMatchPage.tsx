import React, { useEffect, useState } from "react";
import "../styles/crypt-match.css";
import "../styles/live-crypt-match.css";
import "../styles/live-crypt-match-mobile.css";
import { CryptMatchBoard } from "../components/live-match/CryptMatchBoard";
import { PvpLobby, EnteredMatch } from "../components/live-match/PvpLobby";
import RemoteCryptMatchPage from "./RemoteCryptMatchPage";
import { useLocalCryptMatch, LocalMatchOptions } from "../game-ui/useLocalCryptMatch";
import { TutorialCoach } from "../components/tutorial/TutorialCoach";
import { useMatchProgression } from "../meta/useMatchProgression";
import { useMatchRewards } from "../meta/useMatchRewards";
import { funnelOnce } from "../lib/funnel";
import { track } from "../lib/analytics";
import { MulliganScreen } from "../components/live-match/MulliganScreen";
import { WinCeremony } from "../components/live-match/WinCeremony";
import { VersusIntro } from "../components/live-match/VersusIntro";
import { getCommanderVmForPlayer } from "../game-ui/liveMatchAdapter";
import { readAiDifficulty } from "../game-ui/cryptMatchAI";
import { getBossForDifficulty, pickBossLine } from "../data/aiBosses";

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

  // Per-match identity for all the once-per-match guards below. Prefer the
  // monotonic `instanceKey` over `seed`: `seed` is `Date.now()`, so two matches
  // created in the same millisecond (fast "Run it back") share a seed and the
  // guards never re-arm (stale rewards/telemetry/intro). `instanceKey` is unique
  // per match instance, so a rematch always gets a fresh key.
  const matchKey = local.match?.instanceKey ?? local.match?.seed ?? "solo";

  // META PROGRESSION (post-match, OUTSIDE the reducer). Observes the decided
  // `winner` and updates the local PlayerProfile (MMR/XP/level/stars) exactly
  // once per match, keyed to `matchKey` so each reset re-arms the guard.
  // In-game-only: this never sources hex or touches the wallet.
  const { profile, lastDelta: ratingDelta } = useMatchProgression(
    local.winner,
    matchKey,
    { mySeat: "P1" },
  );

  // META REWARDS (post-match, OUTSIDE the reducer). Sibling to progression:
  // advances daily/weekly quests + Sigil + the season track once per decided
  // match, keyed to the same per-match key. The retention loop that gives a
  // reason to return tomorrow. In-game-only — never sources hex or the wallet.
  const { rewards, firstWinBonus } = useMatchRewards(local.winner, matchKey, { mySeat: "P1" });

  // VERSUS match-open beat (solo only). Plays once per match, after the mulligan
  // is confirmed. Keyed to the match key so "Reset Match" re-arms it.
  const matchSeed = matchKey;
  // On a mid-game refresh the board is rehydrated from storage; pre-mark its seed
  // as "intro already seen" so the once-per-match VS splash doesn't replay on
  // resume. A freshly dealt match (restoredFromStorage=false) still shows it.
  const [introSeenSeed, setIntroSeenSeed] = useState<string | number | null>(
    () => (local.restoredFromStorage ? matchSeed : null),
  );

  // NAMED AI BOSS (solo, non-tutorial). The boss is pure presentation over the
  // SAME stored difficulty the planner reads — resolved once per match (keyed by
  // seed) so the plate stays stable even if the tier is changed mid-match. All
  // lines are static and seed-picked (deterministic): zero runtime generation.
  const boss = React.useMemo(
    () => (tutorial ? null : getBossForDifficulty(readAiDifficulty())),
    // matchSeed re-reads the stored choice at each new match.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tutorial, matchSeed],
  );
  const bossOutroLine =
    boss && (local.winner === "P1" || local.winner === "P2")
      ? pickBossLine(
          local.winner === "P1" ? boss.lossLines : boss.winLines,
          matchSeed,
        )
      : null;

  // Tutorial only: report the verdict exactly once when the match decides.
  const [reported, setReported] = useState(false);
  useEffect(() => {
    if (!tutorial || reported || !local.winner) return;
    setReported(true);
    onTutorialComplete?.(local.winner === "P2" ? "P2" : "P1");
  }, [tutorial, reported, local.winner, onTutorialComplete]);

  // FTUE funnel stage 4: the first REAL (non-tutorial) match reaching a verdict
  // on this device. Win or loss both count — the stage measures "completed a
  // real match", not "won one".
  useEffect(() => {
    if (!tutorial && local.winner) funnelOnce("first_match_result");
  }, [tutorial, local.winner]);

  // MEASUREMENT (the wallet-keyed telemetry the gate reads). Emit once per match
  // when it actually starts (a seed exists), and once when it decides. `source`
  // distinguishes an owned-card match from a demo one — that distinction IS the
  // owned-cards adoption number. Wallet (when connected) makes the gate's
  // "distinct wallets" computable; the city /api/play-event sink dedupes it.
  const [startEmittedSeed, setStartEmittedSeed] = useState<string | number | null>(null);
  useEffect(() => {
    if (tutorial || !local.match || startEmittedSeed === matchKey) return;
    setStartEmittedSeed(matchKey);
    const owned = local.deckSource === "owned";
    const props = { source: local.deckSource, wallet: walletAddress ?? undefined };
    track("play_started", props);
    track("play_session", props); // daily-session counter (one per match start)
    if (owned) track("play_started_own_cards", props);
  }, [tutorial, local.match, matchKey, local.deckSource, walletAddress, startEmittedSeed]);

  const [doneEmittedSeed, setDoneEmittedSeed] = useState<string | number | null>(null);
  useEffect(() => {
    if (tutorial || !local.winner || doneEmittedSeed === matchSeed) return;
    setDoneEmittedSeed(matchSeed);
    track("match_completed", {
      won: local.winner === "P1",
      source: local.deckSource,
      wallet: walletAddress ?? undefined,
    });
  }, [tutorial, local.winner, matchSeed, doneEmittedSeed, local.deckSource, walletAddress]);

  // In the tutorial we lock to coached solo — no PvP escape hatch.
  const modeToggle = tutorial ? null : (
    <div className="crypt-mode-toggle">
      <button
        className={`crypt-mode-toggle__btn ${mode === "solo" ? "is-active" : ""}`}
        onClick={() => {
          setMode("solo");
          setMatch(null);
        }}
      >
        Solo
      </button>
      <button
        className={`crypt-mode-toggle__btn ${mode !== "solo" ? "is-active" : ""}`}
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
          mulliganActive={local.mulliganPhaseActive}
          handSelected={!!local.selectedHandId}
          winner={local.winner}
        />
      ) : null}
      {/* OPENING MULLIGAN (PART 1): while the explicit phase is open the player
          keeps or redraws their opening hand here BEFORE the board is playable.
          The board stays mounted below (inert — the reducer rejects every
          non-MULLIGAN action), and the match proceeds the instant they confirm. */}
      {local.mulliganPhaseActive ? (
        <MulliganScreen
          hand={local.mulliganHand}
          match={local.match}
          onResolve={local.resolveMulligan}
        />
      ) : null}
      {/* VERSUS match-open beat: once the opening hand is locked, the two
          commanders' full art faces off across a gold ⬡ before the board reveals.
          Solo, non-tutorial only; re-arms on reset (seed change). Self-contained
          overlay — no live-board effect, so it can't trip the static-flag issue. */}
      {!tutorial &&
      !local.mulliganPhaseActive &&
      !local.winner &&
      introSeenSeed !== matchSeed ? (
        <VersusIntro
          own={getCommanderVmForPlayer(local.match.players.P1)}
          enemy={getCommanderVmForPlayer(local.match.players.P2)}
          boss={
            boss
              ? {
                  name: boss.name,
                  title: boss.title,
                  imageUrl: boss.imageUrl,
                  introLine: pickBossLine(boss.introLines, matchSeed),
                }
              : null
          }
          onDone={() => setIntroSeenSeed(matchSeed)}
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
        actionMessage={local.actionMessage}
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
        canSurge={local.canSurge}
        surge={local.surge}
        playSelectedUnit={local.playSelectedUnit}
        playSelectedArtifact={local.playSelectedArtifact}
        playSelectedSpell={local.playSelectedSpell}
        equipSelectedToUnit={local.equipSelectedToUnit}
        attackUnit={local.attackUnit}
        attackFace={local.attackFace}
        mulligan={local.mulligan}
        resetMatch={local.resetMatch}
        // Solo's end beat is the dedicated WinCeremony below (and the tutorial's
        // completion dialog). The in-board MatchCeremony stays PvP-only —
        // teardown §3/§7: both overlays used to mount at once in solo, and a
        // tutorial win stacked THREE end screens.
        showCeremony={false}
      />
      {/* Premium WIN / LOSS ceremony. Only outside the tutorial (which drives its
          own end-state via TutorialCoach). Renders once `winner` is decided and
          reuses the existing reset handler for "Run It Back". */}
      {!tutorial ? (
        <WinCeremony
          winner={local.winner}
          mySeat="P1"
          match={local.match}
          rewards={rewards}
          firstWinBonus={firstWinBonus}
          rankLabel={profile.rank.label}
          ratingDelta={ratingDelta}
          bossLine={bossOutroLine}
          bossName={boss?.name ?? null}
          onPlayAgain={local.resetMatch}
        />
      ) : null}
    </div>
  );
}
