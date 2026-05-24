import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import type { CardDef, CardType } from '@/types';
import { cardArtDataUrl } from '@/art/cardArt';

interface Props {
  def: CardDef;
  multiplier?: number; // shown when card is in the chain
  unaffordable?: boolean;
  onClick?: () => void;
  small?: boolean;
  highlightWild?: boolean;
}

/**
 * A Magic: The Gathering–style card. Layout:
 *
 *   ┌──────────────────────────────┐
 *   │ Name              ( cost )   │   <- title bar (mana cost pip)
 *   ├──────────────────────────────┤
 *   │                              │
 *   │        ART FRAME             │   <- painted illustration
 *   │                              │
 *   ├──────────────────────────────┤
 *   │ Type — Subtype          [★]  │   <- type bar
 *   ├──────────────────────────────┤
 *   │ Rules text…                  │
 *   │                              │
 *   │ "Flavor text…"   ─────       │
 *   │                       [P/T]  │   <- stat box for damage/block
 *   └──────────────────────────────┘
 *
 * Color is keyed off `def.type` (mapped loosely onto MTG's color pie) so
 * attacks read red, defends white, draws blue, etc.
 */
export function Card({ def, multiplier, unaffordable, onClick, small, highlightWild = true }: Props) {
  const rarityCls = def.rarity ? `card-rarity-${def.rarity}` : '';
  const wildCls = def.isWild && highlightWild ? 'card-wild' : '';
  const color = colorForType(def.type, def.isWild);
  const art = useMemo(() => cardArtDataUrl(def, 220, 160), [def.id]);

  return (
    <motion.button
      type="button"
      className={clsx('card', `card-color-${color}`, rarityCls, wildCls, {
        'card-small': small,
        'card-disabled': unaffordable,
      })}
      onClick={onClick}
      disabled={unaffordable && !!onClick}
      whileHover={{ y: -10, scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      layout
    >
      {/* Inner bordered playmat — what looks like the actual card */}
      <div className="card-frame">
        {/* Title bar with name + mana cost pip */}
        <div className="card-titlebar">
          <div className="card-title">{def.name}</div>
          <div className="card-cost-pip" title={`Mana cost ${def.cost}`}>
            <span>{def.cost}</span>
          </div>
        </div>

        {/* Art box */}
        <div className="card-art-frame">
          <img className="card-art-img" src={art} alt="" draggable={false} />
          <div className="card-art-vignette" />
        </div>

        {/* Type bar */}
        <div className="card-typebar">
          <span className="card-type-label">
            {typeLineFor(def)}
          </span>
          <span className="card-rarity-pip" title={def.rarity ?? 'common'}>
            {rarityGlyph(def.rarity)}
          </span>
        </div>

        {/* Rules + flavor text */}
        <div className="card-textbox">
          <div className="card-rules">{def.description}</div>
          {def.flavor && <div className="card-flavor">"{def.flavor}"</div>}

          {/* Power/toughness stat block. Shows the most relevant numeric stat
              for the card — damage for attacks, block for defends, etc. */}
          <div className="card-stat">{statFor(def)}</div>
        </div>
      </div>

      {/* Chain multiplier pip (outside frame) */}
      {multiplier !== undefined && multiplier > 1 && (
        <div className="card-multiplier">×{multiplier.toFixed(2)}</div>
      )}
    </motion.button>
  );
}

function colorForType(type: CardType, isWild?: boolean): string {
  if (isWild) return 'artifact';
  switch (type) {
    case 'attack':
      return 'red';
    case 'defend':
      return 'white';
    case 'heal':
      return 'green';
    case 'draw':
      return 'blue';
    case 'buff':
      return 'black';
    case 'item':
      return 'artifact';
    default:
      return 'artifact';
  }
}

function typeLineFor(def: CardDef): string {
  if (def.isWild) return 'Artifact — Wild';
  switch (def.type) {
    case 'attack':
      return def.cost <= 1 ? 'Instant — Strike' : def.cost >= 4 ? 'Sorcery — Finisher' : 'Sorcery — Strike';
    case 'defend':
      return 'Instant — Ward';
    case 'heal':
      return 'Sorcery — Mend';
    case 'draw':
      return 'Instant — Insight';
    case 'buff':
      return 'Enchantment — Hex';
    case 'item':
      return 'Artifact — Relic';
    default:
      return 'Spell';
  }
}

function statFor(def: CardDef): string | null {
  const e = def.effect;
  if (e.damage) {
    const hits = e.hits && e.hits > 1 ? `×${e.hits}` : '';
    const aoe = e.aoe ? ' AoE' : '';
    return `${e.damage}${hits}${aoe}`;
  }
  if (e.block) return `+${e.block}`;
  if (e.heal) return `♥${e.heal}`;
  if (e.draw) return `+${e.draw}`;
  if (e.manaGain) return `✦${e.manaGain}`;
  return null;
}

function rarityGlyph(r?: CardDef['rarity']): string {
  switch (r) {
    case 'legendary':
      return '★';
    case 'rare':
      return '◆';
    case 'uncommon':
      return '●';
    default:
      return '○';
  }
}
