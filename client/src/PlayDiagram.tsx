import { useId } from 'react';
import { buildMovementRoutes } from './playDiagramRoutes';
import type { ActionLogEntry, Position, Scenario } from './types';
import './PlayDiagram.css';

const CELL = 20;
const MARGIN = 18;
const STATE_ROWS = 26;
const STATE_COLS = 15;
const PITCH_WIDTH = STATE_ROWS * CELL;
const PITCH_HEIGHT = STATE_COLS * CELL;
const SVG_WIDTH = PITCH_WIDTH + MARGIN * 2;
const SVG_HEIGHT = PITCH_HEIGHT + MARGIN * 2;

interface DiagramLogEntry {
  kind: ActionLogEntry['kind'];
  pieceName: string;
  from: Position;
  to: Position;
  receiverName?: string;
  isBlitz?: boolean;
  diceCount?: 1 | 2 | 3;
}

function point(position: Position): { x: number; y: number } {
  // Rotate the portrait game coordinates into the landscape review from the
  // player's viewpoint. Row zero belongs at the right-hand end and the final
  // lettered column belongs at the top, so a top-right scoring square stays
  // top-right in the completed-play diagram.
  return {
    x: MARGIN + (STATE_ROWS - position.row - 0.5) * CELL,
    y: MARGIN + (STATE_COLS - position.col - 0.5) * CELL,
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
  actionLog: readonly DiagramLogEntry[];
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
    handoffs.length ? `${handoffs.length} ${handoffs.length === 1 ? 'hand-off' : 'hand-offs'}` : '',
    blocks.length ? `${blocks.length} ${blocks.length === 1 ? 'block' : 'blocks'}` : '',
  ].filter(Boolean).join(', ');

  return (
    <figure className="play-diagram">
      <div className="play-diagram__heading">
        <span>Play diagram</span>
        <span className="play-diagram__key" aria-hidden="true">○ Your team, × Opposition</span>
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
              <title>{entry.pieceName} passes to {entry.receiverName ?? 'receiver'}</title>
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
                <title>{entry.pieceName} hands off to {entry.receiverName ?? 'receiver'}</title>
              </line>
            );
          })}
          {blocks.map((entry, index) => {
            const from = point(entry.from);
            const to = point(entry.to);
            return (
              <g key={`block-${index}`} data-route-kind="block">
                <title>{entry.pieceName} {entry.isBlitz ? 'blitzes' : 'blocks'} {entry.receiverName ?? 'opponent'}</title>
                <line className="play-diagram__route play-diagram__route--block" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
                <circle className="play-diagram__block-mark" cx={to.x} cy={to.y} r="8" />
                <text className="play-diagram__block-dice" x={to.x} y={to.y + 3}>{entry.diceCount ?? '?'}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <figcaption>Starting formation and every route committed in this run.</figcaption>
    </figure>
  );
}
