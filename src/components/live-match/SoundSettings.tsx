import React, { useEffect, useState } from "react";
import {
  getVolume,
  isMuted,
  onMuteChange,
  onVolumeChange,
  playClick,
  setMuted as setMutedFlag,
  setVolume as setVolumeFlag,
  toggleMuted,
} from "../../audio/cryptSfx";

/*
 * SoundSettings — master volume + mute control for the procedural match audio.
 *
 * Presentation-only. It drives the persisted master-volume and mute flags in
 * cryptSfx (both stored in localStorage) and never touches game state. It
 * RESPECTS an already-persisted mute: it reads the current flag on mount and
 * stays in sync via onMuteChange, so toggling mute elsewhere (e.g. SoundToggle)
 * updates this control too, and vice-versa.
 *
 * No emoji — uses the hex glyph (⬡) and typographic marks, per the brand. The
 * slider is range 0..100 mapped to a 0..1 master gain. Dragging the slider off
 * zero while muted auto-unmutes (you clearly want sound); sliding to zero is a
 * soft mute that leaves the mute flag alone.
 *
 * Audio stays gesture-gated: the underlying AudioContext is only created when a
 * sound first plays, so changing the slider before any interaction is safe.
 */
export function SoundSettings() {
  const [muted, setMutedState] = useState(isMuted());
  // Slider value is 0..100 for crisp integer steps; mapped to 0..1 gain.
  const [pct, setPct] = useState(() => Math.round(getVolume() * 100));

  // Stay in sync with mute changes coming from anywhere (e.g. SoundToggle).
  useEffect(() => onMuteChange(setMutedState), []);
  // Stay in sync with volume changes from any other source.
  useEffect(() => onVolumeChange((v) => setPct(Math.round(v * 100))), []);

  const applyVolume = (next: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(next)));
    setPct(clamped);
    setVolumeFlag(clamped / 100);
    // Sliding up from silence while muted clearly means "I want sound now".
    if (clamped > 0 && isMuted()) setMutedFlag(false);
  };

  const onToggleMute = () => {
    const nowMuted = toggleMuted();
    // A tiny tick confirms the unmute (and primes the AudioContext on gesture).
    if (!nowMuted) playClick();
  };

  return (
    <div className="live-sound-settings" role="group" aria-label="Match sound settings">
      <button
        type="button"
        className={`live-sound-settings__mute${muted ? " is-muted" : ""}`}
        onClick={onToggleMute}
        aria-pressed={muted}
        aria-label={muted ? "Unmute match sound" : "Mute match sound"}
        title={muted ? "Sound off" : "Sound on"}
      >
        <span className="live-sound-settings__glyph" aria-hidden="true">
          {"\u2B22"}
        </span>
        <span className="live-sound-settings__mark" aria-hidden="true">
          {muted ? "\u00D7" : "\u2022"}
        </span>
      </button>

      <input
        type="range"
        className="live-sound-settings__slider"
        min={0}
        max={100}
        step={1}
        value={muted ? 0 : pct}
        onChange={(e) => applyVolume(Number(e.target.value))}
        aria-label="Master volume"
        title={`Volume ${muted ? 0 : pct}%`}
        disabled={muted}
      />

      <span className="live-sound-settings__readout" aria-hidden="true">
        {muted ? "\u00D7" : `${pct}`}
      </span>
    </div>
  );
}
