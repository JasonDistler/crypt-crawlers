import clsx from 'clsx';
import { CRAWLER_LIST } from '@/data/crawlers';
import { useRunStore } from '@/state/runStore';
import { useMetaStore } from '@/state/metaStore';
import { getCard } from '@/data/cards';
import { crawlerPortraitDataUrl } from '@/art/portraits';
import './CrawlerSelect.css';

export function CrawlerSelect() {
  const startRun = useRunStore((s) => s.startRun);
  const toMenu = useRunStore((s) => s.toMenu);
  const unlocked = useMetaStore((s) => s.unlockedCrawlers);
  const totalXp = useMetaStore((s) => s.totalXp);
  // (these are already individual selectors; no fix needed)

  return (
    <div className="crawler-select">
      <h2>Choose your Crawler</h2>
      <div className="crawler-grid">
        {CRAWLER_LIST.map((c) => {
          const isUnlocked = unlocked.includes(c.id);
          return (
            <div key={c.id} className={clsx('crawler-card', { 'crawler-locked': !isUnlocked })}>
              <div className="crawler-portrait">
                <img
                  className="crawler-portrait-img"
                  src={crawlerPortraitDataUrl(c.id, 256, 320)}
                  alt={c.name}
                  draggable={false}
                />
                <div className="crawler-portrait-frame" />
              </div>
              <h3>{c.name}</h3>
              <div className="crawler-desc">{c.description}</div>
              <div className="crawler-stats">
                <span>❤ {c.maxHp}</span>
                <span>✦ {c.startingMana} mana</span>
                <span>🃏 {c.startingHandSize} hand</span>
              </div>
              <div className="crawler-passive">
                <b>Passive:</b> {c.passive}
              </div>
              <div className="crawler-deck">
                <b>Starter deck:</b>{' '}
                {Object.entries(countDeck(c.starterDeck)).map(([id, n]) => (
                  <span key={id} className="deck-entry">
                    {getCard(id).name}×{n}
                  </span>
                ))}
              </div>
              {isUnlocked ? (
                <button className="big-button" onClick={() => startRun(c.id)}>Choose</button>
              ) : (
                <div className="crawler-lock">
                  🔒 Unlocks at {c.unlockXp} XP ({Math.max(0, (c.unlockXp ?? 0) - totalXp)} more)
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button onClick={toMenu}>← Back to menu</button>
    </div>
  );
}

function countDeck(ids: string[]): Record<string, number> {
  return ids.reduce((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

