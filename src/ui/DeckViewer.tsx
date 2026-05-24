import { useState } from 'react';
import { useRunStore } from '@/state/runStore';
import { getCard } from '@/data/cards';
import { Card } from './Card';
import './DeckViewer.css';

export function DeckViewer() {
  const deck = useRunStore((s) => s.deck);
  const [open, setOpen] = useState(false);

  // Group by card id, count duplicates
  const grouped: Record<string, number> = {};
  for (const id of deck) grouped[id] = (grouped[id] ?? 0) + 1;
  const entries = Object.entries(grouped).sort(([a], [b]) => {
    return getCard(a).cost - getCard(b).cost || a.localeCompare(b);
  });

  return (
    <>
      <button className="deck-toggle" onClick={() => setOpen(true)}>
        🃏 Deck ({deck.length})
      </button>
      {open && (
        <div className="deck-viewer" onClick={() => setOpen(false)}>
          <div className="deck-viewer-content" onClick={(e) => e.stopPropagation()}>
            <h2>Your Deck</h2>
            <div className="deck-list">
              {entries.map(([id, n]) => (
                <div key={id} className="deck-list-entry">
                  <Card def={getCard(id)} small />
                  <div className="deck-count">×{n}</div>
                </div>
              ))}
            </div>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}
