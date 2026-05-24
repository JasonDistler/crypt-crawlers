import type { EnemyDef } from '@/types';

export const ENEMIES: Record<string, EnemyDef> = {
  bat: {
    id: 'bat',
    name: 'Bat',
    maxHp: 14,
    xpReward: 6,
    goldReward: [4, 8],
    sprite: '🦇',
    tint: '#7a4a8c',
    intents: [
      { kind: 'attack', damage: 5, description: 'Bite for 5' },
      { kind: 'attack', damage: 3, description: 'Quick bite for 3' },
    ],
  },
  skeleton: {
    id: 'skeleton',
    name: 'Skeleton',
    maxHp: 22,
    xpReward: 10,
    goldReward: [6, 12],
    sprite: '💀',
    tint: '#c9c2a8',
    intents: [
      { kind: 'attack', damage: 6, description: 'Bone slash for 6' },
      { kind: 'defend', block: 5, description: 'Rattles bones (+5 block)' },
      { kind: 'attack', damage: 8, description: 'Cleave for 8' },
    ],
  },
  ghoul: {
    id: 'ghoul',
    name: 'Ghoul',
    maxHp: 28,
    xpReward: 12,
    goldReward: [8, 14],
    sprite: '🧟',
    tint: '#6e8a4e',
    intents: [
      { kind: 'attack', damage: 4, description: 'Claw (4) + Bleed' },
      { kind: 'status', applyStatus: { kind: 'bleed', amount: 2, target: 'player' }, description: 'Apply 2 Bleed' },
      { kind: 'attack', damage: 9, description: 'Lunge for 9' },
    ],
  },
  zombie: {
    id: 'zombie',
    name: 'Zombie',
    maxHp: 32,
    xpReward: 11,
    goldReward: [6, 10],
    sprite: '🧟‍♂️',
    tint: '#5a7a5a',
    intents: [
      { kind: 'attack', damage: 7, description: 'Bite for 7' },
      { kind: 'attack', damage: 7, description: 'Bite for 7' },
      { kind: 'defend', block: 6, description: 'Hardens flesh (+6 block)' },
    ],
  },
  cultist: {
    id: 'cultist',
    name: 'Cultist',
    maxHp: 26,
    xpReward: 14,
    goldReward: [10, 16],
    sprite: '🧙',
    tint: '#883a83',
    intents: [
      { kind: 'buff', applyStatus: { kind: 'bleed', amount: 1, target: 'player' }, description: 'Hex (+1 Bleed)' },
      { kind: 'attack', damage: 10, description: 'Dark bolt for 10' },
      { kind: 'attack', damage: 4, description: 'Curse for 4' },
    ],
  },
  giantRat: {
    id: 'giantRat',
    name: 'Giant Rat',
    maxHp: 18,
    xpReward: 8,
    goldReward: [4, 10],
    sprite: '🐀',
    tint: '#7a6450',
    intents: [
      { kind: 'attack', damage: 6, description: 'Bite for 6' },
      { kind: 'attack', damage: 3, description: 'Scratch for 3' },
    ],
  },
  // ---------- Mid-tier enemies (floors 4+) ----------
  wraith: {
    id: 'wraith',
    name: 'Wraith',
    maxHp: 30,
    xpReward: 18,
    goldReward: [10, 18],
    sprite: '👻',
    tint: '#5a4a8c',
    intents: [
      { kind: 'attack', damage: 9, description: 'Soul drain for 9' },
      { kind: 'status', applyStatus: { kind: 'manaDrain', amount: 1, target: 'player' }, description: 'Drain 1 mana' },
      { kind: 'attack', damage: 6, description: 'Spectral touch for 6' },
    ],
  },
  gargoyle: {
    id: 'gargoyle',
    name: 'Gargoyle',
    maxHp: 38,
    xpReward: 20,
    goldReward: [12, 22],
    sprite: '🗿',
    tint: '#5a5a5a',
    intents: [
      { kind: 'defend', block: 10, description: 'Stone skin (+10 block)' },
      { kind: 'attack', damage: 11, description: 'Talon swipe for 11' },
      { kind: 'attack', damage: 7, description: 'Stone bite for 7' },
    ],
  },
  direWolf: {
    id: 'direWolf',
    name: 'Dire Wolf',
    maxHp: 26,
    xpReward: 16,
    goldReward: [8, 16],
    sprite: '🐺',
    tint: '#3a3a4a',
    intents: [
      { kind: 'attack', damage: 12, description: 'Lunging bite for 12' },
      { kind: 'attack', damage: 6, description: 'Snarl & nip for 6' },
      { kind: 'buff', applyStatus: { kind: 'bleed', amount: 2, target: 'player' }, description: 'Open wound (+2 Bleed)' },
    ],
  },
  revenant: {
    id: 'revenant',
    name: 'Revenant',
    maxHp: 44,
    xpReward: 24,
    goldReward: [16, 28],
    sprite: '⚔',
    tint: '#4a382a',
    intents: [
      { kind: 'attack', damage: 13, description: 'Rusted blade for 13' },
      { kind: 'defend', block: 8, description: 'Battered shield (+8 block)' },
      { kind: 'attack', damage: 9, description: 'Vengeful strike for 9' },
      { kind: 'buff', applyStatus: { kind: 'bleed', amount: 3, target: 'player' }, description: 'Death-curse (+3 Bleed)' },
    ],
  },

  // ---------- Bosses ----------
  vampireLord: {
    id: 'vampireLord',
    name: 'Vampire Lord',
    maxHp: 90,
    isBoss: true,
    xpReward: 60,
    goldReward: [40, 60],
    sprite: '🧛',
    tint: '#9a1f3d',
    intents: [
      { kind: 'attack', damage: 12, description: 'Fang strike for 12' },
      { kind: 'status', applyStatus: { kind: 'bleed', amount: 3, target: 'player' }, description: 'Inflict 3 Bleed' },
      { kind: 'attack', damage: 8, description: 'Mist slash for 8' },
      { kind: 'defend', block: 12, description: 'Bat swarm (+12 block)' },
    ],
  },
  necromancer: {
    id: 'necromancer',
    name: 'Necromancer',
    maxHp: 110,
    isBoss: true,
    xpReward: 80,
    goldReward: [50, 75],
    sprite: '☠️',
    tint: '#3a6a4a',
    intents: [
      { kind: 'attack', damage: 14, description: 'Soul lance for 14' },
      { kind: 'status', applyStatus: { kind: 'burn', amount: 4, target: 'player' }, description: 'Apply 4 Burn' },
      { kind: 'attack', damage: 10, description: 'Death touch for 10' },
      { kind: 'attack', damage: 6, description: 'Bone wave for 6' },
      { kind: 'defend', block: 15, description: 'Phylactery shield (+15)' },
    ],
  },
  ancientLich: {
    id: 'ancientLich',
    name: 'Ancient Lich',
    maxHp: 150,
    isBoss: true,
    xpReward: 120,
    goldReward: [80, 120],
    sprite: '👑',
    tint: '#c4a23f',
    intents: [
      { kind: 'attack', damage: 18, description: 'Astral blast for 18' },
      { kind: 'status', applyStatus: { kind: 'bleed', amount: 4, target: 'player' }, description: 'Apply 4 Bleed' },
      { kind: 'attack', damage: 12, description: 'Wraithfire for 12' },
      { kind: 'status', applyStatus: { kind: 'burn', amount: 5, target: 'player' }, description: 'Apply 5 Burn' },
      { kind: 'attack', damage: 22, description: 'Apocalypse for 22' },
    ],
  },
  boundTome: {
    id: 'boundTome',
    name: 'The Bound Tome',
    maxHp: 180,
    isBoss: true,
    xpReward: 150,
    goldReward: [100, 140],
    sprite: '📕',
    tint: '#7a5018',
    intents: [
      { kind: 'attack', damage: 14, description: 'Inkstrike for 14' },
      { kind: 'status', applyStatus: { kind: 'burn', amount: 4, target: 'player' }, description: 'Smouldering glyph (+4 Burn)' },
      { kind: 'attack', damage: 10, description: 'Forbidden word for 10' },
      { kind: 'defend', block: 18, description: 'Bookbinding (+18 block)' },
      { kind: 'attack', damage: 20, description: 'Forbidden chapter for 20' },
    ],
  },
  sporeMother: {
    id: 'sporeMother',
    name: 'The Spore Mother',
    maxHp: 210,
    isBoss: true,
    xpReward: 180,
    goldReward: [120, 160],
    sprite: '🍄',
    tint: '#3a7a4a',
    intents: [
      { kind: 'attack', damage: 12, description: 'Spore burst for 12' },
      { kind: 'status', applyStatus: { kind: 'bleed', amount: 5, target: 'player' }, description: 'Mycelial rot (+5 Bleed)' },
      { kind: 'status', applyStatus: { kind: 'manaDrain', amount: 2, target: 'player' }, description: 'Soporific spores (-2 mana)' },
      { kind: 'attack', damage: 16, description: 'Grasping vines for 16' },
      { kind: 'defend', block: 20, description: 'Mycelium shroud (+20 block)' },
    ],
  },
  ironTyrant: {
    id: 'ironTyrant',
    name: 'The Iron Tyrant',
    maxHp: 240,
    isBoss: true,
    xpReward: 210,
    goldReward: [140, 200],
    sprite: '⚙',
    tint: '#aa4818',
    intents: [
      { kind: 'attack', damage: 22, description: 'Forge hammer for 22' },
      { kind: 'defend', block: 24, description: 'Iron plating (+24 block)' },
      { kind: 'status', applyStatus: { kind: 'burn', amount: 6, target: 'player' }, description: 'Molten splash (+6 Burn)' },
      { kind: 'attack', damage: 14, description: 'Piston jab for 14' },
      { kind: 'attack', damage: 28, description: 'Steamroll for 28' },
    ],
  },
  frostWyrm: {
    id: 'frostWyrm',
    name: 'The Frost Wyrm',
    maxHp: 280,
    isBoss: true,
    xpReward: 260,
    goldReward: [180, 240],
    sprite: '🐉',
    tint: '#5a98c4',
    intents: [
      { kind: 'attack', damage: 26, description: 'Glacial breath for 26' },
      { kind: 'status', applyStatus: { kind: 'manaDrain', amount: 2, target: 'player' }, description: 'Numbing chill (-2 mana)' },
      { kind: 'defend', block: 22, description: 'Icy scales (+22 block)' },
      { kind: 'attack', damage: 18, description: 'Tail slam for 18' },
      { kind: 'status', applyStatus: { kind: 'bleed', amount: 6, target: 'player' }, description: 'Frost shards (+6 Bleed)' },
      { kind: 'attack', damage: 32, description: 'Avalanche for 32' },
    ],
  },
  obsidianMaw: {
    id: 'obsidianMaw',
    name: 'The Obsidian Maw',
    maxHp: 320,
    isBoss: true,
    xpReward: 300,
    goldReward: [220, 280],
    sprite: '🌋',
    tint: '#aa2a3a',
    intents: [
      { kind: 'attack', damage: 30, description: 'Magma surge for 30' },
      { kind: 'status', applyStatus: { kind: 'burn', amount: 8, target: 'player' }, description: 'Volcanic ash (+8 Burn)' },
      { kind: 'attack', damage: 20, description: 'Obsidian shard for 20' },
      { kind: 'attack', damage: 14, description: 'Sulphur cloud for 14' },
      { kind: 'defend', block: 28, description: 'Black glass shell (+28 block)' },
      { kind: 'attack', damage: 36, description: 'Eruption for 36' },
    ],
  },
  astralWarden: {
    id: 'astralWarden',
    name: 'The Astral Warden',
    maxHp: 380,
    isBoss: true,
    xpReward: 360,
    goldReward: [260, 340],
    sprite: '✨',
    tint: '#9a78ff',
    intents: [
      { kind: 'attack', damage: 32, description: 'Starfall for 32' },
      { kind: 'status', applyStatus: { kind: 'manaDrain', amount: 3, target: 'player' }, description: 'Mind eclipse (-3 mana)' },
      { kind: 'attack', damage: 22, description: 'Reality tear for 22' },
      { kind: 'status', applyStatus: { kind: 'bleed', amount: 8, target: 'player' }, description: 'Astral wound (+8 Bleed)' },
      { kind: 'status', applyStatus: { kind: 'burn', amount: 8, target: 'player' }, description: 'Solar flare (+8 Burn)' },
      { kind: 'defend', block: 30, description: 'Veil of stars (+30 block)' },
      { kind: 'attack', damage: 40, description: 'Cosmic judgment for 40' },
    ],
  },
  eternityKing: {
    id: 'eternityKing',
    name: 'The Eternity King',
    maxHp: 450,
    isBoss: true,
    xpReward: 500,
    goldReward: [400, 500],
    sprite: '👑',
    tint: '#ffd870',
    intents: [
      { kind: 'attack', damage: 40, description: 'Sceptre of ages for 40' },
      { kind: 'status', applyStatus: { kind: 'bleed', amount: 10, target: 'player' }, description: 'Wound of ages (+10 Bleed)' },
      { kind: 'attack', damage: 28, description: 'Time-stop strike for 28' },
      { kind: 'status', applyStatus: { kind: 'burn', amount: 10, target: 'player' }, description: 'Sunfire crown (+10 Burn)' },
      { kind: 'defend', block: 40, description: 'Eternal regalia (+40 block)' },
      { kind: 'status', applyStatus: { kind: 'manaDrain', amount: 4, target: 'player' }, description: 'Steal mana (-4)' },
      { kind: 'attack', damage: 50, description: 'End of all things for 50' },
    ],
  },
};

export function getEnemy(id: string): EnemyDef {
  const e = ENEMIES[id];
  if (!e) throw new Error(`Unknown enemy id: ${id}`);
  return e;
}

/** Curated encounters by floor depth. Each encounter is a list of enemy ids. */
export const ENCOUNTERS_BY_FLOOR: Record<number, string[][]> = {
  1: [
    ['bat'],
    ['bat', 'bat'],
    ['giantRat'],
    ['skeleton'],
    ['bat', 'giantRat'],
  ],
  2: [
    ['skeleton', 'bat'],
    ['ghoul'],
    ['zombie'],
    ['skeleton', 'skeleton'],
    ['giantRat', 'giantRat', 'bat'],
  ],
  3: [
    ['cultist'],
    ['ghoul', 'skeleton'],
    ['zombie', 'bat', 'bat'],
    ['cultist', 'skeleton'],
  ],
  4: [
    ['wraith'],
    ['cultist', 'cultist'],
    ['ghoul', 'ghoul'],
    ['zombie', 'cultist'],
    ['wraith', 'bat'],
  ],
  5: [
    ['gargoyle'],
    ['wraith', 'cultist'],
    ['ghoul', 'ghoul', 'bat'],
    ['direWolf'],
    ['direWolf', 'zombie'],
  ],
  6: [
    ['gargoyle', 'cultist'],
    ['revenant'],
    ['wraith', 'wraith'],
    ['direWolf', 'direWolf'],
    ['gargoyle', 'zombie'],
  ],
  7: [
    ['revenant', 'wraith'],
    ['gargoyle', 'gargoyle'],
    ['direWolf', 'wraith', 'bat'],
    ['revenant', 'cultist'],
    ['gargoyle', 'cultist', 'cultist'],
  ],
  8: [
    ['revenant', 'gargoyle'],
    ['wraith', 'wraith', 'cultist'],
    ['direWolf', 'revenant'],
    ['gargoyle', 'gargoyle', 'wraith'],
  ],
  9: [
    ['revenant', 'revenant'],
    ['wraith', 'wraith', 'wraith'],
    ['gargoyle', 'revenant', 'cultist'],
    ['direWolf', 'direWolf', 'gargoyle'],
  ],
  10: [
    ['revenant', 'revenant', 'wraith'],
    ['gargoyle', 'gargoyle', 'revenant'],
    ['direWolf', 'revenant', 'wraith'],
    ['revenant', 'gargoyle', 'wraith'],
  ],
};

export const BOSSES_BY_FLOOR: Record<number, string> = {
  1: 'vampireLord',
  2: 'necromancer',
  3: 'ancientLich',
  4: 'boundTome',
  5: 'sporeMother',
  6: 'ironTyrant',
  7: 'frostWyrm',
  8: 'obsidianMaw',
  9: 'astralWarden',
  10: 'eternityKing',
};

/**
 * Elites are denser/tougher than regular encounters. They pull from the same
 * enemy roster but mix in heavier groups and tend to use enemies that would
 * normally appear one floor later.
 */
export const ELITES_BY_FLOOR: Record<number, string[][]> = {
  1: [
    ['skeleton', 'skeleton'],
    ['ghoul'],
    ['bat', 'bat', 'giantRat'],
  ],
  2: [
    ['cultist', 'bat'],
    ['zombie', 'skeleton'],
    ['ghoul', 'giantRat', 'giantRat'],
  ],
  3: [
    ['cultist', 'cultist'],
    ['zombie', 'zombie', 'ghoul'],
    ['ghoul', 'ghoul', 'skeleton'],
  ],
  4: [
    ['wraith', 'cultist'],
    ['ghoul', 'ghoul', 'cultist'],
    ['cultist', 'cultist', 'bat'],
  ],
  5: [
    ['gargoyle', 'cultist'],
    ['wraith', 'wraith'],
    ['ghoul', 'ghoul', 'ghoul'],
  ],
  6: [
    ['revenant'],
    ['gargoyle', 'wraith'],
    ['direWolf', 'direWolf', 'wraith'],
  ],
  7: [
    ['revenant', 'wraith'],
    ['gargoyle', 'gargoyle', 'cultist'],
    ['direWolf', 'revenant'],
  ],
  8: [
    ['revenant', 'gargoyle'],
    ['wraith', 'wraith', 'wraith'],
    ['revenant', 'direWolf', 'wraith'],
  ],
  9: [
    ['revenant', 'revenant'],
    ['gargoyle', 'gargoyle', 'gargoyle'],
    ['revenant', 'wraith', 'wraith'],
  ],
  10: [
    ['revenant', 'revenant', 'gargoyle'],
    ['revenant', 'revenant', 'wraith'],
    ['gargoyle', 'revenant', 'direWolf'],
  ],
};

/** Highest floor index covered by the tables above. */
export const MAX_FLOOR = 10;

export function pickEncounter(floor: number, rng: () => number): string[] {
  const pool = ENCOUNTERS_BY_FLOOR[floor] ?? ENCOUNTERS_BY_FLOOR[MAX_FLOOR];
  return pool[Math.floor(rng() * pool.length)];
}

export function pickElite(floor: number, rng: () => number): string[] {
  const pool = ELITES_BY_FLOOR[floor] ?? ELITES_BY_FLOOR[MAX_FLOOR];
  return pool[Math.floor(rng() * pool.length)];
}

export function bossForFloor(floor: number): string {
  return BOSSES_BY_FLOOR[floor] ?? BOSSES_BY_FLOOR[MAX_FLOOR];
}
