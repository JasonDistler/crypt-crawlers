import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRunStore } from '@/state/runStore';
import { useMetaStore } from '@/state/metaStore';
import { getCard } from '@/data/cards';
import { getCrawler } from '@/data/crawlers';
import { computeChain, projectedDamage } from '@/combat/manaChain';
import { crawlerPortraitDataUrl } from '@/art/portraits';
import { CRAWLER_PORTRAIT_FOCUS } from '@/art/crawlerImages';
import { getCrawlerPalette } from '@/data/crawlerPalette';
import { Card } from './Card';
import { EnemyPanel } from './EnemyPanel';
import './CombatScene.css';

type PlayerFloater = {
  id: string;
  text: string;
  tone: 'damage' | 'heal' | 'block';
  dx: number;
};

export function CombatScene() {
  const c = useRunStore((s) => s.combat);
  const crawlerId = useRunStore((s) => s.crawlerId);
  const isElite = useRunStore((s) => s.combatIsElite);
  const godMode = useRunStore((s) => s.godMode);
  const reducedMotion = useMetaStore((s) => s.reducedMotion);
  const actions = useRunStore.getState();
  const crawler = crawlerId ? getCrawler(crawlerId) : null;
  const palette = getCrawlerPalette(crawlerId);

  // Compute chain steps for live multiplier preview
  const chainInput = useMemo(() => {
    if (!c) return [];
    return c.chain.map((ci) => {
      const def = getCard(ci.defId);
      return { id: def.id, cost: def.cost, isWild: !!def.isWild, effect: def.effect };
    });
  }, [c?.chain]);
  const steps = useMemo(() => computeChain(chainInput), [chainInput]);
  const previewDamage = useMemo(() => projectedDamage(chainInput), [chainInput]);

  const currentMultiplier = steps.length ? steps[steps.length - 1].multiplier : 1;
  const chainTier =
    currentMultiplier >= 3 ? 'mega' : currentMultiplier >= 2 ? 'big' : currentMultiplier >= 1.5 ? 'std' : 'none';

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const st = useRunStore.getState();
      if (st.mode !== 'combat' || !st.combat) return;
      if (e.key === ' ' || e.key.toLowerCase() === 'enter') {
        st.endTurn();
      } else if (e.key.toLowerCase() === 'c') {
        st.clearChain();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---- Player floaters: track HP / shield deltas, emit damage / heal / block popups
  const [playerFloaters, setPlayerFloaters] = useState<PlayerFloater[]>([]);
  const [portraitFlash, setPortraitFlash] = useState<'damage' | 'heal' | null>(null);
  const prevPlayerHp = useRef(c?.hp ?? 0);
  const prevPlayerShield = useRef(c?.statuses.shield ?? 0);

  const triggerPortraitFlash = (tone: 'damage' | 'heal') => {
    setPortraitFlash(tone);
    setTimeout(() => setPortraitFlash(null), tone === 'damage' ? 420 : 600);
  };

  const pushPlayerFloater = (text: string, tone: PlayerFloater['tone']) => {
    const id = Math.random().toString(36).slice(2, 10);
    const dx = (Math.random() - 0.5) * 30;
    setPlayerFloaters((cur) => [...cur, { id, text, tone, dx }]);
    setTimeout(() => {
      setPlayerFloaters((cur) => cur.filter((f) => f.id !== id));
    }, 1100);
  };

  // ---- Screen shake: re-runs whenever shakeKey bumps. Magnitude controlled
  // by the latest hit; the framer animation reads that off the key suffix.
  const shakeControls = useAnimationControls();

  const doShake = (magnitude: number) => {
    // Magnitude: 0 (none) → ~14px (huge boss hit). Reduced-motion mode skips
    // the camera shake entirely (the flash + floater still communicate the hit).
    if (reducedMotion) return;
    const m = Math.min(14, magnitude);
    if (m < 1) return;
    shakeControls.start({
      x: [0, -m, m, -m * 0.7, m * 0.7, -m * 0.45, m * 0.45, 0],
      y: [0, m * 0.4, -m * 0.4, m * 0.25, -m * 0.25, 0, 0, 0],
      transition: { duration: 0.42, ease: 'easeOut' },
    });
  };

  useEffect(() => {
    if (!c) return;
    const curShield = c.statuses.shield ?? 0;
    if (c.hp < prevPlayerHp.current) {
      const lost = prevPlayerHp.current - c.hp;
      pushPlayerFloater(`-${lost}`, 'damage');
      doShake(Math.min(12, 3 + lost * 0.4));
      triggerPortraitFlash('damage');
    } else if (c.hp > prevPlayerHp.current) {
      pushPlayerFloater(`+${c.hp - prevPlayerHp.current}`, 'heal');
      triggerPortraitFlash('heal');
    }
    if (curShield > prevPlayerShield.current) {
      pushPlayerFloater(`+${curShield - prevPlayerShield.current} 🛡`, 'block');
    }
    prevPlayerHp.current = c.hp;
    prevPlayerShield.current = curShield;
  }, [c?.hp, c?.statuses.shield]); // eslint-disable-line react-hooks/exhaustive-deps

  // Enemy damage events → shake too. Track total enemy HP and shake on big
  // deltas (e.g. a chain that hits multiple enemies at once).
  const prevEnemyTotalHp = useRef(
    c ? c.enemies.reduce((a, e) => a + Math.max(0, e.hp), 0) : 0,
  );
  useEffect(() => {
    if (!c) return;
    const total = c.enemies.reduce((a, e) => a + Math.max(0, e.hp), 0);
    const lost = prevEnemyTotalHp.current - total;
    if (lost > 0) doShake(Math.min(14, 2 + lost * 0.4));
    prevEnemyTotalHp.current = total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c?.enemies.map((e) => e.hp).join('|')]);

  if (!c || !crawler) return null;

  return (
    <motion.div className="combat-scene" animate={shakeControls}>
      <div className="combat-bg" />

      {isElite && <div className="combat-elite-banner">◆ ELITE ENCOUNTER ◆</div>}

      <div className="combat-top">
        <EnemyPanel enemies={c.enemies} />
      </div>

      {/* Combat log */}
      <div className="combat-log">
        {c.log.slice(-6).map((line, i) => (
          <div key={i} className="combat-log-line">{line}</div>
        ))}
      </div>

      {/* Chain area */}
      <div className="combat-chain-area">
        <div className="combat-chain-header">
          <span>Chain ({c.chain.length})</span>
          {steps.length > 0 && (
            <>
              <span className={`combat-chain-mult combat-chain-tier-${chainTier}`}>
                ×{currentMultiplier.toFixed(2)}
              </span>
              <span className="combat-chain-dmg">{previewDamage} projected dmg</span>
              <AnimatePresence>
                {chainTier !== 'none' && chainTier !== 'std' && (
                  <motion.span
                    key={chainTier}
                    className={`combat-chain-callout combat-chain-callout-${chainTier}`}
                    initial={{ scale: 0.6, opacity: 0, y: -4 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 1.4, opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'backOut' }}
                  >
                    {chainTier === 'mega' ? 'MEGA CHAIN!' : 'BIG CHAIN!'}
                  </motion.span>
                )}
                {chainTier === 'std' && (
                  <motion.span
                    key="std"
                    className="combat-chain-callout combat-chain-callout-std"
                    initial={{ scale: 0.6, opacity: 0, y: -4 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 1.2, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    CHAIN!
                  </motion.span>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
        <div className="combat-chain-slots">
          <AnimatePresence>
            {c.chain.map((ci, idx) => {
              const def = getCard(ci.defId);
              const step = steps[idx];
              return (
                <motion.div
                  key={ci.uid}
                  initial={{ y: 40, opacity: 0, scale: 0.8 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -40, opacity: 0 }}
                  layout
                >
                  <Card
                    def={def}
                    multiplier={step?.multiplier}
                    onClick={() => actions.removeFromChain(idx)}
                    small
                  />
                  {step && !step.continued && (
                    <div className="chain-broken">⛓ broken</div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
          {c.chain.length === 0 && (
            <div className="combat-chain-empty">
              Click cards to stack them here. Ascending mana cost → bigger multiplier. Wilds (grey) never break the chain.
            </div>
          )}
        </div>
      </div>

      {/* Hand */}
      <div className="combat-hand">
        <AnimatePresence>
          {c.hand.map((ci, idx) => {
            const def = getCard(ci.defId);
            const unaffordable = def.cost > c.mana;
            return (
              <motion.div
                key={ci.uid}
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 100, opacity: 0 }}
                transition={{ delay: idx * 0.04 }}
                whileHover={{ y: -10, scale: 1.04 }}
                layout
              >
                <Card def={def} unaffordable={unaffordable} onClick={() => actions.addToChain(idx)} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Player status row */}
      <div className="combat-player">
        <div className="combat-player-block">
          <PlayerPortrait
            crawlerId={crawler.id}
            crawlerName={crawler.name}
            paletteAccent={palette.primary}
            paletteGlow={palette.glow}
            flash={portraitFlash}
            godMode={godMode}
            dead={c.hp <= 0}
          />
          <div className="combat-player-info">
            <div className="combat-player-name">{crawler.name}</div>
            <div className="combat-player-hp">
              <div className="combat-player-hp-fill" style={{ width: `${(c.hp / c.maxHp) * 100}%` }} />
              <span>{c.hp} / {c.maxHp}</span>
            </div>
            {/* Floaters anchored above the player HP bar */}
            <div className="combat-player-floaters">
              <AnimatePresence>
                {playerFloaters.map((f) => (
                  <motion.div
                    key={f.id}
                    className={`floater floater-${f.tone}`}
                    initial={{ y: 0, opacity: 0, scale: 0.8, x: f.dx }}
                    animate={{ y: -70, opacity: 1, scale: 1, x: f.dx }}
                    exit={{ opacity: 0, y: -90, scale: 0.8 }}
                    transition={{ duration: 1.0, ease: 'easeOut' }}
                  >
                    {f.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="combat-player-statuses">
              {Object.entries(c.statuses).map(([k, v]) =>
                v ? (
                  <span key={k} className={`status status-${k}`}>
                    {statusLabel(k)} {v}
                  </span>
                ) : null,
              )}
            </div>
          </div>
        </div>
        <div className="combat-mana">
          <div className="mana-orb">
            <div className="mana-orb-fill" style={{ height: `${(c.mana / Math.max(c.maxMana, c.mana, 1)) * 100}%` }} />
            <span>{c.mana}</span>
          </div>
          <div className="combat-deck-counts">
            <div>Draw {c.drawPile.length}</div>
            <div>Disc {c.discardPile.length}</div>
          </div>
        </div>
        <div className="combat-actions">
          <button className="big-button" onClick={() => actions.endTurn()}>End Turn (Space)</button>
          <button onClick={() => actions.clearChain()} disabled={c.chain.length === 0}>Clear (C)</button>
          {!c.isBoss && <button onClick={() => actions.flee()}>Flee</button>}
        </div>
      </div>
    </motion.div>
  );
}

function statusLabel(k: string): string {
  switch (k) {
    case 'bleed': return '🩸 Bleed';
    case 'burn': return '🔥 Burn';
    case 'shield': return '🛡 Block';
    case 'strength': return '💪 Str';
    case 'manaDrain': return '∅ Drain';
    default: return k;
  }
}

/**
 * Player avatar panel for the combat HUD. Renders the crawler painting with:
 *  - a frame tinted in the crawler's signature palette color,
 *  - a red flash overlay when HP drops,
 *  - a green pulse when HP rises (heals),
 *  - a gold pulsing aura when god-mode is on,
 *  - desaturation + dim when the player's HP reaches zero.
 *
 * The portrait `<img>` is memoized via `crawlerPortraitDataUrl` (which returns
 * the static asset URL for any crawler with real artwork), so this component
 * is cheap to re-render on every HP tick.
 */
function PlayerPortrait({
  crawlerId,
  crawlerName,
  paletteAccent,
  paletteGlow,
  flash,
  godMode,
  dead,
}: {
  crawlerId: string;
  crawlerName: string;
  paletteAccent: string;
  paletteGlow: string;
  flash: 'damage' | 'heal' | null;
  godMode: boolean;
  dead: boolean;
}) {
  const src = useMemo(() => crawlerPortraitDataUrl(crawlerId, 256, 320), [crawlerId]);
  const focus = CRAWLER_PORTRAIT_FOCUS[crawlerId] ?? '50% 25%';
  return (
    <div
      className="player-portrait"
      style={{
        ['--portrait-accent' as any]: paletteAccent,
        ['--portrait-glow' as any]: paletteGlow,
      }}
    >
      <img
        className="player-portrait-img"
        src={src}
        alt={crawlerName}
        draggable={false}
        style={{ objectPosition: focus, filter: dead ? 'grayscale(1) brightness(0.55)' : undefined }}
      />
      <div className="player-portrait-vignette" />
      {godMode && <div className="player-portrait-godmode" />}
      <AnimatePresence>
        {flash === 'damage' && (
          <motion.div
            key="dmg"
            className="player-portrait-flash player-portrait-flash-damage"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.75, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, ease: 'easeOut' }}
          />
        )}
        {flash === 'heal' && (
          <motion.div
            key="heal"
            className="player-portrait-flash player-portrait-flash-heal"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.65, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
