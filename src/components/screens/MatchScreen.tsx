import { useState, useMemo } from "react";
import { useGame } from "../../hooks/useGame";
import { getPlayableCardById, getCommanderCardById } from "../../engine/cards";
import { getDisplayCardById } from "../../lib/cardAdapter";
import { UnitOnBoard } from "../match/UnitOnBoard";
import { HandCard } from "../match/HandCard";
import { Button } from "../ui/Button";
import type { PlayerId, UnitInPlay } from "../../engine/state";

interface MatchScreenProps {
  onSelectCard: (cardId: string) => void;
}

export function MatchScreen({ onSelectCard }: MatchScreenProps) {
  const { match, actions } = useGame();
  const [selectedHandIndex, setSelectedHandIndex] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [targetMode, setTargetMode] = useState<"attack" | "equip" | null>(null);

  const activePlayer = match.activePlayer;
  const currentPlayer = match.players[activePlayer];
  const opponent = match.players[activePlayer === "P1" ? "P2" : "P1"];

  const selectedHandCard = useMemo(() => {
    if (selectedHandIndex === null) return null;
    const cardId = currentPlayer.hand[selectedHandIndex];
    return cardId ? getPlayableCardById(cardId) : null;
  }, [selectedHandIndex, currentPlayer.hand]);

  const canPlayCard = (cardId: string): boolean => {
    const card = getPlayableCardById(cardId);
    if (!card) return false;
    const cost = (card as any).cost ?? 0;
    return currentPlayer.energy >= cost;
  };

  const handleHandCardClick = (index: number) => {
    const cardId = currentPlayer.hand[index];
    const card = getPlayableCardById(cardId);
    if (!card) return;

    if (selectedHandIndex === index) {
      // Deselect
      setSelectedHandIndex(null);
      setTargetMode(null);
      return;
    }

    setSelectedHandIndex(index);
    setSelectedUnitId(null);
    
    // Determine action based on card type
    if (card.type === "unit" || card.type === "artifact") {
      // Auto-play units and artifacts
      if (canPlayCard(cardId)) {
        if (card.type === "unit") {
          actions.playUnit(activePlayer, index, "front");
        } else {
          actions.playArtifact(activePlayer, index);
        }
        setSelectedHandIndex(null);
      }
    } else if (card.type === "equipment") {
      // Enter target selection mode
      setTargetMode("equip");
    }
  };

  const handleBoardUnitClick = (unit: UnitInPlay, isOwn: boolean) => {
    // If targeting for equipment
    if (targetMode === "equip" && selectedHandIndex !== null && isOwn) {
      actions.playEquipment(activePlayer, selectedHandIndex, unit.instanceId);
      setSelectedHandIndex(null);
      setTargetMode(null);
      return;
    }

    // If selecting unit for attack
    if (targetMode === "attack" && selectedUnitId && !isOwn) {
      actions.attack(selectedUnitId, unit.instanceId);
      setSelectedUnitId(null);
      setTargetMode(null);
      return;
    }

    // Select own unit for attacking
    if (isOwn && !unit.exhausted && !unit.summoningSick) {
      if (selectedUnitId === unit.instanceId) {
        setSelectedUnitId(null);
        setTargetMode(null);
      } else {
        setSelectedUnitId(unit.instanceId);
        setTargetMode("attack");
        setSelectedHandIndex(null);
      }
    }
  };

  const handleAttackPlayer = () => {
    if (selectedUnitId) {
      actions.attack(selectedUnitId);
      setSelectedUnitId(null);
      setTargetMode(null);
    }
  };

  const handleEndTurn = () => {
    actions.endTurn();
    setSelectedHandIndex(null);
    setSelectedUnitId(null);
    setTargetMode(null);
  };

  const renderPlayerInfo = (playerId: PlayerId, isOpponent: boolean) => {
    const player = match.players[playerId];
    const commander = getCommanderCardById(player.commanderId);
    const commanderDisplay = getDisplayCardById(player.commanderId);
    
    return (
      <div className={`flex items-center gap-4 ${isOpponent ? "flex-row-reverse" : ""}`}>
        {/* Commander Portrait */}
        <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-crypt-accent/50 bg-crypt-surface">
          {commanderDisplay?.imageUrl ? (
            <img 
              src={commanderDisplay.imageUrl}
              alt={commander?.name || playerId}
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-crypt-muted text-xs">
              {playerId}
            </div>
          )}
        </div>

        {/* Player Stats */}
        <div className={`${isOpponent ? "text-right" : ""}`}>
          <p className="font-display font-bold text-crypt-text">
            {commander?.name || playerId}
          </p>
          <div className={`flex items-center gap-3 mt-1 ${isOpponent ? "justify-end" : ""}`}>
            {/* Health */}
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-bold text-red-400">{player.health}</span>
            </div>
            {/* Energy */}
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-crypt-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-bold text-crypt-accent">{player.energy}/{player.maxEnergy}</span>
            </div>
            {/* Deck */}
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-crypt-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span className="text-sm text-crypt-muted">{player.deck.length}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Check for winner
  if (match.winner) {
    return (
      <div className="min-h-screen pt-20 flex items-center justify-center">
        <div className="bg-crypt-card border border-crypt-border rounded-2xl p-12 text-center">
          <h1 className="font-display font-black text-4xl text-transparent bg-clip-text bg-gradient-to-r from-crypt-accent to-crypt-gold mb-4">
            {match.winner === "P1" ? "Victory!" : "Defeat"}
          </h1>
          <p className="text-crypt-muted mb-8">
            {match.winner} has won the match
          </p>
          <Button onClick={actions.reset}>Play Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 pb-4 flex flex-col">
      {/* Match Header */}
      <div className="bg-crypt-surface/80 border-b border-crypt-border px-4 py-2">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-sm text-crypt-muted">Turn {match.turn}</span>
            <span className="text-sm text-crypt-accent font-medium">{match.phase} Phase</span>
          </div>
          <div className="flex items-center gap-2">
            {targetMode && (
              <span className="px-3 py-1 bg-crypt-accent/20 text-crypt-accent text-sm rounded-full">
                {targetMode === "attack" ? "Select target to attack" : "Select unit to equip"}
              </span>
            )}
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => { setSelectedHandIndex(null); setSelectedUnitId(null); setTargetMode(null); }}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleEndTurn}>
              End Turn
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4">
        {/* Opponent Area */}
        <div className="flex items-start justify-between">
          {renderPlayerInfo("P2", true)}
          <div className="flex items-center gap-2">
            {/* Opponent hand (face down) */}
            {opponent.hand.map((_, i) => (
              <div 
                key={i}
                className="w-8 h-12 rounded bg-gradient-to-b from-red-900 to-red-950 border border-red-700"
              />
            ))}
          </div>
        </div>

        {/* Opponent Board */}
        <div className="bg-crypt-card/30 border border-crypt-border rounded-xl p-4 min-h-[160px]">
          <p className="text-xs text-crypt-muted mb-2">Opponent Board</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {opponent.board.front.map((unit) => (
              <UnitOnBoard
                key={unit.instanceId}
                unit={unit}
                isOwn={false}
                isSelected={false}
                isValidTarget={targetMode === "attack" && selectedUnitId !== null}
                onClick={() => handleBoardUnitClick(unit, false)}
              />
            ))}
            {opponent.board.front.length === 0 && (
              <div className="text-crypt-muted text-sm py-8">No units</div>
            )}
          </div>
          
          {/* Attack Player Button */}
          {selectedUnitId && opponent.board.front.length === 0 && (
            <div className="flex justify-center mt-4">
              <Button variant="danger" onClick={handleAttackPlayer}>
                Attack Opponent Directly
              </Button>
            </div>
          )}
        </div>

        {/* Battlefield Divider */}
        <div className="flex items-center gap-4 py-2">
          <div className="flex-1 h-px bg-crypt-border" />
          <span className="text-xs text-crypt-muted uppercase tracking-wider">Battlefield</span>
          <div className="flex-1 h-px bg-crypt-border" />
        </div>

        {/* Player Board */}
        <div className="bg-crypt-card/30 border border-crypt-border rounded-xl p-4 min-h-[160px]">
          <p className="text-xs text-crypt-muted mb-2">Your Board</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {currentPlayer.board.front.map((unit) => (
              <UnitOnBoard
                key={unit.instanceId}
                unit={unit}
                isOwn={true}
                isSelected={selectedUnitId === unit.instanceId}
                isValidTarget={targetMode === "equip"}
                onClick={() => handleBoardUnitClick(unit, true)}
              />
            ))}
            {currentPlayer.board.front.length === 0 && (
              <div className="text-crypt-muted text-sm py-8">Play units from your hand</div>
            )}
          </div>
        </div>

        {/* Player Hand */}
        <div className="bg-crypt-surface border border-crypt-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            {renderPlayerInfo("P1", false)}
            <span className="text-sm text-crypt-muted">{currentPlayer.hand.length} cards in hand</span>
          </div>
          <div className="flex items-end justify-center gap-2 min-h-[160px] pb-4">
            {currentPlayer.hand.map((cardId, index) => (
              <HandCard
                key={`${cardId}-${index}`}
                cardId={cardId}
                canPlay={canPlayCard(cardId)}
                isSelected={selectedHandIndex === index}
                onClick={() => handleHandCardClick(index)}
              />
            ))}
            {currentPlayer.hand.length === 0 && (
              <div className="text-crypt-muted text-sm">No cards in hand</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
