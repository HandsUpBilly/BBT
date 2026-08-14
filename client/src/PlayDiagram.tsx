import { useId } from 'react';
import type { ActionLogEntry, Position, Scenario } from './types';
import './PlayDiagram.css';

const CELL = 20;
const MARGIN = 18;
const PITCH_WIDTH = 26 * CELL;
const PITCH_HEIGHT = 15 * CELL;
const SVG_WIDTH = PITCH_WIDTH + MARGIN * 2;
const SVG_HEIGHT = PITCH_HEIGHT + MARGIN * 2;

export interface MovementRoute {
  pieceName: string;
  points: Position[];
}

function samePosition(a: Position, b: Position): boolean {
  return a.col === b.col && a.row === b.row;
}

/** Group the step-by-step log into the routes actually committed by each activation. */
export function buildMovementRoutes(actionLog: ActionLogEntry[]): MovementRoute[] {
  const routes: MovementRoute[] = [];
  let current: MovementRoute | undefined;

  for (const entry of actionLog) {
    if (entry.kind !== 'move') continue;
    const tip = current?.points.at(-1);
    if (!current || current.pieceName !== entry.pieceName || !tip || !samePosition(tip, entry.from)) {
      current = { pieceName: entry.pieceName, points: [entry.from, entry.to] };
      routes.push(current);
    } else if (!samePosition(tip, entry.to)) {
      current.points.push(entry.to);
    }
  }

  return routes;
}

function point(position: Position): { x: number; y: number } {
  // Game coordinates are portrait; the played pitch is rendered landscape.
  return {
    x: MARGIN + (position.row + 0.5) * CELL,
    y: MARGIN + (position.col + 0.5) * CELL,
  };
}

function routePoints(positions: Position[]): string {
  return positions.map(position => {
    const p = point(position);
    return `${p.x},${p.y}`;
  }).join(' ');
}

function curvedPath(from: Position, to: Position): string {
  const start = point(from);
  const end = point(to);
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
  actionLog: ActionLogEntry[];
}

export function PlayDiagram({ scenario, actionLog }: Props) {
  const markerPrefix = useId().replaceAll(':', '');
  const movementMarker = `${markerPrefix}-movement-arrow`;
  const ballMarker = `${markerPrefix}-ball-arrow`;
  const routes = buildMovementRoutes(actionLog);
  const passes = actionLog.filter(entry => entry.kind === 'pass');
  const handoffs = actionLog.filter(entry => entry.kind === 'handoff');
  const blocks = actionLog.filter(entry => entry.kind === 'block');
  const ballStart = scenario.pieces.find(piece => piece.hasBall)?.position ?? scenario.ballPosition;
  const description = [
    `${routes.length} movement ${routes.length === 1 ? 'route' : 'routes'}`,
    passes.length ? `${passes.length} ${passes.length === 1 ? 'pass' : 'passes'}` : '',
    handoffs.length ? `${handoffs.length} ${handoffs.length === 1 ? 'handoff' : 'handoffs'}` : '',
    blocks.length ? `${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'}` : '',
  ].filter(Boolean).join(', ');

  return (
    <figure className="play-diagram">
      <div className="play-diagram__heading">
        <span>Play diagram</span>
        <span className="play-diagram__key" aria-hidden="true">○ Your team · × Opposition</span>
      </div>
      <svg
        className="play-diagram__svg"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
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
        </defs>

        <rect className="play-diagram__board" x={MARGIN} y={MARGIN} width={PITCH_WIDTH} height={PITCH_HEIGHT} rx="3" />
        <g className="play-diagram__grid" aria-hidden="true">
          {Array.from({ length: 27 }, (_, index) => (
            <line key={`col-${index}`} x1={MARGIN + index * CELL} y1={MARGIN} x2={MARGIN + index * CELL} y2={MARGIN + PITCH_HEIGHT} />
          ))}
          {Array.from({ length: 16 }, (_, index) => (
            <line key={`row-${index}`} x1={MARGIN} y1={MARGIN + index * CELL} x2={MARGIN + PITCH_WIDTH} y2={MARGIN + index * CELL} />
          ))}
        </g>
        <g className="play-diagram__markings" aria-hidden="true">
          <line x1={MARGIN + CELL} y1={MARGIN} x2={MARGIN + CELL} y2={MARGIN + PITCH_HEIGHT} />
          <line x1={MARGIN + 13 * CELL} y1={MARGIN} x2={MARGIN + 13 * CELL} y2={MARGIN + PITCH_HEIGHT} />
          <line x1={MARGIN + 25 * CELL} y1={MARGIN} x2={MARGIN + 25 * CELL} y2={MARGIN + PITCH_HEIGHT} />
          <line x1={MARGIN} y1={MARGIN + 4 * CELL} x2={MARGIN + PITCH_WIDTH} y2={MARGIN + 4 * CELL} />
          <line x1={MARGIN} y1={MARGIN + 11 * CELL} x2={MARGIN + PITCH_WIDTH} y2={MARGIN + 11 * CELL} />
        </g>

        <g className="play-diagram__formation">
          {scenario.pieces.map(piece => {
            const p = point(piece.position);
            const active = piece.team === scenario.activeTeam;
            return active ? (
              <g key={piece.id} className={`play-diagram__player play-diagram__player--active${piece.down ? ' play-diagram__player--down' : ''}`}>
                <title>{piece.name} — starting square</title>
                <circle cx={p.x} cy={p.y} r="6.5" />
              </g>
            ) : (
              <g key={piece.id} className={`play-diagram__player play-diagram__player--opposition${piece.down ? ' play-diagram__player--down' : ''}`}>
                <title>{piece.name} — starting square</title>
                <path d={`M ${p.x - 5} ${p.y - 5} L ${p.x + 5} ${p.y + 5} M ${p.x + 5} ${p.y - 5} L ${p.x - 5} ${p.y + 5}`} />
              </g>
            );
          })}
          {ballStart && (() => {
            const p = point(ballStart);
            return <ellipse className="play-diagram__ball" cx={p.x} cy={p.y} rx="3.2" ry="5" transform={`rotate(-35 ${p.x} ${p.y})`} />;
          })()}
        </g>

        <g className="play-diagram__routes">
          {routes.map((route, index) => (
            <polyline
              key={`move-${index}`}
              className="play-diagram__route play-diagram__route--movement"
              data-route-kind="movement"
              points={routePoints(route.points)}
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
              d={curvedPath(entry.from, entry.to)}
              markerEnd={`url(#${ballMarker})`}
            >
              <title>{entry.pieceName} passes to {entry.receiverName}</title>
            </path>
          ))}
          {handoffs.map((entry, index) => {
            const from = point(entry.from);
            const to = point(entry.to);
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
                <title>{entry.pieceName} hands off to {entry.receiverName}</title>
              </line>
            );
          })}
          {blocks.map((entry, index) => {
            const from = point(entry.from);
            const to = point(entry.to);
            return (
              <g key={`block-${index}`} data-route-kind="block">
                <title>{entry.pieceName} {entry.isBlitz ? 'blitzes' : 'blocks'} {entry.receiverName}</title>
                <line className="play-diagram__route play-diagram__route--block" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                <circle className="play-diagram__block-mark" cx={to.x} cy={to.y} r="8" />
                <text className="play-diagram__block-dice" x={to.x} y={to.y + 3}>{entry.diceCount}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <figcaption>Starting formation and every route committed in this run.</figcaption>
    </figure>
  );
}
