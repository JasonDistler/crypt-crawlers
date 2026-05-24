import { useState } from 'react';
import { useRunStore } from '@/state/runStore';

/**
 * Always-visible top-of-screen debug strip so we can see what mode the app
 * is in even if the 3D layer silently fails to render.
 */
export function DebugOverlay() {
  const mode = useRunStore((s) => s.mode);
  const crawlerId = useRunStore((s) => s.crawlerId);
  const map = useRunStore((s) => s.map);
  const px = useRunStore((s) => s.px);
  const py = useRunStore((s) => s.py);
  const facing = useRunStore((s) => s.facing);
  const hp = useRunStore((s) => s.hp);
  const maxHp = useRunStore((s) => s.maxHp);
  const deckLen = useRunStore((s) => s.deck.length);
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <button
        style={{
          position: 'fixed',
          bottom: 4,
          left: 4,
          zIndex: 99999,
          fontSize: 10,
          padding: '2px 6px',
        }}
        onClick={() => setOpen(true)}
      >
        debug
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 4,
        left: 4,
        background: 'rgba(0,0,0,0.85)',
        color: '#0f0',
        padding: '6px 10px',
        fontFamily: 'monospace',
        fontSize: 11,
        lineHeight: 1.4,
        zIndex: 99999,
        border: '1px solid #0f0',
        pointerEvents: 'auto',
      }}
    >
      <div>mode: {mode}</div>
      <div>crawler: {crawlerId ?? 'none'}</div>
      <div>map: {map ? `${map.width}×${map.height} floor ${map.floor}` : 'null'}</div>
      <div>pos: ({px}, {py}) face {facing}</div>
      <div>hp: {hp}/{maxHp} · deck {deckLen}</div>
      <button
        style={{ fontSize: 10, padding: '0 4px', marginTop: 4 }}
        onClick={() => setOpen(false)}
      >
        hide
      </button>
    </div>
  );
}
