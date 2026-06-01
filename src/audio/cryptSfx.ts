/*
 * cryptSfx.ts — PRESENTATION-ONLY procedural sound design for the live match.
 *
 * A pure Web Audio synth: no mp3/wav assets, no npm deps. Every sound is built
 * at call time from layered oscillators (detuned voices), ADSR gain envelopes,
 * BiquadFilter-shaped noise bursts for impacts, and a shared reverb send for
 * space. The vibe is dark-arcade / occult-tech: low minor-key metallic tones,
 * punchy and weighty, never a wash of noise.
 *
 * Browsers block autoplay until a user gesture, so the shared AudioContext is
 * created lazily on the first play() call (which is always downstream of a
 * click/keypress in this app). A mute flag is persisted to localStorage.
 *
 * Public API is STABLE — useMatchSound + SoundToggle depend on these names:
 *   isMuted / setMuted / toggleMuted / onMuteChange  (mute API)
 *   playDeploy / playDraw / playAttack / playDamage / playDeath /
 *   playTurn / playWin / playDefeat / playStalemate  (sfx)
 * Plus, additively, the audio bus accessor used by the ambience module.
 *
 * This module touches NO game logic — it only makes noise.
 */

const MUTE_KEY = "crypt.sfx.muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
/** Shared reverb send + return, built once alongside the context. */
let reverbSend: GainNode | null = null;
let muted = readMuted();
const listeners = new Set<(muted: boolean) => void>();

/** Per-faction base-pitch tint (semitone offsets). Cheap tonal motif — purely
 * shifts the root of each sound so the match "keys" to the deck's faction. */
const FACTION_SEMITONES: Record<string, number> = {
  STONE: -5, // low, heavy
  IRON: -3,
  BRONZE: 0,
  SILVER: 2, // the brand's silver — bright, neutral root
  GOLD: 4,
  GOD: 7, // exalted, high
};
let factionShift = 1; // multiplicative pitch ratio applied to every voice

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Build a short algorithmic impulse response for a dark plate-ish reverb. */
function buildReverbIR(ac: AudioContext, seconds = 1.6, decay = 3.2): AudioBuffer {
  const rate = ac.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const ir = ac.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      // Noise tail with an exponential decay — cheap but convincing space.
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return ir;
}

/** Lazily build (and resume) the shared AudioContext on first gesture. */
function audio(): { ctx: AudioContext; master: GainNode; reverb: GainNode } | null {
  if (typeof window === "undefined") return null;
  const Ctor: typeof AudioContext | undefined =
    window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;

  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.5; // headroom; per-sound envelopes stay well below 1
    master.connect(ctx.destination);

    // Reverb return: a Convolver fed by a send bus, mixed back under master.
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 1;
    let wet: AudioNode = reverbSend;
    try {
      const conv = ctx.createConvolver();
      conv.buffer = buildReverbIR(ctx);
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.32; // subtle space, not a cathedral
      reverbSend.connect(conv);
      conv.connect(wetGain);
      wet = wetGain;
    } catch {
      // Convolver unsupported — fall back to a short feedback delay as "space".
      const delay = ctx.createDelay(0.5);
      delay.delayTime.value = 0.13;
      const fb = ctx.createGain();
      fb.gain.value = 0.28;
      const wetGain = ctx.createGain();
      wetGain.gain.value = 0.25;
      reverbSend.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wetGain);
      wet = wetGain;
    }
    wet.connect(master);
  }
  // Autoplay policy: a context can start "suspended" until a gesture resumes it.
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, master: master!, reverb: reverbSend! };
}

/** Exposed for the ambience module so it shares ONE context + bus + mute gate. */
export function getAudioBus():
  | { ctx: AudioContext; master: GainNode; reverb: GainNode }
  | null {
  return audio();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0");
  } catch {
    /* storage unavailable — keep in-memory flag */
  }
  listeners.forEach((fn) => fn(muted));
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}

/** Subscribe to mute changes (for the toggle UI + ambience). Returns unsub fn. */
export function onMuteChange(fn: (muted: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Set the active faction tint (optional tonal motif). Cheap: shifts the root
 * pitch of every subsequent voice. Unknown / undefined resets to neutral.
 */
export function setFactionTint(faction: string | null | undefined): void {
  const semis = faction ? (FACTION_SEMITONES[faction] ?? 0) : 0;
  factionShift = Math.pow(2, semis / 12);
}

/* ---- Voice primitives ---------------------------------------------------- */

type Routing = { reverb?: number };

type ToneSpec = {
  type: OscillatorType;
  /** start frequency (Hz) — multiplied by the faction tint at schedule time. */
  freq: number;
  /** optional glide-to frequency for a pitch sweep */
  toFreq?: number;
  /** peak gain (0..1), kept low to avoid clipping */
  gain: number;
  /** total duration in seconds */
  dur: number;
  /** attack time in seconds (default snappy) */
  attack?: number;
  /** decay-to-sustain time; sustain held until release */
  decay?: number;
  /** sustain level as a fraction of peak (0..1) */
  sustain?: number;
  /** release time in seconds */
  release?: number;
  /** detune in cents for fat/metallic stacks */
  detune?: number;
  /** start offset in seconds (for layered/sequenced voices) */
  delay?: number;
  /** how much of this voice feeds the reverb send (0..1) */
  reverb?: number;
};

/** Schedule a single oscillator with a real ADSR on the shared bus. */
function tone(spec: ToneSpec): void {
  const a = audio();
  if (!a) return;
  const { ctx, master, reverb } = a;
  const t0 = ctx.currentTime + (spec.delay ?? 0);
  const attack = spec.attack ?? 0.005;
  const decay = spec.decay ?? Math.min(0.08, spec.dur * 0.4);
  const sustain = spec.sustain ?? 0.5;
  const release = spec.release ?? Math.max(0.04, spec.dur * 0.5);
  const peak = Math.max(0.0002, spec.gain);
  const sus = Math.max(0.0002, peak * sustain);

  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = spec.type;
  if (spec.detune) osc.detune.setValueAtTime(spec.detune, t0);
  const f0 = spec.freq * factionShift;
  osc.frequency.setValueAtTime(f0, t0);
  if (spec.toFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, spec.toFreq * factionShift),
      t0 + spec.dur,
    );
  }

  // ADSR
  const tA = t0 + attack;
  const tD = tA + decay;
  const tR = t0 + spec.dur;
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, tA);
  env.gain.exponentialRampToValueAtTime(sus, tD);
  env.gain.setValueAtTime(sus, Math.max(tD, tR - release));
  env.gain.exponentialRampToValueAtTime(0.0001, tR + release);

  osc.connect(env);
  env.connect(master);
  if (spec.reverb) {
    const send = ctx.createGain();
    send.gain.value = spec.reverb;
    env.connect(send);
    send.connect(reverb);
  }
  osc.start(t0);
  osc.stop(tR + release + 0.03);
}

type NoiseSpec = {
  /** total duration in seconds */
  dur: number;
  /** peak gain (0..1) */
  gain: number;
  /** filter type for shaping the burst */
  filter?: BiquadFilterType;
  /** filter cutoff (Hz) — multiplied by faction tint */
  cutoff?: number;
  /** optional cutoff sweep target (Hz) */
  toCutoff?: number;
  /** filter Q */
  q?: number;
  attack?: number;
  delay?: number;
  reverb?: number;
};

let noiseBuf: AudioBuffer | null = null;
function noiseBuffer(ac: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ac.sampleRate) return noiseBuf;
  const len = Math.floor(ac.sampleRate * 0.5);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

/** A filtered noise burst — the "impact / metallic" texture for hits & deaths. */
function noise(spec: NoiseSpec): void {
  const a = audio();
  if (!a) return;
  const { ctx, master, reverb } = a;
  const t0 = ctx.currentTime + (spec.delay ?? 0);
  const attack = spec.attack ?? 0.001;
  const peak = Math.max(0.0002, spec.gain);

  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.playbackRate.value = 1;

  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter ?? "bandpass";
  const cut = (spec.cutoff ?? 1200) * factionShift;
  filter.frequency.setValueAtTime(cut, t0);
  if (spec.toCutoff !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(40, spec.toCutoff * factionShift),
      t0 + spec.dur,
    );
  }
  filter.Q.value = spec.q ?? 0.7;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + spec.dur);

  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  if (spec.reverb) {
    const send = ctx.createGain();
    send.gain.value = spec.reverb;
    env.connect(send);
    send.connect(reverb);
  }
  src.start(t0);
  src.stop(t0 + spec.dur + 0.03);
}

/** Play a layered cluster of voices + noise, short-circuiting when muted. */
function play(voices: ToneSpec[], bursts: NoiseSpec[] = []): void {
  if (muted) return;
  if (!audio()) return;
  for (const v of voices) tone(v);
  for (const b of bursts) noise(b);
}

/* ---- The sound palette ---------------------------------------------------
 * Each event is tonally distinct and weighty. Roots sit in a dark minor
 * world (A minor-ish: A=220, C=262, E=330, G=196). Reverb sends add space to
 * the longer, more dramatic events (death / win / defeat). */

/** Unit deployed to a lane: a grounded, confident low→mid swell with a thunk. */
export function playDeploy(): void {
  play(
    [
      // Detuned saw stack rising into the lane — body + weight.
      { type: "sawtooth", freq: 110, toFreq: 220, gain: 0.13, dur: 0.22, attack: 0.008, decay: 0.06, sustain: 0.55, release: 0.12, detune: -7, reverb: 0.12 },
      { type: "square", freq: 165, toFreq: 247, gain: 0.1, dur: 0.2, attack: 0.006, decay: 0.05, sustain: 0.5, release: 0.1, detune: 8 },
      // Sub thump on landing.
      { type: "sine", freq: 70, toFreq: 55, gain: 0.16, dur: 0.18, attack: 0.004, decay: 0.05, sustain: 0.2, release: 0.1 },
    ],
    [
      // Low "set down" impact.
      { dur: 0.12, gain: 0.07, filter: "lowpass", cutoff: 900, toCutoff: 220, q: 0.6 },
    ],
  );
}

/** A card is drawn into hand: a crisp upward shimmer flick. */
export function playDraw(): void {
  play(
    [
      { type: "triangle", freq: 540, toFreq: 920, gain: 0.08, dur: 0.12, attack: 0.003, decay: 0.04, sustain: 0.3, release: 0.06 },
      { type: "sine", freq: 1080, toFreq: 1500, gain: 0.04, dur: 0.1, attack: 0.002, decay: 0.03, sustain: 0.25, release: 0.05, delay: 0.015, reverb: 0.18 },
    ],
    [
      // Tiny paper-edge tick high up.
      { dur: 0.05, gain: 0.04, filter: "highpass", cutoff: 3800, q: 0.5, reverb: 0.1 },
    ],
  );
}

/** An attack is committed: a sharp downward metallic swipe with bite. */
export function playAttack(): void {
  play(
    [
      { type: "sawtooth", freq: 520, toFreq: 130, gain: 0.13, dur: 0.16, attack: 0.004, decay: 0.05, sustain: 0.35, release: 0.07, detune: -10 },
      { type: "square", freq: 260, toFreq: 110, gain: 0.07, dur: 0.13, attack: 0.004, decay: 0.04, sustain: 0.3, release: 0.06, detune: 12 },
    ],
    [
      // Steel-scrape: bandpass noise sweeping down = the blade swing.
      { dur: 0.16, gain: 0.09, filter: "bandpass", cutoff: 3200, toCutoff: 700, q: 3.5, reverb: 0.14 },
    ],
  );
}

/** A unit takes damage (still alive): a tight, punchy low thud + crack. */
export function playDamage(): void {
  play(
    [
      { type: "square", freq: 150, toFreq: 78, gain: 0.15, dur: 0.12, attack: 0.002, decay: 0.04, sustain: 0.25, release: 0.06 },
      { type: "sine", freq: 64, gain: 0.12, dur: 0.11, attack: 0.002, decay: 0.04, sustain: 0.2, release: 0.05 },
    ],
    [
      // Impact crack — short, mid-bright.
      { dur: 0.07, gain: 0.1, filter: "bandpass", cutoff: 1600, toCutoff: 500, q: 1.2 },
    ],
  );
}

/** A unit dies: a descending minor fall with a hollow, reverberant tail. */
export function playDeath(): void {
  play(
    [
      { type: "sawtooth", freq: 280, toFreq: 66, gain: 0.12, dur: 0.34, attack: 0.004, decay: 0.1, sustain: 0.4, release: 0.18, detune: -8, reverb: 0.3 },
      { type: "triangle", freq: 140, toFreq: 49, gain: 0.09, dur: 0.4, attack: 0.006, decay: 0.12, sustain: 0.35, release: 0.22, delay: 0.04, reverb: 0.34 },
      // A low knell underneath.
      { type: "sine", freq: 55, gain: 0.1, dur: 0.36, attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.2, reverb: 0.2 },
    ],
    [
      // Shattering noise burst that decays into the reverb.
      { dur: 0.3, gain: 0.08, filter: "lowpass", cutoff: 2600, toCutoff: 200, q: 0.8, reverb: 0.4 },
    ],
  );
}

/** Turn change: a soft neutral two-tone chime so it registers without nagging. */
export function playTurn(): void {
  play([
    { type: "triangle", freq: 330, gain: 0.07, dur: 0.14, attack: 0.006, decay: 0.05, sustain: 0.4, release: 0.07, reverb: 0.16 },
    { type: "sine", freq: 495, gain: 0.05, dur: 0.16, attack: 0.006, decay: 0.05, sustain: 0.4, release: 0.08, delay: 0.05, reverb: 0.2 },
  ]);
}

/** Victory: a rising gold arpeggio that blooms into reverb. */
export function playWin(): void {
  play(
    [
      // A minor → resolving bright: A4, C5, E5, A5 with a shimmer top.
      { type: "square", freq: 440, gain: 0.11, dur: 0.2, attack: 0.005, decay: 0.06, sustain: 0.5, release: 0.12, delay: 0.0, reverb: 0.18 },
      { type: "square", freq: 523, gain: 0.11, dur: 0.2, attack: 0.005, decay: 0.06, sustain: 0.5, release: 0.12, delay: 0.11, reverb: 0.2 },
      { type: "square", freq: 659, gain: 0.12, dur: 0.24, attack: 0.005, decay: 0.06, sustain: 0.55, release: 0.16, delay: 0.22, reverb: 0.24 },
      { type: "sawtooth", freq: 880, gain: 0.09, dur: 0.5, attack: 0.006, decay: 0.12, sustain: 0.4, release: 0.32, delay: 0.33, detune: -6, reverb: 0.34 },
      // Gold shimmer octave.
      { type: "triangle", freq: 1320, gain: 0.05, dur: 0.5, attack: 0.01, decay: 0.14, sustain: 0.3, release: 0.3, delay: 0.33, reverb: 0.4 },
      // Sub foundation.
      { type: "sine", freq: 110, gain: 0.1, dur: 0.55, attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.3, delay: 0.22 },
    ],
    [
      // Triumphant air-burst that sails into the reverb.
      { dur: 0.45, gain: 0.05, filter: "highpass", cutoff: 1800, q: 0.6, delay: 0.33, reverb: 0.5 },
    ],
  );
}

/** Defeat: a descending minor knell with a long mournful tail. */
export function playDefeat(): void {
  play(
    [
      { type: "sawtooth", freq: 330, gain: 0.1, dur: 0.26, attack: 0.006, decay: 0.08, sustain: 0.45, release: 0.16, detune: -8, reverb: 0.24 },
      { type: "sawtooth", freq: 247, gain: 0.1, dur: 0.28, attack: 0.006, decay: 0.08, sustain: 0.45, release: 0.18, delay: 0.16, detune: -6, reverb: 0.28 },
      { type: "triangle", freq: 196, toFreq: 123, gain: 0.1, dur: 0.6, attack: 0.008, decay: 0.18, sustain: 0.4, release: 0.4, delay: 0.34, reverb: 0.4 },
      // Low funeral sub.
      { type: "sine", freq: 82, gain: 0.11, dur: 0.6, attack: 0.012, decay: 0.18, sustain: 0.4, release: 0.35, delay: 0.34, reverb: 0.2 },
    ],
    [
      { dur: 0.5, gain: 0.05, filter: "lowpass", cutoff: 1400, toCutoff: 160, q: 0.7, delay: 0.34, reverb: 0.5 },
    ],
  );
}

/** Stalemate / no-winner result: a flat, suspended, unresolved two-tone. */
export function playStalemate(): void {
  play([
    { type: "triangle", freq: 300, gain: 0.09, dur: 0.24, attack: 0.008, decay: 0.08, sustain: 0.5, release: 0.12, reverb: 0.22 },
    // A minor-second clash holds the tension unresolved.
    { type: "triangle", freq: 318, gain: 0.08, dur: 0.26, attack: 0.008, decay: 0.08, sustain: 0.5, release: 0.14, delay: 0.18, reverb: 0.24 },
  ]);
}
