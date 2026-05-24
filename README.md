# Crypt Crawlers

A web-based clone of *Vampire Crawlers* — a first-person grid-based dungeon
crawler with turn-based **Mana Chain** card combat and roguelite
meta-progression.

Built with React + Three.js (via `@react-three/fiber`) and Zustand.

## Run it

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

## Other scripts

```bash
npm test       # unit tests for the mana-chain resolver
npm run build  # production build
```

## How to play

- **W / ↑** — step forward
- **S / ↓** — step back
- **A / ←** and **D / →** — turn 90°
- **Q / E** — strafe left / right
- **Space** — interact (open chest, dig deeper with shovel, or end turn in combat)
- **C** — clear chain in combat
- **Esc** — return to main menu

Step on red glyphs to trigger an encounter. In combat:

1. Cards have a **mana cost**.
2. Drop them into the **chain** in **ascending cost** to keep the chain alive.
3. Each unbroken step multiplies the next card's effect by ×1.5.
4. **Wild cards** (grey) — like Sack of Gold or Candle Stub — never break the
   chain, even when their cost is lower than the previous card.
5. Hit **End Turn** when you're ready. Enemies attack; bleed / burn ticks at
   end-of-round.

Defeat the floor boss, then walk to the **shovel** and dig deeper. The Crypt
has 3 floors plus a final boss.

## Architecture

```
src/
├── App.tsx                — top-level mode switcher
├── main.tsx               — React root
├── types.ts               — shared domain types
├── combat/
│   ├── manaChain.ts       — the heart: chain resolver (pure fn, unit tested)
│   └── manaChain.test.ts  — 12 tests covering the chain mechanic
├── data/
│   ├── cards.ts           — ~25 card definitions
│   ├── enemies.ts         — enemies + bosses + encounter pools
│   └── crawlers.ts        — playable characters
├── dungeon/
│   ├── generator.ts       — rooms-and-corridors procgen + LOS fog of war
│   └── DungeonScene.tsx   — R3F first-person 3D scene
├── state/
│   ├── runStore.ts        — per-run state + combat resolver
│   └── metaStore.ts       — persisted meta (XP, unlocks, codex)
├── ui/                    — menus, HUD, combat overlay, codex, …
├── util/
│   ├── rng.ts             — mulberry32 PRNG + helpers
│   └── sound.ts           — procedural Web Audio SFX (no asset files)
└── styles/global.css
```

## Phases delivered

All six phases of the plan landed:

1. **Walking sim** — 3D first-person grid dungeon with R/F + grid movement
2. **Combat core** — mana chain resolver + card hand UI
3. **Loop wired up** — encounters → combat → reward → dungeon
4. **Content & rewards** — procgen floors, chests, ~25 cards, reward picker, shovel
5. **Bosses & polish** — 3 unique bosses with multi-intent cycles, status effects,
   framer-motion card juice, procedural SFX
6. **Meta & evolutions** — `localStorage` meta store, multiple crawlers with
   unique decks/passives, evolution system (gem chests upgrade cards), Codex screen

## Credits

Inspired by *Vampire Crawlers: The Turbo Wildcard from Vampire Survivors* by
poncle. This is a learning/educational reimplementation, not an asset-for-asset
clone — all art is procedurally generated (canvas textures + emoji sprites)
and all sound is procedural Web Audio.
