import type { CSSProperties } from 'react';
import type { BlockOutcomeFace } from './types';
import { BLOCK_FACE_LABELS, BLOCK_FACE_GLYPHS } from './blockFacePresentation';
import './BlockDiceGraphic.css';

// Block dice don't carry a single target number the way a dodge or pick-up
// roll does (a block roll picks from up to 5 outcome faces, not a threshold),
// so while a block is still being decided (BlockOutcomePanel's dice-count
// display, before the player has picked which face(s) to accept) these icons
// are decorative — they show recognisable block-die iconography (skull for a
// "down" result, starburst "pow" for an impact result) rather than a literal
// rolled face, cycling so a 2- or 3-dice block reads as a genuine handful of
// block dice instead of identical repeated pips. Once a block has resolved,
// `BlockFaceGraphic` below shows the actual `resolvedFace` instead.
export type BlockDieSymbol = 'skull' | 'pow';

const FACE_PATTERN: Record<1 | 2 | 3, BlockDieSymbol[]> = {
  1: ['skull'],
  2: ['skull', 'pow'],
  3: ['skull', 'pow', 'skull'],
};

const PIP = 'rgba(255,150,150,0.95)';
const BG = 'rgba(60,8,8,0.85)';

function BlockDieIcon({ symbol, style }: { symbol: BlockDieSymbol; style?: CSSProperties }) {
  return (
    <svg className="block-die-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={style}>
      <rect x="1" y="1" width="18" height="18" rx="3" ry="3"
        fill={BG} stroke="rgba(255,90,90,0.95)" strokeWidth="1.5" />
      {symbol === 'skull' ? (
        <>
          <circle cx="10" cy="8" r="5" fill={PIP} />
          <circle cx="7.6" cy="8" r="1.3" fill={BG} />
          <circle cx="12.4" cy="8" r="1.3" fill={BG} />
          <rect x="7" y="12.3" width="6" height="2.6" rx="0.8" fill={PIP} />
          <line x1="9" y1="12.3" x2="9" y2="15" stroke={BG} strokeWidth="0.7" />
          <line x1="11" y1="12.3" x2="11" y2="15" stroke={BG} strokeWidth="0.7" />
        </>
      ) : (
        <polygon points="10,2 12,8 18,10 12,12 10,18 8,12 2,10 8,8" fill={PIP} />
      )}
    </svg>
  );
}

interface BlockDiceGraphicProps {
  count: 1 | 2 | 3;
  className?: string;
  /** Fixed pixel size, for contexts (like a modal) that aren't sized off a pitch square. */
  size?: number;
}

export function BlockDiceGraphic({ count, className, size }: BlockDiceGraphicProps) {
  const label = `Block: ${count} block ${count === 1 ? 'die' : 'dice'}`;
  const iconStyle = size ? { width: size, height: size } : undefined;
  return (
    <div
      className={className ? `block-dice-graphic ${className}` : 'block-dice-graphic'}
      data-count={count}
      title={label}
      aria-hidden="true"
    >
      {FACE_PATTERN[count].map((symbol, i) => (
        <BlockDieIcon key={i} symbol={symbol} style={iconStyle} />
      ))}
    </div>
  );
}

function BlockFaceIcon({ face, style }: { face: BlockOutcomeFace; style?: CSSProperties }) {
  return (
    <svg className="block-die-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={style}>
      <rect x="1" y="1" width="18" height="18" rx="3" ry="3"
        fill={BG} stroke="rgba(255,90,90,0.95)" strokeWidth="1.5" />
      <text x="10" y="14" textAnchor="middle" fontSize={face === 'both-down' ? 7 : 11} fill={PIP}>
        {BLOCK_FACE_GLYPHS[face]}
      </text>
    </svg>
  );
}

interface BlockFaceGraphicProps {
  face: BlockOutcomeFace;
  className?: string;
  /** Fixed pixel size, for contexts (like a modal) that aren't sized off a pitch square. */
  size?: number;
}

/** Marks a resolved block/blitz with the actual outcome it produced, e.g. "Push Back" or "Defender Down". */
export function BlockFaceGraphic({ face, className, size }: BlockFaceGraphicProps) {
  const iconStyle = size ? { width: size, height: size } : undefined;
  return (
    <div
      className={className ? `block-dice-graphic ${className}` : 'block-dice-graphic'}
      data-count={1}
      title={`Block: ${BLOCK_FACE_LABELS[face]}`}
      aria-hidden="true"
    >
      <BlockFaceIcon face={face} style={iconStyle} />
    </div>
  );
}
