import type { GameState } from './types';
import type { TutorialDiagramHint } from './tutorialDiagram';
import './TutorialMiniDiagram.css';

interface Props {
  state: GameState;
  hint: TutorialDiagramHint;
}

const WIDTH = 520;
const HEIGHT = 230;
const MARGIN_X = 22;
const MARGIN_Y = 20;
const FIELD_WIDTH = WIDTH - MARGIN_X * 2;
const FIELD_HEIGHT = HEIGHT - MARGIN_Y * 2;

function point(col: number, row: number): { x: number; y: number } {
  return {
    x: MARGIN_X + (row / 25) * FIELD_WIDTH,
    y: MARGIN_Y + (col / 14) * FIELD_HEIGHT,
  };
}

function roleCode(role?: string): string {
  if (role === 'thrower') return 'T';
  if (role === 'catcher') return 'C';
  if (role === 'blitzer') return 'B';
  if (role === 'big-un') return 'U';
  return 'L';
}

function ParallelUniversesDiagram({ hint }: { hint: TutorialDiagramHint }) {
  return (
    <figure className="tutorial-mini-diagram tutorial-mini-diagram--universes">
      <svg
        className="tutorial-mini-diagram__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={hint.alt}
        preserveAspectRatio="xMidYMid meet"
      >
        <g className="tutorial-mini-diagram__universe-split">
          <rect className="tutorial-mini-diagram__universe-source" x="22" y="78" width="145" height="74" rx="10" />
          <text className="tutorial-mini-diagram__universe-kicker" x="94" y="105" textAnchor="middle">ONE BLOCK</text>
          <text className="tutorial-mini-diagram__universe-title" x="94" y="130" textAnchor="middle">3 live results</text>

          <path d="M 167 115 C 215 115, 218 42, 270 42" />
          <path d="M 167 115 L 270 115" />
          <path d="M 167 115 C 215 115, 218 188, 270 188" />

          {[42, 115, 188].map((y, index) => (
            <g key={y} className="tutorial-mini-diagram__universe-card" transform={`translate(270 ${y - 27})`}>
              <rect width="226" height="54" rx="9" />
              <circle cx="28" cy="27" r="15" />
              <text className="tutorial-mini-diagram__universe-number" x="28" y="32" textAnchor="middle">{index + 1}</text>
              <text className="tutorial-mini-diagram__universe-label" x="54" y="23">UNIVERSE {index + 1}</text>
              <text className="tutorial-mini-diagram__universe-status" x="54" y="40">PLAY THIS BOARD</text>
            </g>
          ))}
        </g>
      </svg>
      <figcaption>{hint.alt}</figcaption>
    </figure>
  );
}

export function TutorialMiniDiagram({ state, hint }: Props) {
  if (hint.focus.kind === 'universes') {
    return <ParallelUniversesDiagram hint={hint} />;
  }

  const focusIds = new Set(hint.focus.pieceIds ?? []);
  const focused = state.pieces.filter(piece => focusIds.has(piece.id));
  const target = hint.focus.target ? point(hint.focus.target.col, hint.focus.target.row) : null;
  const routeStart = focused[0] ? point(focused[0].position.col, focused[0].position.row) : null;
  const showRoute = hint.focus.region === 'route' || hint.focus.region === 'end-zone' || target;
  const connectionEnd = hint.focus.region === 'receiver' && focused[1]
    ? point(focused[1].position.col, focused[1].position.row)
    : null;
  const showTackleZones = hint.focus.region === 'tackle-zones';
  const scoresAtLeft = state.activeTeam === 'human';
  const endZoneWidth = FIELD_WIDTH / 26;
  const endZoneX = scoresAtLeft ? MARGIN_X : MARGIN_X + FIELD_WIDTH - endZoneWidth;
  const endZoneLabelX = scoresAtLeft ? endZoneX + 7 : endZoneX + endZoneWidth - 7;
  const routeEnd = routeStart && showRoute
    ? target ?? {
      x: scoresAtLeft ? MARGIN_X + 26 : MARGIN_X + FIELD_WIDTH - 26,
      y: routeStart.y,
    }
    : null;
  const routeDirection = routeStart && routeEnd
    ? Math.sign(routeEnd.x - routeStart.x) || 1
    : 1;

  return (
    <figure className="tutorial-mini-diagram">
      <svg
        className="tutorial-mini-diagram__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={hint.alt}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <marker id="tutorial-guide-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" />
          </marker>
        </defs>
        <rect className="tutorial-mini-diagram__field" x={MARGIN_X} y={MARGIN_Y} width={FIELD_WIDTH} height={FIELD_HEIGHT} rx="10" />
        <g className="tutorial-mini-diagram__grid" aria-hidden="true">
          {Array.from({ length: 27 }, (_, index) => (
            <line key={`x-${index}`} x1={MARGIN_X + index * FIELD_WIDTH / 26} y1={MARGIN_Y} x2={MARGIN_X + index * FIELD_WIDTH / 26} y2={MARGIN_Y + FIELD_HEIGHT} />
          ))}
          {Array.from({ length: 16 }, (_, index) => (
            <line key={`y-${index}`} x1={MARGIN_X} y1={MARGIN_Y + index * FIELD_HEIGHT / 15} x2={MARGIN_X + FIELD_WIDTH} y2={MARGIN_Y + index * FIELD_HEIGHT / 15} />
          ))}
        </g>
        <rect
          className={`tutorial-mini-diagram__end-zone tutorial-mini-diagram__end-zone--${state.activeTeam}`}
          x={endZoneX}
          y={MARGIN_Y}
          width={endZoneWidth}
          height={FIELD_HEIGHT}
        />
        <line className="tutorial-mini-diagram__halfway" x1={MARGIN_X + FIELD_WIDTH / 2} y1={MARGIN_Y} x2={MARGIN_X + FIELD_WIDTH / 2} y2={MARGIN_Y + FIELD_HEIGHT} />
        <g className="tutorial-mini-diagram__landmarks" aria-hidden="true">
          <text x={MARGIN_X + 5} y={MARGIN_Y + 14}>0</text>
          <text x={MARGIN_X + FIELD_WIDTH - 6} y={MARGIN_Y + 14} textAnchor="end">25</text>
          <text
            x={endZoneLabelX}
            y={MARGIN_Y + FIELD_HEIGHT / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${endZoneLabelX} ${MARGIN_Y + FIELD_HEIGHT / 2})`}
          >END ZONE</text>
        </g>

        {showTackleZones && state.pieces.filter(piece => piece.team !== state.activeTeam && !piece.down).map(piece => {
          const p = point(piece.position.col, piece.position.row);
          return <circle key={`tz-${piece.id}`} className="tutorial-mini-diagram__tackle-zone" cx={p.x} cy={p.y} r="23" />;
        })}

        {routeStart && routeEnd && (
          <path
            className="tutorial-mini-diagram__route"
            d={`M ${routeStart.x} ${routeStart.y} C ${routeStart.x + routeDirection * 70} ${routeStart.y - 24}, ${routeEnd.x - routeDirection * 45} ${routeEnd.y - 12}, ${routeEnd.x} ${routeEnd.y}`}
          />
        )}
        {routeStart && connectionEnd && (
          <line
            className="tutorial-mini-diagram__connection"
            x1={routeStart.x}
            y1={routeStart.y}
            x2={connectionEnd.x}
            y2={connectionEnd.y}
            markerEnd="url(#tutorial-guide-arrow)"
          />
        )}

        {state.pieces.map(piece => {
          const p = point(piece.position.col, piece.position.row);
          const isFocused = focusIds.has(piece.id);
          return (
            <g
              key={piece.id}
              className={`tutorial-mini-diagram__piece tutorial-mini-diagram__piece--${piece.team}${isFocused ? ' tutorial-mini-diagram__piece--focused' : ''}`}
              transform={`translate(${p.x} ${p.y})`}
            >
              <circle r={isFocused ? 16 : 11} />
              <text y="4" textAnchor="middle">{roleCode(piece.role)}</text>
              {piece.hasBall && <circle className="tutorial-mini-diagram__ball" cx="12" cy="-12" r="5" />}
            </g>
          );
        })}

        {state.ballPosition && (() => {
          const p = point(state.ballPosition.col, state.ballPosition.row);
          return <ellipse className="tutorial-mini-diagram__loose-ball" cx={p.x} cy={p.y} rx="7" ry="4" />;
        })()}
        {target && <circle className="tutorial-mini-diagram__target" cx={target.x} cy={target.y} r="14" />}

        {(hint.focus.kind === 'action' || hint.focus.kind === 'confirmation') && (
          <g className="tutorial-mini-diagram__control" transform="translate(345 166)">
            <rect width="145" height="42" rx="21" />
            {hint.focus.kind === 'confirmation' ? (
              <>
                <circle className="tutorial-mini-diagram__cancel" cx="26" cy="21" r="14" />
                <text x="26" y="26" textAnchor="middle">×</text>
                <circle className="tutorial-mini-diagram__confirm" cx="119" cy="21" r="14" />
                <text x="119" y="26" textAnchor="middle">✓</text>
              </>
            ) : (
              <text x="72" y="27" textAnchor="middle">{hint.focus.action ?? 'Choose action'}</text>
            )}
          </g>
        )}
        {hint.focus.kind === 'probability' && (
          <g className="tutorial-mini-diagram__probability" transform="translate(346 166)">
            <rect width="144" height="42" rx="8" />
            <text x="72" y="17" textAnchor="middle">SUCCESS CHANCE</text>
            <text x="72" y="34" textAnchor="middle">compare routes</text>
          </g>
        )}
      </svg>
      <figcaption>{hint.alt}</figcaption>
    </figure>
  );
}
