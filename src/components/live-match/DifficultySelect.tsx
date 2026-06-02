import React, { useEffect, useState } from "react";
import {
  AI_DIFFICULTY_KEY,
  readAiDifficulty,
  type AiDifficulty,
} from "../../game-ui/cryptMatchAI";

/*
 * DifficultySelect — a small, self-contained Easy / Normal / Hard control for
 * the single-player opponent AI.
 *
 * Fully standalone: it reads and writes the same localStorage key the AI
 * self-reads (`crypt_ai_difficulty`), so it can be dropped in anywhere with NO
 * props or external wiring — the planner picks up the change on its next turn.
 * Browser-safe via the shared `readAiDifficulty()` guard. No emoji — uses the
 * hex glyph (⬡) to mark the active tier, in keeping with the match UI.
 *
 * Persisting here also broadcasts a `storage`-style refresh so any other mounted
 * instance stays in sync within the same tab (the native `storage` event only
 * fires across tabs).
 */

const TIERS: { value: AiDifficulty; label: string; hint: string }[] = [
  { value: "easy", label: "Easy", hint: "Passive opponent — under-deploys and misplays" },
  { value: "normal", label: "Normal", hint: "Balanced greedy opponent" },
  { value: "hard", label: "Hard", hint: "Sharp opponent — trades well and takes lethal" },
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
    <div
      className="live-difficulty-select"
      role="group"
      aria-label="Opponent difficulty"
    >
      {TIERS.map((tier) => {
        const active = tier.value === value;
        return (
          <button
            key={tier.value}
            type="button"
            className={`live-difficulty-select__btn${
              active ? " live-difficulty-select__btn--active" : ""
            }`}
            onClick={() => choose(tier.value)}
            aria-pressed={active}
            title={tier.hint}
          >
            {active ? (
              <span className="live-difficulty-select__mark" aria-hidden="true">
                {"\u2B22 "}
              </span>
            ) : null}
            {tier.label}
          </button>
        );
      })}
    </div>
  );
}

export default DifficultySelect;
