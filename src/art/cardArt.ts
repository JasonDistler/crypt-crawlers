// =============================================================================
// Procedural Magic-the-Gathering–style card art
// =============================================================================
//
// Each painter draws a small "spell illustration" for the card's art box. The
// resulting data URL is cached so it's cheap to use the same card definition
// across deck builders, draft screens, the hand, etc.
//
// Style: moody background gradient tinted to the card's color, a focal
// illustration (weapon, shield, flame, eye, etc.), and a vignette to suggest
// candlelight.

import type { CardDef } from '@/types';

const CACHE = new Map<string, string>();

export function cardArtDataUrl(def: CardDef, w = 220, h = 160): string {
  const key = `${def.id}:${w}x${h}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  paintArt(ctx, def, w, h);
  const url = canvas.toDataURL();
  CACHE.set(key, url);
  return url;
}

function paintArt(ctx: CanvasRenderingContext2D, def: CardDef, w: number, h: number) {
  paintBackground(ctx, def, w, h);
  const painter = ART_BY_ID[def.id] ?? defaultArt(def);
  painter(ctx, w, h);
  paintVignette(ctx, w, h);
}

// =============================================================================
// Backgrounds + helpers
// =============================================================================

const COLOR_BG: Record<string, [string, string]> = {
  red: ['#7a1a1a', '#220606'],
  white: ['#e8d6a0', '#7a5a28'],
  green: ['#264a2a', '#0a1808'],
  blue: ['#1a3a6a', '#080a1a'],
  black: ['#3a1a3a', '#0a0410'],
  artifact: ['#5a5a64', '#1a1a20'],
};

function bgForCard(def: CardDef): [string, string] {
  if (def.isWild) return COLOR_BG.artifact;
  switch (def.type) {
    case 'attack':
      return COLOR_BG.red;
    case 'defend':
      return COLOR_BG.white;
    case 'heal':
      return COLOR_BG.green;
    case 'draw':
      return COLOR_BG.blue;
    case 'buff':
      return COLOR_BG.black;
    case 'item':
      return COLOR_BG.artifact;
    default:
      return COLOR_BG.artifact;
  }
}

function paintBackground(ctx: CanvasRenderingContext2D, def: CardDef, w: number, h: number) {
  const [top, bot] = bgForCard(def);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, top);
  sky.addColorStop(1, bot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Distant landscape silhouettes
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.78);
  ctx.lineTo(w * 0.18, h * 0.6);
  ctx.lineTo(w * 0.34, h * 0.7);
  ctx.lineTo(w * 0.5, h * 0.55);
  ctx.lineTo(w * 0.66, h * 0.68);
  ctx.lineTo(w * 0.82, h * 0.58);
  ctx.lineTo(w, h * 0.72);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  // Floor / ground line
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.86);
  ctx.lineTo(w, h * 0.86);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();
}

function paintVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const v = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

type ArtFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function defaultArt(def: CardDef): ArtFn {
  if (def.isWild) return artWildSigil;
  switch (def.type) {
    case 'attack':
      return artGenericSword;
    case 'defend':
      return artGenericShield;
    case 'heal':
      return artGenericPotion;
    case 'draw':
      return artGenericEye;
    case 'buff':
      return artGenericFlame;
    case 'item':
      return artGenericChest;
    default:
      return artGenericSword;
  }
}

// =============================================================================
// Generic (fallback) art
// =============================================================================

function artGenericSword(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.5);
  // Blade
  ctx.fillStyle = '#dcdee4';
  ctx.beginPath();
  ctx.moveTo(0, -60);
  ctx.lineTo(6, -56);
  ctx.lineTo(8, 30);
  ctx.lineTo(0, 38);
  ctx.lineTo(-8, 30);
  ctx.lineTo(-6, -56);
  ctx.closePath();
  ctx.fill();
  // Blade highlight
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-1, -56, 2, 90);
  // Crossguard
  ctx.fillStyle = '#7a5a18';
  ctx.fillRect(-22, 30, 44, 6);
  // Grip
  ctx.fillStyle = '#3a1a14';
  ctx.fillRect(-4, 36, 8, 18);
  // Pommel
  ctx.fillStyle = '#c4922b';
  ctx.beginPath();
  ctx.arc(0, 58, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function artGenericShield(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  // Body
  ctx.fillStyle = '#3a4a72';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 40);
  ctx.lineTo(cx + 40, cy - 26);
  ctx.lineTo(cx + 36, cy + 18);
  ctx.lineTo(cx, cy + 48);
  ctx.lineTo(cx - 36, cy + 18);
  ctx.lineTo(cx - 40, cy - 26);
  ctx.closePath();
  ctx.fill();
  // Inner panel
  ctx.fillStyle = '#5e72a8';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 30);
  ctx.lineTo(cx + 30, cy - 18);
  ctx.lineTo(cx + 28, cy + 12);
  ctx.lineTo(cx, cy + 38);
  ctx.lineTo(cx - 28, cy + 12);
  ctx.lineTo(cx - 30, cy - 18);
  ctx.closePath();
  ctx.fill();
  // Boss
  ctx.fillStyle = '#c4922b';
  ctx.beginPath();
  ctx.arc(cx, cy + 2, 8, 0, Math.PI * 2);
  ctx.fill();
  // Cross
  ctx.strokeStyle = '#1a1820';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 24);
  ctx.lineTo(cx, cy + 32);
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.stroke();
}

function artGenericPotion(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 6;
  // Cork
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(cx - 8, cy - 50, 16, 8);
  // Neck
  ctx.fillStyle = '#a8d0a0';
  ctx.fillRect(cx - 6, cy - 42, 12, 14);
  // Bottle bulb
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 28);
  ctx.lineTo(cx - 26, cy - 12);
  ctx.lineTo(cx - 26, cy + 28);
  ctx.lineTo(cx + 26, cy + 28);
  ctx.lineTo(cx + 26, cy - 12);
  ctx.lineTo(cx + 6, cy - 28);
  ctx.closePath();
  ctx.fill();
  // Liquid
  ctx.fillStyle = '#e64a4a';
  ctx.beginPath();
  ctx.moveTo(cx - 24, cy);
  ctx.lineTo(cx - 24, cy + 26);
  ctx.lineTo(cx + 24, cy + 26);
  ctx.lineTo(cx + 24, cy);
  ctx.bezierCurveTo(cx + 12, cy + 4, cx - 12, cy - 4, cx - 24, cy);
  ctx.closePath();
  ctx.fill();
  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - 14, cy - 4, 5, 10, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Glow
  glow(ctx, cx, cy + 10, 50, 'rgba(255, 100, 100, 0.5)');
}

function artGenericEye(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  // Outer eye
  ctx.fillStyle = '#0a1428';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 48, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  // White
  ctx.fillStyle = '#e8e0c8';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 42, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Iris
  glow(ctx, cx, cy, 30, 'rgba(80, 180, 255, 0.7)');
  ctx.fillStyle = '#1a5a9a';
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fill();
  // Pupil
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  // Highlight
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - 3, cy - 3, 2, 0, Math.PI * 2);
  ctx.fill();
}

function artGenericFlame(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 14;
  // Outer flame
  glow(ctx, cx, cy, 70, 'rgba(255, 140, 60, 0.55)');
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 56);
  ctx.bezierCurveTo(cx + 30, cy - 36, cx + 22, cy - 10, cx + 24, cy + 16);
  ctx.bezierCurveTo(cx + 22, cy + 36, cx - 22, cy + 36, cx - 24, cy + 16);
  ctx.bezierCurveTo(cx - 22, cy - 10, cx - 30, cy - 36, cx, cy - 56);
  ctx.closePath();
  ctx.fill();
  // Inner flame
  ctx.fillStyle = '#ffce4a';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 36);
  ctx.bezierCurveTo(cx + 16, cy - 22, cx + 12, cy - 4, cx + 14, cy + 14);
  ctx.bezierCurveTo(cx + 12, cy + 26, cx - 12, cy + 26, cx - 14, cy + 14);
  ctx.bezierCurveTo(cx - 12, cy - 4, cx - 16, cy - 22, cx, cy - 36);
  ctx.closePath();
  ctx.fill();
  // Core
  ctx.fillStyle = '#fff4c8';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 6, 14, 0, 0, Math.PI * 2);
  ctx.fill();
}

function artGenericChest(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2 + 8;
  // Chest body
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(cx - 44, cy - 16, 88, 38);
  // Lid (arched)
  ctx.beginPath();
  ctx.moveTo(cx - 44, cy - 16);
  ctx.quadraticCurveTo(cx, cy - 50, cx + 44, cy - 16);
  ctx.closePath();
  ctx.fill();
  // Gold bands
  ctx.fillStyle = '#c4922b';
  ctx.fillRect(cx - 46, cy - 4, 92, 4);
  ctx.fillRect(cx - 46, cy + 10, 92, 4);
  // Lock
  ctx.fillStyle = '#7a5a18';
  ctx.fillRect(cx - 6, cy - 6, 12, 14);
  // Keyhole
  ctx.fillStyle = '#1a0a06';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - 1, cy, 2, 5);
}

function artWildSigil(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  // Diamond rune
  glow(ctx, cx, cy, 60, 'rgba(200, 180, 255, 0.5)');
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = '#ecd8ff';
  ctx.lineWidth = 4;
  ctx.strokeRect(-30, -30, 60, 60);
  ctx.fillStyle = '#9a7adf';
  ctx.fillRect(-2, -28, 4, 56);
  ctx.fillRect(-28, -2, 56, 4);
  ctx.restore();
}

// =============================================================================
// Card-specific art (by id)
// =============================================================================

const ART_BY_ID: Record<string, ArtFn> = {
  // Basic attacks — escalating weapon imagery
  pebble: (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2 + 16;
    ctx.fillStyle = '#5a504a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 18, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a807a';
    ctx.beginPath();
    ctx.ellipse(cx - 6, cy - 4, 6, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Speed lines (thrown)
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(cx - 30 - i * 6, cy - 8 + i * 3);
      ctx.lineTo(cx - 10 - i * 4, cy - 4 + i * 2);
      ctx.stroke();
    }
  },
  jab: artGenericSword,
  slash: (ctx, w, h) => {
    // Curved sword arc
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = '#ffd870';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + 10, 50, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy + 10, 50, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
    artGenericSword(ctx, w, h);
  },
  cleave: (ctx, w, h) => {
    // Two crossing arcs
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = '#ff4a3a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx - 8, cy + 10, 50, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 8, cy + 10, 50, -Math.PI * 0.85, -Math.PI * 0.15);
    ctx.stroke();
    artGenericSword(ctx, w, h);
  },
  smite: (ctx, w, h) => {
    // Lightning + sword
    const cx = w / 2;
    glow(ctx, cx, h * 0.3, 60, 'rgba(255, 220, 100, 0.55)');
    ctx.strokeStyle = '#fff8a8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, 10);
    ctx.lineTo(cx - 6, 28);
    ctx.lineTo(cx + 6, 36);
    ctx.lineTo(cx - 4, 56);
    ctx.lineTo(cx + 4, 68);
    ctx.stroke();
    artGenericSword(ctx, w, h);
  },

  // Defenses
  guard: artGenericShield,
  bulwark: (ctx, w, h) => {
    artGenericShield(ctx, w, h);
    // Add stone wall behind
    const cy = h * 0.7;
    ctx.fillStyle = '#3a3a44';
    ctx.fillRect(0, cy, w, h - cy);
    ctx.strokeStyle = '#1a1a20';
    ctx.lineWidth = 1;
    for (let y = cy; y < h; y += 10) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  },

  // Magic / draws
  focus: artGenericEye,
  insight: (ctx, w, h) => {
    artGenericEye(ctx, w, h);
    // Floating runes
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = 'rgba(120, 220, 255, 0.8)';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = cx + Math.cos(a) * 60;
      const y = cy + Math.sin(a) * 30;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillRect(-1, -5, 2, 10);
      ctx.fillRect(-5, -1, 10, 2);
      ctx.restore();
    }
  },

  // Burns
  ignite: artGenericFlame,
  inferno: (ctx, w, h) => {
    artGenericFlame(ctx, w, h);
    // Smaller side flames
    const cy = h / 2 + 22;
    for (const off of [-44, 44]) {
      glow(ctx, w / 2 + off, cy, 30, 'rgba(255, 140, 60, 0.4)');
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.moveTo(w / 2 + off, cy - 22);
      ctx.bezierCurveTo(w / 2 + off + 14, cy - 12, w / 2 + off + 10, cy, w / 2 + off + 12, cy + 14);
      ctx.bezierCurveTo(w / 2 + off + 10, cy + 22, w / 2 + off - 10, cy + 22, w / 2 + off - 12, cy + 14);
      ctx.bezierCurveTo(w / 2 + off - 10, cy, w / 2 + off - 14, cy - 12, w / 2 + off, cy - 22);
      ctx.closePath();
      ctx.fill();
    }
  },

  // Heals
  heal: artGenericPotion,
  prayer: (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    glow(ctx, cx, cy - 10, 70, 'rgba(255, 240, 180, 0.7)');
    // Cross
    ctx.fillStyle = '#fff4c8';
    ctx.fillRect(cx - 4, cy - 40, 8, 70);
    ctx.fillRect(cx - 22, cy - 20, 44, 8);
    // Sparkles
    ctx.fillStyle = '#ffd870';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = 50;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // Items
  garlic: (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2 + 10;
    // Bulb
    ctx.fillStyle = '#f3e2c4';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 32, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    // Segment lines
    ctx.strokeStyle = '#c4a878';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 8, cy - 30);
      ctx.bezierCurveTo(cx + i * 14, cy - 20, cx + i * 14, cy + 20, cx + i * 8, cy + 30);
      ctx.stroke();
    }
    // Stem
    ctx.fillStyle = '#4a6a2a';
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 34);
    ctx.lineTo(cx, cy - 56);
    ctx.lineTo(cx + 4, cy - 34);
    ctx.closePath();
    ctx.fill();
  },

  // Whip / bleed
  whip: (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    // Whip lash
    ctx.strokeStyle = '#5a2a14';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 70, cy + 30);
    ctx.bezierCurveTo(cx - 40, cy - 30, cx + 30, cy - 20, cx + 70, cy + 30);
    ctx.stroke();
    // Spikes along whip
    ctx.fillStyle = '#dcdee4';
    for (let t = 0.2; t < 0.95; t += 0.15) {
      const x = cx - 70 + t * 140;
      const y = cy + 30 - Math.sin(t * Math.PI) * 56;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4, y + 8);
      ctx.lineTo(x - 4, y + 8);
      ctx.closePath();
      ctx.fill();
    }
    // Blood drops
    ctx.fillStyle = '#aa0414';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(cx + 60 + i * 8, cy + 40 + i * 4, 2 + Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  thornedBrand: (ctx, w, h) => {
    artGenericSword(ctx, w, h);
    // Thorny vines wrapped around
    const cx = w / 2;
    const cy = h / 2;
    ctx.strokeStyle = '#3a5a1a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - 40);
    ctx.bezierCurveTo(cx + 14, cy - 30, cx - 14, cy, cx + 12, cy + 30);
    ctx.stroke();
    // Thorns
    ctx.fillStyle = '#1a0608';
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const x = cx + (i % 2 === 0 ? -1 : 1) * 14;
      const y = cy - 40 + t * 70;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x + 3, y - 8);
      ctx.closePath();
      ctx.fill();
    }
  },

  // Inspire / buff
  inspire: (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    // Banner pole
    ctx.fillStyle = '#5a3a14';
    ctx.fillRect(cx - 2, cy - 50, 4, 90);
    // Banner
    ctx.fillStyle = '#aa1818';
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 48);
    ctx.lineTo(cx + 48, cy - 48);
    ctx.lineTo(cx + 40, cy - 24);
    ctx.lineTo(cx + 48, cy);
    ctx.lineTo(cx + 2, cy);
    ctx.closePath();
    ctx.fill();
    // Emblem
    ctx.fillStyle = '#c4922b';
    ctx.beginPath();
    ctx.arc(cx + 25, cy - 24, 8, 0, Math.PI * 2);
    ctx.fill();
    // Banner pole top
    ctx.fillStyle = '#c4922b';
    ctx.beginPath();
    ctx.arc(cx, cy - 50, 5, 0, Math.PI * 2);
    ctx.fill();
  },
};
