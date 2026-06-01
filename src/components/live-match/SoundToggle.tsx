import React, { useEffect, useState } from "react";
import { isMuted, onMuteChange, toggleMuted } from "../../audio/cryptSfx";
import { isAmbienceEnabled, setAmbienceEnabled } from "../../audio/cryptAmbience";

/*
 * SoundToggle — unobtrusive audio controls for the procedural match audio.
 *
 * Presentation-only: it flips the persisted mute flag in cryptSfx and the
 * (opt-in, off-by-default) generative-ambience flag; it does not touch game
 * state. No emoji — uses the hex glyph (⬡) for "sound on", a struck hex with the
 * × mark for "muted", and a wave glyph (∿) for the ambient bed toggle.
 *
 * The ambience toggle is hidden while muted (the bed can't sound anyway), and
 * its flag is read on the next match start by useMatchSound. Toggling it
 * mid-match doesn't hot-restart the bed by design — it's a quiet preference.
 */
export function SoundToggle() {
  const [muted, setMuted] = useState(isMuted());
  const [ambience, setAmbience] = useState(isAmbienceEnabled());

  useEffect(() => onMuteChange(setMuted), []);

  return (
    <span className="live-sound-controls">
      <button
        type="button"
        className={`live-sound-toggle${muted ? " live-sound-toggle--muted" : ""}`}
        onClick={() => setMuted(toggleMuted())}
        aria-pressed={muted}
        aria-label={muted ? "Unmute match sound" : "Mute match sound"}
        title={muted ? "Sound off" : "Sound on"}
      >
        <span className="live-sound-toggle__glyph" aria-hidden="true">
          {"\u2B22"}
        </span>
        <span className="live-sound-toggle__state" aria-hidden="true">
          {muted ? "\u00D7" : "\u2022"}
        </span>
      </button>

      {!muted ? (
        <button
          type="button"
          className={`live-sound-toggle live-sound-toggle--ambience${
            ambience ? " live-sound-toggle--ambience-on" : ""
          }`}
          onClick={() => {
            const next = !ambience;
            setAmbienceEnabled(next);
            setAmbience(next);
          }}
          aria-pressed={ambience}
          aria-label={ambience ? "Disable ambient soundtrack" : "Enable ambient soundtrack"}
          title={
            ambience
              ? "Ambient soundtrack on (applies next match)"
              : "Ambient soundtrack off"
          }
        >
          <span className="live-sound-toggle__glyph" aria-hidden="true">
            {"\u223F"}
          </span>
        </button>
      ) : null}
    </span>
  );
}
