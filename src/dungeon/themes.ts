// =============================================================================
// Floor themes for Crypt Crawlers
// =============================================================================
//
// Each dungeon floor gets a distinct visual identity. We tune procedurally
// generated textures + lighting + fog by theme. Themes are also referenced
// from CSS overlays (combat scene gradients) when needed.

export interface FloorTheme {
  id: string;
  name: string;
  blurb: string;

  // Lighting & atmosphere
  bg: string; // canvas clear color (visible above the fog horizon)
  fog: string;
  fogNear: number;
  fogFar: number;
  ambient: { color: string; intensity: number };
  hemisphere: { sky: string; ground: string; intensity: number };
  torchColor: string;
  torchFlame: string;
  torchLightIntensity: number;

  // Wall / floor / ceiling textures (canvas-painted procedurally)
  wall: {
    base: string;
    mortar: string;
    accent: string; // sparse highlight color (mossy stone, gold trim, etc.)
    accentAlpha: number;
  };
  floor: {
    base: string;
    border: string;
    sparkleColor: string;
    sparkleAlpha: number;
  };
  ceiling: {
    base: string;
    grimeAlpha: number;
  };
}

export const FLOOR_THEMES: FloorTheme[] = [
  {
    id: 'catacomb',
    name: 'The Catacombs',
    blurb: 'Bone-strewn passages beneath the chapel.',
    bg: '#070409',
    fog: '#0a070d',
    fogNear: 3,
    fogFar: 16,
    ambient: { color: '#5a4258', intensity: 0.42 },
    hemisphere: { sky: '#a08868', ground: '#2a1820', intensity: 0.28 },
    torchColor: '#ffb56b',
    torchFlame: '#ffd07a',
    torchLightIntensity: 3.2,
    wall: { base: '#3a2a32', mortar: '#1a0f15', accent: '#000000', accentAlpha: 0.18 },
    floor: { base: '#2a1c20', border: '#15090c', sparkleColor: 'rgba(255,200,150,', sparkleAlpha: 0.05 },
    ceiling: { base: '#150a14', grimeAlpha: 0.4 },
  },
  {
    id: 'flooded-crypt',
    name: 'The Flooded Crypt',
    blurb: 'Where the river of souls leaks through the walls.',
    bg: '#040814',
    fog: '#091624',
    fogNear: 3,
    fogFar: 15,
    ambient: { color: '#3a5a78', intensity: 0.5 },
    hemisphere: { sky: '#6ea0c4', ground: '#102032', intensity: 0.35 },
    torchColor: '#9bd0ff',
    torchFlame: '#cfe9ff',
    torchLightIntensity: 3.0,
    wall: { base: '#243a48', mortar: '#0c1820', accent: '#2a5a6c', accentAlpha: 0.28 },
    floor: { base: '#1a2a36', border: '#06121c', sparkleColor: 'rgba(140, 220, 255,', sparkleAlpha: 0.09 },
    ceiling: { base: '#08121c', grimeAlpha: 0.32 },
  },
  {
    id: 'throne-hall',
    name: 'The Throne Hall',
    blurb: 'Vaulted halls of the vampire kings, drenched in dried blood.',
    bg: '#100406',
    fog: '#1c0408',
    fogNear: 4,
    fogFar: 18,
    ambient: { color: '#7a3438', intensity: 0.55 },
    hemisphere: { sky: '#e8b048', ground: '#3a0a12', intensity: 0.4 },
    torchColor: '#ffb86a',
    torchFlame: '#ffe09c',
    torchLightIntensity: 3.8,
    wall: { base: '#4a1820', mortar: '#1a0408', accent: '#c4922b', accentAlpha: 0.32 },
    floor: { base: '#2a0a10', border: '#160406', sparkleColor: 'rgba(232, 196, 108,', sparkleAlpha: 0.1 },
    ceiling: { base: '#1a0408', grimeAlpha: 0.36 },
  },
];

export function getFloorTheme(floor: number): FloorTheme {
  // Floors are 1-indexed; clamp into our theme array
  const idx = Math.max(0, Math.min(FLOOR_THEMES.length - 1, floor - 1));
  return FLOOR_THEMES[idx];
}
