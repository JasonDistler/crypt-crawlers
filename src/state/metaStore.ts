import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CRAWLERS } from '@/data/crawlers';

interface MetaState {
  totalXp: number;
  totalRuns: number;
  bestFloor: number;
  unlockedCrawlers: string[];
  discoveredCards: string[];
  defeatedBosses: string[];

  addXp: (amount: number) => void;
  registerRun: (floorReached: number, bossesKilled: string[], cardsSeen: string[]) => void;
  unlockCrawler: (id: string) => void;
  resetAll: () => void;
}

const defaultUnlocked = Object.values(CRAWLERS)
  .filter((c) => c.unlocked)
  .map((c) => c.id);

export const useMetaStore = create<MetaState>()(
  persist(
    (set, get) => ({
      totalXp: 0,
      totalRuns: 0,
      bestFloor: 0,
      unlockedCrawlers: defaultUnlocked,
      discoveredCards: [],
      defeatedBosses: [],

      addXp: (amount) => {
        const next = get().totalXp + amount;
        // Auto-unlock crawlers when XP threshold passed
        const newlyUnlocked: string[] = [];
        for (const c of Object.values(CRAWLERS)) {
          if (
            !c.unlocked &&
            c.unlockXp !== undefined &&
            next >= c.unlockXp &&
            !get().unlockedCrawlers.includes(c.id)
          ) {
            newlyUnlocked.push(c.id);
          }
        }
        set({
          totalXp: next,
          unlockedCrawlers: [...get().unlockedCrawlers, ...newlyUnlocked],
        });
      },

      registerRun: (floorReached, bossesKilled, cardsSeen) => {
        const cur = get();
        set({
          totalRuns: cur.totalRuns + 1,
          bestFloor: Math.max(cur.bestFloor, floorReached),
          defeatedBosses: Array.from(new Set([...cur.defeatedBosses, ...bossesKilled])),
          discoveredCards: Array.from(new Set([...cur.discoveredCards, ...cardsSeen])),
        });
      },

      unlockCrawler: (id) => {
        if (!get().unlockedCrawlers.includes(id)) {
          set({ unlockedCrawlers: [...get().unlockedCrawlers, id] });
        }
      },

      resetAll: () =>
        set({
          totalXp: 0,
          totalRuns: 0,
          bestFloor: 0,
          unlockedCrawlers: defaultUnlocked,
          discoveredCards: [],
          defeatedBosses: [],
        }),
    }),
    {
      name: 'crypt-crawlers-meta',
      version: 1,
    },
  ),
);
