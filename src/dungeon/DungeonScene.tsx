import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useRunStore, remainingFoes } from '@/state/runStore';
import { getEnemy } from '@/data/enemies';
import { paintEnemy } from '@/art/portraits';
import { onEnemyImageLoad, hasEnemyImage } from '@/art/enemyImages';
import type { Cell, Facing, Fixture } from '@/types';
import { type FloorTheme, getFloorTheme } from './themes';

// Theme context — children read the active floor's palette
const ThemeCtx = createContext<FloorTheme>(getFloorTheme(1));
const useTheme = () => useContext(ThemeCtx);

const CELL_SIZE = 1;
const WALL_HEIGHT = 2.2; // raised for a vaulted dungeon feel & to clear hovering cards
const EYE_HEIGHT = 0.9;  // raised proportionally so the player feels human-scaled

/**
 * Global brightness multiplier applied to every light source (ambient,
 * hemisphere, torches, shrines, portals, player torch). 1.0 = theme-defined
 * baseline; bumping this brightens the whole dungeon proportionally without
 * losing per-theme mood (the catacombs still feel dimmer than the throne room).
 */
const BRIGHTNESS_BOOST = 1.3;

const FACING_TO_YAW: Record<Facing, number> = {
  0: 0,           // North = -Z
  1: -Math.PI / 2, // East = +X
  2: Math.PI,
  3: Math.PI / 2,
};

function cellToWorld(x: number, y: number): [number, number] {
  return [x * CELL_SIZE, y * CELL_SIZE];
}

// =============================================================================
// Camera Rig — tweens position/rotation between grid cells
// =============================================================================

function CameraRig() {
  const camera = useThree((s) => s.camera);
  // IMPORTANT: select each field individually. Returning a new object from a
  // single selector triggers infinite re-renders in Zustand v5 (every render
  // produces a fresh object that fails the default identity comparison).
  const px = useRunStore((s) => s.px);
  const py = useRunStore((s) => s.py);
  const facing = useRunStore((s) => s.facing);
  const isMoving = useRunStore((s) => s.isMoving);
  const setMoving = useRunStore((s) => s.setMoving);

  // Initialize refs to the player's actual world coords from the start so
  // even the first frame paints with the camera correctly positioned.
  const [initWx, initWz] = cellToWorld(px, py);
  const target = useRef({ x: initWx, z: initWz, yaw: FACING_TO_YAW[facing] });
  const current = useRef({ x: initWx, z: initWz, yaw: FACING_TO_YAW[facing] });

  // Snap the camera before the first paint — useLayoutEffect fires sync after
  // commit and before the browser actually renders, which avoids the brief
  // window where the camera could be looking the wrong direction.
  useLayoutEffect(() => {
    camera.position.set(initWx, EYE_HEIGHT, initWz);
    camera.rotation.set(0, FACING_TO_YAW[facing], 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update target when state changes
  useEffect(() => {
    const [wx, wz] = cellToWorld(px, py);
    target.current.x = wx;
    target.current.z = wz;
    // Choose shortest rotation
    const newYaw = FACING_TO_YAW[facing];
    let diff = newYaw - target.current.yaw;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    target.current.yaw += diff;
  }, [px, py, facing]);

  useFrame((_, dt) => {
    // Higher speed = snappier movement (each cell-step converges in
    // ~90ms at 60fps instead of ~200ms).
    const speed = 22;
    const cur = current.current;
    const tgt = target.current;
    const lerp = Math.min(1, dt * speed);
    cur.x += (tgt.x - cur.x) * lerp;
    cur.z += (tgt.z - cur.z) * lerp;
    cur.yaw += (tgt.yaw - cur.yaw) * lerp;
    camera.position.set(cur.x, EYE_HEIGHT, cur.z);
    camera.rotation.set(0, cur.yaw, 0);

    if (isMoving) {
      const dx = Math.abs(tgt.x - cur.x);
      const dz = Math.abs(tgt.z - cur.z);
      const dy = Math.abs(tgt.yaw - cur.yaw);
      // Release the input lock a little earlier so the next held-key
      // repeat can fire seamlessly without a perceptible stutter.
      if (dx < 0.04 && dz < 0.04 && dy < 0.04) {
        setMoving(false);
      }
    }
  });

  return null;
}

// =============================================================================
// Walls — instanced
// =============================================================================

function Walls({ cells, width, height }: { cells: Cell[][]; width: number; height: number }) {
  const theme = useTheme();
  const wallTex = useMemo(() => buildWallTexture(theme), [theme]);
  const floorTex = useMemo(() => buildFloorTexture(theme), [theme]);
  const ceilTex = useMemo(() => buildCeilingTexture(theme), [theme]);

  // Render ALL walls/floors of the map. We rely on Three.js fog (set on Canvas)
  // to hide distant geometry — fog gives us "darkness fade" without needing
  // to gate rendering on the seen flag (which is mutated in place and would
  // not invalidate useMemo dependencies).
  const wallPositions = useMemo(() => {
    const list: [number, number][] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cells[y][x].kind === 'wall') {
          // Skip walls that have no non-wall neighbors at all (interior
          // bedrock that's never seen) to keep draw-call count down.
          const hasNeighborFloor =
            cells[y - 1]?.[x]?.kind && cells[y - 1][x].kind !== 'wall' ||
            cells[y + 1]?.[x]?.kind && cells[y + 1][x].kind !== 'wall' ||
            cells[y]?.[x - 1]?.kind && cells[y][x - 1].kind !== 'wall' ||
            cells[y]?.[x + 1]?.kind && cells[y][x + 1].kind !== 'wall';
          if (hasNeighborFloor) list.push([x, y]);
        }
      }
    }
    return list;
    // We only need to recompute when the map identity changes — width/height
    // change with each new floor and cells is a new array per floor.
  }, [cells, width, height]);

  const floorPositions = useMemo(() => {
    const list: [number, number][] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (cells[y][x].kind !== 'wall') list.push([x, y]);
      }
    }
    return list;
  }, [cells, width, height]);

  return (
    <>
      {wallPositions.map(([x, y]) => {
        const [wx, wz] = cellToWorld(x, y);
        return (
          <mesh key={`w-${x}-${y}`} position={[wx, WALL_HEIGHT / 2, wz]} castShadow receiveShadow>
            <boxGeometry args={[CELL_SIZE, WALL_HEIGHT, CELL_SIZE]} />
            <meshStandardMaterial map={wallTex} roughness={0.95} />
          </mesh>
        );
      })}
      {floorPositions.map(([x, y]) => {
        const [wx, wz] = cellToWorld(x, y);
        return (
          <group key={`f-${x}-${y}`}>
            <mesh position={[wx, 0, wz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[CELL_SIZE, CELL_SIZE]} />
              <meshStandardMaterial map={floorTex} roughness={1} />
            </mesh>
            <mesh position={[wx, WALL_HEIGHT - 0.001, wz]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[CELL_SIZE, CELL_SIZE]} />
              <meshStandardMaterial map={ceilTex} roughness={1} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

// =============================================================================
// Decorations on special cells
// =============================================================================

function Decorations({ cells, width, height }: { cells: Cell[][]; width: number; height: number }) {
  // We subscribe to player position so this component re-renders when foes
  // are cleared — the cells themselves mutate in place. (Recomputing the
  // count via useMemo would otherwise return a stale value.)
  const px = useRunStore((s) => s.px);
  const py = useRunStore((s) => s.py);
  const map = useRunStore((s) => s.map);
  const foes = useMemo(
    () => (map ? remainingFoes(map) : { encounters: 0, bossAlive: false }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, px, py],
  );
  const portalLocked = foes.encounters > 0 || foes.bossAlive;

  // Render all decorations on the floor; fog handles distance dim-out.
  // (seen flag isn't a reliable React dep because we mutate cells in place.)
  const items: JSX.Element[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = cells[y][x];
      const [wx, wz] = cellToWorld(x, y);

      if (cell.kind === 'encounter' && !cell.cleared) {
        const accent = cell.isElite ? '#e8c46c' : '#c44';
        items.push(
          <group key={`enc-${x}-${y}`}>
            <Marker
              position={[wx, 0.05, wz]}
              color={accent}
              pulse
              size={cell.isElite ? 0.5 : 0.4}
            />
            {cell.isElite && (
              <Marker position={[wx, 0.04, wz]} color={accent} size={0.65} />
            )}
            {cell.encounterId && (
              <EnemyPreviewCard
                position={[wx, 1.4, wz]}
                encounterId={cell.encounterId}
                accent={accent}
                isElite={cell.isElite}
              />
            )}
          </group>,
        );
      } else if (cell.kind === 'boss' && !cell.cleared) {
        items.push(
          <group key={`boss-${x}-${y}`}>
            <Marker position={[wx, 0.05, wz]} color="#f4a02e" pulse size={0.55} />
            {cell.encounterId && (
              <EnemyPreviewCard
                position={[wx, 1.45, wz]}
                encounterId={cell.encounterId}
                accent="#f4a02e"
                isBoss
              />
            )}
          </group>,
        );
      } else if (cell.kind === 'chest' && !cell.cleared) {
        items.push(<Chest key={`ch-${x}-${y}`} position={[wx, 0.18, wz]} />);
      } else if (cell.kind === 'shovel') {
        items.push(
          <Portal
            key={`portal-${x}-${y}`}
            position={[wx, 0, wz]}
            locked={portalLocked}
          />,
        );
      } else if (cell.kind === 'hazard') {
        items.push(
          <SpikeTrap key={`hz-${x}-${y}`} position={[wx, 0, wz]} sprung={!!cell.cleared} />,
        );
      } else if (cell.kind === 'shrine') {
        items.push(
          <Shrine
            key={`sh-${x}-${y}`}
            position={[wx, 0, wz]}
            kind={cell.shrineKind ?? 'heal'}
            consumed={!!cell.cleared}
          />,
        );
      }
    }
  }
  return <>{items}</>;
}

// =============================================================================
// Hovering enemy preview card above encounter markers
// =============================================================================

/**
 * Paints an enemy "spirit card" onto a canvas in a Magic-the-Gathering style:
 * gold/silver beveled frame, illustrated portrait box, a type bar, and a name
 * banner. Cached per enemy-id so we don't rebuild canvases as the player
 * walks around.
 */
const ENEMY_CARD_CACHE = new Map<string, THREE.CanvasTexture>();

function buildEnemyCardTexture(
  enemyId: string,
  isBoss: boolean,
  isElite = false,
): THREE.CanvasTexture {
  const cacheKey = `${enemyId}:${isBoss ? 1 : 0}:${isElite ? 1 : 0}`;
  const hit = ENEMY_CARD_CACHE.get(cacheKey);
  if (hit) return hit;

  const def = getEnemy(enemyId);
  const W = 256;
  const H = 384;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  // ---- Card frame: dark recessed background with gold/silver bevel ----
  // Outer black bleed
  g.fillStyle = '#070306';
  g.fillRect(0, 0, W, H);

  // Frame color (gold = boss, pale gold = elite, bone = common)
  const frameOuter = isBoss ? '#e8b242' : isElite ? '#c4a45a' : '#a89878';
  const frameInner = isBoss ? '#7a5018' : isElite ? '#5a4628' : '#3a3228';

  // Outer frame
  const frameGrad = g.createLinearGradient(0, 0, 0, H);
  frameGrad.addColorStop(0, frameOuter);
  frameGrad.addColorStop(0.5, frameInner);
  frameGrad.addColorStop(1, frameOuter);
  g.fillStyle = frameGrad;
  roundedRect(g, 4, 4, W - 8, H - 8, 8);
  g.fill();

  // Inner card body
  g.fillStyle = '#1a0e16';
  roundedRect(g, 12, 12, W - 24, H - 24, 6);
  g.fill();

  // ---- Title bar ----
  const titleY = 18;
  const titleH = 30;
  g.fillStyle = '#241620';
  roundedRect(g, 18, titleY, W - 36, titleH, 4);
  g.fill();
  g.strokeStyle = frameOuter;
  g.lineWidth = 1;
  g.stroke();

  g.fillStyle = '#f3e2b8';
  g.font = 'bold 18px "Cinzel", "Times New Roman", serif';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(def.name, 26, titleY + titleH / 2);

  // ---- Portrait box ----
  // Paint the enemy illustration to an offscreen canvas first, then composite
  // it into the card's portrait slot. paintEnemy returns true when it drew
  // the real artwork; if false, we'll need to repaint once the image lands.
  const portraitTop = titleY + titleH + 8;
  const portraitH = 200;
  const portraitX = 18;
  const portraitW = W - 36;
  const drawPortrait = () => {
    const off = document.createElement('canvas');
    off.width = portraitW;
    off.height = portraitH;
    const ready = paintEnemy(off.getContext('2d')!, def.id, portraitW, portraitH);
    g.drawImage(off, portraitX, portraitTop);
    g.strokeStyle = frameOuter;
    g.lineWidth = 2;
    g.strokeRect(portraitX, portraitTop, portraitW, portraitH);
    return ready;
  };
  const portraitReady = drawPortrait();

  // ---- Type bar ----
  const typeY = portraitTop + portraitH + 6;
  const typeH = 22;
  g.fillStyle = '#241620';
  roundedRect(g, 18, typeY, W - 36, typeH, 3);
  g.fill();
  g.strokeStyle = frameOuter;
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = '#f3e2b8';
  g.font = 'italic 13px "Times New Roman", serif';
  g.textAlign = 'left';
  g.fillText(
    isBoss ? 'Legendary Creature' : isElite ? 'Elite Creature' : 'Creature',
    24,
    typeY + typeH / 2,
  );
  // Right-side rarity glyph
  g.textAlign = 'right';
  g.fillStyle = isBoss ? '#ffae3c' : isElite ? '#e8c46c' : '#a89878';
  g.fillText(isBoss ? '★' : isElite ? '◆' : '●', W - 26, typeY + typeH / 2);

  // ---- Stat box (bottom right) ----
  const statS = 44;
  const statX = W - 18 - statS;
  const statY = H - 18 - statS;
  g.fillStyle = '#241620';
  roundedRect(g, statX, statY, statS, statS, 4);
  g.fill();
  g.strokeStyle = frameOuter;
  g.lineWidth = 2;
  g.stroke();
  g.fillStyle = '#f3e2b8';
  g.font = 'bold 16px "Cinzel", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  // HP / XP shown as a power/toughness pair
  g.fillText(`${def.maxHp}`, statX + statS / 2, statY + statS / 2 - 1);

  // Small HP label above the stat
  g.font = '9px serif';
  g.fillStyle = '#a89878';
  g.fillText('HP', statX + statS / 2, statY - 6);

  // XP/coin info (bottom left)
  g.font = '11px "Times New Roman", serif';
  g.textAlign = 'left';
  g.fillStyle = '#e8c46c';
  g.fillText(`✦ ${def.xpReward} XP`, 22, H - 28);

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  ENEMY_CARD_CACHE.set(cacheKey, tex);

  // If a real image exists but hasn't decoded yet, schedule a one-shot
  // repaint of just the portrait region — the rest of the card frame is
  // already correct and doesn't need to be rebuilt.
  if (!portraitReady && hasEnemyImage(def.id)) {
    onEnemyImageLoad(def.id, () => {
      drawPortrait();
      tex.needsUpdate = true;
    });
  }

  return tex;
}

/** Draw a rounded rectangle path. Callers can then call fill() / stroke(). */
function roundedRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}

function EnemyPreviewCard({
  position,
  encounterId,
  accent,
  isBoss = false,
  isElite = false,
}: {
  position: [number, number, number];
  encounterId: string;
  accent: string;
  isBoss?: boolean;
  isElite?: boolean;
}) {
  // encounterId is comma-separated, e.g. "bat,giantRat". Show the first
  // enemy in the list as the preview — typically the headliner.
  const enemyId = encounterId.split(',')[0];
  const texture = useMemo(
    () => buildEnemyCardTexture(enemyId, isBoss, isElite),
    [enemyId, isBoss, isElite],
  );

  const groupRef = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!groupRef.current) return;
    // Gentle bob up and down so the card feels ethereal
    const t = s.clock.elapsedTime;
    groupRef.current.position.y = position[1] + Math.sin(t * 1.6) * 0.06;
  });

  const cardW = isBoss ? 0.7 : isElite ? 0.62 : 0.55;
  const cardH = cardW * 1.5;

  return (
    <group ref={groupRef} position={position}>
      <Billboard follow lockX={false} lockY={false} lockZ={false}>
        {/* Glow halo behind card */}
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[cardW * 1.25, cardH * 1.18]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.35}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Actual card */}
        <mesh>
          <planeGeometry args={[cardW, cardH]} />
          <meshBasicMaterial
            map={texture}
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

function Marker({
  position,
  color,
  pulse,
  size = 0.4,
}: {
  position: [number, number, number];
  color: string;
  pulse?: boolean;
  size?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (ref.current && pulse) {
      const t = s.clock.elapsedTime * 3;
      const sc = 1 + Math.sin(t) * 0.15;
      ref.current.scale.set(sc, 1 + Math.sin(t * 1.3) * 0.05, sc);
    }
  });
  return (
    <mesh ref={ref} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[size * 0.5, size, 24]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Chest({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.4, 0.3, 0.3]} />
        <meshStandardMaterial color="#6b3a1a" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <boxGeometry args={[0.42, 0.06, 0.32]} />
        <meshStandardMaterial color="#e8c46c" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  );
}

// ---------- Portal to next floor ----------

const PORTAL_TEXTURE_CACHE = { tex: null as THREE.CanvasTexture | null };

function buildPortalTexture(): THREE.CanvasTexture {
  if (PORTAL_TEXTURE_CACHE.tex) return PORTAL_TEXTURE_CACHE.tex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d')!;

  // Radial gradient — luminous center fading to deep void
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(232,196,255,0.95)');
  grad.addColorStop(0.5, 'rgba(160,75,255,0.8)');
  grad.addColorStop(0.85, 'rgba(60,28,110,0.6)');
  grad.addColorStop(1, 'rgba(20,10,40,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(128, 128, 128, 0, Math.PI * 2);
  g.fill();

  // Spiraling arms
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const angleOffset = (i / 4) * Math.PI * 2;
    g.strokeStyle = `rgba(255, 220, 255, ${0.45 - i * 0.05})`;
    g.lineWidth = 3;
    g.beginPath();
    for (let r = 6; r < 122; r += 1) {
      const theta = r * 0.06 + angleOffset;
      const x = 128 + Math.cos(theta) * r;
      const y = 128 + Math.sin(theta) * r;
      if (r === 6) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }

  // Sparkle dots
  for (let i = 0; i < 60; i++) {
    const r = Math.random() * 110 + 10;
    const theta = Math.random() * Math.PI * 2;
    const x = 128 + Math.cos(theta) * r;
    const y = 128 + Math.sin(theta) * r;
    g.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.5})`;
    g.beginPath();
    g.arc(x, y, Math.random() * 1.4 + 0.5, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  PORTAL_TEXTURE_CACHE.tex = tex;
  return tex;
}

function Portal({
  position,
  locked = false,
}: {
  position: [number, number, number];
  locked?: boolean;
}) {
  const swirlRef = useRef<THREE.Mesh>(null);
  const swirlBackRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => buildPortalTexture(), []);

  // Locked portals swirl sluggishly with a dim, sickly light. Unlocked ones
  // spin fast and pulse a vibrant violet glow.
  const swirlSpeed = locked ? 0.12 : 0.55;
  const swirlBackSpeed = locked ? -0.07 : -0.32;
  const baseLight = locked ? 0.9 : 4;
  const lightAmp = locked ? 0.15 : 0.6;

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (swirlRef.current) swirlRef.current.rotation.z = t * swirlSpeed;
    if (swirlBackRef.current) swirlBackRef.current.rotation.z = t * swirlBackSpeed;
    if (lightRef.current) {
      lightRef.current.intensity =
        baseLight + Math.sin(t * 2.4) * lightAmp + Math.sin(t * 5.3) * (lightAmp * 0.4);
    }
    if (ringRef.current) {
      const pulse = 1 + Math.sin(t * (locked ? 1.1 : 2.2)) * (locked ? 0.025 : 0.06);
      ringRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  // Center the visible portal at chest height in the new tall dungeon
  const portalY = 1.1;
  const [px, py, pz] = position;

  // Color palette: vibrant lavender when active, ashen gray-violet when locked.
  const padColor = locked ? '#3a2a40' : '#a04bff';
  const ringColor = locked ? '#6a5868' : '#d8a8ff';
  const lightColor = locked ? '#544064' : '#b070ff';
  const swirlOpacityFront = locked ? 0.45 : 1;
  const swirlOpacityBack = locked ? 0.28 : 0.55;
  const ringOpacity = locked ? 0.5 : 0.95;
  const padOpacity = locked ? 0.22 : 0.45;

  return (
    <group position={[px, py, pz]}>
      {/* Glowing pad on the floor */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.28, 0.46, 32]} />
        <meshBasicMaterial
          color={padColor}
          transparent
          opacity={padOpacity}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>

      {/* Vertical portal — billboarded so it's visible from any approach */}
      <Billboard position={[0, portalY, 0]} follow lockX lockZ>
        {/* Outer ring (slightly larger than the inner swirl) */}
        <mesh ref={ringRef}>
          <ringGeometry args={[0.42, 0.5, 48]} />
          <meshBasicMaterial
            color={ringColor}
            transparent
            opacity={ringOpacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {/* Back swirl (slower, behind front) */}
        <mesh ref={swirlBackRef} position={[0, 0, -0.005]}>
          <circleGeometry args={[0.42, 40]} />
          <meshBasicMaterial
            map={tex}
            color={locked ? '#5a4a66' : '#ffffff'}
            transparent
            opacity={swirlOpacityBack}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
        {/* Front swirl */}
        <mesh ref={swirlRef} position={[0, 0, 0.001]}>
          <circleGeometry args={[0.4, 40]} />
          <meshBasicMaterial
            map={tex}
            color={locked ? '#7a6a86' : '#ffffff'}
            transparent
            opacity={swirlOpacityFront}
            depthWrite={false}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>
      </Billboard>

      {/* Soft glow light — purple when active, dim and cool when sealed */}
      <pointLight
        ref={lightRef}
        position={[0, portalY, 0]}
        color={lightColor}
        intensity={baseLight}
        distance={locked ? 4 : 7}
        decay={1.3}
      />
    </group>
  );
}

// =============================================================================
// Wall torches & candelabras
// =============================================================================

/**
 * Returns the (worldX, worldZ, rotationY) for mounting a wall torch on the
 * specified side of cell (cx, cy). The torch sits flush against the wall
 * facing inward toward the cell.
 */
function wallTorchTransform(cx: number, cy: number, side: 0 | 1 | 2 | 3) {
  const [wx, wz] = cellToWorld(cx, cy);
  // Cell extends from (wx-0.5, wz-0.5) to (wx+0.5, wz+0.5). Wall is the
  // adjacent cell, so the wall face is at +/- 0.5 from cell center.
  const off = 0.45;
  switch (side) {
    case 0:
      return { x: wx, z: wz - off, ry: 0 };
    case 1:
      return { x: wx + off, z: wz, ry: -Math.PI / 2 };
    case 2:
      return { x: wx, z: wz + off, ry: Math.PI };
    case 3:
      return { x: wx - off, z: wz, ry: Math.PI / 2 };
  }
}

function Flame({ scale = 1 }: { scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const theme = useTheme();
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime * 6 + ref.current.id * 0.7;
    const sx = 1 + Math.sin(t) * 0.18;
    const sy = 1 + Math.sin(t * 1.6) * 0.22;
    ref.current.scale.set(sx * scale, sy * scale, sx * scale);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.06, 8, 8]} />
      <meshBasicMaterial color={theme.torchFlame} toneMapped={false} />
    </mesh>
  );
}

function WallTorch({ fixture }: { fixture: Fixture }) {
  const t = wallTorchTransform(fixture.x, fixture.y, fixture.wallSide!);
  return (
    <group position={[t.x, 1.5, t.z]} rotation={[0, t.ry, 0]}>
      {/* Bracket: a short stick coming out of the wall, ending in a cup */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[0.06, 0.06, 0.18]} />
        <meshStandardMaterial color="#4a2818" roughness={0.9} />
      </mesh>
      {/* Cup that holds the flame */}
      <mesh position={[0, 0.05, 0.16]}>
        <cylinderGeometry args={[0.05, 0.04, 0.06, 8]} />
        <meshStandardMaterial color="#2a1810" roughness={0.7} metalness={0.4} />
      </mesh>
      {/* Flame */}
      <group position={[0, 0.12, 0.16]}>
        <Flame scale={1.1} />
      </group>
    </group>
  );
}

function HangingSkeleton({ fixture }: { fixture: Fixture }) {
  const t = wallTorchTransform(fixture.x, fixture.y, fixture.wallSide!);
  // Random tilt for variety, deterministic from variant
  const tilt = (((fixture.variant ?? 0) % 21) - 10) * 0.02;
  return (
    <group position={[t.x, 1.4, t.z]} rotation={[0, t.ry, 0]}>
      <group rotation={[0, 0, tilt]}>
        {/* Iron manacle / hook embedded in wall */}
        <mesh position={[0, 0.55, 0.02]}>
          <boxGeometry args={[0.18, 0.04, 0.04]} />
          <meshStandardMaterial color="#3a2820" metalness={0.7} roughness={0.5} />
        </mesh>
        {/* Chain — short vertical bar (single link visual stand-in) */}
        <mesh position={[0, 0.38, 0.05]}>
          <cylinderGeometry args={[0.012, 0.012, 0.3, 6]} />
          <meshStandardMaterial color="#2a1f1c" metalness={0.6} roughness={0.6} />
        </mesh>
        {/* Skull */}
        <mesh position={[0, 0.12, 0.1]} castShadow>
          <sphereGeometry args={[0.085, 12, 10]} />
          <meshStandardMaterial color="#e8e0c8" roughness={0.85} />
        </mesh>
        {/* Eye sockets — small dark spheres in front of skull */}
        <mesh position={[-0.025, 0.13, 0.18]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshBasicMaterial color="#0a0608" />
        </mesh>
        <mesh position={[0.025, 0.13, 0.18]}>
          <sphereGeometry args={[0.015, 6, 6]} />
          <meshBasicMaterial color="#0a0608" />
        </mesh>
        {/* Jaw */}
        <mesh position={[0, 0.06, 0.14]}>
          <boxGeometry args={[0.07, 0.02, 0.06]} />
          <meshStandardMaterial color="#d4cab0" roughness={0.85} />
        </mesh>
        {/* Ribcage — a vertical cluster of horizontal bars */}
        {[-0.08, -0.13, -0.18].map((y) => (
          <mesh key={y} position={[0, y, 0.08]}>
            <boxGeometry args={[0.16, 0.018, 0.04]} />
            <meshStandardMaterial color="#e0d6bd" roughness={0.85} />
          </mesh>
        ))}
        {/* Spine */}
        <mesh position={[0, -0.13, 0.07]}>
          <cylinderGeometry args={[0.015, 0.015, 0.18, 6]} />
          <meshStandardMaterial color="#d4cab0" roughness={0.85} />
        </mesh>
        {/* Arms — two thin rods hanging at sides */}
        <mesh position={[-0.1, -0.1, 0.06]} rotation={[0, 0, -0.1]}>
          <cylinderGeometry args={[0.013, 0.013, 0.22, 6]} />
          <meshStandardMaterial color="#d4cab0" roughness={0.85} />
        </mesh>
        <mesh position={[0.1, -0.1, 0.06]} rotation={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.013, 0.013, 0.22, 6]} />
          <meshStandardMaterial color="#d4cab0" roughness={0.85} />
        </mesh>
        {/* Pelvis */}
        <mesh position={[0, -0.27, 0.07]}>
          <boxGeometry args={[0.1, 0.05, 0.05]} />
          <meshStandardMaterial color="#d4cab0" roughness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

function BonePile({ fixture }: { fixture: Fixture }) {
  const [wx, wz] = cellToWorld(fixture.x, fixture.y);
  const v = fixture.variant ?? 0;
  // Two slightly-scattered "long bones" + an optional small skull on top.
  // Use the variant to pick rotation so it's deterministic per map.
  const rot1 = ((v % 100) / 100) * Math.PI * 2;
  const rot2 = (((v >> 3) % 100) / 100) * Math.PI * 2;
  const dx1 = Math.sin(v * 0.31) * 0.08;
  const dz1 = Math.cos(v * 0.31) * 0.08;
  const dx2 = Math.sin(v * 0.71) * 0.1;
  const dz2 = Math.cos(v * 0.71) * 0.1;
  const showSkull = (v % 3) === 0;
  return (
    <group position={[wx, 0.02, wz]}>
      {/* Long bone 1 (femur-like) */}
      <group position={[dx1, 0.03, dz1]} rotation={[Math.PI / 2, rot1, 0]}>
        <mesh>
          <cylinderGeometry args={[0.025, 0.025, 0.28, 7]} />
          <meshStandardMaterial color="#e0d6bd" roughness={0.85} />
        </mesh>
        {/* End knobs */}
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color="#e8e0c8" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.15, 0]}>
          <sphereGeometry args={[0.04, 8, 6]} />
          <meshStandardMaterial color="#e8e0c8" roughness={0.85} />
        </mesh>
      </group>
      {/* Long bone 2 */}
      <group position={[dx2, 0.03, dz2]} rotation={[Math.PI / 2, rot2, 0.3]}>
        <mesh>
          <cylinderGeometry args={[0.02, 0.02, 0.24, 7]} />
          <meshStandardMaterial color="#d4cab0" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.13, 0]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshStandardMaterial color="#d4cab0" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.13, 0]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          <meshStandardMaterial color="#d4cab0" roughness={0.85} />
        </mesh>
      </group>
      {/* Sometimes: a skull on top */}
      {showSkull && (
        <group position={[0, 0.09, 0]} rotation={[0, ((v >> 5) % 8) * 0.3, 0]}>
          <mesh>
            <sphereGeometry args={[0.075, 12, 10]} />
            <meshStandardMaterial color="#e8e0c8" roughness={0.85} />
          </mesh>
          <mesh position={[-0.022, 0.005, 0.06]}>
            <sphereGeometry args={[0.013, 6, 6]} />
            <meshBasicMaterial color="#0a0608" />
          </mesh>
          <mesh position={[0.022, 0.005, 0.06]}>
            <sphereGeometry args={[0.013, 6, 6]} />
            <meshBasicMaterial color="#0a0608" />
          </mesh>
        </group>
      )}
    </group>
  );
}

// =============================================================================
// Spiderwebs — hang in upper corners of rooms
// =============================================================================

const SPIDERWEB_TEXTURE_CACHE = { tex: null as THREE.CanvasTexture | null };

/**
 * Paints a dusty corner spiderweb radiating from the canvas's top-center.
 * The web fades out toward the edges so the square plane reads as a
 * triangular tangle of threads instead of a square cutout.
 */
function buildSpiderwebTexture(): THREE.CanvasTexture {
  if (SPIDERWEB_TEXTURE_CACHE.tex) return SPIDERWEB_TEXTURE_CACHE.tex;
  const W = 512;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, W, H);

  // Anchor (the imaginary point where the spider sits) at top-center.
  const ax = W / 2;
  const ay = 22;

  // Radial threads fanning downward (~180° arc). Alternate brighter "structural"
  // threads with dimmer secondary threads for visual depth.
  const threadCount = 23;
  for (let i = 0; i < threadCount; i++) {
    const angle = (i / (threadCount - 1)) * Math.PI; // 0..π (right-down-left)
    const isStructural = i % 2 === 0;
    g.strokeStyle = isStructural ? 'rgba(238, 238, 244, 0.85)' : 'rgba(220, 220, 230, 0.55)';
    g.lineWidth = isStructural ? 1.4 : 1;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(ax + Math.cos(angle) * 520, ay + Math.sin(angle) * 520);
    g.stroke();
  }

  // Concentric capture threads (the catching arcs). Each arc is drawn as a
  // sequence of slight chords so it sags slightly between threads — gives the
  // web a more organic, hand-spun feel.
  for (let r = 42; r < 480; r += 18) {
    const alpha = Math.max(0, 0.72 - (r - 42) / 460 * 0.6);
    g.strokeStyle = `rgba(232, 232, 240, ${alpha})`;
    g.lineWidth = 0.9;
    const segs = 28;
    g.beginPath();
    for (let s = 0; s <= segs; s++) {
      const a = (s / segs) * Math.PI;
      // Subtle sag — capture arcs droop slightly between radial spokes
      const spokeIdx = (s / segs) * (threadCount - 1);
      const sag = Math.sin((spokeIdx - Math.floor(spokeIdx)) * Math.PI) * 1.5;
      const rr = r + sag;
      const px = ax + Math.cos(a) * rr;
      const py = ay + Math.sin(a) * rr;
      if (s === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  }

  // Sagging broken threads for extra creep factor — single-line catenaries
  // hanging off the main structure.
  g.strokeStyle = 'rgba(214, 214, 224, 0.55)';
  g.lineWidth = 0.9;
  for (let i = 0; i < 10; i++) {
    const angleA = (i / 10) * Math.PI + 0.1;
    const angleB = angleA + 0.45;
    const rA = 70 + (i % 4) * 26;
    const rB = rA + 22;
    g.beginPath();
    g.moveTo(ax + Math.cos(angleA) * rA, ay + Math.sin(angleA) * rA);
    g.quadraticCurveTo(
      ax + Math.cos((angleA + angleB) / 2) * (rA + 24),
      ay + Math.sin((angleA + angleB) / 2) * (rA + 50),
      ax + Math.cos(angleB) * rB,
      ay + Math.sin(angleB) * rB,
    );
    g.stroke();
  }

  // Sparse dust motes / wrapped prey along the radial threads.
  g.fillStyle = 'rgba(160, 154, 140, 0.55)';
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI;
    const r = 60 + Math.random() * 340;
    const x = ax + Math.cos(angle) * r;
    const y = ay + Math.sin(angle) * r;
    g.beginPath();
    g.ellipse(x, y, 1.2 + Math.random() * 1.6, 0.8 + Math.random() * 1.2, angle, 0, Math.PI * 2);
    g.fill();
  }

  // Anchor knot at the top-center — small dense tangle where the spider would sit.
  g.strokeStyle = 'rgba(180, 174, 160, 0.85)';
  g.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2;
    const len = 6 + Math.random() * 10;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(ax + Math.cos(a) * len, ay + Math.sin(a) * len);
    g.stroke();
  }

  // Radial fade-out — mask the canvas with a soft radial gradient so the web
  // dissolves toward the bottom corners of the plane instead of cutting off
  // at a hard square edge.
  g.globalCompositeOperation = 'destination-in';
  const grad = g.createRadialGradient(ax, ay, 20, ax, ay, 480);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.62, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  SPIDERWEB_TEXTURE_CACHE.tex = tex;
  return tex;
}

/**
 * Returns the (worldX, worldZ, rotationY) for a spiderweb hanging in the
 * specified corner of cell (cx, cy). The web sits just inside the corner so
 * its top edge spans between the two adjoining walls. Rotation aligns the
 * plane's normal to point into the room along the corner's diagonal.
 */
function spiderwebTransform(cx: number, cy: number, corner: 0 | 1 | 2 | 3) {
  const [wx, wz] = cellToWorld(cx, cy);
  // PLANE_HALF * cos(π/4) ≈ 0.5 * 0.707 ≈ 0.354 — distance from the wall
  // corner intersection to the plane's center along the diagonal.
  const inset = 0.18;
  // Each corner: [dx, dz, ry]
  //   dx/dz: offset from cell center to the web plane's center
  //   ry: yaw so the plane's +Z normal points into the room's interior
  const data: [number, number, number][] = [
    // NW: corner at (-0.5, -0.5), room interior is SE → normal yaw = π/4
    [-0.5 + inset, -0.5 + inset, Math.PI / 4],
    // NE: corner at (+0.5, -0.5), room interior is SW → normal yaw = -π/4
    [0.5 - inset, -0.5 + inset, -Math.PI / 4],
    // SE: corner at (+0.5, +0.5), room interior is NW → normal yaw = -3π/4
    [0.5 - inset, 0.5 - inset, -3 * Math.PI / 4],
    // SW: corner at (-0.5, +0.5), room interior is NE → normal yaw = 3π/4
    [-0.5 + inset, 0.5 - inset, (3 * Math.PI) / 4],
  ];
  const [dx, dz, ry] = data[corner];
  return { x: wx + dx, z: wz + dz, ry };
}

function Spiderweb({ fixture }: { fixture: Fixture }) {
  const t = spiderwebTransform(fixture.x, fixture.y, fixture.corner!);
  const tex = useMemo(() => buildSpiderwebTexture(), []);
  // Plane dimensions roughly span corner-to-corner along both walls.
  const size = 0.5;
  // Deterministic tiny rotation (z-axis) so each web feels slightly different
  const v = fixture.variant ?? 0;
  const wobble = (((v % 21) - 10) / 10) * 0.05;
  // Tuck the web just below the ceiling — small epsilon prevents z-fighting.
  return (
    <group position={[t.x, WALL_HEIGHT - 0.02, t.z]} rotation={[0, t.ry, 0]}>
      {/* Plane is offset down by half its height so its top edge sits at the
          ceiling and the web hangs into the room. */}
      <mesh position={[0, -size / 2, 0]} rotation={[0, 0, wobble]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial
          map={tex}
          transparent
          opacity={0.85}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// =============================================================================
// Wall dressing — chains / banner / grave plaque / rune / portrait
//
// All five share `wallTorchTransform` placement: position the group at the
// wall face with +Z pointing into the room, then build out the silhouette
// in local coordinates.
// =============================================================================

/** A pair of rusted manacles dangling from short chains. */
function WallChains({ fixture }: { fixture: Fixture }) {
  const t = wallTorchTransform(fixture.x, fixture.y, fixture.wallSide!);
  const v = fixture.variant ?? 0;
  // Slight per-instance sway so they don't all hang identically.
  const tilt = (((v % 21) - 10) / 10) * 0.05;
  const links = 7;
  return (
    <group position={[t.x, 1.5, t.z]} rotation={[0, t.ry, 0]}>
      <group rotation={[0, 0, tilt]}>
        {/* Two wall brackets the chains anchor to */}
        {[-0.13, 0.13].map((xo) => (
          <mesh key={`b-${xo}`} position={[xo, 0.45, 0.02]}>
            <boxGeometry args={[0.07, 0.05, 0.04]} />
            <meshStandardMaterial color="#3a2820" metalness={0.7} roughness={0.55} />
          </mesh>
        ))}
        {/* Vertical chain links — alternating orientation gives the woven look */}
        {[-0.13, 0.13].map((xo) =>
          Array.from({ length: links }).map((_, i) => (
            <mesh
              key={`l-${xo}-${i}`}
              position={[xo, 0.36 - i * 0.07, 0.045]}
              rotation={[Math.PI / 2, (i % 2) * (Math.PI / 2), 0]}
            >
              <torusGeometry args={[0.022, 0.008, 6, 10]} />
              <meshStandardMaterial color="#2a1f1c" metalness={0.65} roughness={0.6} />
            </mesh>
          )),
        )}
        {/* Manacles at the bottom */}
        {[-0.13, 0.13].map((xo) => (
          <mesh key={`m-${xo}`} position={[xo, -0.18, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.045, 0.014, 6, 14]} />
            <meshStandardMaterial color="#3a2820" metalness={0.7} roughness={0.55} />
          </mesh>
        ))}
        {/* A single drop of dried blood on the lower wall */}
        <mesh position={[0, -0.4, 0.022]}>
          <planeGeometry args={[0.04, 0.12]} />
          <meshStandardMaterial color="#3a0608" roughness={1} />
        </mesh>
      </group>
    </group>
  );
}

const BANNER_PALETTES: Array<{ cloth: [number, number, number]; sigil: [number, number, number]; sigilKind: 'cross' | 'chalice' | 'crown' | 'wing' }> = [
  { cloth: [90, 24, 32],  sigil: [196, 146, 43],  sigilKind: 'cross' },   // crimson + gold cross
  { cloth: [26, 40, 64],  sigil: [220, 207, 166], sigilKind: 'chalice' }, // navy + bone chalice
  { cloth: [42, 24, 64],  sigil: [196, 162, 63],  sigilKind: 'crown' },   // royal purple + gold crown
  { cloth: [28, 42, 24],  sigil: [168, 196, 108], sigilKind: 'wing' },    // moss + pale spread wing
];

const BANNER_TEXTURE_CACHE = new Map<number, THREE.CanvasTexture>();

/**
 * Procedural heraldic banner texture: cloth weave + damask diamond sub-pattern
 * + central sigil + wear marks + alpha-cut tatter hem with fraying threads.
 * Painted at 256×512 (tall banner aspect) so close-up details remain crisp.
 */
function buildBannerTexture(variant: number): THREE.CanvasTexture {
  const cached = BANNER_TEXTURE_CACHE.get(variant);
  if (cached) return cached;
  const W = 256;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const p = BANNER_PALETTES[variant % BANNER_PALETTES.length];
  const [cr, cg, cb] = p.cloth;
  const [sr, sg, sb] = p.sigil;

  // Cloth base — slight vertical gradient (hint brighter at top → darker at bottom)
  const baseGrad = g.createLinearGradient(0, 0, 0, H);
  baseGrad.addColorStop(0, `rgb(${Math.min(255, cr + 18)}, ${Math.min(255, cg + 14)}, ${Math.min(255, cb + 14)})`);
  baseGrad.addColorStop(1, `rgb(${Math.max(0, cr - 14)}, ${Math.max(0, cg - 12)}, ${Math.max(0, cb - 12)})`);
  g.fillStyle = baseGrad;
  g.fillRect(0, 0, W, H);

  // Fabric weave — fine horizontal weft + vertical warp highlights
  g.strokeStyle = `rgba(0, 0, 0, 0.10)`;
  g.lineWidth = 1;
  for (let y = 0; y < H; y += 2) {
    g.beginPath();
    g.moveTo(0, y + 0.5);
    g.lineTo(W, y + 0.5);
    g.stroke();
  }
  g.strokeStyle = `rgba(255, 255, 255, 0.05)`;
  for (let x = 0; x < W; x += 3) {
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, H);
    g.stroke();
  }

  // Damask diamonds — subtle, in a slightly lighter cloth tone
  const damaskColor = `rgba(${Math.min(255, cr + 30)}, ${Math.min(255, cg + 22)}, ${Math.min(255, cb + 22)}, 0.35)`;
  g.strokeStyle = damaskColor;
  g.lineWidth = 1.2;
  const dRows = 8;
  const dCols = 3;
  const dH = (H * 0.7) / dRows;
  const dW = W / dCols;
  for (let dr = 0; dr < dRows; dr++) {
    const yc = 12 + (dr + 0.5) * dH;
    for (let dc = 0; dc < dCols; dc++) {
      const xc = (dc + 0.5) * dW + (dr % 2 ? dW * 0.5 : 0);
      g.beginPath();
      g.moveTo(xc, yc - dH * 0.4);
      g.lineTo(xc + dW * 0.35, yc);
      g.lineTo(xc, yc + dH * 0.4);
      g.lineTo(xc - dW * 0.35, yc);
      g.closePath();
      g.stroke();
      // Inner fleur dot
      g.fillStyle = damaskColor;
      g.beginPath();
      g.arc(xc, yc, 2, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Side and top trim — thin sigil-colored band along the cloth edges
  g.strokeStyle = `rgba(${sr}, ${sg}, ${sb}, 0.55)`;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(6, 0);
  g.lineTo(6, H * 0.78);
  g.moveTo(W - 6, 0);
  g.lineTo(W - 6, H * 0.78);
  g.moveTo(0, 6);
  g.lineTo(W, 6);
  g.stroke();

  // Central sigil — drawn full-color so it reads at a distance
  const sx = W / 2;
  const sy = H * 0.34;
  const ringR = W * 0.24;
  const sigilCol = `rgb(${sr}, ${sg}, ${sb})`;
  g.strokeStyle = sigilCol;
  g.lineWidth = 5;
  g.beginPath();
  g.arc(sx, sy, ringR, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 2;
  g.beginPath();
  g.arc(sx, sy, ringR * 0.78, 0, Math.PI * 2);
  g.stroke();

  // Glyph inside the ring — varies per variant for visual identity
  g.fillStyle = sigilCol;
  if (p.sigilKind === 'cross') {
    g.fillRect(sx - ringR * 0.1, sy - ringR * 0.85, ringR * 0.2, ringR * 1.5);
    g.fillRect(sx - ringR * 0.55, sy - ringR * 0.1, ringR * 1.1, ringR * 0.2);
  } else if (p.sigilKind === 'chalice') {
    g.beginPath();
    g.moveTo(sx - ringR * 0.45, sy - ringR * 0.35);
    g.quadraticCurveTo(sx, sy + ringR * 0.25, sx + ringR * 0.45, sy - ringR * 0.35);
    g.closePath();
    g.fill();
    g.fillRect(sx - ringR * 0.07, sy + ringR * 0.1, ringR * 0.14, ringR * 0.32);
    g.fillRect(sx - ringR * 0.28, sy + ringR * 0.42, ringR * 0.56, ringR * 0.12);
    g.strokeStyle = sigilCol;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(sx - ringR * 0.45, sy - ringR * 0.35);
    g.lineTo(sx + ringR * 0.45, sy - ringR * 0.35);
    g.stroke();
  } else if (p.sigilKind === 'crown') {
    g.fillRect(sx - ringR * 0.55, sy + ringR * 0.18, ringR * 1.1, ringR * 0.18);
    g.beginPath();
    g.moveTo(sx - ringR * 0.55, sy + ringR * 0.18);
    g.lineTo(sx - ringR * 0.36, sy - ringR * 0.45);
    g.lineTo(sx - ringR * 0.18, sy + ringR * 0.0);
    g.lineTo(sx, sy - ringR * 0.55);
    g.lineTo(sx + ringR * 0.18, sy + ringR * 0.0);
    g.lineTo(sx + ringR * 0.36, sy - ringR * 0.45);
    g.lineTo(sx + ringR * 0.55, sy + ringR * 0.18);
    g.closePath();
    g.fill();
    for (const xo of [-ringR * 0.34, 0, ringR * 0.34]) {
      g.beginPath();
      g.arc(sx + xo, sy + ringR * 0.27, ringR * 0.06, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    // Spread wing — feathered V from the center
    g.lineWidth = 4;
    g.strokeStyle = sigilCol;
    for (let side = -1; side <= 1; side += 2) {
      g.beginPath();
      g.moveTo(sx, sy);
      g.quadraticCurveTo(sx + side * ringR * 0.45, sy - ringR * 0.4, sx + side * ringR * 0.8, sy - ringR * 0.05);
      g.stroke();
      for (let i = 0; i < 6; i++) {
        const tt = (i + 1) / 7;
        const fx = sx + side * tt * ringR * 0.8;
        const fy = sy - ringR * 0.4 * (1 - Math.abs(tt - 0.5) * 1.4);
        g.beginPath();
        g.moveTo(fx, fy);
        g.lineTo(fx, fy + ringR * 0.22);
        g.stroke();
      }
    }
    g.beginPath();
    g.arc(sx, sy, ringR * 0.06, 0, Math.PI * 2);
    g.fill();
  }

  // Wear marks — irregular dark scuffs scattered across the cloth area
  g.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let i = 0; i < 16; i++) {
    const x = Math.random() * W;
    const y = 20 + Math.random() * (H * 0.78);
    const w = 6 + Math.random() * 22;
    const h = 1 + Math.random() * 2.2;
    g.save();
    g.translate(x, y);
    g.rotate((Math.random() - 0.5) * 0.4);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
  }

  // Sub-pixel fabric grit
  for (let i = 0; i < 1200; i++) {
    g.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.12})`;
    g.fillRect(Math.random() * W, Math.random() * H * 0.82, 1, 1);
  }

  // Tattered hem — alpha-mask the bottom of the canvas into a jagged peak/valley
  // pattern so the cloth physically appears torn instead of squared off.
  const hemStart = H * 0.78;
  const hemPeak = hemStart + (H - hemStart) * 0.92;
  const tatterPeaks: Array<{ x: number; depth: number }> = [];
  const peakCount = 7;
  for (let i = 0; i <= peakCount; i++) {
    tatterPeaks.push({
      x: (i / peakCount) * W,
      depth: 0.35 + Math.random() * 0.6,
    });
  }
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.beginPath();
  g.moveTo(0, H);
  g.lineTo(0, hemPeak);
  for (let i = 0; i < tatterPeaks.length - 1; i++) {
    const a = tatterPeaks[i];
    const b = tatterPeaks[i + 1];
    const valleyX = (a.x + b.x) / 2;
    const valleyY = hemStart + (H - hemStart) * a.depth;
    g.lineTo(a.x, hemPeak);
    g.lineTo(valleyX, valleyY);
    g.lineTo(b.x, hemPeak);
  }
  g.lineTo(W, hemPeak);
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  g.globalCompositeOperation = 'source-over';

  // Fray threads dangling from the tatter peaks
  g.strokeStyle = `rgba(${Math.max(0, cr - 30)}, ${Math.max(0, cg - 24)}, ${Math.max(0, cb - 24)}, 0.7)`;
  g.lineWidth = 1;
  for (const peak of tatterPeaks) {
    if (Math.random() < 0.7) {
      const len = 6 + Math.random() * 18;
      const sway = (Math.random() - 0.5) * 6;
      g.beginPath();
      g.moveTo(peak.x, hemPeak);
      g.quadraticCurveTo(peak.x + sway, hemPeak + len * 0.6, peak.x + sway * 0.5, hemPeak + len);
      g.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  BANNER_TEXTURE_CACHE.set(variant, tex);
  return tex;
}

/** Tattered heraldic banner — pole + textured cloth (weave + damask + sigil + hem all baked in). */
function WallBanner({ fixture }: { fixture: Fixture }) {
  const t = wallTorchTransform(fixture.x, fixture.y, fixture.wallSide!);
  const v = fixture.variant ?? 0;
  const tex = useMemo(() => buildBannerTexture(v), [v]);
  return (
    <group position={[t.x, 1.55, t.z]} rotation={[0, t.ry, 0]}>
      {/* Horizontal pole */}
      <mesh position={[0, 0.45, 0.04]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.022, 0.022, 0.56, 8]} />
        <meshStandardMaterial color="#3a2820" roughness={0.85} metalness={0.3} />
      </mesh>
      {/* Pole end caps */}
      {[-0.28, 0.28].map((xo) => (
        <mesh key={`c-${xo}`} position={[xo, 0.45, 0.04]}>
          <sphereGeometry args={[0.032, 10, 10]} />
          <meshStandardMaterial color="#c4922b" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {/* Single textured cloth panel — alpha-cut tatter at the bottom */}
      <mesh position={[0, -0.05, 0.05]}>
        <planeGeometry args={[0.5, 1.0]} />
        <meshStandardMaterial
          map={tex}
          transparent
          alphaTest={0.4}
          roughness={1}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

const GRAVE_PLAQUE_TEXTURE_CACHE = { tex: null as THREE.CanvasTexture | null };

/**
 * Procedural tomb-plaque engraving texture — weathered stone slab with a
 * carved skull (with proper sockets, nose cavity, teeth), crossed bones
 * beneath, and a multi-line rune inscription. Cracks and grime baked in.
 * Painted at 512×768 so the engraving holds up at close player distance.
 */
function buildGravePlaqueTexture(): THREE.CanvasTexture {
  if (GRAVE_PLAQUE_TEXTURE_CACHE.tex) return GRAVE_PLAQUE_TEXTURE_CACHE.tex;
  const W = 512;
  const H = 768;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  // Recessed stone background (slightly darker than the outer slab)
  const baseGrad = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8);
  baseGrad.addColorStop(0, '#2a221c');
  baseGrad.addColorStop(1, '#15110d');
  g.fillStyle = baseGrad;
  g.fillRect(0, 0, W, H);
  // Subtle stone variation (mineral specks + flecks)
  for (let i = 0; i < 160; i++) {
    const a = 0.04 + Math.random() * 0.06;
    g.fillStyle = `rgba(220, 198, 168, ${a})`;
    const sz = 3 + Math.random() * 10;
    g.fillRect(Math.random() * W, Math.random() * H, sz, sz * 0.4);
  }

  // Inner shadow border (concave-recess illusion)
  const shadowGrad = g.createLinearGradient(0, 0, 0, H);
  shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  shadowGrad.addColorStop(0.05, 'rgba(0, 0, 0, 0)');
  g.fillStyle = shadowGrad;
  g.fillRect(0, 0, W, H);

  // ----- Carved skull -----
  const cx = W / 2;
  const skullCy = H * 0.27;
  const skullR = W * 0.18;
  // Recessed dark base — slightly inset and softened
  g.fillStyle = '#0a0808';
  g.beginPath();
  g.ellipse(cx, skullCy, skullR * 1.05, skullR * 1.12, 0, 0, Math.PI * 2);
  g.fill();
  // Jaw
  g.beginPath();
  g.ellipse(cx, skullCy + skullR * 0.68, skullR * 0.7, skullR * 0.36, 0, 0, Math.PI * 2);
  g.fill();
  // Bone color fill — overlaid only on the skull silhouette
  g.save();
  g.beginPath();
  g.ellipse(cx, skullCy, skullR * 1.0, skullR * 1.08, 0, 0, Math.PI * 2);
  g.ellipse(cx, skullCy + skullR * 0.68, skullR * 0.62, skullR * 0.3, 0, 0, Math.PI * 2);
  g.clip();
  const boneGrad = g.createLinearGradient(cx - skullR, skullCy - skullR, cx + skullR, skullCy + skullR);
  boneGrad.addColorStop(0, '#c8b890');
  boneGrad.addColorStop(0.5, '#a89a78');
  boneGrad.addColorStop(1, '#6a5e44');
  g.fillStyle = boneGrad;
  g.fillRect(cx - skullR * 1.2, skullCy - skullR * 1.2, skullR * 2.4, skullR * 2.4);
  // Crown highlight
  g.fillStyle = 'rgba(255, 240, 210, 0.18)';
  g.beginPath();
  g.ellipse(cx - skullR * 0.25, skullCy - skullR * 0.45, skullR * 0.45, skullR * 0.22, -0.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // Skull rim shadow (carved-edge effect)
  g.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(cx, skullCy, skullR * 1.0, skullR * 1.08, 0, 0, Math.PI * 2);
  g.stroke();
  // Eye sockets
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(cx - skullR * 0.35, skullCy - skullR * 0.18, skullR * 0.2, skullR * 0.22, 0, 0, Math.PI * 2);
  g.ellipse(cx + skullR * 0.35, skullCy - skullR * 0.18, skullR * 0.2, skullR * 0.22, 0, 0, Math.PI * 2);
  g.fill();
  // Socket rim highlight (top-left)
  g.strokeStyle = 'rgba(255, 240, 210, 0.22)';
  g.lineWidth = 1.5;
  for (const xo of [-skullR * 0.35, skullR * 0.35]) {
    g.beginPath();
    g.ellipse(cx + xo, skullCy - skullR * 0.18, skullR * 0.2, skullR * 0.22, 0, Math.PI * 0.95, Math.PI * 1.7);
    g.stroke();
  }
  // Nasal cavity (inverted triangle)
  g.fillStyle = '#000';
  g.beginPath();
  g.moveTo(cx - skullR * 0.1, skullCy + skullR * 0.08);
  g.lineTo(cx, skullCy + skullR * 0.34);
  g.lineTo(cx + skullR * 0.1, skullCy + skullR * 0.08);
  g.closePath();
  g.fill();
  // Teeth row (top jaw)
  g.fillStyle = '#0a0606';
  for (let i = -3; i <= 3; i++) {
    g.fillRect(cx + i * skullR * 0.13 - skullR * 0.05, skullCy + skullR * 0.46, skullR * 0.1, skullR * 0.18);
  }
  // Lower jaw bone highlight
  g.strokeStyle = 'rgba(255, 240, 210, 0.18)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(cx, skullCy + skullR * 0.68, skullR * 0.62, skullR * 0.3, 0, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();

  // ----- Crossed bones beneath the skull -----
  const bonesCy = H * 0.5;
  const boneLen = W * 0.42;
  const boneThick = W * 0.05;
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    g.save();
    g.translate(cx, bonesCy);
    g.rotate(angle);
    // Shaft shadow
    g.fillStyle = 'rgba(0, 0, 0, 0.55)';
    g.fillRect(-boneLen / 2 + 4, -boneThick / 2 + 4, boneLen, boneThick);
    // Shaft fill (bone gradient)
    const sg2 = g.createLinearGradient(0, -boneThick / 2, 0, boneThick / 2);
    sg2.addColorStop(0, '#d4c294');
    sg2.addColorStop(0.5, '#a89a78');
    sg2.addColorStop(1, '#5a503c');
    g.fillStyle = sg2;
    g.fillRect(-boneLen / 2, -boneThick / 2, boneLen, boneThick);
    // Bulbous ends — two knobs per side
    g.fillStyle = sg2;
    g.beginPath();
    g.arc(-boneLen / 2 + boneThick * 0.4, -boneThick * 0.5, boneThick * 0.55, 0, Math.PI * 2);
    g.arc(-boneLen / 2 + boneThick * 0.4, boneThick * 0.5, boneThick * 0.55, 0, Math.PI * 2);
    g.arc(boneLen / 2 - boneThick * 0.4, -boneThick * 0.5, boneThick * 0.55, 0, Math.PI * 2);
    g.arc(boneLen / 2 - boneThick * 0.4, boneThick * 0.5, boneThick * 0.55, 0, Math.PI * 2);
    g.fill();
    // Top highlight
    g.fillStyle = 'rgba(255, 240, 210, 0.18)';
    g.fillRect(-boneLen / 2 + 6, -boneThick / 2 + 2, boneLen - 12, 2);
    g.restore();
  }

  // ----- Rune inscription (3 rows of variable-width glyphs) -----
  const inscriptionTop = H * 0.66;
  const rowH = H * 0.08;
  const glyphWidths = [
    [22, 18, 24, 20, 26, 16, 22, 20, 18],
    [20, 22, 18, 24, 22, 20, 18, 24],
    [18, 24, 20, 22, 18],
  ];
  for (let row = 0; row < 3; row++) {
    const widths = glyphWidths[row];
    const totalW = widths.reduce((a, b) => a + b, 0) + (widths.length - 1) * 14;
    let x = cx - totalW / 2;
    const yc = inscriptionTop + row * rowH;
    for (let i = 0; i < widths.length; i++) {
      const w = widths[i];
      const glyph = (row * 7 + i * 11) % 6;
      // Carved (recessed dark) glyph
      g.fillStyle = '#080604';
      g.save();
      g.translate(x + w / 2, yc);
      if (glyph === 0) {
        // I-bar (vertical with serifs)
        g.fillRect(-w * 0.1, -rowH * 0.32, w * 0.2, rowH * 0.64);
        g.fillRect(-w * 0.45, -rowH * 0.32, w * 0.9, rowH * 0.12);
        g.fillRect(-w * 0.45, rowH * 0.2, w * 0.9, rowH * 0.12);
      } else if (glyph === 1) {
        // Triangle
        g.beginPath();
        g.moveTo(0, -rowH * 0.32);
        g.lineTo(w * 0.45, rowH * 0.32);
        g.lineTo(-w * 0.45, rowH * 0.32);
        g.closePath();
        g.fill();
      } else if (glyph === 2) {
        // X-cross
        g.lineWidth = w * 0.18;
        g.strokeStyle = '#080604';
        g.beginPath();
        g.moveTo(-w * 0.4, -rowH * 0.32);
        g.lineTo(w * 0.4, rowH * 0.32);
        g.moveTo(w * 0.4, -rowH * 0.32);
        g.lineTo(-w * 0.4, rowH * 0.32);
        g.stroke();
      } else if (glyph === 3) {
        // Diamond
        g.beginPath();
        g.moveTo(0, -rowH * 0.36);
        g.lineTo(w * 0.45, 0);
        g.lineTo(0, rowH * 0.36);
        g.lineTo(-w * 0.45, 0);
        g.closePath();
        g.fill();
      } else if (glyph === 4) {
        // Half-circle
        g.beginPath();
        g.arc(0, 0, w * 0.42, Math.PI, Math.PI * 2);
        g.lineTo(-w * 0.42, 0);
        g.closePath();
        g.fill();
      } else {
        // Y-rune
        g.lineWidth = w * 0.18;
        g.strokeStyle = '#080604';
        g.beginPath();
        g.moveTo(0, rowH * 0.32);
        g.lineTo(0, 0);
        g.moveTo(0, 0);
        g.lineTo(-w * 0.4, -rowH * 0.32);
        g.moveTo(0, 0);
        g.lineTo(w * 0.4, -rowH * 0.32);
        g.stroke();
      }
      // Carved highlight along the top-left edge (suggests engraved depth)
      g.strokeStyle = 'rgba(255, 240, 210, 0.18)';
      g.lineWidth = 1;
      g.restore();
      x += w + 14;
    }
  }

  // ----- Surface weathering — irregular cracks across the slab -----
  g.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    let x = Math.random() * W;
    let y = Math.random() * H;
    g.beginPath();
    g.moveTo(x, y);
    const segs = 4 + Math.floor(Math.random() * 4);
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * (W / 6);
      y += (Math.random() - 0.5) * (H / 8);
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // Grit
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.16})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  // Corner vignette
  const vig = g.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.7);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  GRAVE_PLAQUE_TEXTURE_CACHE.tex = tex;
  return tex;
}

/** Engraved stone tomb plaque embedded in the wall. */
function GravePlaque({ fixture }: { fixture: Fixture }) {
  const t = wallTorchTransform(fixture.x, fixture.y, fixture.wallSide!);
  const tex = useMemo(() => buildGravePlaqueTexture(), []);
  return (
    <group position={[t.x, 1.15, t.z]} rotation={[0, t.ry, 0]}>
      {/* Outer slab — bevelled stone frame */}
      <mesh position={[0, 0, 0.02]} castShadow>
        <boxGeometry args={[0.52, 0.78, 0.04]} />
        <meshStandardMaterial color="#3e3631" roughness={0.95} />
      </mesh>
      {/* Inner recessed engraved panel — skull, crossed bones, runes all baked into texture */}
      <mesh position={[0, -0.03, 0.043]}>
        <planeGeometry args={[0.42, 0.62]} />
        <meshStandardMaterial map={tex} roughness={1} />
      </mesh>
    </group>
  );
}

/** Glowing arcane rune carved into the wall. Color follows the floor theme. */
function RuneMark({ fixture }: { fixture: Fixture }) {
  const t = wallTorchTransform(fixture.x, fixture.y, fixture.wallSide!);
  const theme = useTheme();
  const v = fixture.variant ?? 0;
  // Pick one of two rune patterns deterministically.
  const pattern = v % 2;
  return (
    <group position={[t.x, 1.45, t.z]} rotation={[0, t.ry, 0]}>
      {/* Outer ring */}
      <mesh position={[0, 0, 0.013]}>
        <ringGeometry args={[0.16, 0.19, 32]} />
        <meshBasicMaterial color={theme.torchColor} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Inner ring */}
      <mesh position={[0, 0, 0.014]}>
        <ringGeometry args={[0.085, 0.1, 24]} />
        <meshBasicMaterial color={theme.torchFlame} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* Cross or diamond glyph */}
      {pattern === 0 ? (
        <>
          <mesh position={[0, 0, 0.015]}>
            <boxGeometry args={[0.035, 0.32, 0.002]} />
            <meshBasicMaterial color={theme.torchColor} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.015]}>
            <boxGeometry args={[0.32, 0.035, 0.002]} />
            <meshBasicMaterial color={theme.torchColor} toneMapped={false} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0, 0.015]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.035, 0.3, 0.002]} />
            <meshBasicMaterial color={theme.torchColor} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.015]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.035, 0.3, 0.002]} />
            <meshBasicMaterial color={theme.torchColor} toneMapped={false} />
          </mesh>
        </>
      )}
      {/* Faint halo billboard */}
      <mesh position={[0, 0, 0.012]}>
        <circleGeometry args={[0.24, 24]} />
        <meshBasicMaterial
          color={theme.torchColor}
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/** Dusty oil portrait of an ancestor (procedural canvas painting). */
function WallPainting({ fixture }: { fixture: Fixture }) {
  const t = wallTorchTransform(fixture.x, fixture.y, fixture.wallSide!);
  const v = fixture.variant ?? 0;
  const tex = useMemo(() => buildPortraitTexture(v), [v]);
  return (
    <group position={[t.x, 1.4, t.z]} rotation={[0, t.ry, 0]}>
      {/* Gold outer frame */}
      <mesh position={[0, 0, 0.018]} castShadow>
        <boxGeometry args={[0.55, 0.7, 0.04]} />
        <meshStandardMaterial color="#7a5a18" metalness={0.7} roughness={0.45} />
      </mesh>
      {/* Inner shadow plate */}
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[0.46, 0.6]} />
        <meshStandardMaterial color="#0a0608" roughness={1} />
      </mesh>
      {/* Painting canvas */}
      <mesh position={[0, 0, 0.042]}>
        <planeGeometry args={[0.42, 0.56]} />
        <meshStandardMaterial map={tex} roughness={1} />
      </mesh>
      {/* Top hanging nail / hook (visible above the frame) */}
      <mesh position={[0, 0.4, 0.025]}>
        <boxGeometry args={[0.04, 0.04, 0.03]} />
        <meshStandardMaterial color="#3a2820" metalness={0.6} roughness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * Procedural oil-portrait texture. Paints a dim, shrouded figure on a moody
 * cracked-canvas background, with chiaroscuro lighting, hood folds, lapel
 * trim, and a faux-rune name plate. `variant` selects palette + silhouette pose.
 *
 * Rendered at 512×640 — a full doubling of the previous resolution — so the
 * portrait holds up close at typical player viewing distances.
 */
function buildPortraitTexture(variant: number): THREE.CanvasTexture {
  const W = 512;
  const H = 640;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // Mood palette — sepia / olive / burgundy / royal variants
  const palettes = [
    { bg0: '#4a3220', bg1: '#080604', figure: '#0a0608', skin: '#2a1c14', accent: '#c4a23f', name: '#d8b850' },
    { bg0: '#1e2a1c', bg1: '#040804', figure: '#080a06', skin: '#1c2418', accent: '#a8c46c', name: '#bcd084' },
    { bg0: '#36202a', bg1: '#080406', figure: '#0a0608', skin: '#241818', accent: '#aa3a4a', name: '#d05060' },
    { bg0: '#221c40', bg1: '#040408', figure: '#0a0814', skin: '#1a1830', accent: '#9a78ff', name: '#c4a8ff' },
  ];
  const p = palettes[variant % palettes.length];

  // Mottled canvas backdrop (radial spotlight + brush-stroke variation)
  const grad = g.createRadialGradient(W / 2, H * 0.36, 0, W / 2, H * 0.5, W * 0.9);
  grad.addColorStop(0, p.bg0);
  grad.addColorStop(1, p.bg1);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // Painterly brush-stroke variation across the background
  for (let i = 0; i < 240; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    const w = 6 + Math.random() * 24;
    const h = 1 + Math.random() * 2.4;
    const a = (Math.random() - 0.5) * 0.6;
    const tone = Math.random() < 0.5 ? 'rgba(255,220,170,' : 'rgba(0,0,0,';
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = `${tone}${0.04 + Math.random() * 0.07})`;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
  }

  // Hairline craquelure (irregular branching cracks across the surface)
  g.strokeStyle = 'rgba(0, 0, 0, 0.22)';
  g.lineWidth = 1;
  for (let i = 0; i < 28; i++) {
    let x = Math.random() * W;
    let y = Math.random() * H;
    g.beginPath();
    g.moveTo(x, y);
    const segs = 3 + Math.floor(Math.random() * 4);
    for (let s = 0; s < segs; s++) {
      x += (Math.random() - 0.5) * 80;
      y += (Math.random() - 0.5) * 80;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // Shrouded figure silhouette
  const cx = W / 2;
  const cy = H * 0.55;
  g.fillStyle = p.figure;
  // Shoulders / cloak
  g.beginPath();
  g.moveTo(cx - 160, H);
  g.bezierCurveTo(cx - 180, cy + 80, cx - 140, cy - 40, cx - 100, cy - 80);
  g.lineTo(cx + 100, cy - 80);
  g.bezierCurveTo(cx + 140, cy - 40, cx + 180, cy + 80, cx + 160, H);
  g.closePath();
  g.fill();

  // Cloak folds — vertical highlight ridges
  g.strokeStyle = `${p.accent}26`;
  g.lineWidth = 2;
  for (const xo of [-110, -70, -32, 32, 70, 110]) {
    g.beginPath();
    g.moveTo(cx + xo * 0.7, cy + 10);
    g.quadraticCurveTo(cx + xo * 0.85, cy + 100, cx + xo, H - 12);
    g.stroke();
  }
  // Cloak fold shadows (offset slightly so we get a chiseled drape)
  g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  g.lineWidth = 3;
  for (const xo of [-110, -70, -32, 32, 70, 110]) {
    g.beginPath();
    g.moveTo(cx + xo * 0.7 + 6, cy + 14);
    g.quadraticCurveTo(cx + xo * 0.85 + 6, cy + 104, cx + xo + 6, H - 8);
    g.stroke();
  }

  // Lapel trim along the collar opening
  g.strokeStyle = `${p.accent}88`;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx - 96, cy - 76);
  g.quadraticCurveTo(cx, cy - 30, cx + 96, cy - 76);
  g.stroke();
  // Trim highlight
  g.strokeStyle = 'rgba(255, 220, 180, 0.35)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(cx - 96, cy - 78);
  g.quadraticCurveTo(cx, cy - 32, cx + 96, cy - 78);
  g.stroke();

  // Face — softly lit oval (left side caught by the light, right side in shadow)
  g.fillStyle = p.skin;
  g.beginPath();
  g.ellipse(cx, cy - 130, 70, 92, 0, 0, Math.PI * 2);
  g.fill();
  // Chiaroscuro shadow on the right side of the face
  const faceShadow = g.createLinearGradient(cx - 30, cy - 130, cx + 70, cy - 130);
  faceShadow.addColorStop(0, 'rgba(0, 0, 0, 0)');
  faceShadow.addColorStop(1, 'rgba(0, 0, 0, 0.65)');
  g.save();
  g.beginPath();
  g.ellipse(cx, cy - 130, 70, 92, 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = faceShadow;
  g.fillRect(cx - 70, cy - 222, 140, 184);
  g.restore();
  // Cheek highlight (lit side)
  const cheek = g.createRadialGradient(cx - 26, cy - 118, 4, cx - 26, cy - 118, 28);
  cheek.addColorStop(0, 'rgba(255, 220, 180, 0.32)');
  cheek.addColorStop(1, 'rgba(255, 220, 180, 0)');
  g.save();
  g.beginPath();
  g.ellipse(cx, cy - 130, 70, 92, 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = cheek;
  g.fillRect(cx - 70, cy - 200, 140, 140);
  g.restore();

  // Hood drape over the head — figure-color arch with accent ridge
  g.fillStyle = p.figure;
  g.beginPath();
  g.moveTo(cx - 76, cy - 64);
  g.bezierCurveTo(cx - 96, cy - 160, cx + 96, cy - 160, cx + 76, cy - 64);
  g.lineTo(cx + 60, cy - 100);
  g.bezierCurveTo(cx + 70, cy - 150, cx - 70, cy - 150, cx - 60, cy - 100);
  g.closePath();
  g.fill();
  g.strokeStyle = `${p.accent}66`;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx - 76, cy - 64);
  g.bezierCurveTo(cx - 96, cy - 160, cx + 96, cy - 160, cx + 76, cy - 64);
  g.stroke();

  // Eye sockets — small shadow pits
  const eyeY = cy - 138;
  g.fillStyle = 'rgba(0, 0, 0, 0.85)';
  g.beginPath();
  g.ellipse(cx - 22, eyeY, 8, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx + 22, eyeY, 8, 5, 0, 0, Math.PI * 2);
  g.fill();
  // Glowing accent eye(s) — sometimes one, sometimes both
  if ((variant % 3) !== 0) {
    g.fillStyle = p.accent;
    g.beginPath();
    g.arc(cx + (variant % 2 ? 22 : -22), eyeY, 3.2, 0, Math.PI * 2);
    g.fill();
    // Faint glow halo
    const glow = g.createRadialGradient(cx + (variant % 2 ? 22 : -22), eyeY, 1, cx + (variant % 2 ? 22 : -22), eyeY, 18);
    glow.addColorStop(0, `${p.accent}88`);
    glow.addColorStop(1, `${p.accent}00`);
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
  }

  // Brow shadow line
  g.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 36, eyeY - 12);
  g.quadraticCurveTo(cx, eyeY - 18, cx + 36, eyeY - 12);
  g.stroke();
  // Nose-bridge shadow
  g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx + 4, eyeY - 4);
  g.quadraticCurveTo(cx + 8, eyeY + 32, cx + 2, eyeY + 50);
  g.stroke();
  // Mouth — thin shadow line
  g.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(cx - 16, eyeY + 64);
  g.quadraticCurveTo(cx, eyeY + 68, cx + 16, eyeY + 64);
  g.stroke();

  // Name plate at the bottom — recessed band with faux-rune inscription
  const plateY = H - 70;
  const plateH = 30;
  g.fillStyle = 'rgba(0, 0, 0, 0.55)';
  g.fillRect(cx - 140, plateY, 280, plateH);
  g.strokeStyle = `${p.accent}88`;
  g.lineWidth = 2;
  g.strokeRect(cx - 140, plateY, 280, plateH);
  // Faux-rune glyphs (faintly glowing dashes — short uneven runes)
  g.fillStyle = p.name;
  for (let i = 0; i < 11; i++) {
    const gx = cx - 130 + i * 24;
    const gy = plateY + plateH / 2;
    const glyph = (variant * 7 + i * 13) % 6;
    g.save();
    g.translate(gx, gy);
    if (glyph === 0) {
      g.fillRect(-1, -8, 2, 16);
    } else if (glyph === 1) {
      g.fillRect(-1, -8, 2, 16);
      g.fillRect(-1, -8, 8, 2);
    } else if (glyph === 2) {
      g.fillRect(-1, -8, 2, 16);
      g.fillRect(-1, 6, 8, 2);
    } else if (glyph === 3) {
      g.beginPath();
      g.moveTo(-7, -8);
      g.lineTo(7, 8);
      g.lineTo(7, 6);
      g.lineTo(-5, -8);
      g.closePath();
      g.fill();
    } else if (glyph === 4) {
      g.beginPath();
      g.arc(0, 0, 7, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'destination-out';
      g.beginPath();
      g.arc(0, 0, 4, 0, Math.PI * 2);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    } else {
      g.fillRect(-7, -1, 14, 2);
      g.fillRect(-1, -7, 2, 14);
    }
    g.restore();
  }

  // Subtle vignette — darken corners so the portrait reads as candle-lit
  const vig = g.createRadialGradient(cx, H * 0.5, W * 0.3, cx, H * 0.5, W * 0.75);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  g.fillStyle = vig;
  g.fillRect(0, 0, W, H);
  // Final faint surface noise (so the canvas-weave is visible up close)
  for (let i = 0; i < 800; i++) {
    g.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.18})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

// =============================================================================
// Hazard: spike trap
// =============================================================================

function SpikeTrap({
  position,
  sprung,
}: {
  position: [number, number, number];
  sprung: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);

  // Armed traps pulse gently; sprung traps are dim and the spikes recede.
  useFrame((s) => {
    if (!groupRef.current) return;
    const t = s.clock.elapsedTime;
    if (sprung) {
      groupRef.current.scale.y = 0.18;
      if (lightRef.current) lightRef.current.intensity = 0;
      if (glowRef.current)
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.15;
    } else {
      // Subtle "menacing breathing" scale + ring throb
      groupRef.current.scale.y = 1 + Math.sin(t * 1.4) * 0.05;
      if (lightRef.current) {
        lightRef.current.intensity = 0.9 + Math.sin(t * 3.6) * 0.35;
      }
      if (glowRef.current) {
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity =
          0.42 + Math.sin(t * 3) * 0.12;
      }
    }
  });

  const [px, py, pz] = position;
  // Six rusty iron spikes in a small ring
  const spikes: { x: number; z: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    spikes.push({ x: Math.cos(a) * 0.16, z: Math.sin(a) * 0.16 });
  }
  // One taller center spike
  spikes.push({ x: 0, z: 0 });

  return (
    <group position={[px, py, pz]}>
      {/* Cracked floor plate + glow ring */}
      <mesh ref={glowRef} position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.18, 0.36, 28]} />
        <meshBasicMaterial
          color={sprung ? '#3a2018' : '#c4382a'}
          transparent
          opacity={0.45}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.3, 24]} />
        <meshStandardMaterial color="#1a0608" roughness={1} />
      </mesh>
      {/* Spikes (scaled vertically by groupRef) */}
      <group ref={groupRef}>
        {spikes.map((s, i) => {
          const isCenter = i === spikes.length - 1;
          const h = isCenter ? 0.32 : 0.22;
          return (
            <mesh key={i} position={[s.x, h / 2 + 0.02, s.z]} castShadow>
              <coneGeometry args={[isCenter ? 0.055 : 0.04, h, 6]} />
              <meshStandardMaterial
                color={sprung ? '#3a2820' : '#7a3424'}
                roughness={0.55}
                metalness={0.45}
                emissive={sprung ? '#000' : '#5a1810'}
                emissiveIntensity={sprung ? 0 : 0.35}
              />
            </mesh>
          );
        })}
      </group>
      <pointLight
        ref={lightRef}
        position={[0, 0.45, 0]}
        color="#ff5a3a"
        intensity={0.9}
        distance={2.2}
        decay={1.6}
      />
    </group>
  );
}

// =============================================================================
// Shrine: a small altar that can be activated once for HP / max-HP changes
// =============================================================================

function Shrine({
  position,
  kind,
  consumed,
}: {
  position: [number, number, number];
  kind: 'heal' | 'altar';
  consumed: boolean;
}) {
  const flameRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const isAltar = kind === 'altar';
  const flameColor = consumed ? '#2a2024' : isAltar ? '#b070ff' : '#7fe0a0';
  const lightColor = consumed ? '#3a2a30' : isAltar ? '#9c4dff' : '#6ee0a0';

  useFrame((s) => {
    if (!flameRef.current) return;
    const t = s.clock.elapsedTime;
    if (consumed) {
      flameRef.current.scale.set(0.4, 0.4, 0.4);
      if (lightRef.current) lightRef.current.intensity = 0;
      return;
    }
    const flicker = 1 + Math.sin(t * 6) * 0.18 + Math.sin(t * 11.3) * 0.08;
    flameRef.current.scale.set(1 * flicker, 1.15 * flicker, 1 * flicker);
    if (lightRef.current) {
      lightRef.current.intensity = 2.2 + Math.sin(t * 4) * 0.4;
    }
  });

  const [px, py, pz] = position;

  return (
    <group position={[px, py, pz]}>
      {/* Stepped stone base */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.36, 0.1, 16]} />
        <meshStandardMaterial
          color={isAltar ? '#3a2238' : '#3a3a44'}
          roughness={0.92}
        />
      </mesh>
      <mesh position={[0, 0.16, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.28, 0.12, 16]} />
        <meshStandardMaterial
          color={isAltar ? '#4a2c46' : '#4a4a58'}
          roughness={0.9}
        />
      </mesh>
      {/* Bowl */}
      <mesh position={[0, 0.27, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.16, 0.1, 18]} />
        <meshStandardMaterial
          color={isAltar ? '#2a1a28' : '#2a2630'}
          roughness={0.7}
          metalness={0.3}
        />
      </mesh>
      {/* Liquid surface inside bowl */}
      <mesh position={[0, 0.325, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.17, 24]} />
        <meshBasicMaterial
          color={consumed ? '#1a1416' : isAltar ? '#5a2c7a' : '#1f5a48'}
          transparent
          opacity={0.85}
          toneMapped={false}
        />
      </mesh>
      {/* Glowing flame/aura above the bowl */}
      <mesh ref={flameRef} position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshBasicMaterial color={flameColor} transparent opacity={0.85} toneMapped={false} />
      </mesh>
      {/* Glow ring on the ground */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.38, 0.52, 28]} />
        <meshBasicMaterial
          color={lightColor}
          transparent
          opacity={consumed ? 0.06 : 0.34}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[0, 0.55, 0]}
        color={lightColor}
        intensity={consumed ? 0 : 2.2}
        distance={consumed ? 1 : 4.5}
        decay={1.4}
      />
    </group>
  );
}

function Fixtures({ fixtures }: { fixtures: Fixture[] }) {
  return (
    <>
      {fixtures.map((f, i) => {
        switch (f.kind) {
          case 'wallTorch':
            return <WallTorch key={`f-${i}`} fixture={f} />;
          case 'hangingSkeleton':
            return <HangingSkeleton key={`f-${i}`} fixture={f} />;
          case 'bonePile':
            return <BonePile key={`f-${i}`} fixture={f} />;
          case 'spiderweb':
            return <Spiderweb key={`f-${i}`} fixture={f} />;
          case 'chains':
            return <WallChains key={`f-${i}`} fixture={f} />;
          case 'banner':
            return <WallBanner key={`f-${i}`} fixture={f} />;
          case 'gravePlaque':
            return <GravePlaque key={`f-${i}`} fixture={f} />;
          case 'runeMark':
            return <RuneMark key={`f-${i}`} fixture={f} />;
          case 'paintingFrame':
            return <WallPainting key={`f-${i}`} fixture={f} />;
        }
      })}
    </>
  );
}

/**
 * Maintains a small pool of point lights and assigns them every frame to the
 * N fixtures closest to the camera. This keeps total simultaneous light
 * count low (good for performance) while ensuring the player always sees
 * lighting from nearby torches.
 */
const MAX_DYNAMIC_LIGHTS = 6;
const DYNAMIC_LIGHT_RANGE = 8; // max distance considered

function DynamicTorchLights({ fixtures }: { fixtures: Fixture[] }) {
  const camera = useThree((s) => s.camera);
  const theme = useTheme();
  const lightRefs = useRef<(THREE.PointLight | null)[]>([]);

  // Only light-emitting fixtures attract dynamic lights.
  const lightSources = useMemo(
    () => fixtures.filter((f) => f.kind === 'wallTorch'),
    [fixtures],
  );

  // Precompute world positions for all light source fixtures.
  const fixtureLightPositions = useMemo(() => {
    return lightSources.map((f) => {
      const t = wallTorchTransform(f.x, f.y, f.wallSide!);
      // Place the light slightly in front of the wall surface, at the
      // height of the torch flame.
      const inset = 0.02;
      const fx = t.x + Math.sin(t.ry) * inset;
      const fz = t.z + Math.cos(t.ry) * inset;
      return new THREE.Vector3(fx, 1.65, fz);
    });
  }, [lightSources]);

  useFrame((s) => {
    // Find indices of the N closest fixtures within range.
    const cam = camera.position;
    const scored: { idx: number; dist: number }[] = [];
    for (let i = 0; i < fixtureLightPositions.length; i++) {
      const p = fixtureLightPositions[i];
      const dx = p.x - cam.x;
      const dz = p.z - cam.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d <= DYNAMIC_LIGHT_RANGE) scored.push({ idx: i, dist: d });
    }
    scored.sort((a, b) => a.dist - b.dist);

    for (let slot = 0; slot < MAX_DYNAMIC_LIGHTS; slot++) {
      const light = lightRefs.current[slot];
      if (!light) continue;
      const assignment = scored[slot];
      if (!assignment) {
        light.intensity = 0;
        continue;
      }
      const p = fixtureLightPositions[assignment.idx];
      light.position.set(p.x, p.y, p.z);
      // Flicker, indexed per-light so they don't sync
      const t = s.clock.elapsedTime * 7 + slot * 1.3;
      const base = theme.torchLightIntensity * BRIGHTNESS_BOOST;
      light.intensity = base + Math.sin(t) * 0.45 + Math.sin(t * 1.7) * 0.25;
    }
  });

  return (
    <>
      {Array.from({ length: MAX_DYNAMIC_LIGHTS }).map((_, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lightRefs.current[i] = el;
          }}
          color={theme.torchColor}
          intensity={0}
          distance={9}
          decay={1.4}
        />
      ))}
    </>
  );
}

// =============================================================================
// Lighting — player carries a torch
// =============================================================================

function TorchLight() {
  const ref = useRef<THREE.PointLight>(null);
  const camera = useThree((s) => s.camera);
  const theme = useTheme();
  const baseIntensity = 8 * BRIGHTNESS_BOOST;
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.position.copy(camera.position);
    ref.current.position.y = EYE_HEIGHT + 0.05;
    const t = s.clock.elapsedTime;
    ref.current.intensity = baseIntensity + Math.sin(t * 11) * 0.6 + Math.sin(t * 23) * 0.3;
  });
  return (
    <pointLight ref={ref} color={theme.torchColor} intensity={baseIntensity} distance={13} decay={1.4} />
  );
}

// =============================================================================
// Procedural textures (so we don't need asset files)
// =============================================================================

/**
 * Ashlar masonry: varied-width blocks in running-bond, dark recessed mortar,
 * top-edge highlights, bottom-edge shadows, hairline cracks, edge chips.
 * Per-block face brightness derives from `theme.wall.base` so each floor theme
 * still recolors cleanly; `theme.wall.accent` drives moss / gold / arcane flecks.
 * Painted at 256² to match the approved preview density.
 */
function buildWallTexture(theme: FloorTheme): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  // Mortar (dark grout shows in the joints + chips)
  g.fillStyle = theme.wall.mortar;
  g.fillRect(0, 0, W, H);

  const baseRgb = hexToRgb(theme.wall.base);
  const rows = 6;
  const rowH = H / rows;
  for (let row = 0; row < rows; row++) {
    const y = row * rowH;
    // Running-bond offset: alternate rows nudged ~70% of a row width
    const offset = row % 2 === 0 ? 0 : rowH * 0.7;
    let x = -offset;
    while (x < W) {
      const blockW = rowH * (1.2 + Math.random() * 1.5);
      // Block face: brightness varies around theme base, with a small additive
      // floor so dark themes don't crush to black.
      const shade = 0.55 + Math.random() * 0.35;
      const lift = 0.14;
      const r = Math.min(255, Math.floor(baseRgb.r * (shade + lift)));
      const gg = Math.min(255, Math.floor(baseRgb.g * (shade + lift)));
      const b = Math.min(255, Math.floor(baseRgb.b * (shade + lift)));
      const inset = Math.max(2, W / 96);
      g.fillStyle = `rgb(${r}, ${gg}, ${b})`;
      g.fillRect(x + inset, y + inset, blockW - inset * 2, rowH - inset * 2);
      // Top edge highlight — catches torchlight
      g.fillStyle = 'rgba(255, 220, 200, 0.08)';
      g.fillRect(x + inset, y + inset, blockW - inset * 2, Math.max(1, rowH * 0.06));
      // Bottom edge shadow
      g.fillStyle = 'rgba(0, 0, 0, 0.35)';
      g.fillRect(x + inset, y + rowH - inset - rowH * 0.08, blockW - inset * 2, rowH * 0.08);
      // Hairline cracks (sometimes)
      if (Math.random() < 0.25) {
        g.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        g.lineWidth = 1;
        let cx = x + inset + Math.random() * (blockW - inset * 2);
        let cy = y + inset + Math.random() * (rowH - inset * 2);
        g.beginPath();
        g.moveTo(cx, cy);
        for (let i = 0; i < 4; i++) {
          cx += (Math.random() - 0.5) * (W / 12);
          cy += (Math.random() - 0.5) * (rowH / 3);
          g.lineTo(cx, cy);
        }
        g.stroke();
      }
      // Edge chips — corner of block reveals mortar
      if (Math.random() < 0.4) {
        g.fillStyle = theme.wall.mortar;
        const cx = x + inset + Math.random() * (blockW - inset * 2);
        const cy = Math.random() < 0.5 ? y + inset : y + rowH - inset;
        g.beginPath();
        g.arc(cx, cy, 1.5 + Math.random() * 3, 0, Math.PI * 2);
        g.fill();
      }
      x += blockW;
    }
  }

  // Theme accent (moss / gold / arcane shimmer) — sparse smudges
  const accentRgb = hexToRgb(theme.wall.accent);
  for (let i = 0; i < 16; i++) {
    g.fillStyle = `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, ${theme.wall.accentAlpha * Math.random()})`;
    const sz = 4 + Math.random() * 10;
    g.fillRect(Math.random() * W, Math.random() * H, sz, sz * 0.5);
  }
  // Grit (sub-pixel noise to break up flat areas)
  for (let i = 0; i < 1000; i++) {
    g.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.2})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

/**
 * Cobblestone floor: irregular polygonal stones with per-stone shading, top-rim
 * highlight arcs, bottom-edge shadow arcs, and occasional hairline cracks across
 * the stone face. Sits in dark grout (`theme.floor.border`). The theme-tinted
 * `sparkleColor` preserves the wet-stone shimmer / candle dust feel.
 * Painted at 256² to match the approved preview density.
 */
function buildFloorTexture(theme: FloorTheme): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  // Dark grout base
  g.fillStyle = theme.floor.border;
  g.fillRect(0, 0, W, H);

  const baseRgb = hexToRgb(theme.floor.base);
  const cols = 7;
  const rows = 7;
  const tile = W / cols;

  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const cx = (col + 0.5) * tile + (Math.random() - 0.5) * tile * 0.18;
      const cy = (r + 0.5) * tile + (Math.random() - 0.5) * tile * 0.18;
      // Per-stone shading: brightness varies around the theme base
      const shade = 0.5 + Math.random() * 0.45;
      const lift = 0.15;
      const rr = Math.min(255, Math.floor(baseRgb.r * (shade + lift)));
      const gg = Math.min(255, Math.floor(baseRgb.g * (shade + lift)));
      const bb = Math.min(255, Math.floor(baseRgb.b * (shade + lift)));
      g.fillStyle = `rgb(${rr}, ${gg}, ${bb})`;
      // Irregular polygon (6–8 sides) with jittered radii — reads as a worn cobble
      const sides = 6 + Math.floor(Math.random() * 3);
      const baseR = tile * 0.46 * (0.85 + Math.random() * 0.3);
      g.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 + Math.random() * 0.25;
        const rad = baseR * (0.85 + Math.random() * 0.25);
        const px = cx + Math.cos(a) * rad;
        const py = cy + Math.sin(a) * rad;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      // Top-rim highlight
      g.strokeStyle = `rgba(255, 210, 180, ${0.06 + Math.random() * 0.08})`;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, baseR * 0.85, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
      // Bottom-edge shadow
      g.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      g.beginPath();
      g.arc(cx, cy, baseR * 0.85, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
      // Occasional cobble crack
      if (Math.random() < 0.15) {
        g.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx - baseR * 0.4, cy + (Math.random() - 0.5) * baseR * 0.6);
        g.lineTo(cx + baseR * 0.4, cy + (Math.random() - 0.5) * baseR * 0.6);
        g.stroke();
      }
    }
  }

  // Theme sparkles in the grout (candle dust / damp shimmer)
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `${theme.floor.sparkleColor}${theme.floor.sparkleAlpha * Math.random()})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  // Grit
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.15})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Cross-vaulted ceiling: four rib arcs sweep from each corner to meet at a
 * central rosette boss. A radial lightening at the center suggests dome
 * curvature; grime density still respects `theme.ceiling.grimeAlpha`.
 *
 * Each ceiling cell renders its own copy of the texture (1:1 UV), so the
 * rosette appears once per cell — like a real cathedral's repeating vault bays.
 * Painted at 256² to match the approved preview density.
 */
function buildCeilingTexture(theme: FloorTheme): THREE.CanvasTexture {
  const W = 256;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  // Radial gradient — center slightly lighter than edges (dome curvature)
  const baseRgb = hexToRgb(theme.ceiling.base);
  const lighter = `rgb(${Math.min(255, baseRgb.r + 18)}, ${Math.min(255, baseRgb.g + 14)}, ${Math.min(255, baseRgb.b + 18)})`;
  const grad = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.7);
  grad.addColorStop(0, lighter);
  grad.addColorStop(1, theme.ceiling.base);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);

  // Four rib arcs from each corner — structural lines of a cross vault
  const ribs: Array<[number, number, number, number]> = [
    [0, 0, 0, Math.PI / 2],
    [W, 0, Math.PI / 2, Math.PI],
    [W, H, Math.PI, Math.PI * 1.5],
    [0, H, Math.PI * 1.5, Math.PI * 2],
  ];
  g.strokeStyle = 'rgba(0, 0, 0, 0.55)';
  g.lineWidth = 4;
  for (const [cx, cy, a0, a1] of ribs) {
    g.beginPath();
    g.arc(cx, cy, W * 0.52, a0, a1);
    g.stroke();
  }
  // Outer companion shadow — gives ribs three-dimensional thickness
  g.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  g.lineWidth = 1.5;
  for (const [cx, cy, a0, a1] of ribs) {
    g.beginPath();
    g.arc(cx, cy, W * 0.58, a0, a1);
    g.stroke();
  }

  // Central rosette boss
  const cx = W / 2;
  const cy = H / 2;
  const bossR = W * 0.07;
  // Darker accent (60% of base) — the keystone disc is recessed/shadowed
  g.fillStyle = `rgb(${Math.floor(baseRgb.r * 0.6)}, ${Math.floor(baseRgb.g * 0.6)}, ${Math.floor(baseRgb.b * 0.6)})`;
  g.beginPath();
  g.arc(cx, cy, bossR, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255, 200, 160, 0.18)';
  g.lineWidth = 1;
  g.beginPath();
  g.arc(cx, cy, bossR, 0, Math.PI * 2);
  g.stroke();
  // 8-petal motif inside the boss
  g.fillStyle = 'rgba(255, 200, 160, 0.1)';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(a) * bossR * 0.9, cy + Math.sin(a) * bossR * 0.9);
    g.lineTo(cx + Math.cos(a + 0.3) * bossR * 0.6, cy + Math.sin(a + 0.3) * bossR * 0.6);
    g.closePath();
    g.fill();
  }

  // Subtle transverse ribs along canvas edges — when two ceiling cells abut,
  // their edge ribs combine into a single thin dark joint, giving the vault
  // bays clear separation (like real cathedral transverse arches).
  g.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, W - 1, H - 1);

  // Grime — fixed count, alpha varies per theme
  for (let i = 0; i < 600; i++) {
    g.fillStyle = `rgba(0, 0, 0, ${Math.random() * theme.ceiling.grimeAlpha})`;
    g.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

// =============================================================================
// Main scene component
// =============================================================================

export function DungeonScene() {
  const map = useRunStore((s) => s.map);
  const theme = useMemo(() => (map ? getFloorTheme(map.floor) : getFloorTheme(1)), [map?.floor]);
  if (!map) return null;

  return (
    <Canvas
      camera={{ fov: 70, near: 0.05, far: 50, position: [0, EYE_HEIGHT, 0] }}
      gl={{ antialias: true }}
      style={{ position: 'absolute', inset: 0, background: theme.bg }}
    >
      <ThemeCtx.Provider value={theme}>
        <fog attach="fog" args={[theme.fog, theme.fogNear, theme.fogFar]} />
        <ambientLight
          intensity={theme.ambient.intensity * BRIGHTNESS_BOOST}
          color={theme.ambient.color}
        />
        <hemisphereLight
          args={[
            theme.hemisphere.sky,
            theme.hemisphere.ground,
            theme.hemisphere.intensity * BRIGHTNESS_BOOST,
          ]}
        />
        <TorchLight />
        <DynamicTorchLights fixtures={map.fixtures ?? []} />
        <CameraRig />
        <Walls cells={map.cells} width={map.width} height={map.height} />
        <Decorations cells={map.cells} width={map.width} height={map.height} />
        <Fixtures fixtures={map.fixtures ?? []} />
      </ThemeCtx.Provider>
    </Canvas>
  );
}
