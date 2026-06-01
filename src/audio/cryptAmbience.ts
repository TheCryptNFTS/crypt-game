/*
 * cryptAmbience.ts — PRESENTATION-ONLY generative match soundtrack.
 *
 * A subtle, procedural ambient bed for an ACTIVE match: a slow minor-key
 * arpeggio drifting over a low drone pad, all built from the SAME shared
 * AudioContext/bus as cryptSfx (so it shares the reverb + the single mute gate).
 * Notes are scheduled ahead on the AudioContext clock via a look-ahead
 * scheduler — NOT setInterval-driven oscillators — so there is no timing drift.
 *
 * It is deliberately QUIET and non-fatiguing, and it INTENSIFIES as the match
 * gets tense: as either nexus drops toward zero the filter opens, an extra
 * harmony layer fades in, and the arpeggio tightens. On match end it fades out
 * and tears down every node (no leaks).
 *
 * Risk control: ambience is OFF BY DEFAULT and only starts when explicitly
 * enabled (the hook gates it behind a persisted opt-in flag). It always obeys
 * the shared `crypt.sfx.muted` flag too — muting silences everything instantly.
 *
 * No npm deps, no audio assets — pure Web Audio. Touches NO game logic.
 */

import { getAudioBus, isMuted, onMuteChange } from "./cryptSfx";

const ENABLE_KEY = "crypt.ambience.enabled";

/** A minor (A C D E G — minor pentatonic) across two octaves, in Hz. */
const SCALE_HZ = [
  // octave 2/3 (pad/bass)
  110.0, 130.81, 146.83, 164.81, 196.0,
  // octave 3/4 (arp)
  220.0, 261.63, 293.66, 329.63, 392.0,
  // octave 4/5 (sparkle when tense)
  440.0, 523.25, 587.33, 659.25, 783.99,
];

export function isAmbienceEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAmbienceEnabled(on: boolean): void {
  try {
    localStorage.setItem(ENABLE_KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
}

type AmbienceHandle = {
  /** 0..1 tension; drives filter cutoff, extra layer, tempo. */
  setTension(t: number): void;
  /** Fade out + tear down all nodes. */
  stop(): void;
};

/**
 * Start the generative bed. Returns a handle, or null when audio is
 * unavailable / muted-at-start with no context. Always safe to call; the
 * returned handle's stop() is idempotent.
 */
export function startAmbience(): AmbienceHandle | null {
  const bus = getAudioBus();
  if (!bus) return null;
  const { ctx, master, reverb } = bus;

  // ---- Signal chain: [voices] -> filter -> bedGain -> master (+ reverb) ----
  const bedGain = ctx.createGain();
  bedGain.gain.value = 0.0001; // fade in
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 700; // calm baseline; opens with tension
  filter.Q.value = 0.6;
  filter.connect(bedGain);
  bedGain.connect(master);

  // A gentle reverb send for space.
  const sendGain = ctx.createGain();
  sendGain.gain.value = 0.5;
  bedGain.connect(sendGain);
  sendGain.connect(reverb);

  // Slow drone pad: two detuned saws on the root, very low and quiet.
  const pad: OscillatorNode[] = [];
  const padGain = ctx.createGain();
  padGain.gain.value = 0.05;
  padGain.connect(filter);
  for (const det of [-7, 6]) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = SCALE_HZ[0];
    o.detune.value = det;
    o.connect(padGain);
    o.start();
    pad.push(o);
  }

  // A second, tension-only harmony oscillator (fifth above) — silent until the
  // match gets dangerous, then it fades in.
  const tenseOsc = ctx.createOscillator();
  tenseOsc.type = "triangle";
  tenseOsc.frequency.value = SCALE_HZ[4]; // a fifth-ish above root
  const tenseGain = ctx.createGain();
  tenseGain.gain.value = 0.0001;
  tenseOsc.connect(tenseGain);
  tenseGain.connect(filter);
  tenseOsc.start();

  // Master fade-in for the whole bed.
  const startT = ctx.currentTime;
  bedGain.gain.setValueAtTime(0.0001, startT);
  bedGain.gain.exponentialRampToValueAtTime(0.5, startT + 3.0);

  // ---- State ----
  let tension = 0; // 0..1
  let stopped = false;
  let arpIndex = 0;
  let nextNoteTime = ctx.currentTime + 0.2;
  let timer: number | null = null;

  // Mute should silence the bed without tearing it down (so unmute resumes).
  const applyMute = (m: boolean) => {
    if (stopped) return;
    const now = ctx.currentTime;
    bedGain.gain.cancelScheduledValues(now);
    bedGain.gain.setValueAtTime(Math.max(0.0001, bedGain.gain.value), now);
    bedGain.gain.exponentialRampToValueAtTime(m ? 0.0001 : 0.5, now + 0.4);
  };
  const unsubMute = onMuteChange(applyMute);
  if (isMuted()) applyMute(true);

  // ---- One plucked arp note ----
  function pluck(time: number, freq: number, gain: number, dur: number) {
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g);
    g.connect(filter);
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  // ---- Look-ahead scheduler (clock-accurate, no drift) ----
  // Pattern walks the mid-octave pentatonic with occasional sparkle notes.
  const ARP_ORDER = [5, 7, 9, 6, 8, 7, 5, 9];
  function scheduler() {
    if (stopped) return;
    const lookahead = 0.4; // schedule 400ms ahead
    while (nextNoteTime < ctx.currentTime + lookahead) {
      // Tension tightens the interval (slow ~0.62s → urgent ~0.32s).
      const step = 0.62 - tension * 0.3;
      const noteGain = 0.035 + tension * 0.03;
      const idx = ARP_ORDER[arpIndex % ARP_ORDER.length];
      pluck(nextNoteTime, SCALE_HZ[idx], noteGain, 0.7 - tension * 0.2);
      // Add a high sparkle octave only when the match is tense.
      if (tension > 0.55 && arpIndex % 2 === 0) {
        pluck(nextNoteTime, SCALE_HZ[10 + (idx % 5)], noteGain * 0.5, 0.5);
      }
      arpIndex++;
      nextNoteTime += step;
    }
    timer = window.setTimeout(scheduler, 120);
  }
  scheduler();

  return {
    setTension(t: number) {
      if (stopped) return;
      tension = Math.max(0, Math.min(1, t));
      const now = ctx.currentTime;
      // Filter opens from 700Hz (calm) to ~4200Hz (frantic).
      const cutoff = 700 + tension * 3500;
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.setTargetAtTime(cutoff, now, 0.8);
      // The fifth-harmony layer fades in past the halfway mark.
      const tenseLevel = tension > 0.5 ? (tension - 0.5) * 2 * 0.04 : 0.0001;
      tenseGain.gain.cancelScheduledValues(now);
      tenseGain.gain.setTargetAtTime(Math.max(0.0001, tenseLevel), now, 1.0);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      unsubMute();
      if (timer !== null) window.clearTimeout(timer);
      const now = ctx.currentTime;
      // Fade the whole bed out, then disconnect/stop every node.
      bedGain.gain.cancelScheduledValues(now);
      bedGain.gain.setValueAtTime(Math.max(0.0001, bedGain.gain.value), now);
      bedGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
      const stopAt = now + 0.85;
      for (const o of pad) {
        try {
          o.stop(stopAt);
        } catch {
          /* already stopped */
        }
      }
      try {
        tenseOsc.stop(stopAt);
      } catch {
        /* already stopped */
      }
      // Disconnect graph after the fade so the tail completes cleanly.
      window.setTimeout(() => {
        try {
          padGain.disconnect();
          tenseGain.disconnect();
          filter.disconnect();
          sendGain.disconnect();
          bedGain.disconnect();
        } catch {
          /* nodes may already be GC-eligible */
        }
      }, 900);
    },
  };
}
