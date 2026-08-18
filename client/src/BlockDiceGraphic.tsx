import type { CSSProperties } from 'react';
import type { BlockOutcomeFace } from './types';
import { BLOCK_FACE_LABELS } from './blockFacePresentation';
import { BLOCK_OUTCOME_FACES } from './bfs';
import attackerDownDie from './assets/block-dice/attacker-down.webp';
import bothDownDie from './assets/block-dice/both-down.webp';
import pushDie from './assets/block-dice/push.webp';
import defenderStumblesDie from './assets/block-dice/defender-stumbles.webp';
import defenderDownDie from './assets/block-dice/defender-down.webp';
import './BlockDiceGraphic.css';

// Block dice don't carry a single target number the way a dodge or pick-up
// roll does (a block has five possible face types, not a threshold), so while
// a block is still being decided these icons cycle through every possible
// face. They remain a preview rather than a literal rolled result. Once a
// block has resolved,
// `BlockFaceGraphic` below shows the actual `resolvedFace` instead.

/**
 * Which side of the block the dice favour, from the player's point of view.
 * The attacker in block terms is always the piece the player just declared a
 * block with, so 'attacker' always means "you pick" and 'defender' always
 * means "the opponent picks" — never the reverse. Outlined red when the
 * opponent is the one choosing which die counts, white/neutral when the
 * player is, so the declare-time dialog and the resolved pitch marker both
 * read the same risk at a glance without the player doing the ST-comparison
 * arithmetic themselves.
 */
export type BlockDiceFavor = 'attacker' | 'defender';

const BLOCK_FACE_IMAGES: Record<BlockOutcomeFace, string> = {
  'attacker-down': attackerDownDie,
  'both-down': bothDownDie,
  push: pushDie,
  'defender-stumbles': defenderStumblesDie,
  'defender-down': defenderDownDie,
};

function BlockDieIcon({ favor, style, dieIndex }: {
  favor: BlockDiceFavor;
  style?: CSSProperties;
  dieIndex: number;
}) {
  return (
    <span
      className="block-die-icon block-die-icon--animated"
      style={{ ...style, animationDelay: `-${dieIndex * 0.17}s` }}
      data-favor={favor}
    >
      {BLOCK_OUTCOME_FACES.map((face, faceIndex) => (
        <img
          key={face}
          className="block-die-icon__face"
          data-face={face}
          src={BLOCK_FACE_IMAGES[face]}
          alt=""
          draggable={false}
          style={{ animationDelay: `-${faceIndex * 0.6 + dieIndex * 0.17}s` }}
        />
      ))}
    </span>
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
  const label = `Block: ${count} block ${count === 1 ? 'die' : 'dice'}, possible outcomes`;
  const iconStyle = size ? { width: size, height: size } : undefined;
  return (
    <div
      className={className ? `block-dice-graphic ${className}` : 'block-dice-graphic'}
      data-count={count}
      data-favor={favor}
      title={label}
      aria-hidden="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <BlockDieIcon key={i} favor={favor} style={iconStyle} dieIndex={i} />
      ))}
    </div>
  );
}

function BlockFaceIcon({ face, favor, style }: { face: BlockOutcomeFace; favor: BlockDiceFavor; style?: CSSProperties }) {
  return (
    <span className="block-die-icon" style={style} data-favor={favor}>
      <img className="block-die-icon__art" src={BLOCK_FACE_IMAGES[face]} alt="" draggable={false} />
    </span>
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
