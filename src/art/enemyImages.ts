// =============================================================================
// Painted enemy portraits (real artwork)
// =============================================================================
//
// When a real image is available for an enemy, prefer it over the procedural
// canvas portrait. Bosses and crawlers still fall back to canvas painters in
// `portraits.ts`.
//
// Vite imports below are hashed at build time and emitted as real asset URLs,
// so they work identically in dev and production.

// Base & mid-tier enemies
import batUrl from '@/assets/enemies/bat.png';
import giantRatUrl from '@/assets/enemies/giantRat.png';
import skeletonUrl from '@/assets/enemies/skeleton.png';
import ghoulUrl from '@/assets/enemies/ghoul.png';
import zombieUrl from '@/assets/enemies/zombie.png';
import cultistUrl from '@/assets/enemies/cultist.png';
import direWolfUrl from '@/assets/enemies/direWolf.png';
import wraithUrl from '@/assets/enemies/wraith.png';
import gargoyleUrl from '@/assets/enemies/gargoyle.png';
import revenantUrl from '@/assets/enemies/revenant.png';

// Bosses
import vampireLordUrl from '@/assets/enemies/vampireLord.png';
import necromancerUrl from '@/assets/enemies/necromancer.png';
import ancientLichUrl from '@/assets/enemies/ancientLich.png';
import boundTomeUrl from '@/assets/enemies/boundTome.png';
import sporeMotherUrl from '@/assets/enemies/sporeMother.png';
import ironTyrantUrl from '@/assets/enemies/ironTyrant.png';
import frostWyrmUrl from '@/assets/enemies/frostWyrm.png';
import obsidianMawUrl from '@/assets/enemies/obsidianMaw.png';
import astralWardenUrl from '@/assets/enemies/astralWarden.png';
import eternityKingUrl from '@/assets/enemies/eternityKing.png';

/** Map of enemy id -> asset URL (hashed in production). */
export const ENEMY_IMAGE_URLS: Record<string, string> = {
  bat: batUrl,
  giantRat: giantRatUrl,
  skeleton: skeletonUrl,
  ghoul: ghoulUrl,
  zombie: zombieUrl,
  cultist: cultistUrl,
  direWolf: direWolfUrl,
  wraith: wraithUrl,
  gargoyle: gargoyleUrl,
  revenant: revenantUrl,
  vampireLord: vampireLordUrl,
  necromancer: necromancerUrl,
  ancientLich: ancientLichUrl,
  boundTome: boundTomeUrl,
  sporeMother: sporeMotherUrl,
  ironTyrant: ironTyrantUrl,
  frostWyrm: frostWyrmUrl,
  obsidianMaw: obsidianMawUrl,
  astralWarden: astralWardenUrl,
  eternityKing: eternityKingUrl,
};

/** Preloaded `<img>` elements so we can synchronously `drawImage` them
 *  onto canvas textures (e.g. the in-3D enemy preview card). */
const IMAGE_ELEMENTS = new Map<string, HTMLImageElement>();

/** Callbacks waiting on an image to finish loading. */
const PENDING_CALLBACKS = new Map<string, Array<(img: HTMLImageElement) => void>>();

// Kick off preloading immediately when this module is imported.
for (const [id, url] of Object.entries(ENEMY_IMAGE_URLS)) {
  const img = new Image();
  img.src = url;
  IMAGE_ELEMENTS.set(id, img);
  img.onload = () => {
    const cbs = PENDING_CALLBACKS.get(id);
    if (cbs) {
      for (const cb of cbs) cb(img);
      PENDING_CALLBACKS.delete(id);
    }
  };
}

/** Returns the image element for an enemy id, or undefined if not provided. */
export function getEnemyImage(id: string): HTMLImageElement | undefined {
  return IMAGE_ELEMENTS.get(id);
}

/** Returns true if a real artwork is registered for this enemy. */
export function hasEnemyImage(id: string): boolean {
  return IMAGE_ELEMENTS.has(id);
}

/**
 * Subscribe to image load. If already loaded, callback fires next tick.
 * Useful when a canvas-texture composition needs to refresh once the
 * artwork lands.
 */
export function onEnemyImageLoad(id: string, cb: (img: HTMLImageElement) => void): void {
  const img = IMAGE_ELEMENTS.get(id);
  if (!img) return;
  if (img.complete && img.naturalWidth > 0) {
    queueMicrotask(() => cb(img));
    return;
  }
  let arr = PENDING_CALLBACKS.get(id);
  if (!arr) {
    arr = [];
    PENDING_CALLBACKS.set(id, arr);
  }
  arr.push(cb);
}
