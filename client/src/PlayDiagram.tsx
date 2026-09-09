import { useId } from 'react';
import { buildMovementRoutes } from './playDiagramRoutes';
import type { PitchOrientation } from './Pitch';
import type { ActionLogEntry, Position, Scenario } from './types';
import './PlayDiagram.css';

const CELL = 20;
const MARGIN = 18;
const STATE_ROWS = 26;
const STATE_COLS = 15;
// The pitch is always drawn 26-long by 15-wide; only which state axis maps to
// screen x vs. y changes. LONG_PX/SHORT_PX name the two board dimensions
// independent of orientation so the grid/marking helpers below don't have to
// re-derive which is which.
const LONG_PX = STATE_ROWS * CELL;
const SHORT_PX = STATE_COLS * CELL;

interface DiagramLogEntry {
  kind: ActionLogEntry['kind'];
  pieceName: string;
  from: Position;
  to: Position;
  receiverName?: string;
  isBlitz?: boolean;
  diceCount?: 1 | 2 | 3;
  pushes?: Array<{ from: Position; to: Position }>;
}

function point(position: Position, orientation: PitchOrientation): { x: number; y: number } {
  // Match the live pitch's screen convention for the orientation the play
  // happened under: portrait draws state cols across / rows down, landscape
  // transposes that (see Pitch.tsx). Swap axes here, not reverse them — a
  // past attempt reversed both axes and turned every recorded play around.
  return orientation === 'portrait'
    ? {
        x: MARGIN + (position.col + 0.5) * CELL,
        y: MARGIN + (position.row + 0.5) * CELL,
      }
    : {
        x: MARGIN + (position.row + 0.5) * CELL,
        y: MARGIN + (position.col + 0.5) * CELL,
      };
}

// A row-based marking (LOS, endzones) is a line of constant row spanning the
// full column extent; a col-based marking (wide-zone boundary) is a line of
// constant col spanning the full row extent. Which screen axis is which
// swaps with orientation, but each marking always spans the *other* state
// axis's full length, so SHORT_PX/LONG_PX below don't swap with it.
function rowLine(row: number, orientation: PitchOrientation) {
  const pos = MARGIN + row * CELL;
  return orientation === 'portrait'
    ? { x1: MARGIN, y1: pos, x2: MARGIN + SHORT_PX, y2: pos }
    : { x1: pos, y1: MARGIN, x2: pos, y2: MARGIN + SHORT_PX };
}

function colLine(col: number, orientation: PitchOrientation) {
  const pos = MARGIN + col * CELL;
  return orientation === 'portrait'
    ? { x1: pos, y1: MARGIN, x2: pos, y2: MARGIN + LONG_PX }
    : { x1: MARGIN, y1: pos, x2: MARGIN + LONG_PX, y2: pos };
}

function routePoints(positions: Position[], orientation: PitchOrientation): string {
  return positions.map(position => {
    const p = point(position, orientation);
    return `${p.x},${p.y}`;
  }).join(' ');
}

function curvedPath(from: Position, to: Position, orientation: PitchOrientation): string {
  const start = point(from, orientation);
  const end = point(to, orientation);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const bend = Math.min(52, Math.max(18, length * 0.18));
  const normalX = length === 0 ? 0 : -dy / length;
  const normalY = length === 0 ? -1 : dx / length;
  const controlX = (start.x + end.x) / 2 + normalX * bend;
  const controlY = (start.y + end.y) / 2 + normalY * bend;
  return `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${end.x} ${end.y}`;
}

interface Props {
  scenario: Scenario;
  actionLog: readonly DiagramLogEntry[];
  /** The pitch orientation the run was reviewed under. Defaults to landscape. */
  orientation?: PitchOrientation;
}

export function PlayDiagram({ scenario, actionLog, orientation = 'landscape' }: Props) {
  const markerPrefix = useId().replaceAll(':', '');
  const movementMarker = `${markerPrefix}-movement-arrow`;
  const ballMarker = `${markerPrefix}-ball-arrow`;
  const pushMarker = `${markerPrefix}-push-arrow`;
  const routes = buildMovementRoutes(actionLog);
  const passes = actionLog.filter(entry => entry.kind === 'pass');
  const handoffs = actionLog.filter(entry => entry.kind === 'handoff');
  const blocks = actionLog.filter(entry => entry.kind === 'block');
  const ballStart = scenario.pieces.find(piece => piece.hasBall)?.position ?? scenario.ballPosition;
  const description = [
    `${routes.length} movement ${routes.length === 1 ? 'route' : 'routes'}`,
    passes.length ? `${passes.length} ${passes.length === 1 ? 'pass' : 'passes'}` : '',
    handoffs.length ? `${handoffs.length} ${handoffs.length === 1 ? 'hand-off' : 'hand-offs'}` : '',
    blocks.length ? `${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'}` : '',
  ].filter(Boolean).join(', ');
  const boardWidth = orientation === 'portrait' ? SHORT_PX : LONG_PX;
  const boardHeight = orientation === 'portrait' ? LONG_PX : SHORT_PX;
  const svgWidth = boardWidth + MARGIN * 2;
  const svgHeight = boardHeight + MARGIN * 2;

  return (
    <figure className="play-diagram">
      <div className="play-diagram__heading">
        <span>Play diagram</span>
        <span className="play-diagram__key" aria-hidden="true">○ Your team, × Opposition</span>
      </div>
      <svg
        className="play-diagram__svg"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        role="img"
        aria-label={`Completed play: ${description}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id={movementMarker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8" className="play-diagram__arrowhead play-diagram__arrowhead--movement" />
          </marker>
          <marker id={ballMarker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8" className="play-diagram__arrowhead play-diagram__arrowhead--ball" />
          </marker>
          <marker id={pushMarker} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 0 L 8 4 L 0 8" className="play-diagram__arrowhead play-diagram__arrowhead--push" />
          </marker>
        </defs>

        <rect className="play-diagram__board" x={MARGIN} y={MARGIN} width={boardWidth} height={boardHeight} rx="3" />
        <g className="play-diagram__grid" aria-hidden="true">
          {Array.from({ length: STATE_ROWS + 1 }, (_, row) => {
            const l = rowLine(row, orientation);
            return <line key={`row-${row}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />;
          })}
          {Array.from({ length: STATE_COLS + 1 }, (_, col) => {
            const l = colLine(col, orientation);
            return <line key={`col-${col}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />;
          })}
        </g>
        <g className="play-diagram__markings" aria-hidden="true">
          {[1, 13, 25].map(row => {
            const l = rowLine(row, orientation);
            return <line key={`marking-row-${row}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />;
          })}
          {[4, 11].map(col => {
            const l = colLine(col, orientation);
            return <line key={`marking-col-${col}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />;
          })}
        </g>

        <g className="play-diagram__formation">
          {scenario.pieces.map(piece => {
            const p = point(piece.position, orientation);
            const active = piece.team === scenario.activeTeam;
            return active ? (
              <g key={piece.id} className={`play-diagram__player play-diagram__player--active${piece.down ? ' play-diagram__player--down' : ''}`}>
                <title>{piece.name}: starting square</title>
                <circle cx={p.x} cy={p.y} r="6.5" />
              </g>
            ) : (
              <g key={piece.id} className={`play-diagram__player play-diagram__player--opposition${piece.down ? ' play-diagram__player--down' : ''}`}>
                <title>{piece.name}: starting square</title>
                <path d={`M ${p.x - 5} ${p.y - 5} L ${p.x + 5} ${p.y + 5} M ${p.x + 5} ${p.y - 5} L ${p.x - 5} ${p.y + 5}`} />
              </g>
            );
          })}
          {ballStart && (() => {
            const p = point(ballStart, orientation);
            return <ellipse className="play-diagram__ball" cx={p.x} cy={p.y} rx="3.2" ry="5" transform={`rotate(-35 ${p.x} ${p.y})`} />;
          })()}
        </g>

        <g className="play-diagram__routes">
          {routes.map((route, index) => (
            <polyline
              key={`move-${index}`}
              className="play-diagram__route play-diagram__route--movement"
              data-route-kind="movement"
              points={routePoints(route.points, orientation)}
              markerEnd={`url(#${movementMarker})`}
            >
              <title>{route.pieceName} movement</title>
            </polyline>
          ))}
          {passes.map((entry, index) => (
            <path
              key={`pass-${index}`}
              className="play-diagram__route play-diagram__route--pass"
              data-route-kind="pass"
              d={curvedPath(entry.from, entry.to, orientation)}
              markerEnd={`url(#${ballMarker})`}
            >
              <title>{entry.pieceName} passes to {entry.receiverName ?? 'receiver'}</title>
            </path>
          ))}
          {handoffs.map((entry, index) => {
            const from = point(entry.from, orientation);
            const to = point(entry.to, orientation);
            return (
              <line
                key={`handoff-${index}`}
                className="play-diagram__route play-diagram__route--handoff"
                data-route-kind="handoff"
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                markerEnd={`url(#${ballMarker})`}
              >
                <title>{entry.pieceName} hands off to {entry.receiverName ?? 'receiver'}</title>
              </line>
            );
          })}
          {blocks.map((entry, index) => {
            const from = point(entry.from, orientation);
            const to = point(entry.to, orientation);
            return (
              <g key={`block-${index}`} data-route-kind="block">
                <title>{entry.pieceName} {entry.isBlitz ? 'blitzes' : 'blocks'} {entry.receiverName ?? 'opponent'}</title>
                <line className="play-diagram__route play-diagram__route--block" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                <circle className="play-diagram__block-mark" cx={to.x} cy={to.y} r="8" />
                <text className="play-diagram__block-dice" x={to.x} y={to.y + 3}>{entry.diceCount ?? '?'}</text>
                {entry.pushes?.map((push, pushIndex) => {
                  const pushFrom = point(push.from, orientation);
                  const pushTo = point(push.to, orientation);
                  return (
                    <line
                      key={`push-${pushIndex}`}
                      className="play-diagram__route play-diagram__route--push"
                      data-route-kind="push"
                      x1={pushFrom.x}
                      y1={pushFrom.y}
                      x2={pushTo.x}
                      y2={pushTo.y}
                      markerEnd={`url(#${pushMarker})`}
                    />
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>
      <figcaption>Starting formation and every route committed in this run.</figcaption>
    </figure>
  );
}
