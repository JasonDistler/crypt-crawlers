import { useRunStore } from '@/state/runStore';
import { getCard } from '@/data/cards';
import { Card } from './Card';
import './RewardScreen.css';

export function RewardScreen() {
  const combat = useRunStore((s) => s.combat);
  const offers = useRunStore((s) => s.rewardOffers);
  const chestKind = useRunStore((s) => s.chestKind);
  const pickReward = useRunStore((s) => s.pickReward);
  const skipReward = useRunStore((s) => s.skipReward);

  const goldGained = combat?.pendingGold ?? 0;
  const xpGained = combat?.pendingXp ?? 0;
  const fromChest = chestKind === 'card';

  return (
    <div className="reward">
      <div className="reward-content">
        <h2>{fromChest ? 'Chest reward!' : 'Victory!'}</h2>
        {!fromChest && (
          <div className="reward-stats">
            <span>+{goldGained} gold</span>
            <span>+{xpGained} XP</span>
          </div>
        )}
        <p className="reward-prompt">Pick one card to add to your deck.</p>
        <div className="reward-cards">
          {offers.map((id) => {
            const def = getCard(id);
            return (
              <Card
                key={id}
                def={def}
                onClick={() => pickReward(id)}
              />
            );
          })}
        </div>
        <button onClick={() => skipReward()}>Skip</button>
      </div>
    </div>
  );
}
