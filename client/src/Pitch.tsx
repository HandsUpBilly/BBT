import { memo, useCallback, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { GameState, Team, BlockOutcomeFace, BlockLogEntry, Position } from './types';
import { key, neighbours } from './bfs';
import type { ZoomBounds } from './bfs';
import { buildMovementTrailMap, buildMovementStartMarkers, trailPolylinePoints } from './movementTrail';
import type { PathTrail } from './movementTrail';
import { passTrajectoryPath } from './passTrajectory';
import { skillGroupsFor, skillMarkersFor } from './skillPresentation';
import type { PitchSurface, TokenStyle } from './prefs';
import type { GhostPiece } from './branchRun';
import { RoleGlyph } from './RoleGlyph';
import { roleCodeFor } from './rolePresentation';
import { DEFAULT_PLAYER_ROLE, playerPortraitFor } from './playerPortraits';
import { BlockFaceGraphic } from './BlockDiceGraphic';
import { BLOCK_FACE_LABELS } from './blockFacePresentation';
import { BallIcon as GrittyBallIcon } from './BallIcon';
import './Pitch.css';

function BallIcon({ ghost, loose }: { ghost?: boolean; loose?: boolean }) {
  return (
    <GrittyBallIcon
      className={loose ? 'ball-marker ball-marker--loose' : 'ball-marker'}
      style={{ opacity: ghost ? 0.5 : 1 }}
    />
  );
}

const EMPTY_SKILLS: readonly string[] = [];
const PITCH_DETAIL_CLASS: Record<TokenStyle, string> = {
  portrait: 'pitch--detailed',
  simple: 'pitch--tactical',
  plain: 'pitch--plain',
};

function PieceIcon({ team, role, skills }: { team: Team; role?: string; skills: readonly string[] }) {
  const src = playerPortraitFor(team, role);
  const portraitClass = src.includes('-gritty.')
    ? 'piece__portrait'
    : 'piece__portrait piece__portrait--legacy';
  const groups = skillGroupsFor(skills);
  const markers = skillMarkersFor(skills);

  // Always rendered, hidden by CSS unless a role-disc style is active — see the
  // note above useMediaQuery's compact/hover hooks on why presentation
  // choices belong in the stylesheet rather than a second render path here.
  // The disc keeps the skill-group ring and letter-badge layers below
  // unchanged; only the portrait bitmap and its team tint are swapped out.
  const roleCode = roleCodeFor(role, DEFAULT_PLAYER_ROLE[team]);

  let portrait = (
    <div className="piece__portrait-frame">
      <img className={portraitClass} src={src} alt="" draggable={false} />
      <span className="piece__team-tint" />
      <RoleGlyph role={role} fallback={DEFAULT_PLAYER_ROLE[team]} />
      <span className="piece__role-code">{roleCode}</span>
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

function RollDie({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="square__roll-die" title={label} aria-hidden="true">
      {children}
    </span>
  );
}

function DiceFace({ target }: { target: number }) {
  const dots = DOT_POSITIONS[target] ?? DOT_POSITIONS[6];
  return (
    <RollDie label={`Dodge roll: ${target}+`}>
      <svg className="dodge-die" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="18" height="18" rx="3" ry="3"
          fill="rgba(30,20,10,0.75)" stroke="rgba(255,160,0,0.9)" strokeWidth="1.5" />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2" fill="rgba(255,200,80,0.95)" />
        ))}
      </svg>
    </RollDie>
  );
}

function GfiFace() {
  // Die showing face 2 — blue tint to distinguish from dodge dice
  return (
    <RollDie label="Go For It roll: 2+">
      <svg className="gfi-die" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="18" height="18" rx="3" ry="3"
          fill="rgba(10,20,40,0.80)" stroke="rgba(80,160,255,0.95)" strokeWidth="1.5" />
        <circle cx="5" cy="5" r="2" fill="rgba(140,210,255,0.95)" />
        <circle cx="15" cy="15" r="2" fill="rgba(140,210,255,0.95)" />
      </svg>
    </RollDie>
  );
}

function PickupFace({ target }: { target: number }) {
  // Same shape as DiceFace but ball-amber tinted, to distinguish a pickup
  // Agility test from a dodge Agility test when both dice are shown.
  const dots = DOT_POSITIONS[target] ?? DOT_POSITIONS[6];
  return (
    <RollDie label={`Pick-up roll: ${target}+`}>
      <svg className="pickup-die" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="18" height="18" rx="3" ry="3"
          fill="rgba(50,30,0,0.80)" stroke="rgba(255,210,74,0.95)" strokeWidth="1.5" />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2" fill="rgba(255,224,140,0.95)" />
        ))}
      </svg>
    </RollDie>
  );
}

function PassFace({ target }: { target: number }) {
  // Pass accuracy roll — teal, distinct from the amber/blue/gold movement
  // dice and the crimson block dice, so a completed throw reads at a glance.
  const dots = DOT_POSITIONS[target] ?? DOT_POSITIONS[6];
  return (
    <RollDie label={`Pass roll: ${target}+`}>
      <svg className="pass-die" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="18" height="18" rx="3" ry="3"
          fill="rgba(8,45,42,0.82)" stroke="rgba(70,220,190,0.95)" strokeWidth="1.5" />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2" fill="rgba(150,245,225,0.95)" />
        ))}
      </svg>
    </RollDie>
  );
}

function CatchFace({ target }: { target: number }) {
  // Catch roll (pass-catch and handoff share the same Agility test) — magenta,
  // distinct from every other on-pitch die colour.
  const dots = DOT_POSITIONS[target] ?? DOT_POSITIONS[6];
  return (
    <RollDie label={`Catch roll: ${target}+`}>
      <svg className="catch-die" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="18" height="18" rx="3" ry="3"
          fill="rgba(45,8,42,0.82)" stroke="rgba(230,110,220,0.95)" strokeWidth="1.5" />
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="2" fill="rgba(245,180,240,0.95)" />
        ))}
      </svg>
    </RollDie>
  );
}

/** What resolved on a defender's square this turn, for the pitch marker. */
export interface ResolvedBlockDice {
  face: BlockOutcomeFace;
  diceCount: 1 | 2 | 3;
  picker: 'attacker' | 'defender';
}

/**
 * Marks a resolved block/blitz with the outcome it actually produced (e.g.
 * "Push Back", "Defender Down"), on the defender's square. Crimson- or
 * white-tinted by who picked the die (see BlockDiceGraphic's `favor`), and
 * drawn as `diceCount` icons — a 2- or 3-dice block reads as a genuine
 * handful of dice, not a single die standing in for the whole roll.
 */
function BlockDiceFace({ face, diceCount, picker }: ResolvedBlockDice) {
  return (
    <BlockFaceGraphic face={face} count={diceCount} favor={picker} className="square__block-dice" />
  );
}

// Game state is stored portrait: col 0-14, row 0-25.
//   row 0  = one end zone, row 25 = the other
//   row 13 = the scrimmage line
//   col 4 and col 11 = the wide-zone lines
// Those are facts about the pitch, not about how it is drawn. `orientation`
// decides only which screen axis each one runs along.
const STATE_COLS = 15;
const STATE_ROWS = 26;

export type PitchOrientation = 'landscape' | 'portrait';

// A square's name is fixed to its state coordinates, so "13G" means the same
// square whichever way the board is drawn — written solutions, bug reports and
// the accessible label all stay valid across the rotation.
function squareNumber(stateRow: number) { return String(stateRow); }
function squareLetter(stateCol: number) { return String.fromCharCode(65 + stateCol); }
function squareName(stateCol: number, stateRow: number) {
  return `${squareNumber(stateRow)}${squareLetter(stateCol)}`;
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

interface DiceInfo {
  isGfi: boolean;
  dodgeTarget: number | null;
  pickupTarget: number | null;
  passTarget: number | null;
  catchTarget: number | null;
}

interface SquareProps {
  pCol: number;
  pRow: number;
  /** Stable square name ("13G"), independent of how the board is drawn. */
  name: string;
  /** Needed for the movement trail, whose geometry transposes with the board. */
  portrait: boolean;
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
  blockDice: ResolvedBlockDice | null;
  trailStart: number | null;
  ghost: { team: Team; role?: string; skills: readonly string[]; hasBall: boolean } | null;
  /** Where this piece stands in *other* live branches — see BranchStrip. */
  branchGhosts: readonly BranchGhostView[];
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
  pCol, pRow, name, portrait, classes, label, pieceTeam, pieceRole, pieceSkills, pieceClasses, pieceHasBall,
  looseBall, inTackleZone, actionLabel, displayStep, stepIsPreview, pathTrails, dice, blockDice, trailStart, ghost,
  branchGhosts, focusable,
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
      data-square={name}
      data-col={pCol}
      data-row={pRow}
    >
      <div className="square__overlay" />
      {pathTrails.map((pathTrail, index) => {
        const markerId = `movement-trail-arrow-${pCol}-${pRow}-${index}`;
        return (
        <svg key={index} className="square__path-trail" viewBox="0 0 100 100" aria-hidden="true">
          {pathTrail.leadsToTerminal && (
            <defs>
              <marker id={markerId} markerWidth="22" markerHeight="22" refX="17" refY="11" orient="auto" markerUnits="userSpaceOnUse">
                <path d="M 1 1 L 19 11 L 1 21 z" />
              </marker>
            </defs>
          )}
          <polyline
            className="square__path-trail-line"
            points={trailPolylinePoints(pathTrail, pCol, pRow, portrait)}
            markerEnd={pathTrail.leadsToTerminal ? `url(#${markerId})` : undefined}
          />
        </svg>
        );
      })}
      {trailStart !== null && (
        <span className="trail-start-marker">{trailStart}</span>
      )}
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
          {dice.passTarget !== null && <PassFace target={dice.passTarget} />}
          {dice.catchTarget !== null && <CatchFace target={dice.catchTarget} />}
        </div>
      )}

      {blockDice !== null && (
        <BlockDiceFace face={blockDice.face} diceCount={blockDice.diceCount} picker={blockDice.picker} />
      )}

      {branchGhosts.map(branchGhost => {
        const key = `${branchGhost.down}-${branchGhost.labels.join()}`;
        const where = branchGhost.labels.join(', ');
        return branchGhost.stateOnly ? (
          <div
            key={key}
            className={`square__branch-flag square__branch-flag--${branchGhost.down ? 'down' : 'standing'}`}
            title={branchGhost.down ? `Down here in universes: ${where}` : `Still standing in universes: ${where}`}
          />
        ) : (
          <div
            key={key}
            className={`piece piece--${branchGhost.team} piece--branch-ghost${branchGhost.down ? ' piece--down' : ''}`}
            title={`Also here in: ${where}`}
          >
            <PieceIcon team={branchGhost.team} role={branchGhost.role} skills={branchGhost.skills} />
          </div>
        );
      })}
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
  /** When set, only this state-coordinate sub-region of the pitch is rendered. */
  zoomBounds?: ZoomBounds | null;
  /**
   * Which screen axis the pitch's long side runs along. Portrait puts the end
   * zones top and bottom, which roughly doubles the square size on a phone —
   * a 26-wide board squeezed into a 360px viewport gives 11px squares, and
   * 15 wide gives 24px.
   */
  orientation?: PitchOrientation;
  /** Controls portrait/detail density without changing any gameplay information. */
  tokenStyle?: TokenStyle;
  pitchSurface?: PitchSurface;
  showCoordinates?: boolean;
  /**
   * Where pieces stand in the other live branches of a block, drawn faintly
   * over the viewed board. Only pieces that actually differ are included —
   * see `ghostPieces` in branchRun.ts.
   */
  branchGhosts?: readonly GhostPiece[];
}

/** A branch ghost resolved against the viewed board, ready to draw. */
interface BranchGhostView {
  team: Team;
  role?: string;
  skills: readonly string[];
  down: boolean;
  labels: string[];
  /**
   * The same piece is already on this square in the viewed branch and only its
   * prone state differs. Drawing a translucent copy of a token on top of itself
   * says nothing, so these render as a corner pip instead — and the standing
   * case is the one that matters, because a standing player still projects a
   * tackle zone the viewed board does not have.
   */
  stateOnly: boolean;
}

const NO_BRANCH_GHOSTS: readonly BranchGhostView[] = [];

export function Pitch({
  state, onSquareClick, onPieceClick, onSquareHover, onSquareLeave, zoomBounds,
  orientation = 'landscape', tokenStyle = 'portrait', pitchSurface = 'grass', showCoordinates = true,
  branchGhosts,
}: Props) {
  const portrait = orientation === 'portrait';

  // Resolve each ghost against the viewed board, which is where the piece's
  // team, role and skills come from — a ghost only records where it stands.
  const branchGhostMap = useMemo(() => {
    const map = new Map<string, BranchGhostView[]>();
    if (!branchGhosts?.length) return map;

    const byId = new Map(state.pieces.map(p => [p.id, p]));
    for (const ghost of branchGhosts) {
      const piece = byId.get(ghost.pieceId);
      if (!piece) continue;
      const k = key(ghost.position);
      const views = map.get(k) ?? [];
      views.push({
        team: piece.team,
        role: piece.role,
        skills: piece.skills,
        down: ghost.down,
        labels: ghost.labels,
        stateOnly: piece.position.col === ghost.position.col
          && piece.position.row === ghost.position.row,
      });
      map.set(k, views);
    }
    return map;
  }, [branchGhosts, state.pieces]);
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

  // Which square each piece first moved from this turn, numbered in
  // activation order — same actionLog-derived, auto-clearing-on-cancel
  // convention as the trail and dice maps above.
  const movementStartMap = useMemo(
    () => buildMovementStartMarkers(state.actionLog),
    [state.actionLog],
  );

  // Committed dice: map from square key -> dice info from actionLog. Persists
  // after a waypoint is set so dice remain visible on committed squares. The
  // pass die belongs on the passer's square (entry.from — where the Pass roll
  // actually happens) and the catch die on the receiver's square (entry.to);
  // entries are merged onto whatever is already there rather than
  // overwritten, since a step can carry more than one roll (e.g. a dodge and
  // a pickup on the same square).
  const committedDiceMap = useMemo(() => {
    const map = new Map<string, DiceInfo>();
    const merge = (k: string, patch: Partial<DiceInfo>) => {
      const existing = map.get(k) ?? { isGfi: false, dodgeTarget: null, pickupTarget: null, passTarget: null, catchTarget: null };
      map.set(k, { ...existing, ...patch });
    };
    for (const entry of state.actionLog) {
      if (entry.kind === 'move' && (entry.isGfi || entry.dodgeTarget !== null || entry.pickupTarget)) {
        merge(key(entry.to), { isGfi: entry.isGfi, dodgeTarget: entry.dodgeTarget, pickupTarget: entry.pickupTarget ?? null });
      } else if (entry.kind === 'pass') {
        merge(key(entry.from), { passTarget: entry.passTarget });
      } else if (entry.kind === 'pass-catch' || entry.kind === 'handoff') {
        merge(key(entry.to), { catchTarget: entry.catchTarget });
      }
    }
    return map;
  }, [state.actionLog]);

  // Committed block outcome: map from the defender's square -> the resolved
  // face plus how many dice actually rolled and who picked, for the pitch
  // marker. Same actionLog-derived, overwrite-on-repeat convention as
  // committedDiceMap: a square blocked more than once this turn shows only
  // the most recent block's outcome.
  const committedBlockDiceMap = useMemo(() => {
    const map = new Map<string, ResolvedBlockDice>();
    for (const entry of state.actionLog) {
      if (entry.kind === 'block') {
        map.set(key(entry.to), { face: entry.resolvedFace, diceCount: entry.diceCount, picker: entry.picker });
      }
    }
    return map;
  }, [state.actionLog]);

  // Squares a push touched this turn: origin (the defender's pre-push
  // square, `entry.to`) and destination (`entry.pushTo`). Same actionLog-
  // derived, auto-clears-on-cancel convention as the trail/dice/block-outcome
  // maps above — a square pushed through more than once keeps every glow it
  // was part of, since origin and destination read differently.
  const pushOriginKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of state.actionLog) {
      if (entry.kind === 'block' && entry.pushTo) keys.add(key(entry.to));
    }
    return keys;
  }, [state.actionLog]);
  const pushDestinationKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of state.actionLog) {
      if (entry.kind === 'block' && entry.pushTo) keys.add(key(entry.pushTo));
    }
    return keys;
  }, [state.actionLog]);

  const selectedPiece = state.selectedPieceId
    ? state.pieces.find(p => p.id === state.selectedPieceId)
    : null;
  const ghostHasBall = selectedPiece?.hasBall ?? false;

  // Current tip of the selected piece's committed movement — not the same as
  // selectedPiece.position, which stays at the activation's start square
  // until the activation finalizes.
  const tipPos = state.committedPath.length > 0
    ? state.committedPath[state.committedPath.length - 1]
    : state.originPos ?? selectedPiece?.position ?? null;

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

  // Visible sub-region, in state coordinates.
  const stateColStart = zoomBounds ? zoomBounds.minCol : 0;
  const stateColEnd   = zoomBounds ? zoomBounds.maxCol : STATE_COLS - 1;
  const stateRowStart = zoomBounds ? zoomBounds.minRow : 0;
  const stateRowEnd   = zoomBounds ? zoomBounds.maxRow : STATE_ROWS - 1;

  // Screen axes. Portrait draws state cols across and state rows down;
  // landscape transposes, so state rows run across and state cols run down.
  const acrossValues = portrait
    ? range(stateColStart, stateColEnd)
    : range(stateRowStart, stateRowEnd);
  const downValues = portrait
    ? range(stateRowStart, stateRowEnd)
    : range(stateColStart, stateColEnd);
  const visibleCols = acrossValues.length;
  const visibleRows = downValues.length;
  const acrossStart = acrossValues[0] ?? 0;
  const downStart = downValues[0] ?? 0;
  const passTrajectories = state.actionLog
    .filter(entry => entry.kind === 'pass')
    .map((entry, index) => ({
      key: `${entry.pieceName}-${entry.receiverName}-${index}`,
      path: passTrajectoryPath(entry.from, entry.to, portrait, acrossStart, downStart),
    }));

  // A resolved push, drawn the same way as a completed pass (one arc with an
  // arrowhead over the two squares involved) but in its own colour so a push
  // isn't mistaken for a throw — see pushOriginKeys/pushDestinationKeys above
  // for why the origin square can also be carrying that block's resolved-face
  // marker.
  const pushIndicators = state.actionLog
    .filter((entry): entry is BlockLogEntry & { pushTo: Position } => entry.kind === 'block' && !!entry.pushTo)
    .map((entry, index) => ({
      key: `${entry.pieceName}-${entry.receiverName}-push-${index}`,
      path: passTrajectoryPath(entry.to, entry.pushTo, portrait, acrossStart, downStart),
    }));

  // Labels follow the axis, not the orientation: the letter always names the
  // state col and the number always names the state row.
  const acrossLabel = portrait ? squareLetter : squareNumber;
  const downLabel   = portrait ? squareNumber : squareLetter;

  /** Screen-reader description of a square: position, occupant, and what it offers. */
  function describeSquare(
    stateCol: number, stateRow: number,
    pieceName: string | null, pieceTeam: Team | null, pieceRole: string | undefined,
    pieceSkills: readonly string[], pieceIsPreview: boolean,
    pieceDown: boolean, pieceHasBall: boolean, pieceActivated: boolean,
    reachable: boolean, dodge: number | null, gfi: boolean, pickup: number | null,
    looseBall: boolean, isTarget: string | null, blockFace: BlockOutcomeFace | null,
    passTarget: number | null, catchTarget: number | null, trailStartNumber: number | null,
  ): string {
    const parts = [squareName(stateCol, stateRow)];
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
    if (blockFace !== null) parts.push(`block result: ${BLOCK_FACE_LABELS[blockFace]}`);
    if (passTarget !== null) parts.push(`pass ${passTarget} plus`);
    if (catchTarget !== null) parts.push(`catch ${catchTarget} plus`);
    if (trailStartNumber !== null) parts.push(`activation order ${trailStartNumber}`);
    return parts.join(', ');
  }

  const squares = [];
  for (const down of downValues) {
    for (const across of acrossValues) {
      const pCol = portrait ? across : down;
      const pRow = portrait ? down : across;
      const k = `${pCol},${pRow}`;

      const piece      = pieceMap.get(k);
      const isSelected = piece?.id === state.selectedPieceId;

      // End zones — one row deep at each end. Named for the team that scores
      // there (see isTouchdown in useGameState) rather than for a screen edge,
      // since which edge that is depends on the orientation.
      const isHumanEndZone = pRow === 0;
      const isOrcEndZone   = pRow === STATE_ROWS - 1;

      // Wide-zone lines: 4 squares in from each touchline.
      const isWideZone  = pCol === 4 || pCol === 11;
      // Scrimmage: the halfway line.
      const isScrimmage = pRow === 13;

      const previewStep       = previewStepMap.get(k);
      const isGhost           = ghostKey === k && !piece;
      const isPreviewGfi      = !!previewStep?.isGfi && !isGhost;
      const isPreviewDodge    = !!previewStep?.requiresDodge && !isGhost;
      const isPreviewFree     = !!previewStep && !previewStep.requiresDodge && !previewStep.isGfi && !isGhost;
      const isReachable       = state.reachableKeys.has(k) && !previewStep && k !== ghostKey;
      // Reachable squares beyond the player's remaining MA require one of the
      // two Go For It rolls. Mark the outer rings immediately, rather than
      // only revealing that cost after the player hovers a destination.
      const isGfiRange = isReachable && tipPos != null
        && Math.max(
          Math.abs(pCol - tipPos.col),
          Math.abs(pRow - tipPos.row),
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
      const isPushOrigin      = pushOriginKeys.has(k);
      const isPushDestination = pushDestinationKeys.has(k);
      const isLooseBall       = looseBallKey === k;
      const squareBranchGhosts = branchGhostMap.get(k) ?? NO_BRANCH_GHOSTS;

      const classes = [
        'square',
        (pCol + pRow) % 2 === 0 ? 'square--light' : 'square--dark',
        isHumanEndZone ? 'square--endzone-human' : '',
        isOrcEndZone   ? 'square--endzone-orc'   : '',
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
        isPushOrigin      ? 'square--push-origin'      : '',
        isPushDestination ? 'square--push-destination' : '',
        squareBranchGhosts.length > 0 ? 'square--branch-ghost' : '',
      ].filter(Boolean).join(' ');

      const squaresWalked = selectedPiece ? selectedPiece.ma - state.remainingMa : 0;
      const displayStep = isGhost
        ? null
        : previewStep
          ? squaresWalked + previewStep.stepNum
          : (isCommitted ? walkedStep ?? null : null);

      const committedDice = !previewStep ? committedDiceMap.get(k) ?? null : null;
      const previewDice: DiceInfo | null = previewStep
        && (previewStep.isGfi || previewStep.requiresDodge || previewStep.pickupTarget !== null)
        ? {
            isGfi: previewStep.isGfi,
            dodgeTarget: previewStep.requiresDodge ? previewStep.dodgeTarget : null,
            pickupTarget: previewStep.pickupTarget,
            passTarget: null,
            catchTarget: null,
          }
        : null;
      const displayedDice = previewDice ?? committedDice;
      const blockFace = committedBlockDiceMap.get(k) ?? null;

      // Suppressed on an occupied square (nothing to read a number under) or
      // one already carrying a roll marker, so the activation-order badge
      // never fights another marker for the same square's centre.
      const trailStartNumber = !piece && !displayedDice && blockFace === null
        ? movementStartMap.get(k) ?? null
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
          name={squareName(pCol, pRow)}
          portrait={portrait}
          classes={classes}
          branchGhosts={squareBranchGhosts}
          label={[describeSquare(
            pCol, pRow,
            describedPiece?.name ?? null, describedPiece?.team ?? null, describedPiece?.role,
            describedPiece?.skills ?? EMPTY_SKILLS, !piece && !!showGhost,
            describedPiece?.down ?? false, describedPiece?.hasBall ?? false, describedPiece?.activated ?? false,
            isReachable, displayedDice?.dodgeTarget ?? null,
            (displayedDice?.isGfi ?? false) || isGfiRange, displayedDice?.pickupTarget ?? null,
            isLooseBall, targetDescription, blockFace?.face ?? null,
            displayedDice?.passTarget ?? null, displayedDice?.catchTarget ?? null, trailStartNumber,
          ),
          squareBranchGhosts.length > 0
            ? `occupied in other universes: ${squareBranchGhosts.flatMap(g => g.labels).join(', ')}`
            : '',
          isPushOrigin ? 'pushed from here' : '',
          isPushDestination ? 'pushed to here' : '',
          ].filter(Boolean).join(', ')}
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
          dice={displayedDice}
          blockDice={blockFace}
          trailStart={trailStartNumber}
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

  const colLabels = acrossValues.map(v => (
    <div key={v} className="pitch__col-label">{acrossLabel(v)}</div>
  ));

  const rowLabels = downValues.map(v => (
    <div key={v} className="pitch__row-label">{downLabel(v)}</div>
  ));

  // Always inline rather than only when zoomed: the track counts depend on the
  // orientation as well as the crop, so leaving a 26-column default in the
  // stylesheet would just be a second place to keep in sync.
  const gridStyle = {
    aspectRatio: `${visibleCols} / ${visibleRows}`,
    gridTemplateColumns: `repeat(${visibleCols}, 1fr)`,
    gridTemplateRows: `repeat(${visibleRows}, 1fr)`,
  };

  const colLabelsStyle = { gridTemplateColumns: `1.4em repeat(${visibleCols}, 1fr) 1.4em` };

  const classes = [
    'pitch',
    `pitch--${orientation}`,
    PITCH_DETAIL_CLASS[tokenStyle],
    `pitch--surface-${pitchSurface}`,
    showCoordinates ? '' : 'pitch--coordinates-hidden',
    zoomBounds ? 'pitch--zoomed' : '',
    tokenStyle !== 'portrait' ? 'pitch--simple' : '',
  ].filter(Boolean).join(' ');

  // Drives the fit-to-container calc in Pitch.css. A custom property rather
  // than a width, so the stylesheet keeps ownership of the layout maths.
  const pitchStyle = {
    '--pitch-aspect': visibleCols / visibleRows,
  } as CSSProperties;

  return (
    <div className={classes} style={pitchStyle}>
      {/* Column labels — top */}
      {showCoordinates && <div className="pitch__col-labels pitch__col-labels--top" style={colLabelsStyle} aria-hidden="true">
        <div className="pitch__corner" />
        {colLabels}
        <div className="pitch__corner" />
      </div>}

      <div className="pitch__middle">
        {/* Row labels — left */}
        {showCoordinates && <div className="pitch__row-labels" aria-hidden="true">{rowLabels}</div>}

        {/* The field */}
        <div className="pitch__grid" style={gridStyle} role="group" aria-label="Pitch">
          {squares}
          {passTrajectories.length > 0 && (
            <svg
              className="pitch__pass-trajectories"
              viewBox={`0 0 ${visibleCols} ${visibleRows}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <marker id="pass-trajectory-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth">
                  <path d="M 0 0 L 5 2.5 L 0 5 z" />
                </marker>
              </defs>
              {passTrajectories.map(trajectory => (
                <path key={trajectory.key} className="pitch__pass-trajectory" d={trajectory.path} />
              ))}
            </svg>
          )}
          {pushIndicators.length > 0 && (
            <svg
              className="pitch__push-indicators"
              viewBox={`0 0 ${visibleCols} ${visibleRows}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <marker id="push-indicator-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto" markerUnits="strokeWidth">
                  <path d="M 0 0 L 5 2.5 L 0 5 z" />
                </marker>
              </defs>
              {pushIndicators.map(indicator => (
                <path key={indicator.key} className="pitch__push-indicator" d={indicator.path} />
              ))}
            </svg>
          )}
        </div>

        {/* Row labels — right */}
        {showCoordinates && <div className="pitch__row-labels" aria-hidden="true">{rowLabels}</div>}
      </div>

      {/* Column labels — bottom */}
      {showCoordinates && <div className="pitch__col-labels pitch__col-labels--bottom" style={colLabelsStyle} aria-hidden="true">
        <div className="pitch__corner" />
        {colLabels}
        <div className="pitch__corner" />
      </div>}
    </div>
  );
}
