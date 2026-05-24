import { create } from 'zustand';
import type {
  CardInstance,
  CombatState,
  DungeonMap,
  EnemyInstance,
  Facing,
  GameMode,
  StatusKind,
} from '@/types';
import { getCrawler } from '@/data/crawlers';
import { CARDS, REWARD_POOL, getCard } from '@/data/cards';
import { getEnemy } from '@/data/enemies';
import { generateFloor, isWalkable, updateVisibility } from '@/dungeon/generator';
import { computeChain, scaleEffect } from '@/combat/manaChain';
import { randInt, shuffleInPlace, uid } from '@/util/rng';
import { sfx } from '@/util/sound';
import { useMetaStore } from './metaStore';

// =============================================================================
// State shape
// =============================================================================

interface RunState {
  mode: GameMode;
  crawlerId: string | null;
  seed: number;

  // Persistent (this run) player resources
  hp: number;
  maxHp: number;
  gold: number;
  xp: number;
  deck: string[]; // CardDef ids (full deck — shuffled into drawPile each combat)
  cardsSeenThisRun: string[];

  // Dungeon
  map: DungeonMap | null;
  px: number;
  py: number;
  facing: Facing; // 0=N, 1=E, 2=S, 3=W
  bossesKilled: string[];

  // Combat
  combat: CombatState | null;
  // Was the current combat an elite? Drives bigger rewards on victory.
  combatIsElite: boolean;

  // Reward state
  rewardOffers: string[]; // CardDef ids being offered to player to add to deck
  rewardOriginCellKey?: string; // "x,y" of cell that produced reward (so we mark it cleared)

  // Chest reward in-progress
  chestKind?: 'card' | 'gold' | 'gem';
  chestEvolutionNote?: string;

  // Transient HUD notice for environmental events (hazards, shrines, etc.)
  notice?: { text: string; tone: 'good' | 'bad' | 'info'; expiresAt: number };

  // Pending: are we waiting for an animation? (used by camera tween)
  isMoving: boolean;
  // ===== actions =====
  startRun: (crawlerId: string) => void;
  toMenu: () => void;
  goToCrawlerSelect: () => void;

  // Dungeon nav
  setMoving: (m: boolean) => void;
  tryStepForward: () => void;
  tryStepBackward: () => void;
  tryStrafeLeft: () => void;
  tryStrafeRight: () => void;
  turnLeft: () => void;
  turnRight: () => void;

  // Combat actions
  addToChain: (handIndex: number) => void;
  removeFromChain: (chainIndex: number) => void;
  clearChain: () => void;
  endTurn: () => void;
  flee: () => void;

  // Reward / chest
  pickReward: (cardId: string) => void;
  skipReward: () => void;
  openChest: () => void;
  acknowledgeChest: () => void;

  // Environment interactions
  useShrine: () => void;
  showNotice: (text: string, tone: 'good' | 'bad' | 'info', ttlMs?: number) => void;
  clearNotice: () => void;

  // Floor transition
  digToNextFloor: () => void;

  // Internal helpers (exposed for components if needed)
  _enterCombat: (
    encounterId: string,
    isBoss: boolean,
    cellX: number,
    cellY: number,
    isElite?: boolean,
  ) => void;
  _endCombatVictory: () => void;
  _endCombatDefeat: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function buildCardInstance(defId: string): CardInstance {
  return { uid: uid('c'), defId };
}

function shuffleDeck(deckIds: string[], rng: () => number): CardInstance[] {
  const pile = deckIds.map((id) => buildCardInstance(id));
  shuffleInPlace(rng, pile);
  return pile;
}

const FACE_DX: Record<Facing, number> = { 0: 0, 1: 1, 2: 0, 3: -1 };
const FACE_DY: Record<Facing, number> = { 0: -1, 1: 0, 2: 1, 3: 0 };

function applyPlayerStrengthBonus(rawDamage: number, statuses: Partial<Record<StatusKind, number>>) {
  return rawDamage + (statuses.strength ?? 0);
}

/**
 * Counts uncleared encounters and whether the boss is still alive on the
 * given map. Used by the HUD (to lock the portal button) and by the run
 * store (to refuse `digToNextFloor` until everything's cleared).
 */
export function remainingFoes(map: DungeonMap): {
  encounters: number;
  bossAlive: boolean;
} {
  let encounters = 0;
  let bossAlive = false;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const c = map.cells[y][x];
      if (c.kind === 'encounter' && !c.cleared) encounters++;
      else if (c.kind === 'boss' && !c.cleared) bossAlive = true;
    }
  }
  return { encounters, bossAlive };
}

function applyEnemyArmor(rawDamage: number, statuses: Partial<Record<StatusKind, number>>) {
  const shield = statuses.shield ?? 0;
  if (rawDamage <= 0) return { dealt: 0, shieldLeft: shield };
  const absorbed = Math.min(shield, rawDamage);
  return { dealt: rawDamage - absorbed, shieldLeft: shield - absorbed };
}

/**
 * Player passive lookup. Each crawler tweaks card effects / starting values.
 */
function applyPassiveToCardDamage(crawlerId: string | null, baseDamage: number, cardType: string) {
  if (!crawlerId) return baseDamage;
  if (crawlerId === 'antonio' && cardType === 'attack') return baseDamage + 1;
  return baseDamage;
}

function drawCards(combat: CombatState, n: number) {
  for (let i = 0; i < n; i++) {
    if (combat.drawPile.length === 0) {
      // reshuffle discard into draw
      if (combat.discardPile.length === 0) return;
      combat.drawPile = combat.discardPile;
      combat.discardPile = [];
      // simple shuffle with Math.random — combat shuffle isn't seed-critical
      shuffleInPlace(Math.random, combat.drawPile);
    }
    const c = combat.drawPile.shift()!;
    combat.hand.push(c);
  }
}

// =============================================================================
// Store
// =============================================================================

export const useRunStore = create<RunState>((set, get) => ({
  mode: 'menu',
  crawlerId: null,
  seed: Date.now() & 0xffffffff,
  hp: 0,
  maxHp: 0,
  gold: 0,
  xp: 0,
  deck: [],
  cardsSeenThisRun: [],
  map: null,
  px: 0,
  py: 0,
  facing: 1,
  bossesKilled: [],
  combat: null,
  combatIsElite: false,
  rewardOffers: [],
  isMoving: false,

  // ---------------------------------------------------------------------------
  startRun: (crawlerId) => {
    const crawler = getCrawler(crawlerId);
    const seed = Date.now() & 0xffffffff;
    const map = generateFloor({ floor: 1, seed });
    updateVisibility(map, map.spawn.x, map.spawn.y, 5);
    set({
      mode: 'dungeon',
      crawlerId,
      seed,
      hp: crawler.maxHp,
      maxHp: crawler.maxHp,
      gold: 0,
      xp: 0,
      deck: [...crawler.starterDeck],
      cardsSeenThisRun: [...crawler.starterDeck],
      map,
      px: map.spawn.x,
      py: map.spawn.y,
      facing: 1,
      bossesKilled: [],
      combat: null,
      combatIsElite: false,
      rewardOffers: [],
      isMoving: false,
      notice: undefined,
    });
  },

  toMenu: () => set({ mode: 'menu' }),
  goToCrawlerSelect: () => set({ mode: 'crawler-select' }),

  setMoving: (m) => set({ isMoving: m }),

  // ---------------------------------------------------------------------------
  // Movement
  // ---------------------------------------------------------------------------
  tryStepForward: () => stepRelative(set, get, 0, 1),
  tryStepBackward: () => stepRelative(set, get, 0, -1),
  tryStrafeLeft: () => stepRelative(set, get, -1, 0),
  tryStrafeRight: () => stepRelative(set, get, 1, 0),

  turnLeft: () =>
    set((s) => ({ facing: ((s.facing + 3) % 4) as Facing })),
  turnRight: () =>
    set((s) => ({ facing: ((s.facing + 1) % 4) as Facing })),

  // ---------------------------------------------------------------------------
  // Combat entry
  // ---------------------------------------------------------------------------
  _enterCombat: (encounterId, isBoss, cellX, cellY, isElite = false) => {
    sfx.combatStart();
    const { deck, hp, maxHp, crawlerId } = get();
    const crawler = getCrawler(crawlerId!);
    const enemyIds = encounterId.split(',');
    const enemies: EnemyInstance[] = enemyIds.map((id) => {
      const def = getEnemy(id);
      // Elites have 40% beefier HP pools.
      const hpMul = isElite ? 1.4 : 1;
      const eliteMaxHp = Math.round(def.maxHp * hpMul);
      return {
        uid: uid('e'),
        defId: id,
        hp: eliteMaxHp,
        maxHp: eliteMaxHp,
        statuses: {},
        intentIndex: 0,
      };
    });

    const drawPile = shuffleDeck(deck, Math.random);
    const handSize = crawler.startingHandSize + (crawlerId === 'imelda' ? 1 : 0);
    const startingMana = crawler.startingMana + (crawlerId === 'pasqualina' ? 1 : 0);

    const combat: CombatState = {
      enemies,
      encounterId,
      isBoss,
      drawPile,
      discardPile: [],
      hand: [],
      chain: [],
      mana: startingMana,
      maxMana: startingMana,
      hp,
      maxHp,
      statuses: {},
      turn: 1,
      log: [`A ${enemies.map((e) => getEnemy(e.defId).name).join(', ')} appears!`],
      resolving: false,
    };
    drawCards(combat, handSize);

    set({
      mode: 'combat',
      combat,
      combatIsElite: isElite,
      rewardOriginCellKey: `${cellX},${cellY}`,
    });
  },

  // ---------------------------------------------------------------------------
  // Combat actions
  // ---------------------------------------------------------------------------
  addToChain: (handIndex) => {
    const s = get();
    if (!s.combat) return;
    const c = s.combat.hand[handIndex];
    if (!c) return;
    const def = getCard(c.defId);
    if (def.cost > s.combat.mana) return;
    sfx.cardPick();
    const newHand = [...s.combat.hand];
    newHand.splice(handIndex, 1);
    set({
      combat: {
        ...s.combat,
        hand: newHand,
        chain: [...s.combat.chain, c],
        mana: s.combat.mana - def.cost,
      },
    });
  },

  removeFromChain: (chainIndex) => {
    const s = get();
    if (!s.combat) return;
    const c = s.combat.chain[chainIndex];
    if (!c) return;
    sfx.cardReturn();
    const def = getCard(c.defId);
    const newChain = [...s.combat.chain];
    newChain.splice(chainIndex, 1);
    set({
      combat: {
        ...s.combat,
        chain: newChain,
        hand: [...s.combat.hand, c],
        mana: s.combat.mana + def.cost,
      },
    });
  },

  clearChain: () => {
    const s = get();
    if (!s.combat) return;
    let refund = 0;
    for (const c of s.combat.chain) refund += getCard(c.defId).cost;
    set({
      combat: {
        ...s.combat,
        hand: [...s.combat.hand, ...s.combat.chain],
        chain: [],
        mana: s.combat.mana + refund,
      },
    });
  },

  endTurn: () => {
    const s = get();
    if (!s.combat) return;
    resolveTurn(set, get);
  },

  flee: () => {
    // Simple: take 5% max hp damage, return to dungeon. Boss can't flee.
    const s = get();
    if (!s.combat) return;
    if (s.combat.isBoss) return;
    const dmg = Math.max(1, Math.floor(s.maxHp * 0.1));
    const newHp = Math.max(0, s.hp - dmg);
    if (newHp <= 0) {
      get()._endCombatDefeat();
      return;
    }
    set({ hp: newHp, combat: null, mode: 'dungeon' });
  },

  // ---------------------------------------------------------------------------
  // Combat resolution helpers
  // ---------------------------------------------------------------------------
  _endCombatVictory: () => {
    sfx.victory();
    const s = get();
    if (!s.combat) return;

    // Tally rewards
    let totalGold = 0;
    let totalXp = 0;
    for (const enemyId of s.combat.encounterId.split(',')) {
      const def = getEnemy(enemyId);
      totalGold += randInt(Math.random, def.goldReward[0], def.goldReward[1]);
      totalXp += def.xpReward;
    }
    // Elite bonus: double gold/XP and an extra reward offer.
    if (s.combatIsElite) {
      totalGold = Math.round(totalGold * 2);
      totalXp = Math.round(totalXp * 1.5);
    }

    const newBossesKilled = s.combat.isBoss
      ? Array.from(new Set([...s.bossesKilled, s.combat.encounterId]))
      : s.bossesKilled;

    // Mark cell cleared
    const [cx, cy] = (s.rewardOriginCellKey ?? '0,0').split(',').map(Number);
    if (s.map) {
      s.map.cells[cy][cx].cleared = true;
      // boss cell stays as 'boss' so we can render it; gameplay logic guards by cleared
    }

    // Roll reward card offers — bosses pick from 4, elites from 4, normal 3.
    const offerCount = s.combat.isBoss || s.combatIsElite ? 4 : 3;
    const offers = rollRewardOffers(offerCount, s.deck);

    set({
      mode: 'reward',
      hp: s.combat.hp,
      gold: s.gold + totalGold,
      xp: s.xp + totalXp,
      bossesKilled: newBossesKilled,
      combat: { ...s.combat, pendingGold: totalGold, pendingXp: totalXp },
      rewardOffers: offers,
      combatIsElite: false,
      cardsSeenThisRun: Array.from(new Set([...s.cardsSeenThisRun, ...offers])),
    });
  },

  _endCombatDefeat: () => {
    sfx.defeat();
    const s = get();
    const meta = useMetaStore.getState();
    meta.addXp(Math.floor(s.xp / 2));
    meta.registerRun(s.map?.floor ?? 1, s.bossesKilled, s.cardsSeenThisRun);
    set({ mode: 'game-over', combat: null });
  },

  // ---------------------------------------------------------------------------
  // Reward & chest
  // ---------------------------------------------------------------------------
  pickReward: (cardId) => {
    const s = get();
    set({
      deck: [...s.deck, cardId],
      rewardOffers: [],
      combat: null,
      mode: 'dungeon',
    });
  },

  skipReward: () => {
    set({ rewardOffers: [], combat: null, mode: 'dungeon' });
  },

  openChest: () => {
    const s = get();
    if (!s.map) return;
    const cell = s.map.cells[s.py][s.px];
    if (cell.kind !== 'chest' || cell.cleared) return;
    const kind = cell.chestKind ?? 'gold';
    cell.cleared = true;

    sfx.chest();
    if (kind === 'gold') {
      const amount = randInt(Math.random, 15, 35);
      set({ gold: s.gold + amount, chestKind: 'gold', mode: 'chest' });
    } else if (kind === 'card') {
      const offers = rollRewardOffers(3, s.deck);
      set({ rewardOffers: offers, chestKind: 'card', mode: 'reward',
        cardsSeenThisRun: Array.from(new Set([...s.cardsSeenThisRun, ...offers])),
      });
    } else {
      // Gem: heal 10 AND attempt to evolve a random evolvable card in the deck.
      const newHp = Math.min(s.maxHp, s.hp + 10);
      const evolvableIndices: number[] = [];
      s.deck.forEach((id, i) => {
        if (CARDS[id]?.evolvesTo) evolvableIndices.push(i);
      });
      let newDeck = s.deck;
      let evolvedNote: string | undefined;
      let evolvedToId: string | undefined;
      if (evolvableIndices.length > 0) {
        const pick = evolvableIndices[Math.floor(Math.random() * evolvableIndices.length)];
        const fromId = s.deck[pick];
        const toId = CARDS[fromId].evolvesTo!;
        newDeck = [...s.deck];
        newDeck[pick] = toId;
        evolvedNote = `${CARDS[fromId].name} → ${CARDS[toId].name}`;
        evolvedToId = toId;
      }
      set({
        hp: newHp,
        deck: newDeck,
        chestKind: 'gem',
        mode: 'chest',
        chestEvolutionNote: evolvedNote,
        cardsSeenThisRun: evolvedToId
          ? Array.from(new Set([...s.cardsSeenThisRun, evolvedToId]))
          : s.cardsSeenThisRun,
      });
    }
  },

  acknowledgeChest: () => set({ chestKind: undefined, chestEvolutionNote: undefined, mode: 'dungeon' }),

  // ---------------------------------------------------------------------------
  // Environment
  // ---------------------------------------------------------------------------
  useShrine: () => {
    const s = get();
    if (!s.map) return;
    const cell = s.map.cells[s.py]?.[s.px];
    if (cell?.kind !== 'shrine' || cell.cleared) return;
    cell.cleared = true;
    sfx.chest();
    if (cell.shrineKind === 'altar') {
      // Altar: sacrifice 3 current HP for +5 max HP permanently this run.
      const sacrifice = Math.min(3, Math.max(1, s.hp - 1));
      const newMaxHp = s.maxHp + 5;
      const newHp = Math.max(1, s.hp - sacrifice + 5); // also bumps current
      set({ hp: newHp, maxHp: newMaxHp });
      get().showNotice(
        `Dark altar: -${sacrifice} HP, +5 MAX HP`,
        'info',
        2400,
      );
    } else {
      // Heal: restore a chunk of HP
      const amount = Math.round(s.maxHp * 0.35);
      const newHp = Math.min(s.maxHp, s.hp + amount);
      set({ hp: newHp });
      get().showNotice(`Shrine of Light: +${newHp - s.hp} HP`, 'good', 2200);
    }
  },

  showNotice: (text, tone, ttlMs = 2500) => {
    set({ notice: { text, tone, expiresAt: Date.now() + ttlMs } });
  },

  clearNotice: () => set({ notice: undefined }),

  // ---------------------------------------------------------------------------
  // Floor transition
  // ---------------------------------------------------------------------------
  digToNextFloor: () => {
    const s = get();
    if (!s.map) return;
    // Portal is locked until every encounter and the floor boss are cleared.
    // The player can still try (e.g. mashing space on the portal cell), so we
    // silently no-op here; the HUD also disables its button and tells the
    // player what's left.
    const remaining = remainingFoes(s.map);
    if (remaining.encounters > 0 || remaining.bossAlive) return;
    const nextFloor = s.map.floor + 1;
    if (nextFloor > 10) {
      // Victory!
      const meta = useMetaStore.getState();
      meta.addXp(s.xp);
      meta.registerRun(s.map.floor, s.bossesKilled, s.cardsSeenThisRun);
      set({ mode: 'victory' });
      return;
    }
    const seed = (s.seed + nextFloor * 7919) & 0xffffffff;
    const newMap = generateFloor({ floor: nextFloor, seed });
    updateVisibility(newMap, newMap.spawn.x, newMap.spawn.y, 5);
    set({
      map: newMap,
      px: newMap.spawn.x,
      py: newMap.spawn.y,
      facing: 1,
    });
  },
}));

// =============================================================================
// Movement implementation (operates on store)
// =============================================================================

function stepRelative(
  set: (partial: Partial<RunState>) => void,
  get: () => RunState,
  strafe: number,
  forward: number,
) {
  const s = get();
  if (!s.map || s.mode !== 'dungeon' || s.isMoving) return;

  const f = s.facing;
  // Forward axis
  const fdx = FACE_DX[f];
  const fdy = FACE_DY[f];
  // Right vector (rotate facing right)
  const rf = ((f + 1) % 4) as Facing;
  const rdx = FACE_DX[rf];
  const rdy = FACE_DY[rf];

  const nx = s.px + fdx * forward + rdx * strafe;
  const ny = s.py + fdy * forward + rdy * strafe;

  if (!isWalkable(s.map, nx, ny)) return;
  sfx.step();

  // Mutate map visibility in place (fine for the store; UI re-reads)
  updateVisibility(s.map, nx, ny, 5);

  const cell = s.map.cells[ny][nx];

  set({ px: nx, py: ny, isMoving: true });

  // Trigger encounter / interactions a moment after move starts so the
  // camera tween can play. The 3D component will turn off `isMoving` when
  // its animation completes; we use a fallback timeout in case it doesn't.
  if (cell.kind === 'encounter' && !cell.cleared && cell.encounterId) {
    const isElite = !!cell.isElite;
    setTimeout(
      () => useRunStore.getState()._enterCombat(cell.encounterId!, false, nx, ny, isElite),
      250,
    );
  } else if (cell.kind === 'boss' && !cell.cleared && cell.encounterId) {
    setTimeout(() => useRunStore.getState()._enterCombat(cell.encounterId!, true, nx, ny), 250);
  } else if (cell.kind === 'hazard' && !cell.cleared) {
    // Spike trap: damage on step, then disarmed for the rest of the run.
    const floor = s.map.floor;
    const damage = 4 + floor * 2 + Math.floor(Math.random() * 3); // 6-9 on F1, ~24-27 on F10
    cell.cleared = true;
    const newHp = Math.max(0, s.hp - damage);
    sfx.defeat(); // sharp metallic-y clank stands in for "trap snap"
    if (newHp <= 0) {
      set({ hp: 0 });
      setTimeout(() => useRunStore.getState()._endCombatDefeat(), 200);
    } else {
      set({ hp: newHp });
      useRunStore.getState().showNotice(`🩸 Spike trap! -${damage} HP`, 'bad', 2200);
    }
  }
}

// =============================================================================
// Combat resolution
// =============================================================================

function resolveTurn(
  set: (partial: Partial<RunState>) => void,
  get: () => RunState,
) {
  const s = get();
  if (!s.combat) return;
  const combat: CombatState = { ...s.combat };
  combat.chain = [...combat.chain];
  combat.enemies = combat.enemies.map((e) => ({ ...e, statuses: { ...e.statuses } }));
  combat.statuses = { ...combat.statuses };
  combat.log = [...combat.log];
  combat.hand = [...combat.hand];
  combat.discardPile = [...combat.discardPile];
  combat.drawPile = [...combat.drawPile];

  // --- Player phase: resolve chain ---
  const chainInput = combat.chain.map((c) => {
    const def = getCard(c.defId);
    return { id: def.id, cost: def.cost, isWild: !!def.isWild, effect: def.effect };
  });
  const steps = computeChain(chainInput);

  // Reset block before applying chain — block is per-turn, regranted by defend
  combat.statuses.shield = 0;

  let playerHpDelta = 0;
  let playerGoldGain = 0;
  let drawExtra = 0;
  let manaGain = 0;

  steps.forEach((step, i) => {
    const def = getCard(combat.chain[i].defId);
    const scaled = scaleEffect(def.effect, step.multiplier);

    // damage
    if (scaled.damage !== undefined && scaled.damage > 0) {
      const buffedDamage = applyPlayerStrengthBonus(
        applyPassiveToCardDamage(s.crawlerId, scaled.damage, def.type),
        combat.statuses,
      );
      const hits = scaled.hits ?? 1;
      for (let h = 0; h < hits; h++) {
        if (scaled.aoe) {
          combat.enemies.forEach((e) => {
            if (e.hp <= 0) return;
            const armor = applyEnemyArmor(buffedDamage, e.statuses);
            e.statuses.shield = armor.shieldLeft;
            e.hp = Math.max(0, e.hp - armor.dealt);
          });
        } else {
          const target = combat.enemies.find((e) => e.hp > 0);
          if (target) {
            const armor = applyEnemyArmor(buffedDamage, target.statuses);
            target.statuses.shield = armor.shieldLeft;
            target.hp = Math.max(0, target.hp - armor.dealt);
          }
        }
      }
      combat.log.push(
        `${def.name} → ${buffedDamage}${(scaled.hits ?? 1) > 1 ? `×${scaled.hits}` : ''}${
          scaled.aoe ? ' (all)' : ''
        } [×${step.multiplier.toFixed(2)}]`,
      );
    }

    // block
    if (scaled.block) {
      combat.statuses.shield = (combat.statuses.shield ?? 0) + scaled.block;
      combat.log.push(`${def.name} → +${scaled.block} block`);
    }

    // heal
    if (scaled.heal) {
      playerHpDelta += scaled.heal;
    }

    // draw
    if (scaled.draw) drawExtra += scaled.draw;

    // mana gain
    if (scaled.manaGain) manaGain += scaled.manaGain;

    // gold
    if (scaled.gold) playerGoldGain += scaled.gold;

    // statuses
    scaled.applyStatus?.forEach((st) => {
      if (st.target === 'self') {
        combat.statuses[st.kind] = (combat.statuses[st.kind] ?? 0) + st.amount;
      } else if (st.target === 'enemy') {
        const target = combat.enemies.find((e) => e.hp > 0);
        if (target) {
          target.statuses[st.kind] = (target.statuses[st.kind] ?? 0) + st.amount;
        }
      } else if (st.target === 'all') {
        combat.enemies.forEach((e) => {
          if (e.hp > 0) e.statuses[st.kind] = (e.statuses[st.kind] ?? 0) + st.amount;
        });
      }
    });
  });

  // Apply heal
  if (playerHpDelta > 0) {
    combat.hp = Math.min(combat.maxHp, combat.hp + playerHpDelta);
    combat.log.push(`Healed for ${playerHpDelta}`);
  }

  // Move played cards to discard
  combat.discardPile.push(...combat.chain);
  combat.chain = [];

  combat.mana = Math.max(0, combat.mana + manaGain);

  // --- End-of-player-turn statuses (bleed/burn on enemies tick now) ---
  combat.enemies.forEach((e) => {
    if (e.hp <= 0) return;
    const bleed = e.statuses.bleed ?? 0;
    const burn = e.statuses.burn ?? 0;
    const dot = bleed + burn;
    if (dot > 0) {
      e.hp = Math.max(0, e.hp - dot);
      combat.log.push(`${getEnemy(e.defId).name} suffers ${dot} (bleed/burn)`);
    }
    if (bleed > 0) e.statuses.bleed = bleed - 1;
    if (burn > 0) e.statuses.burn = burn - 1;
  });

  // Save gold immediately
  if (playerGoldGain > 0) {
    set({ gold: s.gold + playerGoldGain });
  }

  // Check victory before enemy phase
  if (combat.enemies.every((e) => e.hp <= 0)) {
    combat.log.push('Victory!');
    set({ combat });
    setTimeout(() => useRunStore.getState()._endCombatVictory(), 600);
    return;
  }

  // --- Enemy phase ---
  combat.enemies.forEach((e) => {
    if (e.hp <= 0) return;
    const def = getEnemy(e.defId);
    const intent = def.intents[e.intentIndex % def.intents.length];
    e.intentIndex++;

    if (intent.kind === 'attack' && intent.damage) {
      // Strength enemies aren't a thing yet; just raw damage minus shield
      let dmg = intent.damage;
      const shield = combat.statuses.shield ?? 0;
      const absorbed = Math.min(shield, dmg);
      combat.statuses.shield = shield - absorbed;
      dmg -= absorbed;
      combat.hp = Math.max(0, combat.hp - dmg);
      combat.log.push(`${def.name} hits for ${dmg}${absorbed ? ` (${absorbed} blocked)` : ''}`);
    } else if (intent.kind === 'defend' && intent.block) {
      e.statuses.shield = (e.statuses.shield ?? 0) + intent.block;
      combat.log.push(`${def.name} blocks +${intent.block}`);
    } else if (intent.kind === 'status' && intent.applyStatus) {
      if (intent.applyStatus.target === 'player') {
        combat.statuses[intent.applyStatus.kind] =
          (combat.statuses[intent.applyStatus.kind] ?? 0) + intent.applyStatus.amount;
        combat.log.push(`${def.name} applies ${intent.applyStatus.amount} ${intent.applyStatus.kind}`);
      } else {
        e.statuses[intent.applyStatus.kind] =
          (e.statuses[intent.applyStatus.kind] ?? 0) + intent.applyStatus.amount;
      }
    } else if (intent.kind === 'buff' && intent.applyStatus) {
      // Buff variants apply to player as well (curses)
      if (intent.applyStatus.target === 'player') {
        combat.statuses[intent.applyStatus.kind] =
          (combat.statuses[intent.applyStatus.kind] ?? 0) + intent.applyStatus.amount;
        combat.log.push(
          `${def.name} curses you with ${intent.applyStatus.amount} ${intent.applyStatus.kind}`,
        );
      }
    }
  });

  // Player end-of-round statuses (bleed/burn tick the player)
  const playerBleed = combat.statuses.bleed ?? 0;
  const playerBurn = combat.statuses.burn ?? 0;
  const playerDot = playerBleed + playerBurn;
  if (playerDot > 0) {
    combat.hp = Math.max(0, combat.hp - playerDot);
    combat.log.push(`You suffer ${playerDot} (bleed/burn)`);
  }
  if (playerBleed > 0) combat.statuses.bleed = playerBleed - 1;
  if (playerBurn > 0) combat.statuses.burn = playerBurn - 1;

  // Check defeat
  if (combat.hp <= 0) {
    combat.log.push('You have fallen...');
    set({ combat });
    setTimeout(() => useRunStore.getState()._endCombatDefeat(), 700);
    return;
  }

  // --- New player turn ---
  combat.turn += 1;
  const crawler = getCrawler(s.crawlerId!);
  combat.mana = crawler.startingMana + (s.crawlerId === 'pasqualina' ? 1 : 0);
  combat.maxMana = combat.mana;
  // discard remaining hand
  combat.discardPile.push(...combat.hand);
  combat.hand = [];
  const handSize = crawler.startingHandSize + (s.crawlerId === 'imelda' ? 1 : 0);
  drawCards(combat, handSize + drawExtra);

  set({ combat, hp: combat.hp });
}

// =============================================================================
// Reward roll
// =============================================================================

function rollRewardOffers(count: number, currentDeck: string[]): string[] {
  // Slight preference for cards player doesn't already have
  const pool = [...REWARD_POOL];
  shuffleInPlace(Math.random, pool);
  const offers: string[] = [];
  while (offers.length < count && pool.length > 0) {
    const c = pool.shift()!;
    offers.push(c);
  }
  // Make sure all offered cards exist
  return offers.filter((id) => !!CARDS[id]);
}
