import type { CSSProperties } from 'react';
import type { BlockOutcomeFace } from './types';
import { BLOCK_FACE_LABELS, BLOCK_FACE_GLYPHS } from './blockFacePresentation';
import './BlockDiceGraphic.css';

// Block dice don't carry a single target number the way a dodge or pick-up
// roll does (a block roll picks from up to 5 outcome faces, not a threshold),
// so while a block is still being decided (BlockDiceGraphic's dice-count
// display, before the player has rolled) these icons are decorative — they
// show recognisable block-die iconography (skull for a "down" result,
// starburst "pow" for an impact result) rather than a literal rolled face,
// cycling so a 2- or 3-dice block reads as a genuine handful of block dice
// instead of identical repeated pips. Once a block has resolved,
// `BlockFaceGraphic` below shows the actual `resolvedFace` instead.
export type BlockDieSymbol = 'skull' | 'pow';

/**
 * Which side of the block the dice favour, from the player's point of view.
 * The attacker in block terms is always the piece the player just declared a
 * block with, so 'attacker' always means "you pick" and 'defender' always
 * means "the opponent picks" — never the reverse. Coloured red when the
 * opponent is the one choosing which die counts, white/neutral when the
 * player is, so the declare-time dialog and the resolved pitch marker both
 * read the same risk at a glance without the player doing the ST-comparison
 * arithmetic themselves.
 */
export type BlockDiceFavor = 'attacker' | 'defender';

const FACE_PATTERN: Record<1 | 2 | 3, BlockDieSymbol[]> = {
  1: ['skull'],
  2: ['skull', 'pow'],
  3: ['skull', 'pow', 'skull'],
};

const FAVOR_COLORS: Record<BlockDiceFavor, { bg: string; stroke: string; pip: string }> = {
  defender: { bg: 'rgba(60,8,8,0.85)', stroke: 'rgba(255,90,90,0.95)', pip: 'rgba(255,150,150,0.95)' },
  attacker: { bg: 'rgba(22,22,26,0.85)', stroke: 'rgba(228,228,235,0.95)', pip: 'rgba(228,228,235,0.95)' },
};

function BlockDieIcon({ symbol, favor, style }: { symbol: BlockDieSymbol; favor: BlockDiceFavor; style?: CSSProperties }) {
  const { bg, stroke, pip } = FAVOR_COLORS[favor];
  return (
    <svg className="block-die-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={style}>
      <rect x="1" y="1" width="18" height="18" rx="3" ry="3" fill={bg} stroke={stroke} strokeWidth="1.5" />
      {symbol === 'skull' ? (
        <>
          <circle cx="10" cy="8" r="5" fill={pip} />
          <circle cx="7.6" cy="8" r="1.3" fill={bg} />
          <circle cx="12.4" cy="8" r="1.3" fill={bg} />
          <rect x="7" y="12.3" width="6" height="2.6" rx="0.8" fill={pip} />
          <line x1="9" y1="12.3" x2="9" y2="15" stroke={bg} strokeWidth="0.7" />
          <line x1="11" y1="12.3" x2="11" y2="15" stroke={bg} strokeWidth="0.7" />
        </>
      ) : (
        <polygon points="10,2 12,8 18,10 12,12 10,18 8,12 2,10 8,8" fill={pip} />
      )}
    </svg>
  );
}

interface BlockDiceGraphicProps {
  count: 1 | 2 | 3;
  favor: BlockDiceFavor;
  className?: string;
  /** Fixed pixel size, for contexts (like a modal) that aren't sized off a pitch square. */
  size?: number;
}

export function BlockDiceGraphic({ count, favor, className, size }: BlockDiceGraphicProps) {
  const label = `Block: ${count} block ${count === 1 ? 'die' : 'dice'} · ${favor === 'attacker' ? 'you pick' : 'defender picks'}`;
  const iconStyle = size ? { width: size, height: size } : undefined;
  return (
    <div
      className={className ? `block-dice-graphic ${className}` : 'block-dice-graphic'}
      data-count={count}
      data-favor={favor}
      title={label}
      aria-hidden="true"
    >
      {FACE_PATTERN[count].map((symbol, i) => (
        <BlockDieIcon key={i} symbol={symbol} favor={favor} style={iconStyle} />
      ))}
    </div>
  );
}

function BlockFaceIcon({ face, favor, style }: { face: BlockOutcomeFace; favor: BlockDiceFavor; style?: CSSProperties }) {
  const { bg, stroke, pip } = FAVOR_COLORS[favor];
  return (
    <svg className="block-die-icon" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" style={style}>
      <rect x="1" y="1" width="18" height="18" rx="3" ry="3" fill={bg} stroke={stroke} strokeWidth="1.5" />
      <text x="10" y="14" textAnchor="middle" fontSize={face === 'both-down' ? 7 : 11} fill={pip}>
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
  /**
   * How many dice this block actually rolled. Every icon shows the same
   * resolved face — the engine tracks which face collapsed into which board
   * state, not what each individual physical die showed, so there is nothing
   * truthful to draw on the dice that didn't get picked. Repeating the result
   * across `count` icons still tells the player something real: how big a
   * roll this was, and (via `favor`) who was holding the good end of it.
   */
  count?: 1 | 2 | 3;
  favor?: BlockDiceFavor;
}

/** Marks a resolved block/blitz with the actual outcome it produced, e.g. "Push Back" or "Defender Down". */
export function BlockFaceGraphic({ face, className, size, count = 1, favor = 'defender' }: BlockFaceGraphicProps) {
  const iconStyle = size ? { width: size, height: size } : undefined;
  return (
    <div
      className={className ? `block-dice-graphic ${className}` : 'block-dice-graphic'}
      data-count={count}
      data-favor={favor}
      title={`Block: ${BLOCK_FACE_LABELS[face]}`}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <BlockFaceIcon key={i} face={face} favor={favor} style={iconStyle} />
      ))}
    </div>
  );
}
