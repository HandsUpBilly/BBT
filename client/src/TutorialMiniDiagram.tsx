import type { GameState } from './types';
import type { TutorialHint } from './tutorialGuides';
import './TutorialMiniDiagram.css';

interface Props {
  state: GameState;
  hint: TutorialHint;
}

const WIDTH = 520;
const HEIGHT = 230;
const MARGIN_X = 22;
const MARGIN_Y = 20;
const FIELD_WIDTH = WIDTH - MARGIN_X * 2;
const FIELD_HEIGHT = HEIGHT - MARGIN_Y * 2;

function point(col: number, row: number): { x: number; y: number } {
  return {
    x: MARGIN_X + ((25 - row) / 25) * FIELD_WIDTH,
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

export function TutorialMiniDiagram({ state, hint }: Props) {
  const focusIds = new Set(hint.focus.pieceIds ?? []);
  const focused = state.pieces.filter(piece => focusIds.has(piece.id));
  const target = hint.focus.target ? point(hint.focus.target.col, hint.focus.target.row) : null;
  const routeStart = focused[0] ? point(focused[0].position.col, focused[0].position.row) : null;
  const showRoute = hint.focus.region === 'route' || hint.focus.region === 'end-zone' || target;
  const connectionEnd = hint.focus.region === 'receiver' && focused[1]
    ? point(focused[1].position.col, focused[1].position.row)
    : null;
  const showTackleZones = hint.focus.region === 'tackle-zones';

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
        <rect className="tutorial-mini-diagram__end-zone" x={MARGIN_X + FIELD_WIDTH - FIELD_WIDTH / 26} y={MARGIN_Y} width={FIELD_WIDTH / 26} height={FIELD_HEIGHT} />
        <line className="tutorial-mini-diagram__halfway" x1={MARGIN_X + FIELD_WIDTH / 2} y1={MARGIN_Y} x2={MARGIN_X + FIELD_WIDTH / 2} y2={MARGIN_Y + FIELD_HEIGHT} />
        <g className="tutorial-mini-diagram__landmarks" aria-hidden="true">
          <text x={MARGIN_X + 5} y={MARGIN_Y + 14}>25</text>
          <text x={MARGIN_X + FIELD_WIDTH - 6} y={MARGIN_Y + 14} textAnchor="end">0</text>
          <text
            x={MARGIN_X + FIELD_WIDTH - 7}
            y={MARGIN_Y + FIELD_HEIGHT / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${MARGIN_X + FIELD_WIDTH - 7} ${MARGIN_Y + FIELD_HEIGHT / 2})`}
          >END ZONE</text>
        </g>

        {showTackleZones && state.pieces.filter(piece => piece.team !== state.activeTeam && !piece.down).map(piece => {
          const p = point(piece.position.col, piece.position.row);
          return <circle key={`tz-${piece.id}`} className="tutorial-mini-diagram__tackle-zone" cx={p.x} cy={p.y} r="23" />;
        })}

        {showRoute && routeStart && (
          <path
            className="tutorial-mini-diagram__route"
            d={`M ${routeStart.x} ${routeStart.y} C ${routeStart.x + 70} ${routeStart.y - 24}, ${target?.x ?? WIDTH - 95} ${target?.y ?? routeStart.y - 12}, ${target?.x ?? WIDTH - 48} ${target?.y ?? routeStart.y}`}
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
        {hint.focus.kind === 'universes' && (
          <g className="tutorial-mini-diagram__universes" transform="translate(300 142)">
            <path d="M 0 34 C 26 34, 24 10, 48 10 M 0 34 L 48 34 M 0 34 C 26 34, 24 58, 48 58" />
            {[{ label: '1', y: -4 }, { label: '2', y: 20 }, { label: '3', y: 44 }].map((card, index) => (
              <g key={card.label} transform={`translate(48 ${card.y})`}>
                <rect className={index < 2 ? 'tutorial-mini-diagram__universe--done' : ''} width="120" height="28" rx="7" />
                <text x="14" y="19">{card.label}</text>
                <text x="36" y="19">{index < 2 ? 'COMPLETE' : 'PLAYING'}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
      <figcaption>{hint.alt}</figcaption>
    </figure>
  );
}
