import React, { useEffect, useState } from "react";
import {
  AI_DIFFICULTY_KEY,
  readAiDifficulty,
  type AiDifficulty,
} from "../../game-ui/cryptMatchAI";
import { AI_BOSSES } from "../../data/aiBosses";
import "../../styles/ai-bosses.css";

/*
 * DifficultySelect — the named-opponent picker for the single-player AI.
 * Each tier is fronted by a NAMED boss (chess.com named-bot pattern): portrait
 * (real commander render, art fills frame), name, declared style chip, and a
 * one-line signature. Static content only — the boss is presentation over the
 * EXACT same easy/normal/hard planner tiers.
 *
 * Fully standalone: it reads and writes the same localStorage key the AI
 * self-reads (`crypt_ai_difficulty`), so it can be dropped in anywhere with NO
 * props or external wiring — the planner picks up the change on its next turn.
 * Browser-safe via the shared `readAiDifficulty()` guard. No emoji.
 *
 * Persisting here also broadcasts a `storage`-style refresh so any other mounted
 * instance stays in sync within the same tab (the native `storage` event only
 * fires across tabs).
 */

/**
 * Book game ruling: 3 visible tiers and NO hidden ramp (useLocalCryptMatch
 * reads this choice directly via readAiDifficulty; the lifetime-match ramp is
 * dead). Storage values stay easy/normal/hard so an existing saved choice
 * keeps working — the boss names are a skin over the same values.
 */
const TIERS: { value: AiDifficulty; tier: string; hint: string }[] = [
  { value: "easy", tier: "Initiate", hint: "Gentle opponent — under-deploys, never hunts lethal" },
  { value: "normal", tier: "Veteran", hint: "The standard greedy opponent — trades well" },
  { value: "hard", tier: "Sovereign", hint: "Full-board commitment — takes lethal on sight" },
];

// Same-tab sync: a custom event so sibling selectors update immediately.
const SYNC_EVENT = "crypt-ai-difficulty-change";

function writeDifficulty(value: AiDifficulty) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(AI_DIFFICULTY_KEY, value);
    }
  } catch {
    // Storage disabled (private mode) — selection is in-memory only this session.
  }
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent<AiDifficulty>(SYNC_EVENT, { detail: value }));
    }
  } catch {
    /* no-op */
  }
}

export function DifficultySelect() {
  const [value, setValue] = useState<AiDifficulty>("normal");

  // Hydrate from storage after mount (avoids any SSR mismatch) and keep in sync
  // with other instances / other tabs.
  useEffect(() => {
    setValue(readAiDifficulty());
    if (typeof window === "undefined") return;
    const onSync = () => setValue(readAiDifficulty());
    window.addEventListener(SYNC_EVENT, onSync as EventListener);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync as EventListener);
      window.removeEventListener("storage", onSync);
    };
  }, []);

  const choose = (next: AiDifficulty) => {
    setValue(next);
    writeDifficulty(next);
  };

  return (
    <div className="boss-select" role="group" aria-label="Opponent">
      <span className="boss-select__label" aria-hidden="true">
        Opponent
      </span>
      <div className="boss-select__row">
        {TIERS.map(({ value: tierValue, tier, hint }) => {
          const boss = AI_BOSSES[tierValue];
          const active = tierValue === value;
          return (
            <button
              key={tierValue}
              type="button"
              className={`boss-card${active ? " boss-card--active" : ""}`}
              onClick={() => choose(tierValue)}
              aria-pressed={active}
              aria-label={`${boss.name} — ${tier}`}
              title={`${hint}. ${boss.signature}.`}
            >
              <span className="boss-card__frame" aria-hidden="true">
                <img
                  className="boss-card__art"
                  src={boss.imageUrl}
                  alt=""
                  loading="lazy"
                  draggable={false}
                />
              </span>
              <span className="boss-card__meta">
                <span className="boss-card__tier">{tier}</span>
                <span className="boss-card__name">{boss.name}</span>
                <span className="boss-card__chip">{boss.styleChip}</span>
                <span className="boss-card__sig">{boss.signature}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default DifficultySelect;
