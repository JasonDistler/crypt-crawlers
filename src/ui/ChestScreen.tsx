import { useRunStore } from '@/state/runStore';

export function ChestScreen() {
  const kind = useRunStore((s) => s.chestKind);
  const evolutionNote = useRunStore((s) => s.chestEvolutionNote);
  const acknowledgeChest = useRunStore((s) => s.acknowledgeChest);
  let title = 'Chest!';
  let body = '';
  if (kind === 'gold') {
    title = 'A pile of gold!';
    body = 'You stuff coins into your pouch.';
  } else if (kind === 'gem') {
    title = 'A glowing gem!';
    body = 'You feel restored. +10 HP.';
  }

  return (
    <div className="reward">
      <div className="reward-content">
        <h2>{title}</h2>
        <p className="reward-prompt">{body}</p>
        {evolutionNote && (
          <p className="reward-prompt" style={{ color: 'var(--accent-2)' }}>
            ✦ Card evolved: <b>{evolutionNote}</b>
          </p>
        )}
        <button className="big-button" onClick={() => acknowledgeChest()}>Continue</button>
      </div>
    </div>
  );
}
