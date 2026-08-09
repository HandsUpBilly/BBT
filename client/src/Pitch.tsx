import { memo, useCallback, useMemo } from 'react';
import type { GameState, Team } from './types';
import { key, neighbours } from './bfs';
import type { ZoomBounds } from './bfs';
import { buildMovementTrailMap } from './movementTrail';
import type { PathTrail } from './movementTrail';
import { skillGroupsFor, skillMarkersFor } from './skillPresentation';
import './Pitch.css';

function BallIcon({ ghost, loose }: { ghost?: boolean; loose?: boolean }) {
  return (
    <svg
      className={loose ? 'ball-marker ball-marker--loose' : 'ball-marker'}
      style={{ opacity: ghost ? 0.5 : 1 }}
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
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

// Keep in sync with the same map in PlayerPanel.tsx.
// `halfling`, `ogre`, `goblin`, and `troll` have no art yet and fall through to
// the team default below.
const PORTRAITS: Record<Team, Record<string, string>> = {
  human: {
    thrower: '/human-thrower-gritty.webp',
    catcher: '/human-catcher-gritty.webp',
    lineman:  '/human-lineman-gritty.webp',
    blitzer:  '/human-tackle.png',
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

const EMPTY_SKILLS: readonly string[] = [];

function PieceIcon({ team, role, skills }: { team: Team; role?: string; skills: readonly string[] }) {
  const map = PORTRAITS[team];
  const src = map[role ?? DEFAULT_ROLE[team]] ?? map[DEFAULT_ROLE[team]];
  const portraitClass = src.includes('-gritty.')
    ? 'piece__portrait'
    : 'piece__portrait piece__portrait--legacy';
  const groups = skillGroupsFor(skills);
  const markers = skillMarkersFor(skills);

  let portrait = (
    <div className="piece__portrait-frame">
      <img className={portraitClass} src={src} alt="" draggable={false} />
      <span className="piece__team-tint" />
      <span className="piece__state-overlay" />
    </div>
  );

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    portrait = (
      <div className={`piece__skill-ring piece__skill-ring--${group.id}`}>
        {portrait}
      </div>
    );
  }

  // Decorative: the square's aria-label names the player, groups, and markers.
  return (
    <div className="piece__visual" aria-hidden="true">
      {portrait}
      {markers.length > 0 && (
        <span className="piece__skill-markers">
          {markers.map(marker => (
            <span
              key={marker.skill}
              className={`piece__skill-marker piece__skill-marker--${marker.className}`}
            >
              {marker.letter}
            </span>
          ))}
        </span>
      )}
    </div>
  );
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
    <svg className="dodge-die" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
    <svg className="gfi-die" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
    <svg className="pickup-die" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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

function colLabel(landscapeCol: number) { return String(landscapeCol); }
function rowLabel(landscapeRow: number) { return String.fromCharCode(65 + landscapeRow); }

interface DiceInfo {
  isGfi: boolean;
  dodgeTarget: number | null;
  pickupTarget: number | null;
}

interface SquareProps {
  pCol: number;
  pRow: number;
  lCol: number;
  lRow: number;
  classes: string;
  label: string;
  pieceTeam: Team | null;
  pieceRole: string | undefined;
  pieceSkills: readonly string[];
  pieceClasses: string;
  pieceHasBall: boolean;
  looseBall: boolean;
  inTackleZone: boolean;
  actionLabel: string | null;
  displayStep: number | null;
  stepIsPreview: boolean;
  pathTrails: PathTrail[];
  dice: DiceInfo | null;
  ghost: { team: Team; role?: string; skills: readonly string[]; hasBall: boolean } | null;
  focusable: boolean;
  onSquareClick: (col: number, row: number) => void;
  onPieceClick: (col: number, row: number, x: number, y: number) => void;
  onSquareHover: (col: number, row: number) => void;
  onSquareLeave: () => void;
}

/**
 * One pitch square.
 *
 * Memoized because hovering re-renders <Pitch> on every mouse-move, and only a
 * handful of the 390 squares actually change between frames. All props are
 * primitives or stable callbacks so the shallow comparison is meaningful.
 */
const Square = memo(function Square({
  pCol, pRow, lCol, lRow, classes, label, pieceTeam, pieceRole, pieceSkills, pieceClasses, pieceHasBall,
  looseBall, inTackleZone, actionLabel, displayStep, stepIsPreview, pathTrails, dice, ghost, focusable,
  onSquareClick, onPieceClick, onSquareHover, onSquareLeave,
}: SquareProps) {
  const activate = useCallback((clientX: number, clientY: number) => {
    if (pieceTeam) onPieceClick(pCol, pRow, clientX, clientY);
    else onSquareClick(pCol, pRow);
  }, [pieceTeam, pCol, pRow, onPieceClick, onSquareClick]);

  return (
    <div
      className={classes}
      // role="button" rather than "gridcell": the CSS lays all 390 squares out
      // as one flat grid with no row elements, and a grid without rows is
      // invalid ARIA. A labelled button per square is honest and works.
      role="button"
      aria-label={label}
      // Roving focus: only squares that can be acted on enter the tab order, so
      // keyboard users aren't forced through 390 inert cells to reach the HUD.
      tabIndex={focusable ? 0 : -1}
      onClick={e => activate(e.clientX, e.clientY)}
      onKeyDown={e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        // Position the context menu over the square itself, since there is no
        // pointer position to anchor to.
        const rect = e.currentTarget.getBoundingClientRect();
        activate(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }}
      onFocus={() => onSquareHover(pCol, pRow)}
      onBlur={onSquareLeave}
      onMouseEnter={() => onSquareHover(pCol, pRow)}
      onMouseLeave={onSquareLeave}
      data-col={lCol}
      data-row={lRow}
    >
      <div className="square__overlay" />
      {pathTrails.map((pathTrail, index) => {
        // Portrait rows run horizontally on the rendered pitch, while portrait
        // columns run vertically. The polyline enters from the previous square,
        // turns at this square's centre, then exits toward the next square.
        const enterX = 50 - (pRow - pathTrail.from.row) * 50;
        const enterY = 50 - (pCol - pathTrail.from.col) * 50;
        const exitX = pathTrail.to ? 50 + (pathTrail.to.row - pRow) * 50 : 50;
        const exitY = pathTrail.to ? 50 + (pathTrail.to.col - pCol) * 50 : 50;
        return (
          <svg key={index} className="square__path-trail" viewBox="0 0 100 100" aria-hidden="true">
            <polyline points={`${enterX},${enterY} 50,50 ${exitX},${exitY}`} />
          </svg>
        );
      })}
      {!pieceTeam && looseBall && <BallIcon loose />}
      {inTackleZone && <div className="square__tz-overlay" />}
      {pieceTeam && (
        <div className={pieceClasses}>
          <PieceIcon team={pieceTeam} role={pieceRole} skills={pieceSkills} />
          {pieceHasBall && <BallIcon />}
        </div>
      )}
      {actionLabel && <span className="piece__action-label">{actionLabel}</span>}

      {displayStep !== null && (
        <span className={`step-num ${stepIsPreview ? 'step-num--preview' : 'step-num--committed'}`}>
          {displayStep}
        </span>
      )}

      {dice && (
        <div className="square__dice">
          {dice.isGfi && <GfiFace />}
          {dice.dodgeTarget !== null && <DiceFace target={dice.dodgeTarget} />}
          {dice.pickupTarget !== null && <PickupFace target={dice.pickupTarget} />}
        </div>
      )}

      {ghost && (
        <div className={`piece piece--${ghost.team} piece--ghost`}>
          <PieceIcon team={ghost.team} role={ghost.role} skills={ghost.skills} />
          {ghost.hasBall && <BallIcon ghost />}
        </div>
      )}
    </div>
  );
});

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
  const pieceMap = useMemo(
    () => new Map(state.pieces.map(p => [key(p.position), p])),
    [state.pieces],
  );

  // Preview path: map from key -> step info
  const previewStepMap = useMemo(() => {
    const map = new Map<string, { stepNum: number; requiresDodge: boolean; dodgeTarget: number | null; isGfi: boolean; pickupTarget: number | null }>();
    state.pathPreview.forEach((s, i) => {
      map.set(key(s.pos), { stepNum: i + 1, requiresDodge: s.requiresDodge, dodgeTarget: s.dodgeTarget, isGfi: s.isGfi, pickupTarget: s.pickupTarget });
    });
    return map;
  }, [state.pathPreview]);

  // Ghost = last square in preview path
  const ghostKey = state.pathPreview.length > 0
    ? key(state.pathPreview[state.pathPreview.length - 1].pos)
    : null;

  // Walked squares: every individual square stepped through, in order.
  const walkedMap = useMemo(() => {
    const map = new Map<string, number>();
    state.walkedSquares.forEach((pos, i) => map.set(key(pos), i + 1));
    return map;
  }, [state.walkedSquares]);

  const movementTrailMap = useMemo(
    () => buildMovementTrailMap(state.actionLog),
    [state.actionLog],
  );

  // Committed dice: map from destination key -> dice info from actionLog.
  // Persists after a waypoint is set so dice remain visible on committed squares.
  const committedDiceMap = useMemo(() => {
    const map = new Map<string, DiceInfo>();
    for (const entry of state.actionLog) {
      if (entry.kind === 'move' && (entry.isGfi || entry.dodgeTarget !== null || entry.pickupTarget)) {
        map.set(key(entry.to), { isGfi: entry.isGfi, dodgeTarget: entry.dodgeTarget, pickupTarget: entry.pickupTarget ?? null });
      }
    }
    return map;
  }, [state.actionLog]);

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
  const tzCounts = useMemo(() => {
    const counts = new Map<string, number>();
    if (!isSelecting) return counts;
    const opponents = state.pieces
      .filter(p => p.team !== state.activeTeam && !p.down)
      .map(p => p.position);
    for (const opponent of opponents) {
      for (const pos of neighbours(opponent)) {
        const zoneKey = key(pos);
        counts.set(zoneKey, (counts.get(zoneKey) ?? 0) + 1);
      }
    }
    return counts;
  }, [isSelecting, state.pieces, state.activeTeam]);

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

  /** Screen-reader description of a square: position, occupant, and what it offers. */
  function describeSquare(
    lCol: number, lRow: number,
    pieceName: string | null, pieceTeam: Team | null, pieceRole: string | undefined,
    pieceSkills: readonly string[], pieceIsPreview: boolean,
    pieceDown: boolean, pieceHasBall: boolean, pieceActivated: boolean,
    reachable: boolean, dodge: number | null, gfi: boolean, pickup: number | null,
    looseBall: boolean, isTarget: string | null,
  ): string {
    const parts = [`${colLabel(lCol)}${rowLabel(lRow)}`];
    if (pieceName) {
      parts.push(`${pieceIsPreview ? 'movement preview for ' : ''}${pieceName}, ${pieceTeam} ${pieceRole ?? ''}`.trim());
      const groups = skillGroupsFor(pieceSkills);
      const markers = skillMarkersFor(pieceSkills);
      if (groups.length > 0) parts.push(`skill groups ${groups.map(group => group.label).join(', ')}`);
      if (markers.length > 0) parts.push(`marked skills ${markers.map(marker => marker.skill).join(', ')}`);
      if (pieceHasBall) parts.push('carrying the ball');
      if (pieceDown) parts.push('knocked down');
      else if (pieceActivated) parts.push('already acted');
    } else if (looseBall) {
      parts.push('loose ball');
    } else {
      parts.push('empty');
    }
    if (isTarget) parts.push(isTarget);
    else if (reachable) parts.push('reachable');
    if (gfi) parts.push('Go For It 2 plus');
    if (dodge !== null) parts.push(`dodge ${dodge} plus`);
    if (pickup !== null) parts.push(`pickup ${pickup} plus`);
    return parts.join(', ');
  }

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
      // Reachable squares beyond the player's remaining MA require one of the
      // two Go For It rolls. Mark the outer rings immediately, rather than
      // only revealing that cost after the player hovers a destination.
      const isGfiRange = isReachable && selectedPiece != null
        && Math.max(
          Math.abs(pCol - selectedPiece.position.col),
          Math.abs(pRow - selectedPiece.position.row),
        ) > state.remainingMa;
      const tzCount           = tzCounts.get(k) ?? 0;
      const isInTZ            = tzCount > 0;
      const walkedStep        = walkedMap.get(k);
      const pathTrails        = movementTrailMap.get(k) ?? [];
      const isCommitted       = walkedStep !== undefined && !piece && !isGhost;
      const isHandoffTarget   = state.handoffTargets.has(k);
      const passRangeBand     = state.passRangeKeys.get(k);
      const isPassReceiver    = state.passReceiverKeys.has(k);
      const isBlockTarget     = state.blockTargets.has(k);
      const isBlitzTarget     = piece?.id === state.blitzTargetId;
      const isPushTarget      = state.pushTargetKeys.has(k);
      const isLooseBall       = looseBallKey === k;

      const classes = [
        'square',
        (lCol + lRow) % 2 === 0 ? 'square--light' : 'square--dark',
        isLeftEndZone  ? 'square--endzone-left'  : '',
        isRightEndZone ? 'square--endzone-right' : '',
        isWideZone     ? 'square--wide-zone'     : '',
        isScrimmage    ? 'square--scrimmage'     : '',
        isReachable    ? 'square--reachable'     : '',
        isGfiRange     ? 'square--reachable-gfi' : '',
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
          : (isCommitted ? walkedStep ?? null : null);

      const committedDice = !previewStep && !piece ? committedDiceMap.get(k) ?? null : null;
      const previewDice: DiceInfo | null = previewStep
        && (previewStep.isGfi || previewStep.requiresDodge || previewStep.pickupTarget !== null)
        ? {
            isGfi: previewStep.isGfi,
            dodgeTarget: previewStep.requiresDodge ? previewStep.dodgeTarget : null,
            pickupTarget: previewStep.pickupTarget,
          }
        : null;

      const targetDescription = isHandoffTarget ? 'handoff target'
        : isPassReceiver ? 'pass target'
        : isBlockTarget ? 'block target'
        : isPushTarget ? 'push-back square'
        : null;

      // Ghost piece — suppress when the destination square has rolls (dice take priority)
      const showGhost = isGhost && selectedPiece && !previewStep?.isGfi && !previewStep?.requiresDodge;
      const describedPiece = piece ?? (showGhost ? selectedPiece : null);

      squares.push(
        <Square
          key={k}
          pCol={pCol}
          pRow={pRow}
          lCol={lCol}
          lRow={lRow}
          classes={classes}
          label={describeSquare(
            lCol, lRow,
            describedPiece?.name ?? null, describedPiece?.team ?? null, describedPiece?.role,
            describedPiece?.skills ?? EMPTY_SKILLS, !piece && !!showGhost,
            describedPiece?.down ?? false, describedPiece?.hasBall ?? false, describedPiece?.activated ?? false,
            isReachable, previewStep?.requiresDodge ? previewStep.dodgeTarget : null,
            (previewStep?.isGfi ?? false) || isGfiRange, previewStep?.pickupTarget ?? null,
            isLooseBall, targetDescription,
          )}
          pieceTeam={piece?.team ?? null}
          pieceRole={piece?.role}
          pieceSkills={piece?.skills ?? EMPTY_SKILLS}
          pieceClasses={piece ? [
            'piece',
            `piece--${piece.team}`,
            isSelected      ? 'piece--selected'  : '',
            piece.activated ? 'piece--activated' : '',
            piece.hasBall   ? 'piece--carrier'   : '',
            piece.down      ? 'piece--down'      : '',
          ].filter(Boolean).join(' ') : ''}
          pieceHasBall={piece?.hasBall ?? false}
          looseBall={isLooseBall}
          inTackleZone={isInTZ}
          actionLabel={isSelected ? actionLabel : null}
          displayStep={displayStep}
          stepIsPreview={!!previewStep}
          pathTrails={pathTrails}
          dice={previewDice ?? committedDice}
          ghost={showGhost && selectedPiece
            ? {
                team: selectedPiece.team,
                role: selectedPiece.role,
                skills: selectedPiece.skills,
                hasBall: ghostHasBall,
              }
            : null}
          // Focusable when the square is actionable, so Tab walks the legal
          // moves rather than every cell on the pitch.
          focusable={Boolean(
            piece || isReachable || isHandoffTarget || isPassReceiver
            || isBlockTarget || isPushTarget || isLooseBall,
          )}
          onSquareClick={onSquareClick}
          onPieceClick={onPieceClick}
          onSquareHover={onSquareHover}
          onSquareLeave={onSquareLeave}
        />
      );
    }
  }

  const colLabels = Array.from({ length: visibleCols }, (_, i) => (
    <div key={colStart + i} className="pitch__col-label">{colLabel(colStart + i)}</div>
  ));

  const rowLabels = Array.from({ length: visibleRows }, (_, i) => (
    <div key={rowStart + i} className="pitch__row-label">{rowLabel(rowStart + i)}</div>
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
      <div className="pitch__col-labels pitch__col-labels--top" style={colLabelsStyle} aria-hidden="true">
        <div className="pitch__corner" />
        {colLabels}
        <div className="pitch__corner" />
      </div>

      <div className="pitch__middle">
        {/* Row labels — left */}
        <div className="pitch__row-labels" aria-hidden="true">{rowLabels}</div>

        {/* The field */}
        <div className="pitch__grid" style={gridStyle} role="group" aria-label="Pitch">{squares}</div>

        {/* Row labels — right */}
        <div className="pitch__row-labels" aria-hidden="true">{rowLabels}</div>
      </div>

      {/* Column labels — bottom */}
      <div className="pitch__col-labels pitch__col-labels--bottom" style={colLabelsStyle} aria-hidden="true">
        <div className="pitch__corner" />
        {colLabels}
        <div className="pitch__corner" />
      </div>
    </div>
  );
}
