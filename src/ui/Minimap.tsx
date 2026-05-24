import { useEffect, useRef, useState } from 'react';
import type { DungeonMap, Facing } from '@/types';

interface Props {
  map: DungeonMap;
  px: number;
  py: number;
  facing: Facing;
}

const FACING_ARROW: Record<Facing, string> = {
  0: '▲',
  1: '▶',
  2: '▼',
  3: '◀',
};

const TILE_SMALL = 8;
const TILE_LARGE = 24;

function paintMap(
  canvas: HTMLCanvasElement,
  map: DungeonMap,
  px: number,
  py: number,
  facing: Facing,
  tile: number,
) {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const cell = map.cells[y][x];
      if (!cell.seen) continue;
      let color = '#3a2840';
      switch (cell.kind) {
        case 'floor': color = '#4a3550'; break;
        case 'wall': color = '#22141c'; break;
        case 'spawn': color = '#5db3ff'; break;
        case 'encounter':
          color = cell.cleared
            ? '#3a2c34'
            : cell.isElite
            ? '#f0c14a'
            : '#c63b3b';
          break;
        case 'boss': color = cell.cleared ? '#3a2c34' : '#e8a23f'; break;
        case 'chest': color = cell.cleared ? '#3a2c34' : '#e8c46c'; break;
        case 'shovel': color = '#b070ff'; break;
        case 'hazard': color = cell.cleared ? '#3a2c2c' : '#a23a2a'; break;
        case 'shrine':
          color = cell.cleared
            ? '#2a2a30'
            : cell.shrineKind === 'altar'
            ? '#a070ff'
            : '#6ee0a0';
          break;
      }
      ctx.fillStyle = color;
      ctx.fillRect(x * tile, y * tile, tile - 1, tile - 1);
    }
  }

  // Player marker — scale to tile size
  ctx.fillStyle = '#f3e9d2';
  ctx.font = `${Math.max(8, tile)}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(FACING_ARROW[facing], px * tile + tile / 2, py * tile + tile / 2);
}

export function Minimap({ map, px, py, facing }: Props) {
  const smallRef = useRef<HTMLCanvasElement>(null);
  const largeRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (smallRef.current) paintMap(smallRef.current, map, px, py, facing, TILE_SMALL);
  }, [map, px, py, facing]);

  useEffect(() => {
    if (expanded && largeRef.current) {
      paintMap(largeRef.current, map, px, py, facing, TILE_LARGE);
    }
  }, [expanded, map, px, py, facing]);

  // Close on Escape while expanded
  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key.toLowerCase() === 'm') {
        e.stopPropagation();
        setExpanded(false);
      }
    }
    // Capture phase to beat the DungeonHud's Escape -> toMenu handler
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [expanded]);

  return (
    <>
      <button
        type="button"
        className="minimap"
        onClick={() => setExpanded(true)}
        title="Click to expand map"
      >
        <canvas ref={smallRef} width={map.width * TILE_SMALL} height={map.height * TILE_SMALL} />
        <div className="minimap-hint">Click to expand</div>
      </button>

      {expanded && (
        <div
          className="minimap-modal"
          onClick={() => setExpanded(false)}
          role="presentation"
        >
          <div
            className="minimap-modal-inner"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="minimap-modal-header">
              <span>Floor {map.floor}</span>
              <button onClick={() => setExpanded(false)}>Close (Esc)</button>
            </div>
            <canvas
              ref={largeRef}
              width={map.width * TILE_LARGE}
              height={map.height * TILE_LARGE}
            />
            <div className="minimap-modal-legend">
              <span><i style={{ background: '#5db3ff' }} />Spawn</span>
              <span><i style={{ background: '#c63b3b' }} />Encounter</span>
              <span><i style={{ background: '#f0c14a' }} />Elite</span>
              <span><i style={{ background: '#e8a23f' }} />Boss</span>
              <span><i style={{ background: '#e8c46c' }} />Chest</span>
              <span><i style={{ background: '#a23a2a' }} />Trap</span>
              <span><i style={{ background: '#6ee0a0' }} />Shrine</span>
              <span><i style={{ background: '#b070ff' }} />Portal</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
