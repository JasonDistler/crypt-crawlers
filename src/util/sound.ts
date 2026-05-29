/**
 * Tiny procedural sound effects via Web Audio. No assets, no licensing.
 * Each effect is a short oscillator + envelope. Calls are no-ops if the
 * browser doesn't support AudioContext (e.g. SSR/tests).
 *
 * Volume model:
 *  - Each effect declares a baseline volume (its "natural" mix level).
 *  - The runtime multiplies that by `masterVolume * sfxVolume` from the
 *    settings store, both 0..1.
 *  - The ambient drone uses `masterVolume * musicVolume` for its own bus.
 *  - `setVolumes()` is called from the meta store whenever any slider moves
 *    and updates the gain nodes live (no need to restart the drone).
 */

let ctx: AudioContext | null = null;
let masterSfxGain: GainNode | null = null;
let masterMusicGain: GainNode | null = null;

// Persisted slider values, last set via setVolumes. Defaults match metaStore.
let MASTER = 0.85;
let SFX = 0.8;
let MUSIC = 0.55;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx && masterSfxGain && masterMusicGain) return ctx;
  try {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (!masterSfxGain) {
      masterSfxGain = ctx.createGain();
      masterSfxGain.gain.value = MASTER * SFX;
      masterSfxGain.connect(ctx.destination);
    }
    if (!masterMusicGain) {
      masterMusicGain = ctx.createGain();
      masterMusicGain.gain.value = MASTER * MUSIC;
      masterMusicGain.connect(ctx.destination);
    }
  } catch {
    return null;
  }
  return ctx;
}

interface BeepOpts {
  freq: number;
  duration?: number;
  type?: OscillatorType;
  volume?: number;
  attack?: number;
  decay?: number;
  /** Linearly slide frequency from `freq` to `freqEnd` over the duration. */
  freqEnd?: number;
  /** Optional start delay (seconds) so a chord can spread its voices. */
  delay?: number;
}

function beep(opts: BeepOpts) {
  const c = ensureCtx();
  if (!c || !masterSfxGain) return;
  const now = c.currentTime + (opts.delay ?? 0);
  const duration = opts.duration ?? 0.12;
  const volume = opts.volume ?? 0.15;
  const attack = opts.attack ?? 0.005;
  const decay = opts.decay ?? Math.max(0.04, duration - attack);

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? 'square';
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.freqEnd !== undefined) {
    osc.frequency.linearRampToValueAtTime(opts.freqEnd, now + duration);
  }

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(volume, now + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);

  osc.connect(gain).connect(masterSfxGain);
  osc.start(now);
  osc.stop(now + attack + decay + 0.05);
}

// ============================================================================
// Ambient drone — a slow detuned pad that loops while the player is in the
// dungeon or in combat. Built from three sine oscillators forming a minor
// triad, fed through a slow LFO-modulated low-pass for that dungeon-y wobble.
// ============================================================================

interface DroneVoices {
  oscs: OscillatorNode[];
  lfo: OscillatorNode;
  lfoGain: GainNode;
  filter: BiquadFilterNode;
  envelope: GainNode;
}

let drone: DroneVoices | null = null;
let droneMood: 'dungeon' | 'combat' | null = null;

const DRONE_MOODS: Record<'dungeon' | 'combat', { freqs: [number, number, number]; cutoff: number; lfoRate: number }> = {
  // Dungeon: low minor-2 cluster, slow filter wobble — mysterious, sparse.
  dungeon: { freqs: [55, 65.4, 82.4], cutoff: 360, lfoRate: 0.08 },
  // Combat: harder root with a 5th + minor-7, brighter, faster wobble.
  combat: { freqs: [73.4, 110, 146.8], cutoff: 520, lfoRate: 0.18 },
};

function startDrone(mood: 'dungeon' | 'combat') {
  const c = ensureCtx();
  if (!c || !masterMusicGain) return;
  stopDrone(); // ensure single instance
  const cfg = DRONE_MOODS[mood];
  const now = c.currentTime;

  const envelope = c.createGain();
  envelope.gain.setValueAtTime(0, now);
  envelope.gain.linearRampToValueAtTime(0.6, now + 2.5);
  envelope.connect(masterMusicGain);

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cfg.cutoff, now);
  filter.Q.value = 1.5;
  filter.connect(envelope);

  const oscs = cfg.freqs.map((f, i) => {
    const osc = c.createOscillator();
    osc.type = i === 0 ? 'triangle' : 'sine';
    // Slight detune for each voice so they beat against each other.
    osc.frequency.setValueAtTime(f, now);
    osc.detune.setValueAtTime((i - 1) * 6, now);
    const voiceGain = c.createGain();
    voiceGain.gain.value = i === 0 ? 0.55 : 0.32;
    osc.connect(voiceGain).connect(filter);
    osc.start(now);
    return osc;
  });

  // LFO modulates the filter cutoff for slow movement.
  const lfo = c.createOscillator();
  lfo.frequency.setValueAtTime(cfg.lfoRate, now);
  const lfoGain = c.createGain();
  lfoGain.gain.value = cfg.cutoff * 0.45;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start(now);

  drone = { oscs, lfo, lfoGain, filter, envelope };
  droneMood = mood;
}

function stopDrone() {
  if (!drone || !ctx) return;
  const now = ctx.currentTime;
  drone.envelope.gain.cancelScheduledValues(now);
  drone.envelope.gain.setValueAtTime(drone.envelope.gain.value, now);
  drone.envelope.gain.linearRampToValueAtTime(0.0001, now + 0.6);
  const finalDrone = drone;
  setTimeout(() => {
    finalDrone.oscs.forEach((o) => {
      try { o.stop(); } catch { /* already stopped */ }
    });
    try { finalDrone.lfo.stop(); } catch { /* already stopped */ }
  }, 650);
  drone = null;
  droneMood = null;
}

// ============================================================================
// Public API
// ============================================================================

export const sfx = {
  resume() {
    const c = ensureCtx();
    if (c && c.state === 'suspended') void c.resume();
  },
  /** Updates live mixer levels. Called by metaStore whenever a slider moves. */
  setVolumes(master: number, sfxV: number, music: number) {
    MASTER = clamp01(master);
    SFX = clamp01(sfxV);
    MUSIC = clamp01(music);
    const c = ensureCtx();
    if (!c || !masterSfxGain || !masterMusicGain) return;
    const now = c.currentTime;
    masterSfxGain.gain.setTargetAtTime(MASTER * SFX, now, 0.05);
    masterMusicGain.gain.setTargetAtTime(MASTER * MUSIC, now, 0.05);
  },
  // -------------------- Card actions --------------------
  cardPick() {
    beep({ freq: 660, duration: 0.08, type: 'triangle', volume: 0.12 });
  },
  cardReturn() {
    beep({ freq: 360, duration: 0.08, type: 'triangle', volume: 0.1 });
  },
  cardDraw() {
    beep({ freq: 740, freqEnd: 540, duration: 0.09, type: 'triangle', volume: 0.07 });
  },
  // -------------------- Combat impacts --------------------
  hit() {
    beep({ freq: 280, freqEnd: 90, duration: 0.18, type: 'square', volume: 0.18 });
  },
  /** Player-being-hit feels distinct: low bass thump + a higher snap. */
  playerHit() {
    beep({ freq: 80, freqEnd: 40, duration: 0.22, type: 'sawtooth', volume: 0.22 });
    beep({ freq: 220, freqEnd: 110, duration: 0.10, type: 'square', volume: 0.10, delay: 0.02 });
  },
  block() {
    beep({ freq: 520, duration: 0.1, type: 'sine', volume: 0.16 });
  },
  heal() {
    // Two-note rise — warm, restorative.
    beep({ freq: 660, duration: 0.18, type: 'sine', volume: 0.14 });
    beep({ freq: 988, duration: 0.22, type: 'sine', volume: 0.16, delay: 0.08 });
  },
  // -------------------- World events --------------------
  step() {
    beep({ freq: 90, duration: 0.05, type: 'sine', volume: 0.06 });
  },
  chest() {
    [523, 784].forEach((f, i) =>
      setTimeout(() => beep({ freq: f, duration: 0.12, type: 'triangle', volume: 0.16 }), i * 80),
    );
  },
  shrine() {
    // Pure bright chime — major triad bell.
    [659, 988, 1318].forEach((f, i) =>
      setTimeout(() => beep({ freq: f, duration: 0.32, type: 'sine', volume: 0.16 }), i * 90),
    );
  },
  altar() {
    // Dark sacrifice — minor down-glide with a sharp bite.
    beep({ freq: 220, freqEnd: 110, duration: 0.45, type: 'sawtooth', volume: 0.18 });
    beep({ freq: 660, freqEnd: 330, duration: 0.18, type: 'square', volume: 0.10, delay: 0.05 });
  },
  portalOpens() {
    // Cascading shimmer — five quick triangle pings ascending through a pentatonic.
    [392, 523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(
        () => beep({ freq: f, duration: 0.18, type: 'triangle', volume: 0.14 }),
        i * 60,
      ),
    );
  },
  bossEntry() {
    // Low growling intro: detuned saw with a slow fall.
    beep({ freq: 73, freqEnd: 36, duration: 0.9, type: 'sawtooth', volume: 0.24 });
    beep({ freq: 110, freqEnd: 55, duration: 0.7, type: 'sawtooth', volume: 0.14, delay: 0.04 });
  },
  // -------------------- Run state --------------------
  combatStart() {
    beep({ freq: 110, freqEnd: 440, duration: 0.3, type: 'sawtooth', volume: 0.18 });
  },
  victory() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => beep({ freq: f, duration: 0.18, type: 'triangle', volume: 0.15 }), i * 100),
    );
  },
  defeat() {
    beep({ freq: 200, freqEnd: 60, duration: 0.6, type: 'sawtooth', volume: 0.2 });
  },
  // -------------------- Ambient music --------------------
  /** Start (or switch to) the ambient drone for the given mood. */
  ambient(mood: 'dungeon' | 'combat' | 'off') {
    if (mood === 'off') {
      stopDrone();
      return;
    }
    if (droneMood === mood) return; // already playing
    startDrone(mood);
  },
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
