/**
 * Tiny procedural sound effects via Web Audio. No assets, no licensing.
 * Each effect is a short oscillator + envelope. Calls are no-ops if the
 * browser doesn't support AudioContext (e.g. SSR/tests).
 */

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctx) return ctx;
  try {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as
      | typeof AudioContext
      | undefined;
    if (!Ctor) return null;
    ctx = new Ctor();
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
}

function beep(opts: BeepOpts) {
  const c = ensureCtx();
  if (!c) return;
  const now = c.currentTime;
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

  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + attack + decay + 0.05);
}

export const sfx = {
  resume() {
    const c = ensureCtx();
    if (c && c.state === 'suspended') void c.resume();
  },
  cardPick() {
    beep({ freq: 660, duration: 0.08, type: 'triangle', volume: 0.12 });
  },
  cardReturn() {
    beep({ freq: 360, duration: 0.08, type: 'triangle', volume: 0.1 });
  },
  hit() {
    beep({ freq: 280, freqEnd: 90, duration: 0.18, type: 'square', volume: 0.18 });
  },
  block() {
    beep({ freq: 520, duration: 0.1, type: 'sine', volume: 0.16 });
  },
  heal() {
    beep({ freq: 880, freqEnd: 1320, duration: 0.2, type: 'sine', volume: 0.16 });
  },
  victory() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => beep({ freq: f, duration: 0.18, type: 'triangle', volume: 0.15 }), i * 100),
    );
  },
  defeat() {
    beep({ freq: 200, freqEnd: 60, duration: 0.6, type: 'sawtooth', volume: 0.2 });
  },
  step() {
    beep({ freq: 90, duration: 0.05, type: 'sine', volume: 0.06 });
  },
  chest() {
    [523, 784].forEach((f, i) =>
      setTimeout(() => beep({ freq: f, duration: 0.12, type: 'triangle', volume: 0.16 }), i * 80),
    );
  },
  combatStart() {
    beep({ freq: 110, freqEnd: 440, duration: 0.3, type: 'sawtooth', volume: 0.18 });
  },
};
