import { useRunStore } from '@/state/runStore';
import { useMetaStore } from '@/state/metaStore';

export function GameOverScreen() {
  const toMenu = useRunStore((s) => s.toMenu);
  const goToSelect = useRunStore((s) => s.goToCrawlerSelect);
  const totalXp = useMetaStore((s) => s.totalXp);
  const bestFloor = useMetaStore((s) => s.bestFloor);
  const totalRuns = useMetaStore((s) => s.totalRuns);

  return (
    <div className="reward">
      <div className="reward-content">
        <h2 style={{ color: 'var(--health)' }}>You have fallen.</h2>
        <p className="reward-prompt">
          The crypt swallows your bones, but your story echoes. Earned XP has been added to your meta-progress.
        </p>
        <div className="reward-stats">
          <span>Total XP: {totalXp}</span>
          <span>Best floor: {bestFloor}</span>
          <span>Total runs: {totalRuns}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="big-button" onClick={goToSelect}>Try again</button>
          <button onClick={toMenu}>Main menu</button>
        </div>
      </div>
    </div>
  );
}

export function VictoryScreen() {
  const toMenu = useRunStore((s) => s.toMenu);
  const goToSelect = useRunStore((s) => s.goToCrawlerSelect);
  const totalXp = useMetaStore((s) => s.totalXp);
  const bestFloor = useMetaStore((s) => s.bestFloor);
  const unlockedCount = useMetaStore((s) => s.unlockedCrawlers.length);

  return (
    <div className="reward">
      <div className="reward-content">
        <h2 style={{ color: 'var(--accent-2)' }}>The Crypt is conquered!</h2>
        <p className="reward-prompt">
          You buried the Ancient Lich and crawled back to the surface. Your legend grows.
        </p>
        <div className="reward-stats">
          <span>Total XP: {totalXp}</span>
          <span>Best floor: {bestFloor}</span>
          <span>Crawlers unlocked: {unlockedCount}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="big-button" onClick={goToSelect}>New run</button>
          <button onClick={toMenu}>Main menu</button>
        </div>
      </div>
    </div>
  );
}
