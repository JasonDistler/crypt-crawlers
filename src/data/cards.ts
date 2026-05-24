import type { CardDef } from '@/types';

/**
 * Card catalogue. Costs follow the mana-chain principle: lower-cost cards lead
 * combos, higher-cost cards finish them. Wild cards (isWild) bypass the
 * ascending rule, letting players splice combos together.
 */
export const CARDS: Record<string, CardDef> = {
  // ---------- Basic attacks (cost ramp 0..4) ----------
  pebble: {
    id: 'pebble',
    name: 'Pebble',
    cost: 0,
    type: 'attack',
    effect: { damage: 3 },
    description: 'Deal 3 damage.',
    rarity: 'common',
    flavor: "It's a rock. Mostly.",
  },
  jab: {
    id: 'jab',
    name: 'Jab',
    cost: 1,
    type: 'attack',
    effect: { damage: 5 },
    description: 'Deal 5 damage.',
    rarity: 'common',
  },
  slash: {
    id: 'slash',
    name: 'Slash',
    cost: 2,
    type: 'attack',
    effect: { damage: 8 },
    description: 'Deal 8 damage.',
    rarity: 'common',
  },
  cleave: {
    id: 'cleave',
    name: 'Cleave',
    cost: 3,
    type: 'attack',
    effect: { damage: 10, aoe: true },
    description: 'Deal 10 damage to ALL enemies.',
    rarity: 'uncommon',
    evolvesTo: 'guillotine',
  },
  smite: {
    id: 'smite',
    name: 'Smite',
    cost: 4,
    type: 'attack',
    effect: { damage: 18 },
    description: 'Deal 18 damage. Combo finisher.',
    rarity: 'rare',
  },

  // ---------- Defense ----------
  guard: {
    id: 'guard',
    name: 'Guard',
    cost: 1,
    type: 'defend',
    effect: { block: 5 },
    description: 'Gain 5 block.',
    rarity: 'common',
  },
  bulwark: {
    id: 'bulwark',
    name: 'Bulwark',
    cost: 2,
    type: 'defend',
    effect: { block: 10 },
    description: 'Gain 10 block.',
    rarity: 'uncommon',
  },

  // ---------- Multi-hit & status ----------
  whip: {
    id: 'whip',
    name: 'Whip',
    cost: 1,
    type: 'attack',
    effect: { damage: 3, hits: 2 },
    description: 'Hit twice for 3 damage each.',
    rarity: 'common',
    evolvesTo: 'bloodyTear',
  },
  bloodyTear: {
    id: 'bloodyTear',
    name: 'Bloody Tear',
    cost: 2,
    type: 'attack',
    effect: { damage: 4, hits: 3, applyStatus: [{ kind: 'bleed', amount: 2, target: 'enemy' }] },
    description: 'Hit thrice for 4 and apply 2 Bleed.',
    rarity: 'rare',
  },
  ignite: {
    id: 'ignite',
    name: 'Ignite',
    cost: 1,
    type: 'attack',
    effect: { damage: 2, applyStatus: [{ kind: 'burn', amount: 3, target: 'enemy' }] },
    description: 'Deal 2 damage and apply 3 Burn.',
    rarity: 'uncommon',
  },
  thornedBrand: {
    id: 'thornedBrand',
    name: 'Thorned Brand',
    cost: 2,
    type: 'attack',
    effect: { damage: 6, applyStatus: [{ kind: 'bleed', amount: 3, target: 'enemy' }] },
    description: 'Deal 6 damage and apply 3 Bleed.',
    rarity: 'uncommon',
  },

  // ---------- Buffs / draw / heal ----------
  focus: {
    id: 'focus',
    name: 'Focus',
    cost: 1,
    type: 'draw',
    effect: { draw: 2 },
    description: 'Draw 2 cards.',
    rarity: 'common',
  },
  inspire: {
    id: 'inspire',
    name: 'Inspire',
    cost: 2,
    type: 'buff',
    effect: { applyStatus: [{ kind: 'strength', amount: 2, target: 'self' }] },
    description: 'Gain 2 Strength (+damage this combat).',
    rarity: 'uncommon',
  },
  garlic: {
    id: 'garlic',
    name: 'Garlic',
    cost: 1,
    type: 'heal',
    effect: { heal: 4 },
    description: 'Heal 4 HP.',
    rarity: 'common',
  },
  spinach: {
    id: 'spinach',
    name: 'Spinach',
    cost: 2,
    type: 'buff',
    effect: { applyStatus: [{ kind: 'strength', amount: 3, target: 'self' }] },
    description: 'Gain 3 Strength.',
    rarity: 'rare',
  },

  // ---------- Wild item cards (the heart of long combos) ----------
  goldSack: {
    id: 'goldSack',
    name: 'Sack of Gold',
    cost: 0,
    type: 'item',
    isWild: true,
    effect: { gold: 10 },
    description: 'Wild. Gain 10 gold.',
    rarity: 'common',
    flavor: 'Bridges combos for free.',
  },
  candleStub: {
    id: 'candleStub',
    name: 'Candle Stub',
    cost: 1,
    type: 'item',
    isWild: true,
    effect: { damage: 1 },
    description: 'Wild. Deal 1 damage. Slots anywhere in the chain.',
    rarity: 'common',
  },
  rustyKey: {
    id: 'rustyKey',
    name: 'Rusty Key',
    cost: 0,
    type: 'item',
    isWild: true,
    effect: { draw: 1 },
    description: 'Wild. Draw 1 card.',
    rarity: 'common',
  },
  silverCoin: {
    id: 'silverCoin',
    name: 'Silver Coin',
    cost: 0,
    type: 'item',
    isWild: true,
    effect: { manaGain: 1 },
    description: 'Wild. Gain 1 mana this turn.',
    rarity: 'uncommon',
  },
  cobwebs: {
    id: 'cobwebs',
    name: 'Cobwebs',
    cost: 0,
    type: 'item',
    isWild: true,
    effect: { applyStatus: [{ kind: 'shield', amount: 3, target: 'self' }] },
    description: 'Wild. Gain 3 Shield.',
    rarity: 'uncommon',
  },

  // ---------- Legendaries / evolved ----------
  guillotine: {
    id: 'guillotine',
    name: 'Guillotine',
    cost: 4,
    type: 'attack',
    effect: { damage: 24, aoe: true },
    description: 'Deal 24 damage to ALL enemies.',
    rarity: 'legendary',
  },
  vampiricBite: {
    id: 'vampiricBite',
    name: 'Vampiric Bite',
    cost: 3,
    type: 'attack',
    effect: { damage: 8, heal: 4 },
    description: 'Deal 8 damage and heal 4 HP.',
    rarity: 'rare',
  },
  holyWater: {
    id: 'holyWater',
    name: 'Holy Water',
    cost: 2,
    type: 'attack',
    effect: {
      damage: 5,
      aoe: true,
      applyStatus: [{ kind: 'burn', amount: 2, target: 'enemy' }],
    },
    description: 'Deal 5 damage to all and apply 2 Burn.',
    rarity: 'rare',
  },
  pentagram: {
    id: 'pentagram',
    name: 'Pentagram',
    cost: 4,
    type: 'attack',
    effect: { damage: 12, aoe: true, hits: 2 },
    description: 'Hit ALL enemies twice for 12.',
    rarity: 'legendary',
  },
};

/** Reward pool used when rolling post-fight card offers. */
export const REWARD_POOL: string[] = [
  'jab',
  'slash',
  'cleave',
  'smite',
  'guard',
  'bulwark',
  'whip',
  'ignite',
  'thornedBrand',
  'focus',
  'inspire',
  'garlic',
  'spinach',
  'vampiricBite',
  'holyWater',
  'pentagram',
  'bloodyTear',
];

export function getCard(id: string): CardDef {
  const card = CARDS[id];
  if (!card) throw new Error(`Unknown card id: ${id}`);
  return card;
}
