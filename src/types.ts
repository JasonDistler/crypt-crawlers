// =============================================================================
// Shared domain types for Crypt Crawlers
// =============================================================================

// ---------- Cards & effects ----------

export type CardType =
  | 'attack'
  | 'defend'
  | 'draw'
  | 'buff'
  | 'heal'
  | 'item';

export type StatusKind = 'bleed' | 'burn' | 'shield' | 'strength' | 'manaDrain';

export interface CardEffect {
  damage?: number;
  block?: number;
  heal?: number;
  draw?: number;
  manaGain?: number;
  applyStatus?: { kind: StatusKind; amount: number; target: 'self' | 'enemy' | 'all' }[];
  hits?: number;
  aoe?: boolean;
  gold?: number;
}

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  type: CardType;
  isWild?: boolean;
  effect: CardEffect;
  description: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'legendary';
  evolvesTo?: string;
  flavor?: string;
}

export interface CardInstance {
  uid: string;
  defId: string;
  // Permanent buffs applied via gems / evolution
  bonusDamage?: number;
  bonusBlock?: number;
}

// ---------- Enemies ----------

export type EnemyIntentKind = 'attack' | 'defend' | 'buff' | 'status';

export interface EnemyIntent {
  kind: EnemyIntentKind;
  damage?: number;
  block?: number;
  applyStatus?: { kind: StatusKind; amount: number; target: 'player' | 'self' };
  description: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  maxHp: number;
  isBoss?: boolean;
  // Cycle of intents. Each turn enemy uses intents[turn % intents.length]
  intents: EnemyIntent[];
  xpReward: number;
  goldReward: [number, number]; // min, max
  sprite?: string; // emoji or simple icon
  tint?: string;
}

export interface EnemyInstance {
  uid: string;
  defId: string;
  hp: number;
  maxHp: number;
  statuses: Partial<Record<StatusKind, number>>;
  intentIndex: number;
}

// ---------- Crawlers (player characters) ----------

export interface CrawlerDef {
  id: string;
  name: string;
  description: string;
  passive: string;
  maxHp: number;
  startingMana: number;
  startingHandSize: number;
  starterDeck: string[]; // CardDef ids
  unlocked?: boolean; // default; meta store can override
  unlockXp?: number;
}

// ---------- Dungeon ----------

export type CellKind =
  | 'wall'
  | 'floor'
  | 'encounter'
  | 'boss'
  | 'chest'
  | 'shovel'
  | 'spawn'
  | 'hazard'
  | 'shrine';

export type ShrineKind = 'heal' | 'altar';

export interface Cell {
  x: number;
  y: number;
  kind: CellKind;
  // For encounter/boss cells: which enemy group spawns here
  encounterId?: string;
  // For chest cells: what type of reward
  chestKind?: 'card' | 'gold' | 'gem';
  // For shrine cells: what blessing this shrine offers
  shrineKind?: ShrineKind;
  // For encounter cells: this is a tougher elite fight with bigger rewards
  isElite?: boolean;
  // Has this cell been consumed (chest opened, encounter cleared, trap sprung)?
  cleared?: boolean;
  // Fog of war / explored
  seen?: boolean;
  visible?: boolean;
}

export interface Fixture {
  kind: 'wallTorch' | 'hangingSkeleton' | 'bonePile' | 'spiderweb';
  /** Cell coordinates the fixture sits in (floor cell). */
  x: number;
  y: number;
  /**
   * For wall-mounted fixtures (torch, skeleton): which side of the cell
   * the fixture is on. 0 = north (y-1), 1 = east (x+1), 2 = south, 3 = west.
   */
  wallSide?: 0 | 1 | 2 | 3;
  /**
   * For spiderwebs: which corner of the cell hosts the web.
   * 0 = NW, 1 = NE, 2 = SE, 3 = SW.
   */
  corner?: 0 | 1 | 2 | 3;
  /** Deterministic seed-derived value for visual variation (rotation, color). */
  variant?: number;
}

export interface DungeonMap {
  width: number;
  height: number;
  cells: Cell[][]; // cells[y][x]
  spawn: { x: number; y: number };
  floor: number;
  fixtures: Fixture[];
}

export type Facing = 0 | 1 | 2 | 3; // 0=N(-y), 1=E(+x), 2=S(+y), 3=W(-x)

// ---------- Game mode ----------

export type GameMode =
  | 'menu'
  | 'crawler-select'
  | 'dungeon'
  | 'combat'
  | 'reward'
  | 'chest'
  | 'game-over'
  | 'victory';

// ---------- Combat state ----------

export interface CombatState {
  enemies: EnemyInstance[];
  encounterId: string;
  isBoss: boolean;
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  hand: CardInstance[];
  chain: CardInstance[]; // staged cards waiting to be resolved
  mana: number;
  maxMana: number;
  hp: number;
  maxHp: number;
  statuses: Partial<Record<StatusKind, number>>;
  turn: number;
  log: string[];
  resolving: boolean;
  // Reward queued when combat ends in victory
  pendingRewardCards?: string[]; // CardDef ids offered
  pendingGold?: number;
  pendingXp?: number;
}
