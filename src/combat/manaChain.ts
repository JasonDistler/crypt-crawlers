import type { CardDef, CardEffect } from '@/types';

/**
 * Mana Chain resolution. Cards are played in the chain area in the order the
 * player drops them. The chain rule: each non-wild card must have a strictly
 * higher mana cost than the previous non-wild card to keep the chain alive.
 * Wild cards never break the chain — they just bridge it (and inherit the
 * current chain multiplier).
 *
 * Each consecutive step in a live chain multiplies the next card's effect by
 * `CHAIN_STEP_MULTIPLIER`. Breaking the chain resets the multiplier to 1 and
 * the previous-cost tracker.
 *
 * Examples:
 *   [cost 0, cost 1, cost 2]            -> multipliers [1, 1.5, 2.25]
 *   [cost 1, wild, cost 2]              -> multipliers [1, 1.5, 2.25]
 *   [cost 2, cost 1, cost 3]            -> multipliers [1, 1, 1.5]   (broken at idx 1)
 *   [cost 0, wild, wild, cost 1, cost 2]-> multipliers [1, 1.5, 2.25, 3.375, 5.0625]
 */

export const CHAIN_STEP_MULTIPLIER = 1.5;

export interface ChainStep {
  cardId: string;
  cost: number;
  isWild: boolean;
  multiplier: number;
  /** 1-indexed depth of this step in the current unbroken chain. */
  depth: number;
  /** True if this card kept the chain going (vs broke it). */
  continued: boolean;
}

/**
 * Compute the multiplier each played card would receive, without applying
 * effects. Useful for the UI preview and for resolution.
 */
export function computeChain(cards: { id: string; cost: number; isWild?: boolean }[]): ChainStep[] {
  let multiplier = 1;
  let prevCost = -Infinity;
  let depth = 0;
  const steps: ChainStep[] = [];

  for (const card of cards) {
    const isWild = !!card.isWild;
    // First card always starts a chain. Wilds always continue.
    const isFirst = steps.length === 0;
    const continued = isFirst || isWild || card.cost > prevCost;

    if (!continued) {
      multiplier = 1;
      depth = 1;
    } else if (isFirst) {
      multiplier = 1;
      depth = 1;
    } else {
      depth += 1;
      multiplier *= CHAIN_STEP_MULTIPLIER;
    }

    steps.push({
      cardId: card.id,
      cost: card.cost,
      isWild,
      multiplier,
      depth,
      continued,
    });

    // Only non-wild cards update the prev cost tracker.
    if (!isWild) {
      prevCost = card.cost;
    }
  }
  return steps;
}

/**
 * Apply a multiplier to numeric fields of an effect. Status amounts and gold
 * scale linearly; damage/block/heal scale and are rounded down. `hits` is
 * preserved.
 */
export function scaleEffect(effect: CardEffect, multiplier: number): CardEffect {
  const scaleNum = (n: number | undefined) =>
    n === undefined ? undefined : Math.max(0, Math.floor(n * multiplier));

  return {
    damage: scaleNum(effect.damage),
    block: scaleNum(effect.block),
    heal: scaleNum(effect.heal),
    draw: effect.draw, // never scales — silly to draw fractional/huge piles
    manaGain: effect.manaGain,
    hits: effect.hits,
    aoe: effect.aoe,
    gold: scaleNum(effect.gold),
    applyStatus: effect.applyStatus?.map((s) => ({
      ...s,
      amount: Math.max(1, Math.floor(s.amount * multiplier)),
    })),
  };
}

/** Total mana cost of a chain. */
export function chainCost(cards: { cost: number }[]): number {
  return cards.reduce((sum, c) => sum + c.cost, 0);
}

/** Sum of projected damage across a chain (for tooltips/preview). */
export function projectedDamage(
  cards: { id: string; cost: number; isWild?: boolean; effect: CardEffect }[],
): number {
  const steps = computeChain(cards);
  let total = 0;
  steps.forEach((step, i) => {
    const scaled = scaleEffect(cards[i].effect, step.multiplier);
    const hits = scaled.hits ?? 1;
    total += (scaled.damage ?? 0) * hits;
  });
  return total;
}

/**
 * Convenience to build the input shape from a deck of CardDefs.
 * Most callers will pass CardInstance through `getCard()` first.
 */
export function cardsForChain(defs: CardDef[]) {
  return defs.map((d) => ({ id: d.id, cost: d.cost, isWild: !!d.isWild, effect: d.effect }));
}
