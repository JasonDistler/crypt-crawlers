import { useMetaStore } from '@/state/metaStore';
import { sfx } from '@/util/sound';
import './SettingsPanel.css';

/**
 * Modal settings panel: audio levels + accessibility toggles. Persists via
 * the existing meta store, so changes survive page reloads and runs.
 *
 * Each slider previews its effect immediately:
 *  - Moving the SFX slider plays a short click.
 *  - Moving the music slider re-starts/keeps the drone audible.
 *  - The reduced-motion toggle is read by CombatScene to skip the shake.
 */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const masterVolume = useMetaStore((s) => s.masterVolume);
  const sfxVolume = useMetaStore((s) => s.sfxVolume);
  const musicVolume = useMetaStore((s) => s.musicVolume);
  const ambientOn = useMetaStore((s) => s.ambientOn);
  const reducedMotion = useMetaStore((s) => s.reducedMotion);

  const setMaster = useMetaStore((s) => s.setMasterVolume);
  const setSfx = useMetaStore((s) => s.setSfxVolume);
  const setMusic = useMetaStore((s) => s.setMusicVolume);
  const setAmbient = useMetaStore((s) => s.setAmbientOn);
  const setReducedMotion = useMetaStore((s) => s.setReducedMotion);

  // Auditioning the slider: ping the SFX bus so the player hears the new level.
  const previewSfx = () => sfx.cardPick();

  return (
    <div
      className="settings-modal"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="settings-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <header className="settings-panel-header">
          <h2>Settings</h2>
          <button onClick={onClose} aria-label="Close settings">×</button>
        </header>

        <section className="settings-section">
          <h3>Audio</h3>

          <SliderRow
            label="Master"
            value={masterVolume}
            onChange={setMaster}
            onCommit={previewSfx}
          />
          <SliderRow
            label="Sound Effects"
            value={sfxVolume}
            onChange={setSfx}
            onCommit={previewSfx}
          />
          <SliderRow
            label="Music"
            value={musicVolume}
            onChange={setMusic}
          />

          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={ambientOn}
              onChange={(e) => setAmbient(e.target.checked)}
            />
            <span>Ambient drone (dungeon &amp; combat pads)</span>
          </label>
        </section>

        <section className="settings-section">
          <h3>Accessibility</h3>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
            />
            <span>Reduce motion (disables screen shake)</span>
          </label>
        </section>

        <footer className="settings-panel-footer">
          <button className="big-button" onClick={onClose}>Done</button>
        </footer>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <label className="settings-slider-row">
      <span className="settings-slider-label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
      />
      <span className="settings-slider-value">{Math.round(value * 100)}%</span>
    </label>
  );
}
