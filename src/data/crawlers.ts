import type { CrawlerDef } from '@/types';

export const CRAWLERS: Record<string, CrawlerDef> = {
  antonio: {
    id: 'antonio',
    name: 'Antonio',
    description: 'A grim swordsman with a heavy hand.',
    passive: '+1 damage to all attack cards.',
    maxHp: 60,
    startingMana: 3,
    startingHandSize: 5,
    starterDeck: [
      'jab', 'jab', 'jab', 'jab',
      'slash', 'slash',
      'guard', 'guard',
      'pebble', 'pebble',
    ],
    unlocked: true,
  },
  imelda: {
    id: 'imelda',
    name: 'Imelda',
    description: 'A young magician quick to study.',
    passive: '+1 card drawn each turn.',
    maxHp: 50,
    startingMana: 3,
    startingHandSize: 5,
    starterDeck: [
      'jab', 'jab', 'jab',
      'ignite', 'ignite',
      'focus', 'focus',
      'guard', 'guard',
      'pebble',
    ],
    unlocked: true,
  },
  pasqualina: {
    id: 'pasqualina',
    name: 'Pasqualina',
    description: 'A relic-bound priestess.',
    passive: '+1 mana per turn.',
    maxHp: 55,
    startingMana: 4,
    startingHandSize: 5,
    starterDeck: [
      'jab', 'jab',
      'garlic', 'garlic',
      'guard', 'guard', 'guard',
      'inspire',
      'pebble', 'pebble',
    ],
    unlocked: false,
    unlockXp: 100,
  },
  gennaro: {
    id: 'gennaro',
    name: 'Gennaro',
    description: 'A bleeder with a vicious whip.',
    passive: 'Bleed deals +1 damage per stack.',
    maxHp: 55,
    startingMana: 3,
    startingHandSize: 5,
    starterDeck: [
      'whip', 'whip', 'whip',
      'thornedBrand',
      'jab', 'jab',
      'guard', 'guard',
      'pebble', 'pebble',
    ],
    unlocked: false,
    unlockXp: 250,
  },
};

export function getCrawler(id: string): CrawlerDef {
  const c = CRAWLERS[id];
  if (!c) throw new Error(`Unknown crawler id: ${id}`);
  return c;
}

export const CRAWLER_LIST: CrawlerDef[] = Object.values(CRAWLERS);
