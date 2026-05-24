// =============================================================================
// D&D-style portraits for enemies and crawlers
// =============================================================================
//
// Enemies that have a real artwork registered in `enemyImages.ts` use that
// image directly. Everything else (bosses, crawlers, generic) falls back to
// the procedural `paint___(ctx, w, h)` painters defined below, which draw
// stylized silhouettes against a moody vignetted background.
//
// Cache: procedural results are memoized as data URLs keyed by `id|w|h` so
// the same portrait can be reused across the combat panel, crawler-select
// grid, and the 3D enemy preview card without repainting.

import { ENEMY_IMAGE_URLS, getEnemyImage } from '@/art/enemyImages';

const CACHE = new Map<string, string>();

export function enemyPortraitDataUrl(id: string, w = 256, h = 256): string {
  // Real artwork wins: just hand back the asset URL so <img> can render it
  // natively (with proper sizing/scaling via CSS).
  const real = ENEMY_IMAGE_URLS[id];
  if (real) return real;

  const key = `enemy:${id}:${w}x${h}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  paintEnemy(ctx, id, w, h);
  const url = canvas.toDataURL();
  CACHE.set(key, url);
  return url;
}

export function crawlerPortraitDataUrl(id: string, w = 256, h = 256): string {
  const key = `crawler:${id}:${w}x${h}`;
  const hit = CACHE.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  paintCrawler(ctx, id, w, h);
  const url = canvas.toDataURL();
  CACHE.set(key, url);
  return url;
}

/**
 * Paint an enemy onto an existing canvas context (used by canvas textures).
 * If a real artwork is registered and already loaded, it's drawn in with a
 * "cover" fit (centered, biased toward the upper portion where the face is).
 * Otherwise we fall back to the procedural painter and return false so the
 * caller knows to schedule a repaint when the image finishes loading.
 *
 * Returns true if the final pixels are the real artwork, false otherwise.
 */
export function paintEnemy(
  ctx: CanvasRenderingContext2D,
  id: string,
  w: number,
  h: number,
): boolean {
  const img = getEnemyImage(id);
  if (img && img.complete && img.naturalWidth > 0) {
    drawImageCover(ctx, img, w, h);
    return true;
  }
  const painter = ENEMY_PAINTERS[id] ?? paintGenericEnemy;
  painter(ctx, w, h);
  return false;
}

/**
 * Draws a portrait-oriented image into a 0..w / 0..h box using "cover" fit:
 * the image fills the entire box without distortion, cropping whichever
 * dimension overflows. The vertical anchor is biased upward (0.25) so the
 * creature's face is favored over its feet/legs.
 */
function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (w - dw) / 2;
  const dy = (h - dh) * 0.25; // bias upward toward the face
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

export function paintCrawler(ctx: CanvasRenderingContext2D, id: string, w: number, h: number) {
  const painter = CRAWLER_PAINTERS[id] ?? paintGenericCrawler;
  painter(ctx, w, h);
}

// =============================================================================
// Shared painting primitives
// =============================================================================

interface BgOpts {
  tint: string;
  glow?: string; // accent glow color
  pattern?: 'cave' | 'stone' | 'arcane' | 'crypt' | 'fire';
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, opts: BgOpts) {
  // Radial gradient — light vignette in upper-middle, dark edges
  const grad = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.5, w * 0.75);
  grad.addColorStop(0, blend(opts.tint, '#ffffff', 0.18));
  grad.addColorStop(0.55, opts.tint);
  grad.addColorStop(1, blend(opts.tint, '#000000', 0.75));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Pattern overlay
  if (opts.pattern === 'cave') {
    // Slow gradient streaks
    ctx.globalAlpha = 0.18;
    for (let i = 0; i < 18; i++) {
      const y = Math.random() * h;
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.5})`;
      ctx.fillRect(0, y, w, 1 + Math.random() * 2);
    }
    ctx.globalAlpha = 1;
  } else if (opts.pattern === 'arcane') {
    // Magic dust specks
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 36; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = Math.random() * 1.5 + 0.4;
      ctx.fillStyle = `rgba(${randInt(180, 255)}, ${randInt(160, 255)}, ${randInt(220, 255)}, ${Math.random() * 0.7 + 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (opts.pattern === 'crypt') {
    // Subtle cracks
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      const x0 = Math.random() * w;
      const y0 = Math.random() * h;
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + (Math.random() - 0.5) * w * 0.3, y0 + (Math.random() - 0.5) * h * 0.3);
      ctx.stroke();
    }
  } else if (opts.pattern === 'fire') {
    // Warm flicker spots
    ctx.globalAlpha = 0.45;
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * w;
      const y = h * 0.5 + Math.random() * h * 0.5;
      const r = Math.random() * 6 + 1;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255, 160, 60, 0.9)');
      g.addColorStop(1, 'rgba(255, 80, 30, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
  } else if (opts.pattern === 'stone') {
    // Stone speckle
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 80; i++) {
      ctx.fillStyle = `rgba(${randInt(60, 120)}, ${randInt(60, 120)}, ${randInt(60, 120)}, ${Math.random() * 0.4})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Top glow
  if (opts.glow) {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.55);
    g.addColorStop(0, opts.glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  // Bottom shadow
  const shadow = ctx.createLinearGradient(0, h * 0.6, 0, h);
  shadow.addColorStop(0, 'rgba(0,0,0,0)');
  shadow.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = shadow;
  ctx.fillRect(0, 0, w, h);
}

/** Soft radial glow without a bright core — handy for embers, runes, sceptres. */
function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, fadeColor(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

function glowingEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
) {
  // Outer glow
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, color);
  g.addColorStop(0.4, fadeColor(color, 0.55));
  g.addColorStop(1, fadeColor(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
  // Inner core
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function blend(a: string, b: string, t: number): string {
  const ar = hexRgb(a);
  const br = hexRgb(b);
  const r = Math.round(ar.r + (br.r - ar.r) * t);
  const g = Math.round(ar.g + (br.g - ar.g) * t);
  const bb = Math.round(ar.b + (br.b - ar.b) * t);
  return `rgb(${r}, ${g}, ${bb})`;
}

function fadeColor(color: string, alpha: number): string {
  if (color.startsWith('rgba')) return color;
  if (color.startsWith('rgb')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }
  const { r, g, b } = hexRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexRgb(hex: string): { r: number; g: number; b: number } {
  if (hex.startsWith('rgb')) {
    const m = hex.match(/\d+/g)!;
    return { r: +m[0], g: +m[1], b: +m[2] };
  }
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function randInt(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

// =============================================================================
// Enemy painters
// =============================================================================

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

const ENEMY_PAINTERS: Record<string, Painter> = {
  bat: paintBat,
  giantRat: paintGiantRat,
  skeleton: paintSkeleton,
  ghoul: paintGhoul,
  zombie: paintZombie,
  cultist: paintCultist,
  vampireLord: paintVampireLord,
  necromancer: paintNecromancer,
  ancientLich: paintAncientLich,
  // Mid-tier (floors 4+)
  wraith: paintWraith,
  gargoyle: paintGargoyle,
  direWolf: paintDireWolf,
  revenant: paintRevenant,
  // Bosses (floors 4-10)
  boundTome: paintBoundTome,
  sporeMother: paintSporeMother,
  ironTyrant: paintIronTyrant,
  frostWyrm: paintFrostWyrm,
  obsidianMaw: paintObsidianMaw,
  astralWarden: paintAstralWarden,
  eternityKing: paintEternityKing,
};

const CRAWLER_PAINTERS: Record<string, Painter> = {
  antonio: paintAntonio,
  imelda: paintImelda,
  pasqualina: paintPasqualina,
  gennaro: paintGennaro,
};

function paintGenericEnemy(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#3a2840', pattern: 'cave' });
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.55, w * 0.22, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  glowingEye(ctx, w * 0.45, h * 0.5, 4, '#ff3322');
  glowingEye(ctx, w * 0.55, h * 0.5, 4, '#ff3322');
}

function paintGenericCrawler(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#4a3a52', pattern: 'stone' });
  ctx.fillStyle = '#1a1418';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.6, w * 0.22, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- Bat ----------
function paintBat(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#3a1a4a', glow: '#5a2a6a', pattern: 'cave' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Body
  ctx.fillStyle = '#0c0610';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 20 * s, 30 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.ellipse(cx, cy - 28 * s, 16 * s, 14 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ears
  ctx.beginPath();
  ctx.moveTo(cx - 12 * s, cy - 36 * s);
  ctx.lineTo(cx - 6 * s, cy - 52 * s);
  ctx.lineTo(cx - 4 * s, cy - 36 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 12 * s, cy - 36 * s);
  ctx.lineTo(cx + 6 * s, cy - 52 * s);
  ctx.lineTo(cx + 4 * s, cy - 36 * s);
  ctx.closePath();
  ctx.fill();
  // Wings — large outstretched membranes
  const drawWing = (sign: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 20 * s);
    ctx.bezierCurveTo(
      cx + sign * 50 * s, cy - 60 * s,
      cx + sign * 110 * s, cy - 30 * s,
      cx + sign * 118 * s, cy + 6 * s,
    );
    // Scalloped trailing edge
    ctx.lineTo(cx + sign * 100 * s, cy + 4 * s);
    ctx.lineTo(cx + sign * 92 * s, cy + 20 * s);
    ctx.lineTo(cx + sign * 75 * s, cy + 6 * s);
    ctx.lineTo(cx + sign * 65 * s, cy + 22 * s);
    ctx.lineTo(cx + sign * 48 * s, cy + 4 * s);
    ctx.lineTo(cx + sign * 36 * s, cy + 18 * s);
    ctx.lineTo(cx + sign * 20 * s, cy + 4 * s);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.fill();
  };
  drawWing(-1);
  drawWing(1);
  // Glowing red eyes
  glowingEye(ctx, cx - 7 * s, cy - 30 * s, 3 * s, '#ff3a2a');
  glowingEye(ctx, cx + 7 * s, cy - 30 * s, 3 * s, '#ff3a2a');
  // Tiny fangs
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 4 * s, cy - 20 * s);
  ctx.lineTo(cx - 2 * s, cy - 14 * s);
  ctx.lineTo(cx, cy - 20 * s);
  ctx.moveTo(cx + 4 * s, cy - 20 * s);
  ctx.lineTo(cx + 2 * s, cy - 14 * s);
  ctx.lineTo(cx, cy - 20 * s);
  ctx.fill();
}

// ---------- Giant Rat ----------
function paintGiantRat(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#2a2018', glow: '#4a3a28', pattern: 'cave' });
  const cx = w * 0.5;
  const cy = h * 0.62;
  const s = w / 256;
  // Body (hunched)
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.ellipse(cx - 4 * s, cy, 50 * s, 28 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Head (snout)
  ctx.beginPath();
  ctx.ellipse(cx + 38 * s, cy - 10 * s, 26 * s, 18 * s, -0.15, 0, Math.PI * 2);
  ctx.fill();
  // Snout point
  ctx.beginPath();
  ctx.moveTo(cx + 56 * s, cy - 18 * s);
  ctx.lineTo(cx + 78 * s, cy - 6 * s);
  ctx.lineTo(cx + 56 * s, cy);
  ctx.closePath();
  ctx.fill();
  // Ears
  ctx.beginPath();
  ctx.ellipse(cx + 26 * s, cy - 28 * s, 8 * s, 10 * s, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 38 * s, cy - 30 * s, 8 * s, 10 * s, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Legs (just suggestions)
  ctx.fillRect(cx - 30 * s, cy + 20 * s, 8 * s, 16 * s);
  ctx.fillRect(cx + 0 * s, cy + 22 * s, 8 * s, 16 * s);
  ctx.fillRect(cx + 30 * s, cy + 14 * s, 8 * s, 18 * s);
  // Tail
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 48 * s, cy + 6 * s);
  ctx.bezierCurveTo(cx - 80 * s, cy + 20 * s, cx - 90 * s, cy - 20 * s, cx - 70 * s, cy - 40 * s);
  ctx.stroke();
  // Yellow gleam in eye
  glowingEye(ctx, cx + 36 * s, cy - 14 * s, 3 * s, '#ffce4a');
  // Sharp incisors
  ctx.fillStyle = '#fff8d8';
  ctx.beginPath();
  ctx.moveTo(cx + 64 * s, cy - 6 * s);
  ctx.lineTo(cx + 70 * s, cy + 4 * s);
  ctx.lineTo(cx + 60 * s, cy + 2 * s);
  ctx.closePath();
  ctx.fill();
}

// ---------- Skeleton ----------
function paintSkeleton(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#28281f', glow: '#48483f', pattern: 'crypt' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Skull
  ctx.fillStyle = '#e8e0c0';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 36 * s, 30 * s, 34 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Jaw
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8 * s, 20 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye sockets
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.ellipse(cx - 10 * s, cy - 40 * s, 8 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 10 * s, cy - 40 * s, 8 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  glowingEye(ctx, cx - 10 * s, cy - 40 * s, 3 * s, '#ff5a2a');
  glowingEye(ctx, cx + 10 * s, cy - 40 * s, 3 * s, '#ff5a2a');
  // Nasal cavity
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.moveTo(cx - 4 * s, cy - 24 * s);
  ctx.lineTo(cx, cy - 14 * s);
  ctx.lineTo(cx + 4 * s, cy - 24 * s);
  ctx.closePath();
  ctx.fill();
  // Teeth
  ctx.fillStyle = '#e8e0c0';
  for (let i = -2; i <= 2; i++) {
    ctx.fillRect(cx + i * 5 * s - 2 * s, cy - 8 * s, 3 * s, 6 * s);
  }
  // Neck vertebrae
  ctx.fillRect(cx - 4 * s, cy + 4 * s, 8 * s, 12 * s);
  // Ribcage
  ctx.fillStyle = '#d8d0b0';
  ctx.fillRect(cx - 32 * s, cy + 16 * s, 64 * s, 6 * s);
  ctx.fillRect(cx - 32 * s, cy + 28 * s, 64 * s, 6 * s);
  ctx.fillRect(cx - 32 * s, cy + 40 * s, 64 * s, 6 * s);
  // Spine
  ctx.fillRect(cx - 3 * s, cy + 16 * s, 6 * s, 36 * s);
  // Shoulder bones
  ctx.beginPath();
  ctx.arc(cx - 32 * s, cy + 16 * s, 8 * s, 0, Math.PI * 2);
  ctx.arc(cx + 32 * s, cy + 16 * s, 8 * s, 0, Math.PI * 2);
  ctx.fill();
  // Sword in right hand
  ctx.fillStyle = '#9aa0a8';
  ctx.fillRect(cx + 50 * s, cy - 20 * s, 6 * s, 70 * s);
  ctx.fillStyle = '#7a5018';
  ctx.fillRect(cx + 46 * s, cy + 48 * s, 14 * s, 6 * s);
  ctx.fillStyle = '#c4922b';
  ctx.fillRect(cx + 50 * s, cy + 50 * s, 6 * s, 14 * s);
  // Pointy sword tip
  ctx.fillStyle = '#9aa0a8';
  ctx.beginPath();
  ctx.moveTo(cx + 50 * s, cy - 24 * s);
  ctx.lineTo(cx + 53 * s, cy - 32 * s);
  ctx.lineTo(cx + 56 * s, cy - 24 * s);
  ctx.closePath();
  ctx.fill();
}

// ---------- Ghoul ----------
function paintGhoul(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#1a2818', glow: '#3a5828', pattern: 'cave' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Hunched body
  ctx.fillStyle = '#3a4a30';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 16 * s, 36 * s, 42 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head — gaunt and elongated
  ctx.fillStyle = '#4a5a3a';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 30 * s, 22 * s, 28 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Receded forehead bulge
  ctx.beginPath();
  ctx.ellipse(cx, cy - 44 * s, 16 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sunken cheekbones (dark hollows)
  ctx.fillStyle = '#1a2818';
  ctx.beginPath();
  ctx.ellipse(cx - 10 * s, cy - 24 * s, 4 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 10 * s, cy - 24 * s, 4 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glowing eyes
  glowingEye(ctx, cx - 8 * s, cy - 36 * s, 3 * s, '#a4f04a');
  glowingEye(ctx, cx + 8 * s, cy - 36 * s, 3 * s, '#a4f04a');
  // Gaping mouth (snarl)
  ctx.fillStyle = '#1a0a0a';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 14 * s, 10 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Jagged teeth
  ctx.fillStyle = '#fff8d8';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 4 * s, cy - 17 * s);
    ctx.lineTo(cx + i * 4 * s + 2 * s, cy - 12 * s);
    ctx.lineTo(cx + i * 4 * s + 4 * s, cy - 17 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Long thin arms reaching down with claws
  ctx.strokeStyle = '#4a5a3a';
  ctx.lineWidth = 10 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 30 * s, cy + 4 * s);
  ctx.lineTo(cx - 58 * s, cy + 50 * s);
  ctx.moveTo(cx + 30 * s, cy + 4 * s);
  ctx.lineTo(cx + 58 * s, cy + 50 * s);
  ctx.stroke();
  // Claws
  ctx.fillStyle = '#d8d8c0';
  for (const cxh of [-58, 58]) {
    ctx.beginPath();
    ctx.moveTo(cx + cxh * s, cy + 50 * s);
    ctx.lineTo(cx + cxh * s - 4 * s, cy + 64 * s);
    ctx.lineTo(cx + cxh * s + 4 * s, cy + 64 * s);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------- Zombie ----------
function paintZombie(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#1a2a1a', glow: '#3a5a3a', pattern: 'cave' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Shambling torso
  ctx.fillStyle = '#5a6a3a';
  ctx.beginPath();
  ctx.ellipse(cx - 6 * s, cy + 14 * s, 32 * s, 38 * s, 0.08, 0, Math.PI * 2);
  ctx.fill();
  // Head — tilted to side
  ctx.beginPath();
  ctx.ellipse(cx - 4 * s, cy - 30 * s, 22 * s, 24 * s, -0.18, 0, Math.PI * 2);
  ctx.fill();
  // Rotting flesh patches
  ctx.fillStyle = '#3a4a2a';
  ctx.beginPath();
  ctx.ellipse(cx + 10 * s, cy + 10 * s, 8 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 14 * s, cy - 30 * s, 6 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Dead eye + glowing eye
  ctx.fillStyle = '#1a0a0a';
  ctx.beginPath();
  ctx.arc(cx - 14 * s, cy - 34 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();
  glowingEye(ctx, cx + 6 * s, cy - 36 * s, 3 * s, '#a4f04a');
  // Slack jaw
  ctx.fillStyle = '#1a0a0a';
  ctx.beginPath();
  ctx.ellipse(cx - 4 * s, cy - 14 * s, 8 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Arm reaching forward
  ctx.strokeStyle = '#5a6a3a';
  ctx.lineWidth = 12 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + 14 * s, cy + 4 * s);
  ctx.lineTo(cx + 56 * s, cy - 20 * s);
  ctx.stroke();
  // Hand (open) at end of arm
  ctx.fillStyle = '#5a6a3a';
  ctx.beginPath();
  ctx.arc(cx + 60 * s, cy - 22 * s, 8 * s, 0, Math.PI * 2);
  ctx.fill();
  // Fingers
  ctx.strokeStyle = '#5a6a3a';
  ctx.lineWidth = 3 * s;
  for (let i = 0; i < 4; i++) {
    const a = -0.5 + i * 0.25;
    ctx.beginPath();
    ctx.moveTo(cx + 60 * s, cy - 22 * s);
    ctx.lineTo(cx + 60 * s + Math.cos(a) * 14 * s, cy - 22 * s + Math.sin(a) * 14 * s);
    ctx.stroke();
  }
}

// ---------- Cultist ----------
function paintCultist(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#220a2a', glow: '#5a1a6a', pattern: 'arcane' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Robe (large triangular silhouette)
  ctx.fillStyle = '#180614';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 60 * s);
  ctx.bezierCurveTo(
    cx - 30 * s, cy - 40 * s,
    cx - 70 * s, cy + 60 * s,
    cx - 60 * s, cy + 76 * s,
  );
  ctx.lineTo(cx + 60 * s, cy + 76 * s);
  ctx.bezierCurveTo(
    cx + 70 * s, cy + 60 * s,
    cx + 30 * s, cy - 40 * s,
    cx, cy - 60 * s,
  );
  ctx.closePath();
  ctx.fill();
  // Hood opening — darker shadow inside
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 30 * s, 18 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Single glowing eye in the void
  glowingEye(ctx, cx, cy - 30 * s, 5 * s, '#d4a8ff');
  // Hands clasping a glowing rune
  ctx.fillStyle = '#1a0420';
  ctx.beginPath();
  ctx.ellipse(cx - 18 * s, cy + 26 * s, 8 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 18 * s, cy + 26 * s, 8 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Floating rune
  ctx.save();
  ctx.translate(cx, cy + 22 * s);
  ctx.rotate(Math.PI / 4);
  const runeG = ctx.createRadialGradient(0, 0, 0, 0, 0, 26 * s);
  runeG.addColorStop(0, 'rgba(212, 168, 255, 0.9)');
  runeG.addColorStop(1, 'rgba(140, 50, 200, 0)');
  ctx.fillStyle = runeG;
  ctx.fillRect(-26 * s, -26 * s, 52 * s, 52 * s);
  ctx.fillStyle = '#ecd8ff';
  ctx.fillRect(-2 * s, -14 * s, 4 * s, 28 * s);
  ctx.fillRect(-14 * s, -2 * s, 28 * s, 4 * s);
  ctx.restore();
}

// ---------- Vampire Lord ----------
function paintVampireLord(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#3a0a14', glow: '#7a1a2a', pattern: 'fire' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Cape — sweeping behind shoulders
  ctx.fillStyle = '#5a0814';
  ctx.beginPath();
  ctx.moveTo(cx - 50 * s, cy - 30 * s);
  ctx.bezierCurveTo(cx - 80 * s, cy + 10 * s, cx - 100 * s, cy + 70 * s, cx - 60 * s, cy + 80 * s);
  ctx.lineTo(cx + 60 * s, cy + 80 * s);
  ctx.bezierCurveTo(cx + 100 * s, cy + 70 * s, cx + 80 * s, cy + 10 * s, cx + 50 * s, cy - 30 * s);
  ctx.lineTo(cx + 28 * s, cy - 14 * s);
  ctx.lineTo(cx - 28 * s, cy - 14 * s);
  ctx.closePath();
  ctx.fill();
  // Cape inner (darker)
  ctx.fillStyle = '#2a0408';
  ctx.beginPath();
  ctx.moveTo(cx - 32 * s, cy - 14 * s);
  ctx.lineTo(cx - 56 * s, cy + 80 * s);
  ctx.lineTo(cx + 56 * s, cy + 80 * s);
  ctx.lineTo(cx + 32 * s, cy - 14 * s);
  ctx.closePath();
  ctx.fill();
  // Body
  ctx.fillStyle = '#1a0a14';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 30 * s, 26 * s, 38 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head — pale aristocrat
  ctx.fillStyle = '#e8d8d0';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 30 * s, 22 * s, 26 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Slicked black hair
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.moveTo(cx - 22 * s, cy - 38 * s);
  ctx.bezierCurveTo(cx - 24 * s, cy - 56 * s, cx + 24 * s, cy - 56 * s, cx + 22 * s, cy - 38 * s);
  ctx.lineTo(cx + 18 * s, cy - 48 * s);
  ctx.lineTo(cx, cy - 40 * s);
  ctx.lineTo(cx - 18 * s, cy - 48 * s);
  ctx.closePath();
  ctx.fill();
  // High collar
  ctx.fillStyle = '#5a0814';
  ctx.beginPath();
  ctx.moveTo(cx - 22 * s, cy - 12 * s);
  ctx.lineTo(cx - 30 * s, cy - 26 * s);
  ctx.lineTo(cx - 16 * s, cy - 8 * s);
  ctx.lineTo(cx + 16 * s, cy - 8 * s);
  ctx.lineTo(cx + 30 * s, cy - 26 * s);
  ctx.lineTo(cx + 22 * s, cy - 12 * s);
  ctx.closePath();
  ctx.fill();
  // Glowing red eyes
  glowingEye(ctx, cx - 8 * s, cy - 32 * s, 3 * s, '#ff2a2a');
  glowingEye(ctx, cx + 8 * s, cy - 32 * s, 3 * s, '#ff2a2a');
  // Fangs
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - 4 * s, cy - 14 * s);
  ctx.lineTo(cx - 3 * s, cy - 6 * s);
  ctx.lineTo(cx - 2 * s, cy - 14 * s);
  ctx.moveTo(cx + 4 * s, cy - 14 * s);
  ctx.lineTo(cx + 3 * s, cy - 6 * s);
  ctx.lineTo(cx + 2 * s, cy - 14 * s);
  ctx.fill();
  // Blood drip from mouth corner
  ctx.fillStyle = '#aa0414';
  ctx.beginPath();
  ctx.moveTo(cx + 5 * s, cy - 8 * s);
  ctx.lineTo(cx + 5 * s, cy + 6 * s);
  ctx.lineTo(cx + 8 * s, cy + 4 * s);
  ctx.closePath();
  ctx.fill();
}

// ---------- Necromancer ----------
function paintNecromancer(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#0a2018', glow: '#2a5a3a', pattern: 'arcane' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Robe (long, hooded)
  ctx.fillStyle = '#0a1810';
  ctx.beginPath();
  ctx.moveTo(cx + 12 * s, cy - 60 * s);
  ctx.bezierCurveTo(cx + 30 * s, cy - 40 * s, cx + 60 * s, cy + 50 * s, cx + 56 * s, cy + 80 * s);
  ctx.lineTo(cx - 60 * s, cy + 80 * s);
  ctx.bezierCurveTo(cx - 60 * s, cy + 50 * s, cx - 30 * s, cy - 40 * s, cx - 12 * s, cy - 60 * s);
  ctx.closePath();
  ctx.fill();
  // Hood opening
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 32 * s, 18 * s, 24 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Two glowing eyes deep in hood
  glowingEye(ctx, cx - 7 * s, cy - 36 * s, 3 * s, '#6ef0a0');
  glowingEye(ctx, cx + 7 * s, cy - 36 * s, 3 * s, '#6ef0a0');
  // Staff (held to the right)
  ctx.strokeStyle = '#5a3a1a';
  ctx.lineWidth = 5 * s;
  ctx.beginPath();
  ctx.moveTo(cx + 56 * s, cy - 60 * s);
  ctx.lineTo(cx + 52 * s, cy + 60 * s);
  ctx.stroke();
  // Bone claw cradle at top of staff
  ctx.strokeStyle = '#e8e0c0';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(cx + 58 * s, cy - 70 * s, 12 * s, Math.PI * 0.3, Math.PI * 1.7);
  ctx.stroke();
  // Glowing orb at staff
  const orbG = ctx.createRadialGradient(cx + 58 * s, cy - 70 * s, 0, cx + 58 * s, cy - 70 * s, 18 * s);
  orbG.addColorStop(0, '#dfffe4');
  orbG.addColorStop(0.4, '#6ef0a0');
  orbG.addColorStop(1, 'rgba(40, 100, 60, 0)');
  ctx.fillStyle = orbG;
  ctx.beginPath();
  ctx.arc(cx + 58 * s, cy - 70 * s, 18 * s, 0, Math.PI * 2);
  ctx.fill();
  // Floating skull at the base
  ctx.fillStyle = '#e8e0c0';
  ctx.beginPath();
  ctx.ellipse(cx - 36 * s, cy + 30 * s, 14 * s, 16 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.arc(cx - 40 * s, cy + 28 * s, 3 * s, 0, Math.PI * 2);
  ctx.arc(cx - 32 * s, cy + 28 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- Ancient Lich ----------
function paintAncientLich(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#1a1410', glow: '#5a4a18', pattern: 'arcane' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Robe — broader, regal
  ctx.fillStyle = '#0a0808';
  ctx.beginPath();
  ctx.moveTo(cx - 20 * s, cy - 30 * s);
  ctx.bezierCurveTo(cx - 80 * s, cy, cx - 100 * s, cy + 80 * s, cx - 80 * s, cy + 88 * s);
  ctx.lineTo(cx + 80 * s, cy + 88 * s);
  ctx.bezierCurveTo(cx + 100 * s, cy + 80 * s, cx + 80 * s, cy, cx + 20 * s, cy - 30 * s);
  ctx.closePath();
  ctx.fill();
  // Skull head
  ctx.fillStyle = '#dccfa6';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 40 * s, 28 * s, 32 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Jaw
  ctx.beginPath();
  ctx.ellipse(cx, cy - 14 * s, 22 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye sockets — large, blazing
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.ellipse(cx - 11 * s, cy - 44 * s, 9 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 11 * s, cy - 44 * s, 9 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  glowingEye(ctx, cx - 11 * s, cy - 44 * s, 5 * s, '#ffae3c');
  glowingEye(ctx, cx + 11 * s, cy - 44 * s, 5 * s, '#ffae3c');
  // Nasal cavity
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.moveTo(cx - 4 * s, cy - 26 * s);
  ctx.lineTo(cx, cy - 14 * s);
  ctx.lineTo(cx + 4 * s, cy - 26 * s);
  ctx.closePath();
  ctx.fill();
  // Teeth
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = '#dccfa6';
    ctx.fillRect(cx + i * 5 * s - 2 * s, cy - 14 * s, 3 * s, 6 * s);
  }
  // Crown (with five spikes & gold band)
  ctx.fillStyle = '#c4922b';
  ctx.beginPath();
  ctx.moveTo(cx - 28 * s, cy - 56 * s);
  for (let i = 0; i <= 5; i++) {
    const x = cx - 28 * s + (i * 56 * s) / 5;
    ctx.lineTo(x, cy - 56 * s);
    ctx.lineTo(x + (56 * s) / 10, cy - 76 * s);
    ctx.lineTo(x + (56 * s) / 5, cy - 56 * s);
  }
  ctx.lineTo(cx + 28 * s, cy - 56 * s);
  ctx.lineTo(cx + 28 * s, cy - 52 * s);
  ctx.lineTo(cx - 28 * s, cy - 52 * s);
  ctx.closePath();
  ctx.fill();
  // Gems on crown
  ctx.fillStyle = '#ff4a4a';
  for (let i = 0; i < 5; i++) {
    const x = cx - 22 * s + i * 11 * s;
    ctx.beginPath();
    ctx.arc(x, cy - 60 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Floating runes around
  ctx.fillStyle = 'rgba(255, 180, 60, 0.7)';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    const r = 90 * s + Math.sin(i) * 10 * s;
    const rx = cx + Math.cos(a) * r;
    const ry = cy + Math.sin(a) * r * 0.6;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(a);
    ctx.fillRect(-1, -6 * s, 2 * s, 12 * s);
    ctx.fillRect(-6 * s, -1, 12 * s, 2 * s);
    ctx.restore();
  }
}

// =============================================================================
// Crawler painters
// =============================================================================

// ---------- Antonio (Swordsman) ----------
function paintAntonio(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#2a2018', glow: '#6a5028', pattern: 'stone' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Body — plate armor torso
  ctx.fillStyle = '#5a5a64';
  ctx.beginPath();
  ctx.moveTo(cx - 32 * s, cy + 6 * s);
  ctx.lineTo(cx - 28 * s, cy + 50 * s);
  ctx.lineTo(cx + 28 * s, cy + 50 * s);
  ctx.lineTo(cx + 32 * s, cy + 6 * s);
  ctx.lineTo(cx + 24 * s, cy - 14 * s);
  ctx.lineTo(cx - 24 * s, cy - 14 * s);
  ctx.closePath();
  ctx.fill();
  // Armor highlights
  ctx.fillStyle = '#8a8a96';
  ctx.fillRect(cx - 4 * s, cy + 4 * s, 8 * s, 44 * s);
  ctx.beginPath();
  ctx.moveTo(cx - 28 * s, cy + 6 * s);
  ctx.lineTo(cx - 32 * s, cy - 12 * s);
  ctx.lineTo(cx - 24 * s, cy - 14 * s);
  ctx.closePath();
  ctx.fill();
  // Pauldrons
  ctx.fillStyle = '#7a7a8a';
  ctx.beginPath();
  ctx.arc(cx - 30 * s, cy - 8 * s, 12 * s, 0, Math.PI * 2);
  ctx.arc(cx + 30 * s, cy - 8 * s, 12 * s, 0, Math.PI * 2);
  ctx.fill();
  // Head — helmet visor
  ctx.fillStyle = '#5a5a64';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 36 * s, 22 * s, 24 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Helmet visor slit
  ctx.fillStyle = '#0a0608';
  ctx.fillRect(cx - 16 * s, cy - 36 * s, 32 * s, 4 * s);
  // Visor highlight
  ctx.fillStyle = '#ffae3c';
  ctx.fillRect(cx - 14 * s, cy - 35 * s, 4 * s, 2 * s);
  ctx.fillRect(cx + 10 * s, cy - 35 * s, 4 * s, 2 * s);
  // Helmet crest (small)
  ctx.fillStyle = '#aa3a3a';
  ctx.beginPath();
  ctx.moveTo(cx - 6 * s, cy - 58 * s);
  ctx.lineTo(cx + 6 * s, cy - 58 * s);
  ctx.lineTo(cx + 4 * s, cy - 70 * s);
  ctx.lineTo(cx - 4 * s, cy - 70 * s);
  ctx.closePath();
  ctx.fill();
  // Greatsword (held in front, vertical)
  ctx.fillStyle = '#9aa0a8';
  ctx.fillRect(cx + 40 * s, cy - 50 * s, 8 * s, 110 * s);
  // Crossguard
  ctx.fillStyle = '#5a3a1a';
  ctx.fillRect(cx + 30 * s, cy + 52 * s, 28 * s, 6 * s);
  // Sword tip
  ctx.fillStyle = '#9aa0a8';
  ctx.beginPath();
  ctx.moveTo(cx + 40 * s, cy - 50 * s);
  ctx.lineTo(cx + 44 * s, cy - 62 * s);
  ctx.lineTo(cx + 48 * s, cy - 50 * s);
  ctx.closePath();
  ctx.fill();
  // Gem on hilt
  ctx.fillStyle = '#ffae3c';
  ctx.beginPath();
  ctx.arc(cx + 44 * s, cy + 62 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- Imelda (Magician) ----------
function paintImelda(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#0a1a3a', glow: '#3a6abf', pattern: 'arcane' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Robe — flowing blue
  ctx.fillStyle = '#1a2a6a';
  ctx.beginPath();
  ctx.moveTo(cx - 22 * s, cy - 10 * s);
  ctx.bezierCurveTo(cx - 60 * s, cy + 30 * s, cx - 70 * s, cy + 80 * s, cx - 50 * s, cy + 84 * s);
  ctx.lineTo(cx + 50 * s, cy + 84 * s);
  ctx.bezierCurveTo(cx + 70 * s, cy + 80 * s, cx + 60 * s, cy + 30 * s, cx + 22 * s, cy - 10 * s);
  ctx.closePath();
  ctx.fill();
  // Robe trim (gold)
  ctx.strokeStyle = '#c4922b';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 50 * s, cy + 84 * s);
  ctx.lineTo(cx + 50 * s, cy + 84 * s);
  ctx.stroke();
  // Head & hood
  ctx.fillStyle = '#1a2a6a';
  ctx.beginPath();
  ctx.moveTo(cx - 28 * s, cy - 16 * s);
  ctx.bezierCurveTo(cx - 32 * s, cy - 64 * s, cx + 32 * s, cy - 64 * s, cx + 28 * s, cy - 16 * s);
  ctx.closePath();
  ctx.fill();
  // Face
  ctx.fillStyle = '#e8c4a8';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 32 * s, 18 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Hair (auburn) peeking from hood
  ctx.fillStyle = '#7a3a1a';
  ctx.beginPath();
  ctx.moveTo(cx - 16 * s, cy - 26 * s);
  ctx.lineTo(cx - 22 * s, cy - 8 * s);
  ctx.lineTo(cx - 12 * s, cy - 12 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 16 * s, cy - 26 * s);
  ctx.lineTo(cx + 22 * s, cy - 8 * s);
  ctx.lineTo(cx + 12 * s, cy - 12 * s);
  ctx.closePath();
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#0a0a14';
  ctx.beginPath();
  ctx.arc(cx - 6 * s, cy - 34 * s, 2 * s, 0, Math.PI * 2);
  ctx.arc(cx + 6 * s, cy - 34 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  // Mouth
  ctx.strokeStyle = '#5a2018';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(cx, cy - 22 * s, 4 * s, 0, Math.PI);
  ctx.stroke();
  // Glowing orb held in hands
  const orbX = cx + 36 * s;
  const orbY = cy + 30 * s;
  const orbG = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 24 * s);
  orbG.addColorStop(0, '#ffffff');
  orbG.addColorStop(0.4, '#6cc6ff');
  orbG.addColorStop(1, 'rgba(40, 80, 200, 0)');
  ctx.fillStyle = orbG;
  ctx.beginPath();
  ctx.arc(orbX, orbY, 24 * s, 0, Math.PI * 2);
  ctx.fill();
  // Hand cradling orb
  ctx.fillStyle = '#e8c4a8';
  ctx.beginPath();
  ctx.arc(orbX - 16 * s, orbY + 10 * s, 8 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- Pasqualina (Priestess) ----------
function paintPasqualina(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#2a2010', glow: '#c4922b', pattern: 'stone' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Robe — cream with red cross
  ctx.fillStyle = '#e8d8b0';
  ctx.beginPath();
  ctx.moveTo(cx - 22 * s, cy - 14 * s);
  ctx.bezierCurveTo(cx - 60 * s, cy + 30 * s, cx - 70 * s, cy + 84 * s, cx - 50 * s, cy + 88 * s);
  ctx.lineTo(cx + 50 * s, cy + 88 * s);
  ctx.bezierCurveTo(cx + 70 * s, cy + 84 * s, cx + 60 * s, cy + 30 * s, cx + 22 * s, cy - 14 * s);
  ctx.closePath();
  ctx.fill();
  // Red cross sash
  ctx.fillStyle = '#aa1818';
  ctx.fillRect(cx - 6 * s, cy + 4 * s, 12 * s, 70 * s);
  ctx.fillRect(cx - 22 * s, cy + 20 * s, 44 * s, 10 * s);
  // Hood
  ctx.fillStyle = '#c8b890';
  ctx.beginPath();
  ctx.moveTo(cx - 30 * s, cy - 18 * s);
  ctx.bezierCurveTo(cx - 34 * s, cy - 66 * s, cx + 34 * s, cy - 66 * s, cx + 30 * s, cy - 18 * s);
  ctx.closePath();
  ctx.fill();
  // Face
  ctx.fillStyle = '#e8c4a8';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 30 * s, 16 * s, 20 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Closed serene eyes (lines)
  ctx.strokeStyle = '#3a2018';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 10 * s, cy - 34 * s);
  ctx.lineTo(cx - 4 * s, cy - 32 * s);
  ctx.moveTo(cx + 4 * s, cy - 32 * s);
  ctx.lineTo(cx + 10 * s, cy - 34 * s);
  ctx.stroke();
  // Calm mouth
  ctx.beginPath();
  ctx.moveTo(cx - 4 * s, cy - 22 * s);
  ctx.lineTo(cx + 4 * s, cy - 22 * s);
  ctx.stroke();
  // Halo glow
  const halo = ctx.createRadialGradient(cx, cy - 50 * s, 0, cx, cy - 50 * s, 32 * s);
  halo.addColorStop(0, 'rgba(255, 230, 160, 0.9)');
  halo.addColorStop(1, 'rgba(255, 200, 100, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - 50 * s, cy - 80 * s, 100 * s, 70 * s);
  // Relic — held in front hands
  ctx.fillStyle = '#c4922b';
  ctx.fillRect(cx - 3 * s, cy + 22 * s, 6 * s, 24 * s);
  ctx.fillRect(cx - 10 * s, cy + 28 * s, 20 * s, 6 * s);
  // Hands
  ctx.fillStyle = '#e8c4a8';
  ctx.beginPath();
  ctx.arc(cx - 12 * s, cy + 36 * s, 6 * s, 0, Math.PI * 2);
  ctx.arc(cx + 12 * s, cy + 36 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- Gennaro (Bleeder with whip) ----------
function paintGennaro(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#2a0a14', glow: '#7a1a2a', pattern: 'fire' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Cloak — torn red leather
  ctx.fillStyle = '#3a0814';
  ctx.beginPath();
  ctx.moveTo(cx - 26 * s, cy - 16 * s);
  ctx.bezierCurveTo(cx - 60 * s, cy + 20 * s, cx - 80 * s, cy + 70 * s, cx - 58 * s, cy + 86 * s);
  // Jagged edge
  ctx.lineTo(cx - 30 * s, cy + 70 * s);
  ctx.lineTo(cx - 20 * s, cy + 86 * s);
  ctx.lineTo(cx - 10 * s, cy + 66 * s);
  ctx.lineTo(cx, cy + 88 * s);
  ctx.lineTo(cx + 10 * s, cy + 66 * s);
  ctx.lineTo(cx + 20 * s, cy + 86 * s);
  ctx.lineTo(cx + 30 * s, cy + 70 * s);
  ctx.lineTo(cx + 58 * s, cy + 86 * s);
  ctx.bezierCurveTo(cx + 80 * s, cy + 70 * s, cx + 60 * s, cy + 20 * s, cx + 26 * s, cy - 16 * s);
  ctx.closePath();
  ctx.fill();
  // Leather torso (dark)
  ctx.fillStyle = '#1a0a0a';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 16 * s, 22 * s, 30 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Spiked shoulder studs
  ctx.fillStyle = '#7a5a3a';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.arc(cx - 18 * s + i * 6 * s, cy - 8 * s + i * 1 * s, 3 * s, 0, Math.PI * 2);
    ctx.arc(cx + 18 * s + i * 6 * s, cy - 8 * s + i * 1 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head — rough, with bandana
  ctx.fillStyle = '#e8c4a8';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 32 * s, 20 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Bandana
  ctx.fillStyle = '#aa1818';
  ctx.beginPath();
  ctx.moveTo(cx - 22 * s, cy - 38 * s);
  ctx.lineTo(cx + 22 * s, cy - 38 * s);
  ctx.lineTo(cx + 22 * s, cy - 28 * s);
  ctx.lineTo(cx - 22 * s, cy - 28 * s);
  ctx.closePath();
  ctx.fill();
  // Bandana knot
  ctx.beginPath();
  ctx.moveTo(cx + 22 * s, cy - 34 * s);
  ctx.lineTo(cx + 36 * s, cy - 24 * s);
  ctx.lineTo(cx + 30 * s, cy - 38 * s);
  ctx.closePath();
  ctx.fill();
  // Glaring eyes
  ctx.fillStyle = '#0a0a14';
  ctx.beginPath();
  ctx.arc(cx - 6 * s, cy - 26 * s, 2 * s, 0, Math.PI * 2);
  ctx.arc(cx + 6 * s, cy - 26 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  // Sneer
  ctx.strokeStyle = '#3a0608';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 6 * s, cy - 18 * s);
  ctx.lineTo(cx + 6 * s, cy - 16 * s);
  ctx.stroke();
  // Whip lash
  ctx.strokeStyle = '#3a1a0a';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(cx + 30 * s, cy + 20 * s);
  ctx.bezierCurveTo(
    cx + 80 * s, cy + 40 * s,
    cx + 100 * s, cy - 20 * s,
    cx + 80 * s, cy - 60 * s,
  );
  ctx.stroke();
  // Whip handle
  ctx.fillStyle = '#1a0a08';
  ctx.fillRect(cx + 26 * s, cy + 16 * s, 6 * s, 14 * s);
  // Blood splatter
  ctx.fillStyle = '#aa0414';
  for (let i = 0; i < 6; i++) {
    const bx = cx + (Math.random() - 0.5) * 100 * s;
    const by = cy + 50 * s + (Math.random() - 0.5) * 30 * s;
    ctx.beginPath();
    ctx.arc(bx, by, Math.random() * 3 * s + 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

// =============================================================================
// Mid-tier enemies (floors 4+)
// =============================================================================

// ---------- Wraith ----------
function paintWraith(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#1a1430', glow: '#6850b8', pattern: 'arcane' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Ethereal body — long flowing cloak that fades to nothing at the base
  const bodyGrad = ctx.createLinearGradient(cx, cy - 50 * s, cx, cy + 90 * s);
  bodyGrad.addColorStop(0, 'rgba(120, 100, 200, 0.95)');
  bodyGrad.addColorStop(0.6, 'rgba(80, 60, 160, 0.7)');
  bodyGrad.addColorStop(1, 'rgba(40, 20, 100, 0)');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(cx - 40 * s, cy - 40 * s);
  ctx.bezierCurveTo(cx - 60 * s, cy + 10 * s, cx - 70 * s, cy + 70 * s, cx - 50 * s, cy + 100 * s);
  ctx.lineTo(cx + 50 * s, cy + 100 * s);
  ctx.bezierCurveTo(cx + 70 * s, cy + 70 * s, cx + 60 * s, cy + 10 * s, cx + 40 * s, cy - 40 * s);
  ctx.bezierCurveTo(cx + 30 * s, cy - 56 * s, cx - 30 * s, cy - 56 * s, cx - 40 * s, cy - 40 * s);
  ctx.closePath();
  ctx.fill();
  // Tattered edges (slashes at the bottom)
  ctx.fillStyle = 'rgba(20, 10, 50, 0.6)';
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 14 * s, cy + 70 * s);
    ctx.lineTo(cx + i * 14 * s + 4 * s, cy + 100 * s);
    ctx.lineTo(cx + i * 14 * s - 4 * s, cy + 100 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Hood opening (dark void)
  ctx.fillStyle = '#0a0418';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 26 * s, 16 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Glowing eyes
  glowingEye(ctx, cx - 6 * s, cy - 30 * s, 3 * s, '#c4a8ff');
  glowingEye(ctx, cx + 6 * s, cy - 30 * s, 3 * s, '#c4a8ff');
  // Wisp trails coming off the sides
  ctx.strokeStyle = 'rgba(150, 130, 220, 0.5)';
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const sign = i < 2 ? -1 : 1;
    const off = (i % 2) * 20 * s;
    ctx.beginPath();
    ctx.moveTo(cx + sign * 38 * s, cy + 10 * s + off);
    ctx.bezierCurveTo(
      cx + sign * 60 * s, cy + 30 * s + off,
      cx + sign * 70 * s, cy - 10 * s + off,
      cx + sign * 90 * s, cy + off,
    );
    ctx.stroke();
  }
}

// ---------- Gargoyle ----------
function paintGargoyle(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#2a2820', glow: '#4a4838', pattern: 'stone' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Hunched stone body
  ctx.fillStyle = '#5a5450';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 20 * s, 42 * s, 40 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Head — squat & brutal
  ctx.beginPath();
  ctx.ellipse(cx, cy - 26 * s, 28 * s, 24 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Horns
  ctx.fillStyle = '#3a3428';
  ctx.beginPath();
  ctx.moveTo(cx - 22 * s, cy - 38 * s);
  ctx.lineTo(cx - 30 * s, cy - 56 * s);
  ctx.lineTo(cx - 16 * s, cy - 44 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 22 * s, cy - 38 * s);
  ctx.lineTo(cx + 30 * s, cy - 56 * s);
  ctx.lineTo(cx + 16 * s, cy - 44 * s);
  ctx.closePath();
  ctx.fill();
  // Wings — folded behind body
  ctx.fillStyle = '#3a3530';
  ctx.beginPath();
  ctx.moveTo(cx - 36 * s, cy);
  ctx.bezierCurveTo(cx - 78 * s, cy - 20 * s, cx - 80 * s, cy + 30 * s, cx - 48 * s, cy + 40 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 36 * s, cy);
  ctx.bezierCurveTo(cx + 78 * s, cy - 20 * s, cx + 80 * s, cy + 30 * s, cx + 48 * s, cy + 40 * s);
  ctx.closePath();
  ctx.fill();
  // Glowing red eyes
  glowingEye(ctx, cx - 10 * s, cy - 28 * s, 3 * s, '#ff4a2a');
  glowingEye(ctx, cx + 10 * s, cy - 28 * s, 3 * s, '#ff4a2a');
  // Snarl with fangs
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 14 * s, 12 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#dcd8c4';
  for (let i = -2; i <= 2; i += 2) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 5 * s, cy - 14 * s);
    ctx.lineTo(cx + i * 5 * s + 2 * s, cy - 6 * s);
    ctx.lineTo(cx + i * 5 * s - 2 * s, cy - 6 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Claws on each shoulder
  ctx.fillStyle = '#1a1814';
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + sign * (40 + i * 6) * s, cy);
      ctx.lineTo(cx + sign * (44 + i * 6) * s, cy + 16 * s);
      ctx.lineTo(cx + sign * (36 + i * 6) * s, cy + 12 * s);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Stone surface cracks
  ctx.strokeStyle = '#28241c';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + (Math.random() - 0.5) * 60 * s, cy + (Math.random() - 0.2) * 40 * s);
    ctx.lineTo(cx + (Math.random() - 0.5) * 60 * s, cy + (Math.random() - 0.2) * 40 * s);
    ctx.stroke();
  }
}

// ---------- Dire Wolf ----------
function paintDireWolf(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#1a1820', glow: '#3a3848', pattern: 'cave' });
  const cx = w * 0.5;
  const cy = h * 0.6;
  const s = w / 256;
  // Body — crouched 4-legged predator
  ctx.fillStyle = '#28242a';
  ctx.beginPath();
  ctx.ellipse(cx - 6 * s, cy + 4 * s, 56 * s, 30 * s, -0.12, 0, Math.PI * 2);
  ctx.fill();
  // Head — long muzzled
  ctx.beginPath();
  ctx.ellipse(cx + 42 * s, cy - 16 * s, 30 * s, 20 * s, -0.1, 0, Math.PI * 2);
  ctx.fill();
  // Snout
  ctx.beginPath();
  ctx.moveTo(cx + 62 * s, cy - 22 * s);
  ctx.lineTo(cx + 86 * s, cy - 12 * s);
  ctx.lineTo(cx + 60 * s, cy - 6 * s);
  ctx.closePath();
  ctx.fill();
  // Pointed ears
  ctx.beginPath();
  ctx.moveTo(cx + 24 * s, cy - 30 * s);
  ctx.lineTo(cx + 18 * s, cy - 48 * s);
  ctx.lineTo(cx + 34 * s, cy - 36 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 48 * s, cy - 36 * s);
  ctx.lineTo(cx + 46 * s, cy - 54 * s);
  ctx.lineTo(cx + 56 * s, cy - 30 * s);
  ctx.closePath();
  ctx.fill();
  // Legs
  ctx.fillStyle = '#1a1820';
  ctx.fillRect(cx - 42 * s, cy + 22 * s, 10 * s, 24 * s);
  ctx.fillRect(cx - 16 * s, cy + 26 * s, 10 * s, 22 * s);
  ctx.fillRect(cx + 14 * s, cy + 22 * s, 10 * s, 24 * s);
  ctx.fillRect(cx + 40 * s, cy + 14 * s, 10 * s, 28 * s);
  // Tail (bushy)
  ctx.beginPath();
  ctx.moveTo(cx - 56 * s, cy + 4 * s);
  ctx.bezierCurveTo(cx - 90 * s, cy + 14 * s, cx - 100 * s, cy - 14 * s, cx - 84 * s, cy - 22 * s);
  ctx.bezierCurveTo(cx - 76 * s, cy - 10 * s, cx - 76 * s, cy, cx - 56 * s, cy + 4 * s);
  ctx.closePath();
  ctx.fill();
  // Yellow glowing eye
  glowingEye(ctx, cx + 40 * s, cy - 20 * s, 3 * s, '#ffce4a');
  // Bared fangs
  ctx.fillStyle = '#fff8d8';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + 70 * s + i * 4 * s, cy - 4 * s);
    ctx.lineTo(cx + 72 * s + i * 4 * s, cy + 4 * s);
    ctx.lineTo(cx + 68 * s + i * 4 * s, cy + 2 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Fur tufts on shoulders
  ctx.fillStyle = '#3a363c';
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 7 * s, cy - 14 * s);
    ctx.lineTo(cx + i * 7 * s + 2 * s, cy - 24 * s);
    ctx.lineTo(cx + i * 7 * s - 2 * s, cy - 24 * s);
    ctx.closePath();
    ctx.fill();
  }
}

// ---------- Revenant ----------
function paintRevenant(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#1c1410', glow: '#5a4028', pattern: 'crypt' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Tattered cloak behind
  ctx.fillStyle = '#3a2818';
  ctx.beginPath();
  ctx.moveTo(cx - 36 * s, cy - 16 * s);
  ctx.bezierCurveTo(cx - 60 * s, cy + 30 * s, cx - 70 * s, cy + 80 * s, cx - 50 * s, cy + 90 * s);
  ctx.lineTo(cx + 50 * s, cy + 90 * s);
  ctx.bezierCurveTo(cx + 70 * s, cy + 80 * s, cx + 60 * s, cy + 30 * s, cx + 36 * s, cy - 16 * s);
  ctx.closePath();
  ctx.fill();
  // Rusted armor torso
  ctx.fillStyle = '#5a3a28';
  ctx.beginPath();
  ctx.moveTo(cx - 28 * s, cy);
  ctx.lineTo(cx - 24 * s, cy + 50 * s);
  ctx.lineTo(cx + 24 * s, cy + 50 * s);
  ctx.lineTo(cx + 28 * s, cy);
  ctx.lineTo(cx + 18 * s, cy - 20 * s);
  ctx.lineTo(cx - 18 * s, cy - 20 * s);
  ctx.closePath();
  ctx.fill();
  // Rust streaks
  ctx.fillStyle = '#7a4a18';
  ctx.fillRect(cx - 8 * s, cy + 4 * s, 2 * s, 40 * s);
  ctx.fillRect(cx + 4 * s, cy + 4 * s, 2 * s, 40 * s);
  // Pauldrons
  ctx.fillStyle = '#3a2818';
  ctx.beginPath();
  ctx.arc(cx - 26 * s, cy - 8 * s, 11 * s, 0, Math.PI * 2);
  ctx.arc(cx + 26 * s, cy - 8 * s, 11 * s, 0, Math.PI * 2);
  ctx.fill();
  // Spiked pauldron studs
  ctx.fillStyle = '#1a1208';
  for (const cxp of [-26, 26]) {
    for (let i = 0; i < 3; i++) {
      const a = -1 + i * 0.5;
      ctx.beginPath();
      ctx.arc(cx + (cxp + Math.cos(a) * 11) * s, cy + (-8 + Math.sin(a) * 11) * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Helmet
  ctx.fillStyle = '#3a2818';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 36 * s, 22 * s, 26 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Helmet visor slit
  ctx.fillStyle = '#0a0608';
  ctx.fillRect(cx - 16 * s, cy - 36 * s, 32 * s, 4 * s);
  // Glowing red eyes through visor
  glowingEye(ctx, cx - 8 * s, cy - 34 * s, 2 * s, '#ff3a2a');
  glowingEye(ctx, cx + 8 * s, cy - 34 * s, 2 * s, '#ff3a2a');
  // Cracked horns from helm
  ctx.fillStyle = '#1a1208';
  ctx.beginPath();
  ctx.moveTo(cx - 18 * s, cy - 54 * s);
  ctx.lineTo(cx - 24 * s, cy - 72 * s);
  ctx.lineTo(cx - 10 * s, cy - 58 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 18 * s, cy - 54 * s);
  ctx.lineTo(cx + 24 * s, cy - 72 * s);
  ctx.lineTo(cx + 10 * s, cy - 58 * s);
  ctx.closePath();
  ctx.fill();
  // Rusted sword
  ctx.fillStyle = '#7a5028';
  ctx.fillRect(cx + 38 * s, cy - 40 * s, 6 * s, 90 * s);
  ctx.fillStyle = '#5a3a18';
  ctx.fillRect(cx + 32 * s, cy + 48 * s, 18 * s, 5 * s);
  // Blade nicks
  ctx.fillStyle = '#5a3a18';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(cx + 38 * s, cy - 30 * s + i * 20 * s, 2 * s, 4 * s);
  }
}

// =============================================================================
// New bosses (floors 4-10)
// =============================================================================

// ---------- The Bound Tome (F4) ----------
function paintBoundTome(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#1a1206', glow: '#8a6a18', pattern: 'arcane' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Book body — leather binding
  ctx.fillStyle = '#5a2818';
  ctx.beginPath();
  ctx.moveTo(cx - 70 * s, cy - 50 * s);
  ctx.lineTo(cx - 70 * s, cy + 50 * s);
  ctx.lineTo(cx + 70 * s, cy + 50 * s);
  ctx.lineTo(cx + 70 * s, cy - 50 * s);
  ctx.closePath();
  ctx.fill();
  // Spine highlight
  ctx.fillStyle = '#7a3a20';
  ctx.fillRect(cx - 4 * s, cy - 50 * s, 8 * s, 100 * s);
  // Gold corner brackets
  ctx.fillStyle = '#c4922b';
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x = cx + sx * 64 * s;
      const y = cy + sy * 44 * s;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - sx * 12 * s, y);
      ctx.lineTo(x, y - sy * 12 * s);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Massive central eye (the binding sigil)
  glow(ctx, cx, cy, 60 * s, 'rgba(255, 220, 100, 0.55)');
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.ellipse(cx, cy, 30 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd870';
  ctx.beginPath();
  ctx.arc(cx, cy, 14 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  // Pages curling out from beneath, embers crackling
  ctx.fillStyle = '#e8d6a8';
  for (let i = -2; i <= 2; i++) {
    ctx.save();
    ctx.translate(cx + i * 22 * s, cy + 56 * s);
    ctx.rotate(i * 0.15);
    ctx.fillRect(-10 * s, 0, 20 * s, 14 * s);
    ctx.restore();
  }
  // Chains crossing the book
  ctx.strokeStyle = '#7a6438';
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 80 * s, cy - 20 * s);
  ctx.lineTo(cx + 80 * s, cy - 20 * s);
  ctx.moveTo(cx - 80 * s, cy + 30 * s);
  ctx.lineTo(cx + 80 * s, cy + 30 * s);
  ctx.stroke();
  // Floating runes
  ctx.fillStyle = 'rgba(255, 220, 100, 0.7)';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rx = cx + Math.cos(a) * 110 * s;
    const ry = cy + Math.sin(a) * 70 * s;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(a);
    ctx.fillRect(-1, -6 * s, 2 * s, 12 * s);
    ctx.fillRect(-6 * s, -1, 12 * s, 2 * s);
    ctx.restore();
  }
}

// ---------- The Spore Mother (F5) ----------
function paintSporeMother(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#0a2010', glow: '#5aff90', pattern: 'cave' });
  const cx = w * 0.5;
  const cy = h * 0.6;
  const s = w / 256;
  // Massive bulbous body (the mushroom cap is the head, body is the stem)
  ctx.fillStyle = '#3a4818';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 30 * s, 50 * s, 60 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Stem ridges
  ctx.fillStyle = '#28381a';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(cx + i * 16 * s, cy + 60 * s, 4 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mushroom cap (dome)
  ctx.fillStyle = '#aa3a4a';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 26 * s, 70 * s, 38 * s, 0, Math.PI, 0);
  ctx.fill();
  // Cap underside (gills)
  ctx.fillStyle = '#5a1820';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 10 * s, 70 * s, 8 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // White spots on cap
  ctx.fillStyle = '#f3e2c4';
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI + (i / 7) * Math.PI;
    const rx = cx + Math.cos(a) * 56 * s;
    const ry = cy - 26 * s + Math.sin(a) * 30 * s;
    if (ry < cy - 10 * s) {
      ctx.beginPath();
      ctx.arc(rx, ry, 5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Glowing face on stem
  glow(ctx, cx, cy + 20 * s, 28 * s, 'rgba(120, 255, 160, 0.6)');
  glowingEye(ctx, cx - 12 * s, cy + 14 * s, 3 * s, '#a8ffb8');
  glowingEye(ctx, cx + 12 * s, cy + 14 * s, 3 * s, '#a8ffb8');
  // Mouth — vertical slit
  ctx.fillStyle = '#0a1810';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 36 * s, 4 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tendrils/vines reaching out
  ctx.strokeStyle = '#1a2810';
  ctx.lineWidth = 4 * s;
  ctx.lineCap = 'round';
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sign * 40 * s, cy + 50 * s);
    ctx.bezierCurveTo(
      cx + sign * 80 * s, cy + 40 * s,
      cx + sign * 100 * s, cy + 20 * s,
      cx + sign * 110 * s, cy - 10 * s,
    );
    ctx.stroke();
  }
  // Spore puffs around (drifting)
  for (let i = 0; i < 16; i++) {
    const px = Math.random() * w;
    const py = Math.random() * h;
    const r = Math.random() * 3 * s + 1;
    glow(ctx, px, py, r * 3, `rgba(120, 255, 160, ${0.15 + Math.random() * 0.25})`);
  }
}

// ---------- The Iron Tyrant (F6) ----------
function paintIronTyrant(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#1a0c06', glow: '#ff5018', pattern: 'fire' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Hulking iron body
  ctx.fillStyle = '#3a2818';
  ctx.beginPath();
  ctx.moveTo(cx - 50 * s, cy + 6 * s);
  ctx.lineTo(cx - 42 * s, cy + 56 * s);
  ctx.lineTo(cx + 42 * s, cy + 56 * s);
  ctx.lineTo(cx + 50 * s, cy + 6 * s);
  ctx.lineTo(cx + 36 * s, cy - 14 * s);
  ctx.lineTo(cx - 36 * s, cy - 14 * s);
  ctx.closePath();
  ctx.fill();
  // Plate seams
  ctx.strokeStyle = '#5a3a20';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14 * s);
  ctx.lineTo(cx, cy + 56 * s);
  ctx.moveTo(cx - 46 * s, cy + 20 * s);
  ctx.lineTo(cx + 46 * s, cy + 20 * s);
  ctx.stroke();
  // Massive pauldrons (spiked)
  ctx.fillStyle = '#2a1c10';
  ctx.beginPath();
  ctx.arc(cx - 50 * s, cy - 10 * s, 22 * s, 0, Math.PI * 2);
  ctx.arc(cx + 50 * s, cy - 10 * s, 22 * s, 0, Math.PI * 2);
  ctx.fill();
  // Spikes on pauldrons
  for (const sx of [-50, 50]) {
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI + (i / 3) * Math.PI;
      ctx.fillStyle = '#1a0e08';
      ctx.beginPath();
      ctx.moveTo(cx + (sx + Math.cos(a) * 22) * s, cy + (-10 + Math.sin(a) * 22) * s);
      ctx.lineTo(cx + (sx + Math.cos(a) * 32) * s, cy + (-10 + Math.sin(a) * 32) * s);
      ctx.lineTo(cx + (sx + Math.cos(a + 0.2) * 22) * s, cy + (-10 + Math.sin(a + 0.2) * 22) * s);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Helmet — squared, slitted visor
  ctx.fillStyle = '#3a2818';
  ctx.beginPath();
  ctx.rect(cx - 24 * s, cy - 50 * s, 48 * s, 36 * s);
  ctx.fill();
  // Visor — wide horizontal slit, glowing molten orange
  ctx.fillStyle = '#0a0408';
  ctx.fillRect(cx - 22 * s, cy - 36 * s, 44 * s, 6 * s);
  glow(ctx, cx, cy - 33 * s, 30 * s, 'rgba(255, 100, 40, 0.7)');
  ctx.fillStyle = '#ff7028';
  ctx.fillRect(cx - 20 * s, cy - 35 * s, 40 * s, 3 * s);
  // Helmet horns / vents
  ctx.fillStyle = '#1a0e08';
  ctx.beginPath();
  ctx.moveTo(cx - 24 * s, cy - 50 * s);
  ctx.lineTo(cx - 30 * s, cy - 64 * s);
  ctx.lineTo(cx - 16 * s, cy - 50 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 24 * s, cy - 50 * s);
  ctx.lineTo(cx + 30 * s, cy - 64 * s);
  ctx.lineTo(cx + 16 * s, cy - 50 * s);
  ctx.closePath();
  ctx.fill();
  // Glowing chest furnace
  glow(ctx, cx, cy + 24 * s, 26 * s, 'rgba(255, 120, 40, 0.7)');
  ctx.fillStyle = '#ff7028';
  ctx.beginPath();
  ctx.arc(cx, cy + 24 * s, 10 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a0e08';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 14 * s, cy + 16 * s);
  ctx.lineTo(cx + 14 * s, cy + 32 * s);
  ctx.moveTo(cx + 14 * s, cy + 16 * s);
  ctx.lineTo(cx - 14 * s, cy + 32 * s);
  ctx.stroke();
  // Massive forge hammer in right hand
  ctx.fillStyle = '#3a2818';
  ctx.fillRect(cx + 60 * s, cy - 20 * s, 6 * s, 70 * s);
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(cx + 50 * s, cy - 36 * s, 26 * s, 22 * s);
  // Hammer face glow
  glow(ctx, cx + 63 * s, cy - 24 * s, 14 * s, 'rgba(255, 100, 40, 0.5)');
}

// ---------- The Frost Wyrm (F7) ----------
function paintFrostWyrm(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#0e1828', glow: '#a8d8ff', pattern: 'cave' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Long serpentine body (S-curve)
  ctx.strokeStyle = '#5a98c4';
  ctx.lineWidth = 28 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 80 * s, cy + 80 * s);
  ctx.bezierCurveTo(
    cx - 60 * s, cy + 40 * s,
    cx - 90 * s, cy + 10 * s,
    cx - 30 * s, cy - 10 * s,
  );
  ctx.bezierCurveTo(
    cx + 30 * s, cy - 30 * s,
    cx + 30 * s, cy - 50 * s,
    cx + 10 * s, cy - 60 * s,
  );
  ctx.stroke();
  // Body shading on the curve
  ctx.strokeStyle = '#3a6a98';
  ctx.lineWidth = 8 * s;
  ctx.beginPath();
  ctx.moveTo(cx - 80 * s, cy + 80 * s);
  ctx.bezierCurveTo(
    cx - 60 * s, cy + 40 * s,
    cx - 90 * s, cy + 10 * s,
    cx - 30 * s, cy - 10 * s,
  );
  ctx.stroke();
  // Dragon head — at the top
  ctx.fillStyle = '#5a98c4';
  ctx.beginPath();
  ctx.ellipse(cx + 4 * s, cy - 58 * s, 32 * s, 22 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // Snout
  ctx.beginPath();
  ctx.moveTo(cx + 30 * s, cy - 60 * s);
  ctx.lineTo(cx + 58 * s, cy - 50 * s);
  ctx.lineTo(cx + 28 * s, cy - 44 * s);
  ctx.closePath();
  ctx.fill();
  // Crest/horns
  ctx.fillStyle = '#c8e0f0';
  ctx.beginPath();
  ctx.moveTo(cx - 16 * s, cy - 70 * s);
  ctx.lineTo(cx - 28 * s, cy - 90 * s);
  ctx.lineTo(cx - 6 * s, cy - 76 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 14 * s, cy - 76 * s);
  ctx.lineTo(cx + 6 * s, cy - 96 * s);
  ctx.lineTo(cx + 22 * s, cy - 78 * s);
  ctx.closePath();
  ctx.fill();
  // Cold breath / icy glow from snout
  glow(ctx, cx + 58 * s, cy - 50 * s, 36 * s, 'rgba(180, 220, 255, 0.65)');
  // Icy eye
  glowingEye(ctx, cx + 10 * s, cy - 60 * s, 4 * s, '#dceefa');
  // Fangs
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + 40 * s + i * 5 * s, cy - 44 * s);
    ctx.lineTo(cx + 42 * s + i * 5 * s, cy - 34 * s);
    ctx.lineTo(cx + 38 * s + i * 5 * s, cy - 40 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Icy scales along the body
  ctx.fillStyle = '#c8e0f0';
  for (let i = 0; i < 14; i++) {
    const t = i / 13;
    const px = cx - 80 * s + t * 130 * s;
    const py = cy + 80 * s - t * 140 * s + Math.sin(t * Math.PI * 2) * 12 * s;
    ctx.beginPath();
    ctx.ellipse(px, py, 4 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Frost particles in air
  for (let i = 0; i < 40; i++) {
    const px = Math.random() * w;
    const py = Math.random() * h;
    ctx.fillStyle = `rgba(220, 240, 255, ${Math.random() * 0.5 + 0.2})`;
    ctx.fillRect(px, py, 1, 1);
  }
}

// ---------- The Obsidian Maw (F8) ----------
function paintObsidianMaw(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#180408', glow: '#ff3020', pattern: 'fire' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Lava-cracked obsidian mound (the body)
  ctx.fillStyle = '#0e0408';
  ctx.beginPath();
  ctx.moveTo(cx - 90 * s, cy + 90 * s);
  ctx.bezierCurveTo(cx - 100 * s, cy + 20 * s, cx - 60 * s, cy - 40 * s, cx, cy - 60 * s);
  ctx.bezierCurveTo(cx + 60 * s, cy - 40 * s, cx + 100 * s, cy + 20 * s, cx + 90 * s, cy + 90 * s);
  ctx.closePath();
  ctx.fill();
  // Cracked lava veins
  ctx.strokeStyle = '#ff5030';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    const sx = cx + (Math.random() - 0.5) * 160 * s;
    const sy = cy + (Math.random() - 0.2) * 80 * s;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (Math.random() - 0.5) * 40 * s, sy + (Math.random() - 0.5) * 30 * s);
    ctx.lineTo(sx + (Math.random() - 0.5) * 60 * s, sy + (Math.random() - 0.5) * 40 * s);
    ctx.stroke();
  }
  // Gaping maw — a horizontal void with rows of jagged teeth
  glow(ctx, cx, cy + 4 * s, 70 * s, 'rgba(255, 80, 40, 0.7)');
  ctx.fillStyle = '#1a0204';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4 * s, 56 * s, 22 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Throat glow
  ctx.fillStyle = '#ff5030';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8 * s, 40 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Upper teeth
  ctx.fillStyle = '#dccfa6';
  for (let i = -5; i <= 5; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 10 * s - 4 * s, cy - 14 * s);
    ctx.lineTo(cx + i * 10 * s + 4 * s, cy - 14 * s);
    ctx.lineTo(cx + i * 10 * s, cy + 0 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Lower teeth
  for (let i = -5; i <= 5; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 10 * s - 4 * s, cy + 22 * s);
    ctx.lineTo(cx + i * 10 * s + 4 * s, cy + 22 * s);
    ctx.lineTo(cx + i * 10 * s, cy + 8 * s);
    ctx.closePath();
    ctx.fill();
  }
  // Pair of glowing eyes above the maw
  glowingEye(ctx, cx - 30 * s, cy - 36 * s, 5 * s, '#ff8040');
  glowingEye(ctx, cx + 30 * s, cy - 36 * s, 5 * s, '#ff8040');
  // Floating embers
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 2 * s + 1;
    glow(ctx, x, y, r * 4, 'rgba(255, 120, 40, 0.6)');
  }
}

// ---------- The Astral Warden (F9) ----------
function paintAstralWarden(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#0a0828', glow: '#b48cff', pattern: 'arcane' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Starfield (denser than the default arcane pattern)
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.5 + 0.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.8 + 0.2})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cosmic robe — purple to black gradient
  const robeGrad = ctx.createLinearGradient(cx, cy - 50 * s, cx, cy + 100 * s);
  robeGrad.addColorStop(0, '#3a2870');
  robeGrad.addColorStop(0.6, '#1a0a3a');
  robeGrad.addColorStop(1, '#08041a');
  ctx.fillStyle = robeGrad;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 60 * s);
  ctx.bezierCurveTo(cx - 50 * s, cy - 30 * s, cx - 90 * s, cy + 80 * s, cx - 70 * s, cy + 100 * s);
  ctx.lineTo(cx + 70 * s, cy + 100 * s);
  ctx.bezierCurveTo(cx + 90 * s, cy + 80 * s, cx + 50 * s, cy - 30 * s, cx, cy - 60 * s);
  ctx.closePath();
  ctx.fill();
  // Constellation patterns on the robe
  ctx.fillStyle = '#e8d8ff';
  for (let i = 0; i < 14; i++) {
    const px = cx + (Math.random() - 0.5) * 100 * s;
    const py = cy + Math.random() * 100 * s;
    ctx.beginPath();
    ctx.arc(px, py, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head — featureless cosmic void with stars inside
  ctx.fillStyle = '#0a0418';
  ctx.beginPath();
  ctx.arc(cx, cy - 28 * s, 28 * s, 0, Math.PI * 2);
  ctx.fill();
  // Star eyes
  glow(ctx, cx, cy - 28 * s, 30 * s, 'rgba(180, 140, 255, 0.55)');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = 12 * s;
    const px = cx + Math.cos(a) * r;
    const py = cy - 28 * s + Math.sin(a) * r;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Central glowing third-eye
  glowingEye(ctx, cx, cy - 28 * s, 6 * s, '#e8d6ff');
  // Halo of orbiting rings (rotating, multi-layered)
  ctx.strokeStyle = '#b48cff';
  ctx.lineWidth = 2 * s;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(cx, cy - 28 * s);
    ctx.rotate(i * 0.7);
    ctx.beginPath();
    ctx.ellipse(0, 0, 52 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  // Floating runes
  ctx.fillStyle = 'rgba(232, 216, 255, 0.85)';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 90 * s + Math.sin(i) * 12 * s;
    const rx = cx + Math.cos(a) * r;
    const ry = cy - 10 * s + Math.sin(a) * r * 0.55;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(a);
    ctx.fillRect(-1, -6 * s, 2 * s, 12 * s);
    ctx.fillRect(-6 * s, -1, 12 * s, 2 * s);
    ctx.restore();
  }
}

// ---------- The Eternity King (F10 — final boss) ----------
function paintEternityKing(ctx: CanvasRenderingContext2D, w: number, h: number) {
  paintBackground(ctx, w, h, { tint: '#1a1408', glow: '#ffd870', pattern: 'arcane' });
  const cx = w * 0.5;
  const cy = h * 0.55;
  const s = w / 256;
  // Halo / sun corona behind throne
  glow(ctx, cx, cy - 36 * s, 120 * s, 'rgba(255, 200, 80, 0.5)');
  // Throne back (large arched shape)
  ctx.fillStyle = '#3a2818';
  ctx.beginPath();
  ctx.moveTo(cx - 70 * s, cy + 90 * s);
  ctx.lineTo(cx - 70 * s, cy - 30 * s);
  ctx.bezierCurveTo(cx - 80 * s, cy - 80 * s, cx + 80 * s, cy - 80 * s, cx + 70 * s, cy - 30 * s);
  ctx.lineTo(cx + 70 * s, cy + 90 * s);
  ctx.closePath();
  ctx.fill();
  // Gold trim on throne
  ctx.fillStyle = '#ffd870';
  ctx.fillRect(cx - 70 * s, cy - 32 * s, 140 * s, 4 * s);
  ctx.fillRect(cx - 70 * s, cy + 86 * s, 140 * s, 4 * s);
  // Royal robe (cape down the throne)
  ctx.fillStyle = '#7a1820';
  ctx.beginPath();
  ctx.moveTo(cx - 50 * s, cy - 10 * s);
  ctx.lineTo(cx - 70 * s, cy + 90 * s);
  ctx.lineTo(cx + 70 * s, cy + 90 * s);
  ctx.lineTo(cx + 50 * s, cy - 10 * s);
  ctx.closePath();
  ctx.fill();
  // Fur trim
  ctx.fillStyle = '#f3e2c4';
  ctx.fillRect(cx - 70 * s, cy + 84 * s, 140 * s, 8 * s);
  // Skeletal body
  ctx.fillStyle = '#3a2818';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 30 * s, 36 * s, 44 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Skull head
  ctx.fillStyle = '#f3e2c4';
  ctx.beginPath();
  ctx.ellipse(cx, cy - 36 * s, 30 * s, 34 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Jaw
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8 * s, 22 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eye sockets — blazing gold
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.ellipse(cx - 11 * s, cy - 40 * s, 9 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 11 * s, cy - 40 * s, 9 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  glowingEye(ctx, cx - 11 * s, cy - 40 * s, 5 * s, '#ffd870');
  glowingEye(ctx, cx + 11 * s, cy - 40 * s, 5 * s, '#ffd870');
  // Teeth
  ctx.fillStyle = '#f3e2c4';
  for (let i = -3; i <= 3; i++) {
    ctx.fillRect(cx + i * 5 * s - 2 * s, cy - 8 * s, 3 * s, 8 * s);
  }
  // Massive imperial crown — 7 spikes with gemstones
  ctx.fillStyle = '#ffd870';
  ctx.beginPath();
  ctx.moveTo(cx - 36 * s, cy - 56 * s);
  for (let i = 0; i <= 7; i++) {
    const x = cx - 36 * s + (i * 72 * s) / 7;
    ctx.lineTo(x, cy - 56 * s);
    ctx.lineTo(x + (72 * s) / 14, cy - 88 * s);
    ctx.lineTo(x + (72 * s) / 7, cy - 56 * s);
  }
  ctx.lineTo(cx + 36 * s, cy - 56 * s);
  ctx.lineTo(cx + 36 * s, cy - 52 * s);
  ctx.lineTo(cx - 36 * s, cy - 52 * s);
  ctx.closePath();
  ctx.fill();
  // Gems on each spike
  const gemColors = ['#ff3a2a', '#3a78ff', '#3aff5a', '#ffd870', '#b478ff', '#ff7adf', '#ff3a2a'];
  for (let i = 0; i < 7; i++) {
    const x = cx - 30 * s + i * 10 * s;
    ctx.fillStyle = gemColors[i];
    ctx.beginPath();
    ctx.arc(x, cy - 70 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Sceptre held in right hand
  ctx.fillStyle = '#ffd870';
  ctx.fillRect(cx + 60 * s, cy - 30 * s, 4 * s, 100 * s);
  // Sceptre top — winged sun
  glow(ctx, cx + 62 * s, cy - 40 * s, 22 * s, 'rgba(255, 220, 100, 0.7)');
  ctx.fillStyle = '#ffd870';
  ctx.beginPath();
  ctx.arc(cx + 62 * s, cy - 40 * s, 10 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff4c8';
  ctx.beginPath();
  ctx.arc(cx + 62 * s, cy - 40 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  // Floating runes orbiting overhead
  ctx.fillStyle = 'rgba(255, 220, 100, 0.85)';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 110 * s;
    const rx = cx + Math.cos(a) * r;
    const ry = cy - 30 * s + Math.sin(a) * r * 0.45;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(a);
    ctx.fillRect(-1, -7 * s, 2 * s, 14 * s);
    ctx.fillRect(-7 * s, -1, 14 * s, 2 * s);
    ctx.restore();
  }
}
