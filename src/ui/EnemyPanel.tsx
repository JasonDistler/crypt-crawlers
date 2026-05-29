import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EnemyInstance } from '@/types';
import { getEnemy } from '@/data/enemies';
import { enemyPortraitDataUrl } from '@/art/portraits';
import clsx from 'clsx';

export function EnemyPanel({ enemies }: { enemies: EnemyInstance[] }) {
  return (
    <div className="enemy-panel">
      {enemies.map((e) => (
        <EnemyCard key={e.uid} enemy={e} />
      ))}
    </div>
  );
}

type Floater = {
  id: string;
  text: string;
  tone: 'damage' | 'heal' | 'block' | 'status';
  // Random horizontal offset so successive floaters don't stack perfectly.
  dx: number;
};

function useFloaters() {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const add = (text: string, tone: Floater['tone']) => {
    const id = Math.random().toString(36).slice(2, 10);
    const dx = (Math.random() - 0.5) * 36;
    setFloaters((cur) => [...cur, { id, text, tone, dx }]);
    setTimeout(() => {
      setFloaters((cur) => cur.filter((f) => f.id !== id));
    }, 1100);
  };
  return { floaters, add };
}

function EnemyCard({ enemy }: { enemy: EnemyInstance }) {
  const def = getEnemy(enemy.defId);
  const intent = def.intents[enemy.intentIndex % def.intents.length];
  const dead = enemy.hp <= 0;

  const { floaters, add } = useFloaters();
  const prevHp = useRef(enemy.hp);
  const prevShield = useRef(enemy.statuses.shield ?? 0);
  const wasDead = useRef(dead);
  const [deathBurst, setDeathBurst] = useState(false);
  // Brief red flash on the portrait when damage lands (independent of the
  // death burst, which only fires on the killing blow). Tone may extend later
  // to 'heal' for green flashes when an enemy is healed by a teammate.
  const [hitFlash, setHitFlash] = useState<'damage' | null>(null);

  // Watch for HP / shield changes and emit floaters accordingly.
  useEffect(() => {
    const curShield = enemy.statuses.shield ?? 0;
    if (enemy.hp < prevHp.current) {
      add(`-${prevHp.current - enemy.hp}`, 'damage');
      setHitFlash('damage');
      // Match the floater + frame-shake cadence so the flash feels tied to
      // the hit, not just trailing behind it.
      setTimeout(() => setHitFlash(null), 360);
    } else if (enemy.hp > prevHp.current) {
      add(`+${enemy.hp - prevHp.current}`, 'heal');
    }
    if (curShield > prevShield.current) {
      add(`+${curShield - prevShield.current} 🛡`, 'block');
    }
    prevHp.current = enemy.hp;
    prevShield.current = curShield;

    // Death transition — burst once when crossing into dead state.
    if (!wasDead.current && dead) {
      setDeathBurst(true);
      setTimeout(() => setDeathBurst(false), 1100);
    }
    wasDead.current = dead;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enemy.hp, enemy.statuses.shield, dead]);

  return (
    <motion.div
      className={clsx('enemy', { 'enemy-dead': dead, 'enemy-boss': def.isBoss })}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: dead ? 0.25 : 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="enemy-floaters">
        <AnimatePresence>
          {floaters.map((f) => (
            <motion.div
              key={f.id}
              className={`floater floater-${f.tone}`}
              initial={{ y: 0, opacity: 0, scale: 0.8, x: f.dx }}
              animate={{ y: -68, opacity: 1, scale: 1, x: f.dx }}
              exit={{ opacity: 0, y: -88, scale: 0.8 }}
              transition={{ duration: 1.0, ease: 'easeOut' }}
            >
              {f.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <EnemyPortrait
        defId={enemy.defId}
        tint={def.tint ?? '#5a3a52'}
        dead={dead}
        deathBurst={deathBurst}
        hitFlash={hitFlash}
      />
      <div className="enemy-info">
        <div className="enemy-name">{def.name}{def.isBoss ? ' ★' : ''}</div>
        <div className="enemy-hpbar">
          <div className="enemy-hpbar-fill" style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }} />
          <span className="enemy-hpbar-text">{enemy.hp} / {enemy.maxHp}</span>
        </div>
        {!dead && (
          <div className="enemy-intent">
            <span className={`intent intent-${intent.kind}`}>
              {intentLabel(intent.kind)} {intent.damage ? `${intent.damage}` : intent.block ? `+${intent.block}` : ''}
            </span>
            <span className="enemy-intent-desc">{intent.description}</span>
          </div>
        )}
        {!dead && Object.keys(enemy.statuses).filter((k) => (enemy.statuses as any)[k]).length > 0 && (
          <div className="enemy-statuses">
            {Object.entries(enemy.statuses).map(([k, v]) =>
              v ? (
                <span key={k} className={`status status-${k}`}>
                  {statusLabel(k)} {v}
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Painted enemy portrait — replaces the old emoji sprite with a procedurally
 * drawn D&D-style illustration. Memoizes the data URL so we don't repaint on
 * every enemy hp/state change.
 */
function EnemyPortrait({
  defId,
  tint,
  dead,
  deathBurst,
  hitFlash,
}: {
  defId: string;
  tint: string;
  dead: boolean;
  deathBurst: boolean;
  hitFlash: 'damage' | null;
}) {
  const portrait = useMemo(() => enemyPortraitDataUrl(defId, 256, 256), [defId]);
  return (
    <div className="enemy-sprite enemy-sprite-portrait" style={{ background: tint }}>
      <motion.img
        src={portrait}
        alt=""
        draggable={false}
        animate={
          deathBurst
            ? { scale: [1, 1.15, 0.6], rotate: [0, -8, 12], opacity: [1, 0.8, 0] }
            : hitFlash === 'damage'
            ? { scale: [1, 1.04, 0.98, 1], rotate: [0, -2.5, 2, 0], opacity: dead ? 0.35 : 1 }
            : { scale: 1, rotate: 0, opacity: dead ? 0.35 : 1 }
        }
        transition={{ duration: deathBurst ? 0.9 : hitFlash ? 0.36 : 0.3 }}
        className="enemy-portrait-img"
      />
      <div className="enemy-sprite-vignette" />
      <AnimatePresence>
        {hitFlash === 'damage' && (
          <motion.div
            key="hit-flash"
            className="enemy-hit-flash"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.36, ease: 'easeOut' }}
          />
        )}
        {deathBurst && <DeathBurst />}
      </AnimatePresence>
    </div>
  );
}

/**
 * Bone-and-dust burst that radiates out from a dying enemy.
 */
function DeathBurst() {
  // Pre-pick deterministic-per-mount particles so a single dying enemy
  // doesn't accidentally lose its burst on re-render.
  const particles = useRef(
    Array.from({ length: 14 }).map(() => {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 70;
      const isBone = Math.random() < 0.45;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 20, // bias upward
        rot: (Math.random() - 0.5) * 540,
        glyph: isBone ? (Math.random() < 0.5 ? '🦴' : '💀') : '💨',
        delay: Math.random() * 0.08,
        size: 12 + Math.random() * 14,
      };
    }),
  );
  return (
    <div className="death-burst">
      {particles.current.map((p, i) => (
        <motion.span
          key={i}
          className="death-particle"
          initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
          animate={{ x: p.x, y: p.y, opacity: [0, 1, 0], scale: 1, rotate: p.rot }}
          transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
          style={{ fontSize: p.size }}
        >
          {p.glyph}
        </motion.span>
      ))}
    </div>
  );
}

function intentLabel(kind: string): string {
  switch (kind) {
    case 'attack': return '⚔';
    case 'defend': return '🛡';
    case 'buff': return '✦';
    case 'status': return '☠';
    default: return '?';
  }
}

function statusLabel(k: string): string {
  switch (k) {
    case 'bleed': return '🩸';
    case 'burn': return '🔥';
    case 'shield': return '🛡';
    case 'strength': return '💪';
    case 'manaDrain': return '∅';
    default: return k;
  }
}
