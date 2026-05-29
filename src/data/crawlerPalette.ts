// =============================================================================
// Per-crawler color palette
// =============================================================================
//
// Each crawler has a signature color triad that shows up in their portrait
// frame, the dungeon banners they trigger, and accent glows on UI surfaces
// tied to them. The values are chosen to harmonize with each character's
// painted artwork:
//
//   antonio    — steel-blue plate (knight)
//   imelda     — arcane violet (witch)
//   pasqualina — holy gold-cream (priestess)
//   gennaro    — blood-red leather (vampire hunter)
//
// `glow` is the rgba color used for box-shadow halos; `accentText` is a
// CSS color tuned for legible text laid over a dark background (used for
// titles in banners).

export interface CrawlerPalette {
  primary: string;
  secondary: string;
  glow: string;
  accentText: string;
  /** hex used in canvas painters (no alpha) */
  flashHex: string;
}

const FALLBACK: CrawlerPalette = {
  primary: '#c4922b',
  secondary: '#ffce6c',
  glow: 'rgba(232, 196, 108, 0.55)',
  accentText: '#f3e9d2',
  flashHex: '#ffce6c',
};

export const CRAWLER_PALETTES: Record<string, CrawlerPalette> = {
  antonio: {
    primary: '#5a8ad8',
    secondary: '#a8d0ff',
    glow: 'rgba(110, 168, 255, 0.55)',
    accentText: '#e0eaff',
    flashHex: '#a8d0ff',
  },
  imelda: {
    primary: '#a070ff',
    secondary: '#d8b8ff',
    glow: 'rgba(176, 112, 255, 0.6)',
    accentText: '#f0e0ff',
    flashHex: '#c4a8ff',
  },
  pasqualina: {
    primary: '#e8c46c',
    secondary: '#fff0c8',
    glow: 'rgba(255, 220, 140, 0.6)',
    accentText: '#fff4d8',
    flashHex: '#ffe69c',
  },
  gennaro: {
    primary: '#c63b3b',
    secondary: '#ff8060',
    glow: 'rgba(220, 60, 60, 0.6)',
    accentText: '#ffd2c4',
    flashHex: '#ff5454',
  },
};

export function getCrawlerPalette(id: string | null | undefined): CrawlerPalette {
  if (!id) return FALLBACK;
  return CRAWLER_PALETTES[id] ?? FALLBACK;
}
