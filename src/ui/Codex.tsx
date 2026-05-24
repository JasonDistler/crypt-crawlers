import { useState } from 'react';
import { useMetaStore } from '@/state/metaStore';
import { CARDS, getCard } from '@/data/cards';
import { ENEMIES } from '@/data/enemies';
import { Card } from './Card';
import './Codex.css';

export function Codex({ onClose }: { onClose: () => void }) {
  const discoveredCards = useMetaStore((s) => s.discoveredCards);
  const defeatedBosses = useMetaStore((s) => s.defeatedBosses);
  const [tab, setTab] = useState<'cards' | 'bosses' | 'about'>('cards');

  const allCardIds = Object.keys(CARDS);
  const discoveredSet = new Set(discoveredCards);

  return (
    <div className="codex">
      <div className="codex-content">
        <div className="codex-tabs">
          <button onClick={() => setTab('cards')} className={tab === 'cards' ? 'codex-tab-active' : ''}>
            Cards ({discoveredSet.size}/{allCardIds.length})
          </button>
          <button onClick={() => setTab('bosses')} className={tab === 'bosses' ? 'codex-tab-active' : ''}>
            Bosses ({defeatedBosses.length})
          </button>
          <button onClick={() => setTab('about')} className={tab === 'about' ? 'codex-tab-active' : ''}>
            About
          </button>
        </div>

        {tab === 'cards' && (
          <div className="codex-cards">
            {allCardIds.map((id) => {
              const def = getCard(id);
              const seen = discoveredSet.has(id);
              return (
                <div key={id} className={seen ? '' : 'codex-undiscovered'}>
                  {seen ? (
                    <Card def={def} small />
                  ) : (
                    <div className="codex-mystery">?</div>
                  )}
                  {seen && def.evolvesTo && (
                    <div className="codex-evolution">→ {getCard(def.evolvesTo).name}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {tab === 'bosses' && (
          <div className="codex-bosses">
            {Object.values(ENEMIES)
              .filter((e) => e.isBoss)
              .map((b) => {
                const defeated = defeatedBosses.some((id) => id.includes(b.id));
                return (
                  <div key={b.id} className={`codex-boss ${defeated ? '' : 'codex-undiscovered'}`}>
                    <div className="codex-boss-sprite" style={{ background: b.tint }}>
                      {defeated ? b.sprite : '?'}
                    </div>
                    <div className="codex-boss-name">
                      {defeated ? b.name : '???'}
                    </div>
                    <div className="codex-boss-status">
                      {defeated ? '✓ Defeated' : 'Not yet defeated'}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {tab === 'about' && (
          <div className="codex-about">
            <h3>About Crypt Crawlers</h3>
            <p>
              A loving homage to <i>Vampire Crawlers</i> by poncle. First-person grid-based dungeon
              crawling meets a Mana Chain card combat system. Play cards in ascending mana cost to
              extend a combo and multiply effects; use Wild cards (grey) to bridge gaps. Defeat the
              boss on each floor and step into the portal to descend.
            </p>
            <h3>Tips</h3>
            <ul>
              <li>Cost-0 wilds at the start of a chain are nearly free combo seeds.</li>
              <li>Long combos benefit AoE attacks dramatically — chain into Cleave or Pentagram.</li>
              <li>Garlic and Vampiric Bite shine in long boss fights.</li>
              <li>Bleed and Burn tick at end of round — stack them then defend.</li>
            </ul>
          </div>
        )}

        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
