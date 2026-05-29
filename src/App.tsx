import { useEffect, useRef, useState } from 'react';
import { useRunStore } from '@/state/runStore';
import { useMetaStore } from '@/state/metaStore';
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
import { SettingsPanel } from '@/ui/SettingsPanel';
import { sfx } from '@/util/sound';

import '@/ui/Card.css';
import '@/ui/EnemyPanel.css';
import '@/ui/Minimap.css';

/**
 * Doom-style cheat codes. The handler in `App.tsx` listens for a backtick to
 * enter cheat-input mode, then accumulates lowercase alphanumeric keystrokes
 * until either the buffer matches a known code (cheat fires + buffer clears)
 * or the buffer length exceeds the longest registered code (cheat-input mode
 * exits silently).
 *
 * To add a new cheat: append a [code, fn] tuple. `fn` is called with no args
 * and can use `useRunStore.getState()` to dispatch any action.
 */
const CHEAT_CODES: Array<[string, () => void]> = [
  ['iddqd', () => {
    const wasOn = useRunStore.getState().godMode;
    useRunStore.getState().setGodMode();
    useRunStore.getState().showNotice(
      wasOn ? '🩹 GOD MODE: OFF' : '🛡 GOD MODE: ON — IDDQD',
      wasOn ? 'info' : 'good',
      2600,
    );
  }],
];

const LONGEST_CHEAT_LEN = CHEAT_CODES.reduce((m, [c]) => Math.max(m, c.length), 0);

export function App() {
  const mode = useRunStore((s) => s.mode);
  const godMode = useRunStore((s) => s.godMode);
  const masterVolume = useMetaStore((s) => s.masterVolume);
  const sfxVolume = useMetaStore((s) => s.sfxVolume);
  const musicVolume = useMetaStore((s) => s.musicVolume);
  const ambientOn = useMetaStore((s) => s.ambientOn);

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

  // Push volume changes into the audio engine whenever a slider moves.
  useEffect(() => {
    sfx.setVolumes(masterVolume, sfxVolume, musicVolume);
  }, [masterVolume, sfxVolume, musicVolume]);

  // Honor the ambient-music toggle live: if the player flips it off mid-run,
  // silence the drone; if they flip it on while in dungeon/combat, start it.
  useEffect(() => {
    if (!ambientOn) {
      sfx.ambient('off');
      return;
    }
    if (mode === 'dungeon' || mode === 'reward' || mode === 'chest') {
      sfx.ambient('dungeon');
    } else if (mode === 'combat') {
      sfx.ambient('combat');
    }
  }, [ambientOn, mode]);

  // ---------- Cheat-code keyboard handler ----------
  // Refs hold the live cheat-input state so the keydown handler can stay
  // attached for the lifetime of the component without churning on every
  // keystroke. The displayed buffer lives in state purely so React can
  // re-render the on-screen indicator.
  const cheatActiveRef = useRef(false);
  const cheatBufferRef = useRef('');
  const cheatTimeoutRef = useRef<number | null>(null);
  const [cheatBufferDisplay, setCheatBufferDisplay] = useState<string | null>(null);

  // Global settings modal — accessible from any mode via the corner gear icon.
  // Mid-run players can tweak volume / ambient / motion without losing progress.
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    function cancelCheat() {
      cheatActiveRef.current = false;
      cheatBufferRef.current = '';
      setCheatBufferDisplay(null);
      if (cheatTimeoutRef.current !== null) {
        window.clearTimeout(cheatTimeoutRef.current);
        cheatTimeoutRef.current = null;
      }
    }
    function armTimeout() {
      if (cheatTimeoutRef.current !== null) window.clearTimeout(cheatTimeoutRef.current);
      // 3.5s to finish typing a code before the buffer auto-cancels.
      cheatTimeoutRef.current = window.setTimeout(cancelCheat, 3500);
    }
    function onKey(e: KeyboardEvent) {
      // Backtick (or its shifted partner, the tilde) opens / re-opens cheat input.
      if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        cheatActiveRef.current = true;
        cheatBufferRef.current = '';
        setCheatBufferDisplay('');
        armTimeout();
        return;
      }
      if (!cheatActiveRef.current) return;
      if (e.key === 'Escape') {
        cancelCheat();
        return;
      }
      // Only accept simple alphanumeric characters; ignore modifiers, arrows,
      // etc. so we don't disrupt other input handlers.
      if (e.key.length !== 1 || !/^[a-z0-9]$/i.test(e.key)) return;
      e.preventDefault();
      const next = (cheatBufferRef.current + e.key.toLowerCase()).slice(-(LONGEST_CHEAT_LEN));
      cheatBufferRef.current = next;
      setCheatBufferDisplay(next);
      armTimeout();
      for (const [code, fn] of CHEAT_CODES) {
        if (next.endsWith(code)) {
          fn();
          cancelCheat();
          return;
        }
      }
      // If we've typed enough characters to overflow the longest cheat without
      // matching, exit cheat-input mode (player's keystrokes go nowhere otherwise).
      if (next.length >= LONGEST_CHEAT_LEN) {
        cancelCheat();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (cheatTimeoutRef.current !== null) window.clearTimeout(cheatTimeoutRef.current);
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

      {/* Cheat-input indicator — shows the buffer as the player types so they
          have feedback that the cheat handler captured their keystrokes. */}
      {cheatBufferDisplay !== null && (
        <div className="cheat-indicator">
          <span className="cheat-indicator-prompt">▸</span>
          <span className="cheat-indicator-buffer">
            {cheatBufferDisplay || '\u00A0'}
          </span>
          <span className="cheat-indicator-caret" />
        </div>
      )}

      {/* Persistent god-mode badge — visible across all modes so the player
          always knows the cheat is active. */}
      {godMode && (
        <div className="god-mode-badge" title="God mode (IDDQD). Press ` then type IDDQD again to disable.">
          🛡 GOD
        </div>
      )}

      {/* Global settings gear: hidden during the main menu (which has its own
          Settings button) but available in dungeon, combat, and end screens
          so the player can adjust audio without resetting their run. */}
      {mode !== 'menu' && (
        <button
          type="button"
          className="settings-gear"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          title="Settings"
        >
          ⚙
        </button>
      )}
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
