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

  // ----- Settings (persisted across sessions) -----
  // Volumes are 0..1 multipliers; the audio module multiplies them together
  // when scheduling each beep. `ambientOn` toggles the looping dungeon drone.
  // `reducedMotion` collapses long animations (screen shake, mega-pulses) to
  // a single static frame for players who get motion-sick.
  sfxVolume: number;
  musicVolume: number;
  masterVolume: number;
  ambientOn: boolean;
  reducedMotion: boolean;

  addXp: (amount: number) => void;
  registerRun: (floorReached: number, bossesKilled: string[], cardsSeen: string[]) => void;
  unlockCrawler: (id: string) => void;
  resetAll: () => void;

  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setMasterVolume: (v: number) => void;
  setAmbientOn: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
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

      sfxVolume: 0.8,
      musicVolume: 0.55,
      masterVolume: 0.85,
      ambientOn: true,
      reducedMotion: false,

      setSfxVolume: (v) => set({ sfxVolume: clamp01(v) }),
      setMusicVolume: (v) => set({ musicVolume: clamp01(v) }),
      setMasterVolume: (v) => set({ masterVolume: clamp01(v) }),
      setAmbientOn: (v) => set({ ambientOn: v }),
      setReducedMotion: (v) => set({ reducedMotion: v }),

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
      version: 2,
      // Older saves predate the audio/motion settings — fall back to defaults.
      migrate: (persisted: any, fromVersion) => {
        if (!persisted) return persisted;
        if (fromVersion < 2) {
          return {
            sfxVolume: 0.8,
            musicVolume: 0.55,
            masterVolume: 0.85,
            ambientOn: true,
            reducedMotion: false,
            ...persisted,
          };
        }
        return persisted;
      },
    },
  ),
);

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}
