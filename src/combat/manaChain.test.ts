import { describe, it, expect } from 'vitest';
import {
  computeChain,
  scaleEffect,
  projectedDamage,
  CHAIN_STEP_MULTIPLIER,
} from './manaChain';

describe('computeChain', () => {
  it('single card has multiplier 1', () => {
    const steps = computeChain([{ id: 'a', cost: 1 }]);
    expect(steps).toHaveLength(1);
    expect(steps[0].multiplier).toBe(1);
    expect(steps[0].continued).toBe(true);
    expect(steps[0].depth).toBe(1);
  });

  it('ascending costs build the chain', () => {
    const steps = computeChain([
      { id: 'a', cost: 0 },
      { id: 'b', cost: 1 },
      { id: 'c', cost: 2 },
    ]);
    expect(steps.map((s) => s.multiplier)).toEqual([
      1,
      CHAIN_STEP_MULTIPLIER,
      CHAIN_STEP_MULTIPLIER ** 2,
    ]);
    expect(steps.every((s) => s.continued)).toBe(true);
  });

  it('breaks chain when a card has lower or equal cost', () => {
    const steps = computeChain([
      { id: 'a', cost: 2 },
      { id: 'b', cost: 1 }, // breaks
      { id: 'c', cost: 3 },
    ]);
    expect(steps[0].multiplier).toBe(1);
    expect(steps[1].multiplier).toBe(1); // reset
    expect(steps[1].continued).toBe(false);
    expect(steps[2].multiplier).toBe(CHAIN_STEP_MULTIPLIER); // continues from b
  });

  it('breaks on equal cost too', () => {
    const steps = computeChain([
      { id: 'a', cost: 1 },
      { id: 'b', cost: 1 },
    ]);
    expect(steps[1].continued).toBe(false);
    expect(steps[1].multiplier).toBe(1);
  });

  it('wild cards continue the chain regardless of cost', () => {
    const steps = computeChain([
      { id: 'a', cost: 2 },
      { id: 'wild', cost: 0, isWild: true },
      { id: 'b', cost: 3 },
    ]);
    expect(steps[1].continued).toBe(true);
    expect(steps[1].multiplier).toBe(CHAIN_STEP_MULTIPLIER);
    expect(steps[2].continued).toBe(true);
    expect(steps[2].multiplier).toBe(CHAIN_STEP_MULTIPLIER ** 2);
  });

  it('wild cards do not update prev cost tracker', () => {
    // a(2) -> wild(5) -> b(3) should still continue because prev non-wild = 2
    const steps = computeChain([
      { id: 'a', cost: 2 },
      { id: 'wild', cost: 5, isWild: true },
      { id: 'b', cost: 3 },
    ]);
    expect(steps[2].continued).toBe(true);
  });

  it('long wild bridge stacks multiplier', () => {
    const steps = computeChain([
      { id: 'a', cost: 0 },
      { id: 'w1', cost: 0, isWild: true },
      { id: 'w2', cost: 0, isWild: true },
      { id: 'b', cost: 1 },
      { id: 'c', cost: 2 },
    ]);
    expect(steps.map((s) => s.multiplier)).toEqual([
      1,
      CHAIN_STEP_MULTIPLIER,
      CHAIN_STEP_MULTIPLIER ** 2,
      CHAIN_STEP_MULTIPLIER ** 3,
      CHAIN_STEP_MULTIPLIER ** 4,
    ]);
  });
});

describe('scaleEffect', () => {
  it('scales damage, block, heal, gold by floor(value * multiplier)', () => {
    const out = scaleEffect({ damage: 5, block: 4, heal: 3, gold: 7 }, 1.5);
    expect(out.damage).toBe(7); // floor(7.5)
    expect(out.block).toBe(6);
    expect(out.heal).toBe(4);
    expect(out.gold).toBe(10);
  });

  it('does not scale draw or manaGain', () => {
    const out = scaleEffect({ draw: 2, manaGain: 1 }, 3);
    expect(out.draw).toBe(2);
    expect(out.manaGain).toBe(1);
  });

  it('scales status amounts with minimum 1', () => {
    const out = scaleEffect(
      { applyStatus: [{ kind: 'bleed', amount: 2, target: 'enemy' }] },
      2.25,
    );
    expect(out.applyStatus![0].amount).toBe(4); // floor(4.5)

    const tiny = scaleEffect(
      { applyStatus: [{ kind: 'bleed', amount: 1, target: 'enemy' }] },
      0.1,
    );
    expect(tiny.applyStatus![0].amount).toBe(1);
  });

  it('preserves hits and aoe flags', () => {
    const out = scaleEffect({ damage: 4, hits: 3, aoe: true }, 2);
    expect(out.hits).toBe(3);
    expect(out.aoe).toBe(true);
    expect(out.damage).toBe(8);
  });
});

describe('projectedDamage', () => {
  it('sums scaled damage across multi-hit cards', () => {
    // chain: cost 0 dmg 3 (x1) + cost 1 dmg 4 hits 2 (x1.5) = 3 + (6*2) = 15
    const dmg = projectedDamage([
      { id: 'a', cost: 0, effect: { damage: 3 } },
      { id: 'b', cost: 1, effect: { damage: 4, hits: 2 } },
    ]);
    expect(dmg).toBe(15);
  });
});
