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
  {
    id: 'forsaken-library',
    name: 'The Forsaken Library',
    blurb: 'Dust-choked stacks where every page hums with forbidden script.',
    bg: '#0e0a04',
    fog: '#1a1408',
    fogNear: 3,
    fogFar: 14,
    ambient: { color: '#7a6238', intensity: 0.5 },
    hemisphere: { sky: '#c4a058', ground: '#2a1a0a', intensity: 0.32 },
    torchColor: '#ffd06a',
    torchFlame: '#fff0a8',
    torchLightIntensity: 3.4,
    wall: { base: '#3a2818', mortar: '#1a0e06', accent: '#7a5a18', accentAlpha: 0.34 },
    floor: { base: '#2a1c10', border: '#150a06', sparkleColor: 'rgba(255, 220, 140,', sparkleAlpha: 0.09 },
    ceiling: { base: '#1a1004', grimeAlpha: 0.38 },
  },
  {
    id: 'mushroom-grotto',
    name: 'The Mushroom Grotto',
    blurb: 'Luminescent fungi pulse softly beneath dripping limestone.',
    bg: '#040c08',
    fog: '#0a1810',
    fogNear: 3,
    fogFar: 17,
    ambient: { color: '#3a7a4a', intensity: 0.55 },
    hemisphere: { sky: '#6affa0', ground: '#0a1810', intensity: 0.38 },
    torchColor: '#7affb8',
    torchFlame: '#cfffe4',
    torchLightIntensity: 3.0,
    wall: { base: '#1c382a', mortar: '#0a1810', accent: '#5aff90', accentAlpha: 0.24 },
    floor: { base: '#0e2418', border: '#04100a', sparkleColor: 'rgba(140, 255, 180,', sparkleAlpha: 0.12 },
    ceiling: { base: '#04140a', grimeAlpha: 0.3 },
  },
  {
    id: 'iron-foundry',
    name: 'The Iron Foundry',
    blurb: 'Rust-bled walls glow with the heat of forges long abandoned.',
    bg: '#100604',
    fog: '#1c0a04',
    fogNear: 3,
    fogFar: 15,
    ambient: { color: '#a04a18', intensity: 0.58 },
    hemisphere: { sky: '#ff7a2a', ground: '#1a0604', intensity: 0.4 },
    torchColor: '#ff7a2a',
    torchFlame: '#ffd06a',
    torchLightIntensity: 4.0,
    wall: { base: '#3a1810', mortar: '#0e0604', accent: '#ff4a18', accentAlpha: 0.36 },
    floor: { base: '#240c08', border: '#100404', sparkleColor: 'rgba(255, 120, 40,', sparkleAlpha: 0.14 },
    ceiling: { base: '#160604', grimeAlpha: 0.42 },
  },
  {
    id: 'frostbitten-mausoleum',
    name: 'The Frostbitten Mausoleum',
    blurb: 'Hoarfrost cakes every coffin; your breath crystallises in the air.',
    bg: '#08101c',
    fog: '#1a2a3a',
    fogNear: 4,
    fogFar: 20,
    ambient: { color: '#6a98c4', intensity: 0.58 },
    hemisphere: { sky: '#dceefa', ground: '#1a2a3a', intensity: 0.45 },
    torchColor: '#a8d8ff',
    torchFlame: '#e8f8ff',
    torchLightIntensity: 3.2,
    wall: { base: '#384858', mortar: '#0e1620', accent: '#c8e0f0', accentAlpha: 0.32 },
    floor: { base: '#1c2a38', border: '#08111c', sparkleColor: 'rgba(220, 240, 255,', sparkleAlpha: 0.15 },
    ceiling: { base: '#0c1828', grimeAlpha: 0.28 },
  },
  {
    id: 'obsidian-sanctum',
    name: 'The Obsidian Sanctum',
    blurb: 'Volcanic glass shimmers; molten veins crawl through the floor.',
    bg: '#08040a',
    fog: '#180610',
    fogNear: 3,
    fogFar: 14,
    ambient: { color: '#aa2a3a', intensity: 0.5 },
    hemisphere: { sky: '#ff3a2a', ground: '#080408', intensity: 0.42 },
    torchColor: '#ff4a3a',
    torchFlame: '#ffa07a',
    torchLightIntensity: 3.8,
    wall: { base: '#1a0a14', mortar: '#04020a', accent: '#ff3a2a', accentAlpha: 0.38 },
    floor: { base: '#100814', border: '#04020a', sparkleColor: 'rgba(255, 80, 40,', sparkleAlpha: 0.16 },
    ceiling: { base: '#060208', grimeAlpha: 0.44 },
  },
  {
    id: 'astral-plane',
    name: 'The Astral Plane',
    blurb: 'Stars hang like lanterns in halls that fold in on themselves.',
    bg: '#04041a',
    fog: '#0a0a24',
    fogNear: 4,
    fogFar: 22,
    ambient: { color: '#7060c4', intensity: 0.62 },
    hemisphere: { sky: '#a890ff', ground: '#0e0a2a', intensity: 0.5 },
    torchColor: '#b48cff',
    torchFlame: '#e8d6ff',
    torchLightIntensity: 3.6,
    wall: { base: '#1e1a3a', mortar: '#08061a', accent: '#9a78ff', accentAlpha: 0.42 },
    floor: { base: '#100c2a', border: '#04031a', sparkleColor: 'rgba(180, 150, 255,', sparkleAlpha: 0.2 },
    ceiling: { base: '#08081e', grimeAlpha: 0.24 },
  },
  {
    id: 'throne-of-eternity',
    name: 'The Throne of Eternity',
    blurb: 'Where time itself kneels. The last halls before silence.',
    bg: '#100a04',
    fog: '#1c1408',
    fogNear: 5,
    fogFar: 24,
    ambient: { color: '#c4922b', intensity: 0.7 },
    hemisphere: { sky: '#ffea9a', ground: '#3a2418', intensity: 0.55 },
    torchColor: '#ffd870',
    torchFlame: '#fff4c8',
    torchLightIntensity: 4.4,
    wall: { base: '#4a3a18', mortar: '#1a1208', accent: '#ffd870', accentAlpha: 0.48 },
    floor: { base: '#2c1f0a', border: '#100a04', sparkleColor: 'rgba(255, 220, 120,', sparkleAlpha: 0.22 },
    ceiling: { base: '#1a1208', grimeAlpha: 0.3 },
  },
];

export function getFloorTheme(floor: number): FloorTheme {
  // Floors are 1-indexed; clamp into our theme array
  const idx = Math.max(0, Math.min(FLOOR_THEMES.length - 1, floor - 1));
  return FLOOR_THEMES[idx];
}
