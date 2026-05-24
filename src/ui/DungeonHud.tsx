import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRunStore, remainingFoes } from '@/state/runStore';
import { getCrawler } from '@/data/crawlers';
import { getFloorTheme } from '@/dungeon/themes';
import { Minimap } from './Minimap';
import { DeckViewer } from './DeckViewer';
import './DungeonHud.css';
import './DeckViewer.css';

export function DungeonHud() {
  // Subscribe to individual fields, not the whole store, to avoid re-renders
  // on every state change.
  const map = useRunStore((s) => s.map);
  const crawlerId = useRunStore((s) => s.crawlerId);
  const hp = useRunStore((s) => s.hp);
  const maxHp = useRunStore((s) => s.maxHp);
  const gold = useRunStore((s) => s.gold);
  const xp = useRunStore((s) => s.xp);
  const px = useRunStore((s) => s.px);
  const py = useRunStore((s) => s.py);
  const facing = useRunStore((s) => s.facing);
  const isMoving = useRunStore((s) => s.isMoving);

  const crawler = crawlerId ? getCrawler(crawlerId) : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const st = useRunStore.getState();
      if (st.mode !== 'dungeon' || st.isMoving) return;
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      if (key === 'w' || e.key === 'ArrowUp') st.tryStepForward();
      else if (key === 's' || e.key === 'ArrowDown') st.tryStepBackward();
      else if (key === 'q') st.tryStrafeLeft();
      else if (key === 'e') st.tryStrafeRight();
      else if (key === 'a' || e.key === 'ArrowLeft') st.turnLeft();
      else if (key === 'd' || e.key === 'ArrowRight') st.turnRight();
      else if (e.key === ' ' || e.key === 'Enter') {
        const cell = st.map?.cells[st.py]?.[st.px];
        if (cell?.kind === 'shovel') st.digToNextFloor();
        else if (cell?.kind === 'chest' && !cell.cleared) st.openChest();
        else if (cell?.kind === 'shrine' && !cell.cleared) st.useShrine();
      }
      else if (key === 'escape') st.toMenu();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Recompute remaining-foe counts whenever the map identity changes OR
  // whenever the player moves (which is when cells flip to `cleared`).
  // We mutate cells in place, so px/py is the most reliable invalidator.
  const foes = useMemo(
    () => (map ? remainingFoes(map) : { encounters: 0, bossAlive: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, px, py],
  );

  // Floor banner: briefly announce each new floor's theme.
  const [floorBanner, setFloorBanner] = useState<string | null>(null);
  useEffect(() => {
    if (!map) return;
    const theme = getFloorTheme(map.floor);
    setFloorBanner(`Floor ${map.floor} — ${theme.name}`);
    const t = setTimeout(() => setFloorBanner(null), 3200);
    return () => clearTimeout(t);
  }, [map?.floor, map]);

  if (!map || !crawler) return null;

  const cell = map.cells[py]?.[px];
  const canDig = cell?.kind === 'shovel';
  const portalUnlocked = foes.encounters === 0 && !foes.bossAlive;
  const canOpenChest = cell?.kind === 'chest' && !cell.cleared;
  const canUseShrine = cell?.kind === 'shrine' && !cell.cleared;
  const shrineKind = cell?.shrineKind;
  const isOnSpawn = cell?.kind === 'spawn';

  const actions = useRunStore.getState();

  return (
    <div className="dungeon-hud">
      <NoticeBanner />
      <AnimatePresence>
        {floorBanner && (
          <motion.div
            className="floor-banner"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="floor-banner-title">{floorBanner}</div>
            <div className="floor-banner-blurb">{getFloorTheme(map.floor).blurb}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hud-top-left">
        <div className="hud-card">
          <div className="hud-row">
            <span className="hud-label">{crawler.name}</span>
            <span className="hud-sub">Floor {map.floor}</span>
          </div>
          <div className="hud-bar hud-bar-hp">
            <div className="hud-bar-fill" style={{ width: `${(hp / maxHp) * 100}%` }} />
            <span className="hud-bar-text">{hp} / {maxHp} HP</span>
          </div>
          <div className="hud-stats">
            <span>🪙 {gold}</span>
            <span>✦ {xp} XP</span>
            <DeckViewer />
          </div>
        </div>
      </div>

      <div className="hud-top-right">
        <Minimap map={map} px={px} py={py} facing={facing} />
      </div>

      <div className="hud-bottom">
        <div className="hud-controls">
          <div className="hud-controls-grid">
            <div />
            <button onClick={() => actions.tryStepForward()} disabled={isMoving}>↑ W</button>
            <div />
            <button onClick={() => actions.turnLeft()} disabled={isMoving}>↶ A</button>
            <button onClick={() => actions.tryStepBackward()} disabled={isMoving}>↓ S</button>
            <button onClick={() => actions.turnRight()} disabled={isMoving}>↷ D</button>
            <button onClick={() => actions.tryStrafeLeft()} disabled={isMoving}>⇦ Q</button>
            <div />
            <button onClick={() => actions.tryStrafeRight()} disabled={isMoving}>⇨ E</button>
          </div>
          <div className="hud-hint">
            {canDig && portalUnlocked && (
              <button className="hud-action" onClick={() => actions.digToNextFloor()}>
                ✦ Enter Portal (Space)
              </button>
            )}
            {canDig && !portalUnlocked && (
              <button className="hud-action hud-action-locked" disabled>
                {portalLockedLabel(foes)}
              </button>
            )}
            {canOpenChest && (
              <button className="hud-action" onClick={() => actions.openChest()}>
                📦 Open chest (Space)
              </button>
            )}
            {canUseShrine && (
              <button
                className={`hud-action hud-action-${shrineKind === 'altar' ? 'altar' : 'shrine'}`}
                onClick={() => actions.useShrine()}
              >
                {shrineKind === 'altar'
                  ? '🩸 Dark Altar — sacrifice for power (Space)'
                  : '✨ Shrine of Light — drink to heal (Space)'}
              </button>
            )}
            {!canDig && !canOpenChest && !canUseShrine && (
              <span className="hud-hint-text">
                {isOnSpawn
                  ? 'Entrance. Explore!'
                  : !portalUnlocked
                  ? `${foes.encounters} encounter${foes.encounters === 1 ? '' : 's'}${
                      foes.bossAlive ? ' + the boss' : ''
                    } remain. Slay them all to open the portal.`
                  : 'All enemies vanquished — find the portal to descend.'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function portalLockedLabel(foes: { encounters: number; bossAlive: boolean }): string {
  const parts: string[] = [];
  if (foes.encounters > 0) {
    parts.push(`${foes.encounters} encounter${foes.encounters === 1 ? '' : 's'}`);
  }
  if (foes.bossAlive) parts.push('the boss');
  return `🔒 Portal Sealed — defeat ${parts.join(' & ')}`;
}

/**
 * Small banner that surfaces transient environment messages (hazards,
 * shrines, etc.) set via `runStore.showNotice`.
 */
function NoticeBanner() {
  const notice = useRunStore((s) => s.notice);
  const clearNotice = useRunStore((s) => s.clearNotice);

  useEffect(() => {
    if (!notice) return;
    const remaining = Math.max(200, notice.expiresAt - Date.now());
    const t = setTimeout(clearNotice, remaining);
    return () => clearTimeout(t);
  }, [notice, clearNotice]);

  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          key={notice.expiresAt}
          className={`hud-notice hud-notice-${notice.tone}`}
          initial={{ y: 30, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          {notice.text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
