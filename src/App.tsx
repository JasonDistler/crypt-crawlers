import { useEffect } from 'react';
import { useRunStore } from '@/state/runStore';
import { MainMenu } from '@/ui/MainMenu';
import { CrawlerSelect } from '@/ui/CrawlerSelect';
import { DungeonScene } from '@/dungeon/DungeonScene';
import { DungeonHud } from '@/ui/DungeonHud';
import { CombatScene } from '@/ui/CombatScene';
import { RewardScreen } from '@/ui/RewardScreen';
import { ChestScreen } from '@/ui/ChestScreen';
import { GameOverScreen, VictoryScreen } from '@/ui/EndScreens';
import { ErrorBoundary } from '@/ui/ErrorBoundary';
import { DebugOverlay } from '@/ui/DebugOverlay';
import { sfx } from '@/util/sound';

import '@/ui/Card.css';
import '@/ui/EnemyPanel.css';
import '@/ui/Minimap.css';

export function App() {
  const mode = useRunStore((s) => s.mode);

  // Resume audio context on first user gesture (browser autoplay policy).
  useEffect(() => {
    const handler = () => {
      sfx.resume();
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('pointerdown', handler);
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('pointerdown', handler);
      window.removeEventListener('keydown', handler);
    };
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Dungeon is rendered whenever the player is in or near the world,
          so transitions (combat, reward overlays) feel like a layer on top. */}
      {(mode === 'dungeon' || mode === 'combat' || mode === 'reward' || mode === 'chest') && (
        <ErrorBoundary label="DungeonScene">
          <DungeonScene />
        </ErrorBoundary>
      )}
      {mode === 'dungeon' && <DungeonHud />}
      <DebugOverlay />
      {mode === 'combat' && <CombatScene />}
      {mode === 'reward' && <RewardScreen />}
      {mode === 'chest' && <ChestScreen />}
      {mode === 'menu' && <MainMenu />}
      {mode === 'crawler-select' && <CrawlerSelect />}
      {mode === 'game-over' && <GameOverScreen />}
      {mode === 'victory' && <VictoryScreen />}
    </div>
  );
}
