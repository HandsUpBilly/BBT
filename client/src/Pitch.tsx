import type { GameState, Team } from './types';
import { key, neighbours } from './bfs';
import type { ZoomBounds } from './bfs';
import './Pitch.css';

function BallIcon({ ghost, loose }: { ghost?: boolean; loose?: boolean }) {
  return (
    <svg
      className={loose ? 'ball-marker ball-marker--loose' : 'ball-marker'}
      style={{ opacity: ghost ? 0.5 : 1 }}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Ball body */}
      <ellipse cx="8" cy="8" rx="5.5" ry="3.5" fill="#c8732a" stroke="#7a3a0a" strokeWidth="0.8" transform="rotate(-30 8 8)" />
      {/* Laces */}
      <line x1="8" y1="5.5" x2="8" y2="10.5" stroke="white" strokeWidth="0.7" strokeLinecap="round" transform="rotate(-30 8 8)" />
      <line x1="6.5" y1="7"  x2="9.5" y2="7"  stroke="white" strokeWidth="0.5" strokeLinecap="round" transform="rotate(-30 8 8)" />
      <line x1="6.5" y1="8.5" x2="9.5" y2="8.5" stroke="white" strokeWidth="0.5" strokeLinecap="round" transform="rotate(-30 8 8)" />
    </svg>
  );
}

const PORTRAITS: Record<Team, Record<string, string>> = {
  human: {
    thrower: '/human-thrower-gritty.webp',
    catcher: '/human-catcher-gritty.webp',
    lineman:  '/human-lineman-gritty.webp',
    blocker:  '/human-blocker.png',
    guard:    '/human-guard.png',
    tackle:   '/human-tackle.png',
  },
  orc: {
    thrower:   '/orc-thrower.png',
    catcher:   '/orc-catcher.png',
    lineman:   '/orc-lineman-gritty.webp',
    'black-orc': '/orc-black-orc.png',
    blocker:   '/orc-blocker-gritty.webp',
    blitzer:   '/orc-blitzer-gritty.webp',
    'big-un':  '/orc-big-un.png',
  },
};

const DEFAULT_ROLE: Record<Team, string> = {
  human: 'lineman',
  orc:   'blocker',
};

function PieceIcon({ team, role }: { team: Team; role?: string }) {
  const map = PORTRAITS[team];
  const src = map[role ?? DEFAULT_ROLE[team]] ?? map[DEFAULT_ROLE[team]];
  const portraitClass = src.includes('-gritty.')
    ? 'piece__portrait'
    : 'piece__portrait piece__portrait--legacy';
  return <img className={portraitClass} src={src} alt={role ?? team} draggable={false} />;
}

// Dot positions for each face of a d6 (cx, cy as % of viewBox 0 0 20 20)
const DOT_POSITIONS: Record<number, [number, number][]> = {
  1: [[10, 10]],
  2: [[5, 5], [15, 15]],
  3: [[5, 5], [10, 10], [15, 15]],
  4: [[5, 5], [15, 5], [5, 15], [15, 15]],
  5: [[5, 5], [15, 5], [10, 10], [5, 15], [15, 15]],
  6: [[5, 4], [15, 4], [5, 10], [15, 10], [5, 16], [15, 16]],
};

function DiceFace({ target }: { target: number }) {
  const dots = DOT_POSITIONS[target] ?? DOT_POSITIONS[6];
  return (
    <svg
      className="dodge-die"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="18" height="18" rx="3" ry="3"
        fill="rgba(30,20,10,0.75)" stroke="rgba(255,160,0,0.9)" strokeWidth="1.5" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2" fill="rgba(255,200,80,0.95)" />
      ))}
    </svg>
  );
}

function GfiFace() {
  // Die showing face 2 — blue tint to distinguish from dodge dice
  return (
    <svg
      className="gfi-die"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="18" height="18" rx="3" ry="3"
        fill="rgba(10,20,40,0.80)" stroke="rgba(80,160,255,0.95)" strokeWidth="1.5" />
      <circle cx="5" cy="5" r="2" fill="rgba(140,210,255,0.95)" />
      <circle cx="15" cy="15" r="2" fill="rgba(140,210,255,0.95)" />
    </svg>
  );
}

function PickupFace({ target }: { target: number }) {
  // Same shape as DiceFace but ball-amber tinted, to distinguish a pickup
  // Agility test from a dodge Agility test when both dice are shown.
  const dots = DOT_POSITIONS[target] ?? DOT_POSITIONS[6];
  return (
    <svg
      className="pickup-die"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1" y="1" width="18" height="18" rx="3" ry="3"
        fill="rgba(50,30,0,0.80)" stroke="rgba(255,210,74,0.95)" strokeWidth="1.5" />
      {dots.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="2" fill="rgba(255,224,140,0.95)" />
      ))}
    </svg>
  );
}

// Landscape layout: 26 cols (left→right) × 15 rows (top→bottom)
// Col 0 = left end zone (human), col 25 = right end zone (orc)
// Scrimmage between col 12 and col 13
const COLS = 26;
const ROWS = 15;

interface Props {
  state: GameState;
  onSquareClick: (col: number, row: number) => void;
  onPieceClick: (col: number, row: number, x: number, y: number) => void;
  onSquareHover: (col: number, row: number) => void;
  onSquareLeave: () => void;
  /** When set, only this landscape-coordinate sub-region of the pitch is rendered. */
  zoomBounds?: ZoomBounds | null;
}

export function Pitch({ state, onSquareClick, onPieceClick, onSquareHover, onSquareLeave, zoomBounds }: Props) {
  const pieceMap = new Map(state.pieces.map(p => [key(p.position), p]));

  // Preview path: map from key -> step info
  const previewStepMap = new Map<string, { stepNum: number; requiresDodge: boolean; dodgeTarget: number | null; isGfi: boolean; pickupTarget: number | null }>();
  state.pathPreview.forEach((s, i) => {
    previewStepMap.set(key(s.pos), { stepNum: i + 1, requiresDodge: s.requiresDodge, dodgeTarget: s.dodgeTarget, isGfi: s.isGfi, pickupTarget: s.pickupTarget });
  });

  // Ghost = last square in preview path
  const ghostKey = state.pathPreview.length > 0
    ? key(state.pathPreview[state.pathPreview.length - 1].pos)
    : null;

  // Walked squares: every individual square stepped through, in order.
  // Map key -> 1-based step number for rendering.
  const walkedMap = new Map<string, number>();
  state.walkedSquares.forEach((pos, i) => walkedMap.set(key(pos), i + 1));

  // Committed dice: map from destination key -> dice info from actionLog.
  // Persists after a waypoint is set so dice remain visible on committed squares.
  const committedDiceMap = new Map<string, { isGfi: boolean; dodgeTarget: number | null; pickupTarget: number | null }>();
  for (const entry of state.actionLog) {
    if (entry.kind === 'move' && (entry.isGfi || entry.dodgeTarget !== null || entry.pickupTarget)) {
      committedDiceMap.set(key(entry.to), { isGfi: entry.isGfi, dodgeTarget: entry.dodgeTarget, pickupTarget: entry.pickupTarget ?? null });
    }
  }

  const selectedPiece = state.selectedPieceId
    ? state.pieces.find(p => p.id === state.selectedPieceId)
    : null;
  const ghostHasBall = selectedPiece?.hasBall ?? false;

  const looseBallKey = state.ballPosition ? key(state.ballPosition) : null;

  // Current action label for the selected piece — shown at the bottom-right
  // of its icon so it's clear which mode (Move / Pass / Hand Off) is active.
  // A pass/handoff is only "declared" once the carrier has finished moving
  // and receiver targeting opens (isPassTargeting/isHandoffTargeting) — up
  // until then the piece is still just being moved, so the label reads
  // "Move" even if Pass or Hand Off was chosen from the piece menu.
  const actionLabel = !selectedPiece
    ? null
    : state.isPassTargeting
      ? 'Pass'
      : state.isHandoffTargeting
        ? 'Hand Off'
        : state.pendingBlockIsBlitz
          ? 'Blitz'
        : 'Move';

  const isSelecting = !!state.selectedPieceId;
  const opponents = state.pieces
    .filter(p => p.team !== state.activeTeam && !p.down)
    .map(p => p.position);
  const tzCounts = new Map<string, number>();
  if (isSelecting) {
    for (const opponent of opponents) {
      for (const pos of neighbours(opponent)) {
        const zoneKey = key(pos);
        tzCounts.set(zoneKey, (tzCounts.get(zoneKey) ?? 0) + 1);
      }
    }
  }

  // Landscape grid: COLS=26 (left→right = portrait rows 0→25),
  //                 ROWS=15  (top→bottom  = portrait cols 0→14)
  // Portrait game state uses { col: 0-14, row: 0-25 }
  // Mapping: landscape col = portrait row, landscape row = portrait col
  const colStart = zoomBounds ? zoomBounds.minCol : 0;
  const colEnd   = zoomBounds ? zoomBounds.maxCol : COLS - 1;
  const rowStart = zoomBounds ? zoomBounds.minRow : 0;
  const rowEnd   = zoomBounds ? zoomBounds.maxRow : ROWS - 1;
  const visibleCols = colEnd - colStart + 1;
  const visibleRows = rowEnd - rowStart + 1;

  const squares = [];
  for (let lRow = rowStart; lRow <= rowEnd; lRow++) {
    for (let lCol = colStart; lCol <= colEnd; lCol++) {
      // Translate to portrait coordinates used by game state
      const pCol = lRow;       // portrait col = landscape row
      const pRow = lCol;       // portrait row = landscape col
      const k = `${pCol},${pRow}`;

      const piece      = pieceMap.get(k);
      const isSelected = piece?.id === state.selectedPieceId;

      // End zones: 1 col each side
      const isLeftEndZone  = lCol === 0;
      const isRightEndZone = lCol === COLS - 1;

      // Wide zone lines: horizontal, 4 rows from each edge → top border of rows 4 and 11
      const isWideZone  = lRow === 4 || lRow === 11;
      // Scrimmage: centre of 26-col field → left border of col 13
      const isScrimmage = lCol === 13;

      const previewStep       = previewStepMap.get(k);
      const isGhost           = ghostKey === k && !piece;
      const isPreviewGfi      = !!previewStep?.isGfi && !isGhost;
      const isPreviewDodge    = !!previewStep?.requiresDodge && !isGhost;
      const isPreviewFree     = !!previewStep && !previewStep.requiresDodge && !previewStep.isGfi && !isGhost;
      const isReachable       = state.reachableKeys.has(k) && !previewStep && k !== ghostKey;
      const tzCount           = tzCounts.get(k) ?? 0;
      const isInTZ            = tzCount > 0;
      const walkedStep        = walkedMap.get(k);
      const isCommitted       = walkedStep !== undefined && !piece && !isGhost;
      const isHandoffTarget   = state.handoffTargets.has(k);
      const passRangeBand     = state.passRangeKeys.get(k);
      const isPassReceiver    = state.passReceiverKeys.has(k);
      const isBlockTarget     = state.blockTargets.has(k);
      const isBlitzTarget     = piece?.id === state.blitzTargetId;
      const isPushTarget      = state.pushTargetKeys.has(k);

      const classes = [
        'square',
        (lCol + lRow) % 2 === 0 ? 'square--light' : 'square--dark',
        isLeftEndZone  ? 'square--endzone-left'  : '',
        isRightEndZone ? 'square--endzone-right' : '',
        isWideZone     ? 'square--wide-zone'     : '',
        isScrimmage    ? 'square--scrimmage'     : '',
        isReachable    ? 'square--reachable'     : '',
        isPreviewFree                       ? 'square--preview-free'      : '',
        isPreviewGfi  && !isPreviewDodge    ? 'square--preview-gfi'       : '',
        isPreviewDodge && !isPreviewGfi     ? 'square--preview-dodge'     : '',
        isPreviewGfi  && isPreviewDodge     ? 'square--preview-gfi-dodge' : '',
        isInTZ         ? 'square--tz'            : '',
        tzCount > 1    ? `square--tz-${Math.min(tzCount, 4)}` : '',
        isCommitted    ? 'square--path'          : '',
        isHandoffTarget ? 'square--handoff-target' : '',
        passRangeBand  ? `square--range-${passRangeBand}` : '',
        isPassReceiver ? 'square--pass-receiver' : '',
        isBlockTarget  ? 'square--block-target'  : '',
        isBlitzTarget  ? 'square--blitz-target'  : '',
        isPushTarget   ? 'square--push-target'   : '',
      ].filter(Boolean).join(' ');

      const squaresWalked = selectedPiece ? selectedPiece.ma - state.remainingMa : 0;
      const displayStep = isGhost
        ? null
        : previewStep
          ? squaresWalked + previewStep.stepNum
          : (isCommitted ? walkedStep! : null);

      squares.push(
        <div
          key={k}
          className={classes}
          onClick={(e) => {
            if (piece) {
              onPieceClick(pCol, pRow, e.clientX, e.clientY);
            } else {
              onSquareClick(pCol, pRow);
            }
          }}
          onMouseEnter={() => onSquareHover(pCol, pRow)}
          onMouseLeave={onSquareLeave}
        >
          <div className="square__overlay" />
          {!piece && looseBallKey === k && <BallIcon loose />}
          {isInTZ && <div className="square__tz-overlay" />}
          {piece && (
            <div className={[
              'piece',
              `piece--${piece.team}`,
              isSelected      ? 'piece--selected'  : '',
              piece.activated ? 'piece--activated' : '',
              piece.hasBall   ? 'piece--carrier'   : '',
              piece.down      ? 'piece--down'      : '',
            ].filter(Boolean).join(' ')}>
              <PieceIcon team={piece.team} role={piece.role} />
              {piece.hasBall && <BallIcon />}
            </div>
          )}
          {isSelected && actionLabel && (
            <span className="piece__action-label">{actionLabel}</span>
          )}

          {displayStep !== null && (
            <span className={`step-num ${previewStep ? 'step-num--preview' : 'step-num--committed'}`}>
              {displayStep}
            </span>
          )}

          {/* Dice indicators — preview path (including ghost destination) */}
          {previewStep && (previewStep.isGfi || previewStep.requiresDodge || previewStep.pickupTarget !== null) && (
            <div className="square__dice">
              {previewStep.isGfi && <GfiFace />}
              {previewStep.requiresDodge && previewStep.dodgeTarget !== null && (
                <DiceFace target={previewStep.dodgeTarget} />
              )}
              {previewStep.pickupTarget !== null && <PickupFace target={previewStep.pickupTarget} />}
            </div>
          )}

          {/* Dice indicators — committed waypoint squares (persist after click) */}
          {!previewStep && !piece && (() => {
            const cd = committedDiceMap.get(k);
            return cd ? (
              <div className="square__dice">
                {cd.isGfi && <GfiFace />}
                {cd.dodgeTarget !== null && <DiceFace target={cd.dodgeTarget} />}
                {cd.pickupTarget !== null && <PickupFace target={cd.pickupTarget} />}
              </div>
            ) : null;
          })()}

          {/* Ghost piece — suppress when the destination square has rolls (dice take priority) */}
          {isGhost && selectedPiece && !previewStep?.isGfi && !previewStep?.requiresDodge && (
            <div className={`piece piece--${state.activeTeam} piece--ghost`}>
              <PieceIcon team={state.activeTeam} role={selectedPiece.role} />
              {ghostHasBall && <BallIcon ghost />}
            </div>
          )}
        </div>
      );
    }
  }

  const colLabels = Array.from({ length: visibleCols }, (_, i) => (
    <div key={colStart + i} className="pitch__col-label">{colStart + i}</div>
  ));

  const rowLabels = Array.from({ length: visibleRows }, (_, i) => (
    <div key={rowStart + i} className="pitch__row-label">{String.fromCharCode(65 + rowStart + i)}</div>
  ));

  const gridStyle = zoomBounds
    ? {
        aspectRatio: `${visibleCols} / ${visibleRows}`,
        gridTemplateColumns: `repeat(${visibleCols}, 1fr)`,
        gridTemplateRows: `repeat(${visibleRows}, 1fr)`,
      }
    : undefined;

  const colLabelsStyle = zoomBounds
    ? { gridTemplateColumns: `1.4em repeat(${visibleCols}, 1fr) 1.4em` }
    : undefined;

  return (
    <div className={`pitch${zoomBounds ? ' pitch--zoomed' : ''}`}>
      {/* Column labels — top */}
      <div className="pitch__col-labels pitch__col-labels--top" style={colLabelsStyle}>
        <div className="pitch__corner" />
        {colLabels}
        <div className="pitch__corner" />
      </div>

      <div className="pitch__middle">
        {/* Row labels — left */}
        <div className="pitch__row-labels">{rowLabels}</div>

        {/* The field */}
        <div className="pitch__grid" style={gridStyle}>{squares}</div>

        {/* Row labels — right */}
        <div className="pitch__row-labels">{rowLabels}</div>
      </div>

      {/* Column labels — bottom */}
      <div className="pitch__col-labels pitch__col-labels--bottom" style={colLabelsStyle}>
        <div className="pitch__corner" />
        {colLabels}
        <div className="pitch__corner" />
      </div>
    </div>
  );
}
