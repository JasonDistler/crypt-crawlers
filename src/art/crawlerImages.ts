// =============================================================================
// Painted crawler portraits (real artwork)
// =============================================================================
//
// When a real image is registered for a crawler, prefer it over the procedural
// `paint___` canvas painter in `portraits.ts`. Unregistered crawlers (or any
// future addition before its art lands) keep falling back to the procedural
// portrait.
//
// Vite imports below are hashed at build time and emitted as real asset URLs,
// so they work identically in dev and production.

import antonioUrl from '@/assets/crawlers/antonio.png';
import imeldaUrl from '@/assets/crawlers/imelda.png';
import pasqualinaUrl from '@/assets/crawlers/pasqualina.png';
import gennaroUrl from '@/assets/crawlers/gennaro.png';

/** Map of crawler id -> asset URL (hashed in production). */
export const CRAWLER_IMAGE_URLS: Record<string, string> = {
  antonio: antonioUrl,
  imelda: imeldaUrl,
  pasqualina: pasqualinaUrl,
  gennaro: gennaroUrl,
};

/**
 * Per-crawler CSS `object-position` value for the portrait `<img>`.
 *
 * The source paintings are 16:9 landscape but the portrait box on the
 * character-select screen is closer to square/portrait, so cover-fit has to
 * crop horizontally. A small per-image x-bias keeps each character's face in
 * frame instead of relying on plain center cropping.
 */
export const CRAWLER_PORTRAIT_FOCUS: Record<string, string> = {
  // Knight is roughly centered in his painting; nudge upward to favor face.
  antonio: '50% 20%',
  // Witch is centered horizontally; her face sits in the upper third.
  imelda: '50% 20%',
  // Priestess is on the LEFT side of her painting (chapel scene fills right).
  pasqualina: '32% 22%',
  // Gennaro is on the RIGHT side of his painting (graveyard fills left).
  gennaro: '72% 28%',
};

/** Preloaded `<img>` elements so callers can synchronously inspect them. */
const IMAGE_ELEMENTS = new Map<string, HTMLImageElement>();
const PENDING_CALLBACKS = new Map<string, Array<(img: HTMLImageElement) => void>>();

for (const [id, url] of Object.entries(CRAWLER_IMAGE_URLS)) {
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

/** Returns the preloaded image element for a crawler id, or undefined. */
export function getCrawlerImage(id: string): HTMLImageElement | undefined {
  return IMAGE_ELEMENTS.get(id);
}

/** Returns true if a real artwork is registered for this crawler. */
export function hasCrawlerImage(id: string): boolean {
  return IMAGE_ELEMENTS.has(id);
}
