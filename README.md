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

### Windows quick-start

Double-click `start.bat` (or run it from `cmd`/PowerShell). The script:

1. Verifies Node.js + npm are on PATH.
2. Runs `npm install` automatically if `node_modules` is missing.
3. Scans TCP ports 5173..5200 and picks the first one that isn't listening.
4. Launches the Vite dev server on that port and prints the URL.

Press Ctrl-C in the window to stop the server.

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

Defeat the floor boss and clear every encounter, then step into the **portal**
to descend. The Crypt is **10 floors deep**, each with its own theme, boss,
and roster:

| # | Floor | Boss |
|--:|-------|------|
| 1 | The Catacombs | Vampire Lord |
| 2 | The Flooded Crypt | Necromancer |
| 3 | The Throne Hall | Ancient Lich |
| 4 | The Forsaken Library | The Bound Tome |
| 5 | The Mushroom Grotto | The Spore Mother |
| 6 | The Iron Foundry | The Iron Tyrant |
| 7 | The Frostbitten Mausoleum | The Frost Wyrm |
| 8 | The Obsidian Sanctum | The Obsidian Maw |
| 9 | The Astral Plane | The Astral Warden |
| 10 | The Throne of Eternity | The Eternity King |

Each floor has its own palette, fog, lighting, torch color, and dungeon
textures. Encounter density, elite count, and shrine count all scale with
depth.

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
4. **Content & rewards** — procgen floors, chests, ~25 cards, reward picker, portals
5. **Bosses & polish** — 10 unique bosses with multi-intent cycles, status effects,
   framer-motion card juice, procedural SFX, screen shake, floating numbers
6. **Meta & evolutions** — `localStorage` meta store, multiple crawlers with
   unique decks/passives, evolution system (gem chests upgrade cards), Codex screen

## Art & visuals

- **Procedural D&D-style portraits.** Every enemy, boss, and crawler is drawn
  to a canvas with shapes + glowing accents — no sprite sheets, no external
  art.
- **MTG-style cards.** Cards have title bars, mana-cost pips, painted art
  boxes, type lines, rules + flavor text, and stat corners. Color-coded by
  type (red attacks, white defends, blue draws, green heals, black hexes,
  silver artifacts).
- **10 themed floors.** Each floor has bespoke wall/floor/ceiling textures,
  fog, ambient/hemisphere lighting, and torch colors — from candle-lit
  catacombs to a starlit Astral Plane.

## Credits

Inspired by *Vampire Crawlers: The Turbo Wildcard from Vampire Survivors* by
poncle. This is a learning/educational reimplementation, not an asset-for-asset
clone — all art is procedurally generated (canvas textures + emoji sprites)
and all sound is procedural Web Audio.
