import { useState } from 'react';
import { useRunStore } from '@/state/runStore';
import { useMetaStore } from '@/state/metaStore';
import { Codex } from './Codex';
import { SettingsPanel } from './SettingsPanel';
import './MainMenu.css';
import './Codex.css';

export function MainMenu() {
  const goToSelect = useRunStore((s) => s.goToCrawlerSelect);
  const totalRuns = useMetaStore((s) => s.totalRuns);
  const bestFloor = useMetaStore((s) => s.bestFloor);
  const totalXp = useMetaStore((s) => s.totalXp);
  const unlockedCrawlers = useMetaStore((s) => s.unlockedCrawlers);
  const [codexOpen, setCodexOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="menu">
      <div className="menu-bg" />
      <div className="menu-content">
        <h1 className="menu-title">Crypt Crawlers</h1>
        <div className="menu-subtitle">A first-person dungeon deckbuilder</div>
        <div className="menu-buttons">
          <button className="big-button menu-start" onClick={goToSelect}>Begin a Run</button>
          <button onClick={() => setCodexOpen(true)}>Codex</button>
          <button onClick={() => setSettingsOpen(true)}>Settings</button>
        </div>
        {codexOpen && <Codex onClose={() => setCodexOpen(false)} />}
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
        <div className="menu-meta">
          <div>Runs: {totalRuns}</div>
          <div>Deepest floor: {bestFloor}</div>
          <div>Total XP: {totalXp}</div>
          <div>Crawlers unlocked: {unlockedCrawlers.length}</div>
        </div>
        <div className="menu-howto">
          <h3>How to play</h3>
          <ul>
            <li><b>W A S D / Arrows</b> — Move & turn. <b>Q E</b> — strafe.</li>
            <li>Step onto red <b>encounter glyphs</b> to fight. Open chests with <b>Space</b>.</li>
            <li>In combat, play cards in <b>ascending mana cost</b> to chain combos for ×1.5 each step.</li>
            <li><b>Wild cards</b> (grey) bridge the chain — they never break it.</li>
            <li>Defeat the floor boss, then step through the <b>portal</b> to descend.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
