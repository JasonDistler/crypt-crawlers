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
};

export const BOSSES_BY_FLOOR: Record<number, string> = {
  1: 'vampireLord',
  2: 'necromancer',
  3: 'ancientLich',
};

/**
 * Elites are denser/tougher than regular encounters. They pull from the same
 * enemy roster but mix in heavier groups and use enemies that would normally
 * appear one floor later (so floor-1 elites use floor-2 enemies, etc.).
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
};

export function pickEncounter(floor: number, rng: () => number): string[] {
  const pool = ENCOUNTERS_BY_FLOOR[floor] ?? ENCOUNTERS_BY_FLOOR[3];
  return pool[Math.floor(rng() * pool.length)];
}

export function pickElite(floor: number, rng: () => number): string[] {
  const pool = ELITES_BY_FLOOR[floor] ?? ELITES_BY_FLOOR[3];
  return pool[Math.floor(rng() * pool.length)];
}

export function bossForFloor(floor: number): string {
  return BOSSES_BY_FLOOR[floor] ?? BOSSES_BY_FLOOR[3];
}
