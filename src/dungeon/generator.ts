import type { Cell, DungeonMap, Facing, Fixture } from '@/types';
import { bossForFloor, pickElite, pickEncounter } from '@/data/enemies';
import { mulberry32, randInt, shuffleInPlace } from '@/util/rng';

interface Room {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

function makeCell(x: number, y: number, kind: Cell['kind']): Cell {
  return { x, y, kind, seen: false, visible: false };
}

function carveRoom(grid: Cell[][], room: Room) {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      grid[y][x].kind = 'floor';
    }
  }
}

function carveCorridor(grid: Cell[][], a: Room, b: Room, horizFirst: boolean) {
  const ax = a.cx;
  const ay = a.cy;
  const bx = b.cx;
  const by = b.cy;

  const carveH = (y: number, x1: number, x2: number) => {
    const [lo, hi] = x1 < x2 ? [x1, x2] : [x2, x1];
    for (let x = lo; x <= hi; x++) grid[y][x].kind = 'floor';
  };
  const carveV = (x: number, y1: number, y2: number) => {
    const [lo, hi] = y1 < y2 ? [y1, y2] : [y2, y1];
    for (let y = lo; y <= hi; y++) grid[y][x].kind = 'floor';
  };

  if (horizFirst) {
    carveH(ay, ax, bx);
    carveV(bx, ay, by);
  } else {
    carveV(ax, ay, by);
    carveH(by, ax, bx);
  }
}

function roomsOverlap(a: Room, b: Room, padding = 1): boolean {
  return (
    a.x - padding < b.x + b.w &&
    a.x + a.w + padding > b.x &&
    a.y - padding < b.y + b.h &&
    a.y + a.h + padding > b.y
  );
}

/**
 * Generate a floor: rooms-and-corridors carved into a grid of walls,
 * then sprinkle in encounters, chests, a boss, and a shovel-to-next-floor.
 *
 * Encounters increase with floor depth, and boss + shovel are placed in
 * the rooms farthest from spawn so the player has to explore.
 */
export function generateFloor(opts: {
  floor: number;
  seed: number;
  width?: number;
  height?: number;
}): DungeonMap {
  const width = opts.width ?? 22 + Math.min(opts.floor * 2, 12);
  const height = opts.height ?? 18 + Math.min(opts.floor * 2, 10);
  const rng = mulberry32(opts.seed ^ (opts.floor * 9301));

  // Init solid wall grid
  const cells: Cell[][] = [];
  for (let y = 0; y < height; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < width; x++) row.push(makeCell(x, y, 'wall'));
    cells.push(row);
  }

  // Generate rooms
  const targetRooms = 7 + Math.min(opts.floor, 5);
  const rooms: Room[] = [];
  let attempts = 0;
  while (rooms.length < targetRooms && attempts < 200) {
    attempts++;
    const w = randInt(rng, 3, 6);
    const h = randInt(rng, 3, 5);
    const x = randInt(rng, 1, width - w - 2);
    const y = randInt(rng, 1, height - h - 2);
    const room: Room = { x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) };
    if (rooms.some((r) => roomsOverlap(r, room))) continue;
    rooms.push(room);
    carveRoom(cells, room);
  }

  // Connect rooms with corridors
  for (let i = 1; i < rooms.length; i++) {
    carveCorridor(cells, rooms[i - 1], rooms[i], rng() < 0.5);
  }

  // Spawn = center of room 0
  const spawnRoom = rooms[0];
  const spawn = { x: spawnRoom.cx, y: spawnRoom.cy };
  cells[spawn.y][spawn.x].kind = 'spawn';

  // Boss in farthest room from spawn
  let bossRoom = rooms[rooms.length - 1];
  let bossDist = 0;
  for (const r of rooms) {
    const d = Math.abs(r.cx - spawn.x) + Math.abs(r.cy - spawn.y);
    if (d > bossDist) {
      bossDist = d;
      bossRoom = r;
    }
  }
  cells[bossRoom.cy][bossRoom.cx].kind = 'boss';
  cells[bossRoom.cy][bossRoom.cx].encounterId = bossForFloor(opts.floor);

  // ---------- Determine doorway / approach cells ("protected") ----------
  // No interactable item — including the portal — is allowed on a cell
  // that is part of a room's entrance or the corridor cell immediately
  // outside it. This keeps players from being shoved into a fight, chest,
  // shrine, or trap just for crossing a threshold.
  const protectedCells = findProtectedCells(cells, rooms, width, height);

  // Portal placement: must be BEHIND the boss so the player has to engage
  // the boss to reach the next floor. We pick the floor cell inside the boss
  // room that is farthest from spawn by Manhattan distance. Tie-break by the
  // largest projection along the spawn→boss approach vector so the chosen
  // cell sits on the far side along the player's natural approach. Doorway
  // cells of the boss room are excluded so the portal never stands in the
  // doorway itself.
  const approachDx = Math.sign(bossRoom.cx - spawn.x);
  const approachDy = Math.sign(bossRoom.cy - spawn.y);
  let portalCell: { x: number; y: number; score: number } | null = null;
  for (let py = bossRoom.y; py < bossRoom.y + bossRoom.h; py++) {
    for (let px = bossRoom.x; px < bossRoom.x + bossRoom.w; px++) {
      if (px === bossRoom.cx && py === bossRoom.cy) continue;
      if (cells[py][px].kind !== 'floor') continue;
      if (protectedCells.has(`${px},${py}`)) continue;
      const manhattan = Math.abs(px - spawn.x) + Math.abs(py - spawn.y);
      const projection =
        (px - bossRoom.cx) * approachDx + (py - bossRoom.cy) * approachDy;
      const score = projection * 100 + manhattan;
      if (!portalCell || score > portalCell.score) {
        portalCell = { x: px, y: py, score };
      }
    }
  }
  if (portalCell) {
    cells[portalCell.y][portalCell.x].kind = 'shovel';
  } else {
    // Defensive fallback: the boss room has no non-doorway floor candidates.
    // Drop the portal on any adjacent floor we can find (still preferring
    // a non-protected cell if one exists, else accepting any floor).
    const tries = [
      { x: bossRoom.cx + 1, y: bossRoom.cy },
      { x: bossRoom.cx - 1, y: bossRoom.cy },
      { x: bossRoom.cx, y: bossRoom.cy + 1 },
      { x: bossRoom.cx, y: bossRoom.cy - 1 },
    ].filter(
      (p) =>
        p.x >= 0 &&
        p.x < width &&
        p.y >= 0 &&
        p.y < height &&
        cells[p.y][p.x].kind === 'floor',
    );
    const fallback =
      tries.find((p) => !protectedCells.has(`${p.x},${p.y}`)) ?? tries[0];
    if (fallback) cells[fallback.y][fallback.x].kind = 'shovel';
    else cells[bossRoom.y][bossRoom.x].kind = 'shovel';
  }

  // ---------- Item placement ----------
  // Items per room scale with room size: capacity = floor(area / 4), min 1.
  // Larger rooms naturally hold more loot/foes; smaller rooms stay sparse.
  // Scaling: keep early floors sparse, ramp up density across the 10-floor
  // run so the final crypts feel packed.
  const encounterCount = 4 + Math.min(opts.floor, 8);          // F1: 5, F10: 12
  const chestCount = 2 + Math.min(opts.floor, 4);              // F1: 3, F10: 6
  const eliteCount = Math.min(5, Math.max(0, opts.floor - 1)); // F1: 0, F6+: 5
  const shrineCount = 1 + Math.floor((opts.floor - 1) / 3);    // F1-3: 1, F4-6: 2, F7-9: 3, F10: 4

  type PlaceableItem = { type: 'elite' | 'encounter' | 'chest' | 'shrine' };
  const itemQueue: PlaceableItem[] = [
    // Order matters when capacity is tight: elites & shrines are rarer, so
    // try to fit those first. Encounters / chests pad out the rest.
    ...Array.from({ length: eliteCount }, () => ({ type: 'elite' } as const)),
    ...Array.from({ length: shrineCount }, () => ({ type: 'shrine' } as const)),
    ...Array.from({ length: encounterCount }, () => ({ type: 'encounter' } as const)),
    ...Array.from({ length: chestCount }, () => ({ type: 'chest' } as const)),
  ];

  const eligibleRooms = rooms.filter((r) => r !== spawnRoom && r !== bossRoom);
  const shuffledRooms = shuffleInPlace(rng, [...eligibleRooms]);
  const capacity = new Map<Room, number>();
  const placedInRoom = new Map<Room, number>();
  for (const room of shuffledRooms) {
    capacity.set(room, Math.max(1, Math.floor((room.w * room.h) / 4)));
    placedInRoom.set(room, 0);
  }

  for (const item of itemQueue) {
    // Pick the room that:
    //  (a) still has capacity, and
    //  (b) has at least one non-protected free floor cell.
    // Bias toward least-filled rooms so items spread out across the map.
    const candidates = shuffledRooms
      .filter((r) => (placedInRoom.get(r) ?? 0) < (capacity.get(r) ?? 0))
      .sort((a, b) => (placedInRoom.get(a) ?? 0) - (placedInRoom.get(b) ?? 0));
    let placed = false;
    for (const room of candidates) {
      const cell = findFreeFloorCell(cells, room, protectedCells, rng);
      if (!cell) continue;
      placeItem(cells, cell.x, cell.y, item.type, opts.floor, rng);
      placedInRoom.set(room, (placedInRoom.get(room) ?? 0) + 1);
      placed = true;
      break;
    }
    // If we couldn't place this item anywhere (every room full or no free
    // cells), silently skip — better to under-place than to put items in
    // bad spots.
    if (!placed) continue;
  }

  // ---------- Hazards (spike traps) ----------
  // Hazards go in CORRIDOR cells only. They CAN block a path, but we run a
  // BFS-with-hazards-as-walls connectivity check after each placement so
  // every required cell (boss, portal, encounters, chests, shrines) remains
  // reachable from spawn via an alternate route.
  const hazardCount = 1 + opts.floor;
  const placedHazards = new Set<string>();
  const keyCells = collectKeyCells(cells, width, height, spawn);

  const corridorCells: { x: number; y: number }[] = [];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (cells[y][x].kind !== 'floor') continue;
      const insideRoom = rooms.some(
        (r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h,
      );
      if (insideRoom) continue;
      // Skip cells protected as doorways/approaches — never trap the player
      // right at a doorway.
      if (protectedCells.has(`${x},${y}`)) continue;
      corridorCells.push({ x, y });
    }
  }
  shuffleInPlace(rng, corridorCells);
  for (const c of corridorCells) {
    if (placedHazards.size >= hazardCount) break;

    // Avoid adjacent hazards (gives breathing room).
    let tooClose = false;
    for (let dy = -1; dy <= 1 && !tooClose; dy++) {
      for (let dx = -1; dx <= 1 && !tooClose; dx++) {
        if (placedHazards.has(`${c.x + dx},${c.y + dy}`)) tooClose = true;
      }
    }
    if (tooClose) continue;

    // Tentatively block this cell, then verify every key cell is still
    // reachable from spawn without crossing any hazard. If not, roll back.
    const ck = `${c.x},${c.y}`;
    placedHazards.add(ck);
    const reachable = bfsReachable(cells, width, height, spawn.x, spawn.y, placedHazards);
    const stillReachable = keyCells.every((kc) => reachable.has(kc));
    if (stillReachable) {
      cells[c.y][c.x].kind = 'hazard';
    } else {
      placedHazards.delete(ck);
    }
  }

  // Mark spawn cell visible
  cells[spawn.y][spawn.x].seen = true;
  cells[spawn.y][spawn.x].visible = true;

  // Pick a facing where the player is NOT staring at a wall, and ideally is
  // looking down a corridor that leads out of the spawn room.
  const spawnFacing = chooseSpawnFacing(cells, width, height, spawn, spawnRoom);

  const fixtures = placeFixtures(cells, width, height, rooms, rng);

  return {
    width,
    height,
    cells,
    spawn,
    spawnFacing,
    floor: opts.floor,
    fixtures,
  };
}

const FACING_DX: Record<Facing, number> = { 0: 0, 1: 1, 2: 0, 3: -1 };
const FACING_DY: Record<Facing, number> = { 0: -1, 1: 0, 2: 1, 3: 0 };

/**
 * Picks an initial facing for the player such that:
 *   1. The cell directly in front of them is never a wall.
 *   2. Whenever possible, the player is looking down a corridor that exits
 *      the spawn room (we cast a ray and prefer facings that escape the
 *      room's bounding box without hitting a wall first).
 *   3. As a tie-breaker, we prefer the facing with the longest open line of
 *      sight (so the player gets the most dramatic "look down the hallway"
 *      moment when they spawn).
 */
function chooseSpawnFacing(
  cells: Cell[][],
  width: number,
  height: number,
  spawn: { x: number; y: number },
  spawnRoom: Room,
): Facing {
  const maxRayLength = Math.max(width, height);
  const scored: Array<{ facing: Facing; openSteps: number; exitsRoom: boolean }> = [];
  for (const facing of [0, 1, 2, 3] as Facing[]) {
    const dx = FACING_DX[facing];
    const dy = FACING_DY[facing];
    let x = spawn.x + dx;
    let y = spawn.y + dy;
    let openSteps = 0;
    let exitsRoom = false;
    while (
      x >= 0 && x < width &&
      y >= 0 && y < height &&
      cells[y][x].kind !== 'wall' &&
      openSteps < maxRayLength
    ) {
      openSteps++;
      const outsideRoom =
        x < spawnRoom.x || x >= spawnRoom.x + spawnRoom.w ||
        y < spawnRoom.y || y >= spawnRoom.y + spawnRoom.h;
      if (outsideRoom) {
        exitsRoom = true;
        break;
      }
      x += dx;
      y += dy;
    }
    scored.push({ facing, openSteps, exitsRoom });
  }

  // Prefer facings that exit the spawn room into a corridor.
  const exits = scored.filter((s) => s.exitsRoom);
  if (exits.length > 0) {
    exits.sort((a, b) => b.openSteps - a.openSteps);
    return exits[0].facing;
  }

  // No corridor visible — at least pick a facing whose adjacent cell isn't a
  // wall (i.e. at least one open step ahead).
  const nonWall = scored.filter((s) => s.openSteps > 0);
  if (nonWall.length > 0) {
    nonWall.sort((a, b) => b.openSteps - a.openSteps);
    return nonWall[0].facing;
  }

  // Pathological case (1×1 room with no exit). Should never happen since the
  // generator guarantees a connected dungeon — but fall back to East.
  return 1;
}

// =============================================================================
// Placement helpers
// =============================================================================

/**
 * Identifies cells that are "doorways" (room-edge cells with a corridor
 * neighbor) plus the corridor cells immediately on the other side of those
 * doorways. We never place encounters / elites / chests / shrines / hazards
 * on these so the player can always cross thresholds unmolested.
 */
function findProtectedCells(
  cells: Cell[][],
  rooms: Room[],
  width: number,
  height: number,
): Set<string> {
  const result = new Set<string>();
  const dirs: [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (cells[y][x].kind === 'wall') continue;
        for (const [dx, dy] of dirs) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (cells[ny][nx].kind === 'wall') continue;
          const outside =
            nx < room.x || nx >= room.x + room.w || ny < room.y || ny >= room.y + room.h;
          if (!outside) continue;
          // This cell is on a doorway: protect both sides.
          result.add(`${x},${y}`);
          result.add(`${nx},${ny}`);
        }
      }
    }
  }
  return result;
}

/**
 * Picks a random floor cell inside `room` that isn't protected (doorway)
 * and isn't already occupied by a non-floor cell. Returns null if none.
 */
function findFreeFloorCell(
  cells: Cell[][],
  room: Room,
  protectedCells: Set<string>,
  rng: () => number,
): { x: number; y: number } | null {
  const candidates: { x: number; y: number }[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      if (cells[y][x].kind !== 'floor') continue;
      if (protectedCells.has(`${x},${y}`)) continue;
      candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

/** Writes a placeable item onto the given cell. */
function placeItem(
  cells: Cell[][],
  x: number,
  y: number,
  type: 'elite' | 'encounter' | 'chest' | 'shrine',
  floor: number,
  rng: () => number,
) {
  const c = cells[y][x];
  if (type === 'elite') {
    c.kind = 'encounter';
    c.encounterId = pickElite(floor, rng).join(',');
    c.isElite = true;
  } else if (type === 'encounter') {
    c.kind = 'encounter';
    c.encounterId = pickEncounter(floor, rng).join(',');
  } else if (type === 'chest') {
    c.kind = 'chest';
    const roll = rng();
    c.chestKind = roll < 0.55 ? 'card' : roll < 0.85 ? 'gold' : 'gem';
  } else {
    c.kind = 'shrine';
    const altarRoll = rng();
    c.shrineKind = floor >= 2 && altarRoll < 0.35 ? 'altar' : 'heal';
  }
}

/**
 * Collects every "key" cell — cells the player needs to be able to reach
 * even with hazards blocking. Includes spawn (trivially), boss, portal
 * (shovel), encounters, chests, and shrines.
 */
function collectKeyCells(
  cells: Cell[][],
  width: number,
  height: number,
  spawn: { x: number; y: number },
): string[] {
  const keys: string[] = [`${spawn.x},${spawn.y}`];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const k = cells[y][x].kind;
      if (
        k === 'boss' ||
        k === 'shovel' ||
        k === 'encounter' ||
        k === 'chest' ||
        k === 'shrine'
      ) {
        keys.push(`${x},${y}`);
      }
    }
  }
  return keys;
}

/**
 * Standard BFS from (sx, sy) returning the set of "x,y" cell keys
 * reachable, treating any cell in `blocked` as impassable (in addition to
 * walls).
 */
function bfsReachable(
  cells: Cell[][],
  width: number,
  height: number,
  sx: number,
  sy: number,
  blocked: Set<string>,
): Set<string> {
  const seen = new Set<string>();
  const startKey = `${sx},${sy}`;
  if (blocked.has(startKey)) return seen;
  seen.add(startKey);
  const queue: number[] = [sx, sy];
  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];
    const dirs: [number, number][] = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const ck = `${nx},${ny}`;
      if (seen.has(ck)) continue;
      if (cells[ny][nx].kind === 'wall') continue;
      if (blocked.has(ck)) continue;
      seen.add(ck);
      queue.push(nx, ny);
    }
  }
  return seen;
}

/**
 * Sprinkle ambience: wall-mounted torches and skeletons on walls bordering
 * floors, plus floor-standing candelabras and bone piles. These are
 * decorative only — they don't affect gameplay.
 */
function placeFixtures(
  cells: Cell[][],
  width: number,
  height: number,
  rooms: Room[],
  rng: () => number,
): Fixture[] {
  const fixtures: Fixture[] = [];
  // Track which (cell, wall side) combos already have a wall fixture.
  const usedWall = new Set<string>();
  // Track which floor cells already have a floor fixture.
  const usedFloor = new Set<string>();
  const key = (x: number, y: number, side?: number) =>
    side === undefined ? `${x},${y}` : `${x},${y},${side}`;

  const sides: [number, number, 0 | 1 | 2 | 3][] = [
    [0, -1, 0],
    [1, 0, 1],
    [0, 1, 2],
    [-1, 0, 3],
  ];

  // 1) Wall fixtures: scan floor cells, on each adjacent wall consider
  //    placing a torch (most common), or occasionally a hanging skeleton.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const cell = cells[y][x];
      if (cell.kind === 'wall') continue;
      if (cell.kind === 'spawn') continue;
      for (const [dx, dy, side] of sides) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (cells[ny][nx].kind !== 'wall') continue;
        const oppositeSide = ((side + 2) % 4) as 0 | 1 | 2 | 3;
        if (usedWall.has(key(nx, ny, oppositeSide))) continue;
        if (usedWall.has(key(x, y, side))) continue;
        const roll = rng();
        if (roll < 0.18) {
          // Torches — most common; carry the dynamic lighting too.
          fixtures.push({ kind: 'wallTorch', x, y, wallSide: side });
          usedWall.add(key(x, y, side));
        } else if (roll < 0.23) {
          // ~5% — menacing prison-skeleton flavor.
          fixtures.push({
            kind: 'hangingSkeleton',
            x,
            y,
            wallSide: side,
            variant: Math.floor(rng() * 1000),
          });
          usedWall.add(key(x, y, side));
        } else if (roll < 0.27) {
          // ~4% — empty rusted manacles (the prisoners are long gone).
          fixtures.push({
            kind: 'chains',
            x,
            y,
            wallSide: side,
            variant: Math.floor(rng() * 1000),
          });
          usedWall.add(key(x, y, side));
        } else if (roll < 0.30) {
          // ~3% — heraldic tattered banner.
          fixtures.push({
            kind: 'banner',
            x,
            y,
            wallSide: side,
            variant: Math.floor(rng() * 1000),
          });
          usedWall.add(key(x, y, side));
        } else if (roll < 0.33) {
          // ~3% — engraved tomb plaque embedded in the wall.
          fixtures.push({
            kind: 'gravePlaque',
            x,
            y,
            wallSide: side,
            variant: Math.floor(rng() * 1000),
          });
          usedWall.add(key(x, y, side));
        } else if (roll < 0.35) {
          // ~2% — glowing arcane rune (rare, eye-catching).
          fixtures.push({
            kind: 'runeMark',
            x,
            y,
            wallSide: side,
            variant: Math.floor(rng() * 1000),
          });
          usedWall.add(key(x, y, side));
        } else if (roll < 0.38) {
          // ~3% — dusty oil portrait of a noble who probably became a lich.
          fixtures.push({
            kind: 'paintingFrame',
            x,
            y,
            wallSide: side,
            variant: Math.floor(rng() * 1000),
          });
          usedWall.add(key(x, y, side));
        }
      }
    }
  }

  // 2) Bone piles: scattered floor cells, very sparse. Skip spawn, encounter,
  //    boss, chest, shovel cells (we don't want decor blocking interactables).
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = cells[y][x];
      if (c.kind !== 'floor') continue;
      if (usedFloor.has(key(x, y))) continue;
      if (rng() < 0.025) {
        fixtures.push({
          kind: 'bonePile',
          x,
          y,
          variant: Math.floor(rng() * 1000),
        });
        usedFloor.add(key(x, y));
      }
    }
  }

  // 3) Spiderwebs: hang in the upper corners of rooms. We scan each cell that
  //    belongs to a room and look for "inside corners" where two adjacent
  //    walls meet. Each qualifying corner has a moderate chance of getting a
  //    web. Limit per room so we don't over-cobweb the dungeon.
  // Each corner: [dx, dy_a, dx_b, dy_b, cornerIndex]
  //   The two adjacent cells we check are (x+dx_a, y+dy_a) and (x+dx_b, y+dy_b).
  //   Corner index follows: 0=NW, 1=NE, 2=SE, 3=SW.
  const cornerChecks: [number, number, number, number, 0 | 1 | 2 | 3][] = [
    [-1, 0, 0, -1, 0], // NW: wall to west AND wall to north
    [1, 0, 0, -1, 1], // NE: wall to east AND wall to north
    [1, 0, 0, 1, 2], // SE: wall to east AND wall to south
    [-1, 0, 0, 1, 3], // SW: wall to west AND wall to south
  ];
  const usedCorner = new Set<string>();
  const cornerKey = (x: number, y: number, c: number) => `${x},${y},c${c}`;

  // ~60% of rooms get webs, with at most 2 webs per room for a tasteful amount.
  for (const room of rooms) {
    if (rng() > 0.6) continue;
    const webBudget = 1 + (rng() < 0.4 ? 1 : 0);
    let placed = 0;
    // Visit cells in room in a shuffled order so the chosen webs are varied.
    const roomCells: { x: number; y: number }[] = [];
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (cells[y][x].kind === 'wall') continue;
        roomCells.push({ x, y });
      }
    }
    shuffleInPlace(rng, roomCells);
    for (const { x, y } of roomCells) {
      if (placed >= webBudget) break;
      // Check all 4 corners in randomized order
      const shuffledCorners = shuffleInPlace(rng, [...cornerChecks]);
      for (const [dxa, dya, dxb, dyb, corner] of shuffledCorners) {
        if (placed >= webBudget) break;
        const ax = x + dxa;
        const ay = y + dya;
        const bx = x + dxb;
        const by = y + dyb;
        if (ax < 0 || ay < 0 || ax >= width || ay >= height) continue;
        if (bx < 0 || by < 0 || bx >= width || by >= height) continue;
        if (cells[ay][ax].kind !== 'wall') continue;
        if (cells[by][bx].kind !== 'wall') continue;
        if (usedCorner.has(cornerKey(x, y, corner))) continue;
        if (rng() < 0.55) {
          fixtures.push({
            kind: 'spiderweb',
            x,
            y,
            corner,
            variant: Math.floor(rng() * 1000),
          });
          usedCorner.add(cornerKey(x, y, corner));
          placed++;
        }
      }
    }
  }

  return fixtures;
}

/**
 * Updates `seen`/`visible` flags on cells around the player using a simple
 * Manhattan radius. Walls block neighbors beyond them in a cheap way.
 */
export function updateVisibility(map: DungeonMap, px: number, py: number, radius = 5) {
  // Clear current visibility
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      map.cells[y][x].visible = false;
    }
  }
  for (let y = py - radius; y <= py + radius; y++) {
    for (let x = px - radius; x <= px + radius; x++) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      // Cheap line-of-sight: walk from player toward cell, stop at walls
      if (hasLineOfSight(map, px, py, x, y)) {
        map.cells[y][x].visible = true;
        map.cells[y][x].seen = true;
      }
    }
  }
}

function hasLineOfSight(map: DungeonMap, x0: number, y0: number, x1: number, y1: number): boolean {
  // Bresenham. Walls block sight, but the target wall itself is visible.
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    if (x === x1 && y === y1) return true;
    if (!(x === x0 && y === y0) && map.cells[y]?.[x]?.kind === 'wall') return false;
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

export function isWalkable(map: DungeonMap, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  return map.cells[y][x].kind !== 'wall';
}
