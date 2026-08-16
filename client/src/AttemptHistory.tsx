import { useCallback, useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import {
  clearAttempts,
  readAttempts,
  summarizeAttempts,
  type Attempt,
} from './attemptStore';
import './AttemptHistory.css';

interface Props {
  scenarioId: string;
}

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function when(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** Chart geometry, in the SVG's own units — it scales to whatever width it gets. */
const CHART = { width: 320, height: 96, padX: 4, padY: 8 };

function plot(attempts: Attempt[]): { x: number; y: number }[] {
  const { width, height, padX, padY } = CHART;
  const span = width - padX * 2;
  const rise = height - padY * 2;

  // A single run has no horizontal span to divide, and a lone point centred
  // reads better than one pinned to the left edge.
  return attempts.map((attempt, i) => ({
    x: attempts.length === 1 ? width / 2 : padX + (span * i) / (attempts.length - 1),
    // The axis is a fixed 0-100%, not fitted to the data. A run-to-run scale
    // would magnify a two-point wobble into a dramatic climb.
    y: padY + rise * (1 - attempt.probability),
  }));
}

/**
 * "Improvement over time" for one puzzle, from the local record of completed
 * runs — see attemptStore.ts for why this is not the leaderboard.
 *
 * The store is named attemptStore rather than attemptHistory because a module
 * differing from this file only by case does not survive a case-insensitive
 * filesystem: the import resolves back to this component and its exports come
 * out undefined.
 *
 * The chart is a plain inline SVG: five data points, no interaction, no
 * tooltips. A charting dependency would be several times the size of the whole
 * feature, and the table below it is the accessible version of the same data.
 */
export function AttemptHistory({ scenarioId }: Props) {
  // Read once, on mount. Runs are written on the game screen and this only
  // ever renders after leaving it, so there is nothing to re-read while it is
  // up — and an effect that setStates on every scenarioId change is both a
  // cascading render and against the hooks lint. Callers pass scenarioId as the
  // React key so a different puzzle is a different component instance.
  const [attempts, setAttempts] = useState<Attempt[]>(() => readAttempts(scenarioId));
  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleClear = useCallback(() => {
    clearAttempts(scenarioId);
    setAttempts([]);
    setConfirmingClear(false);
  }, [scenarioId]);

  const trend = summarizeAttempts(attempts);

  if (!trend) {
    return (
      <section className="attempts" aria-labelledby="attempts-title">
        <h3 className="attempts__title" id="attempts-title">Your attempts</h3>
        <p className="attempts__empty">
          Completed runs are recorded on this device. Use them to compare each play.
        </p>
      </section>
    );
  }

  const points = plot(attempts);
  const bestY = CHART.padY + (CHART.height - CHART.padY * 2) * (1 - trend.best.probability);
  // Newest first in the table — the run just played is the one being looked for.
  const rows = attempts.map((attempt, i) => ({ attempt, number: i + 1 })).reverse();

  return (
    <section className="attempts" aria-labelledby="attempts-title">
      <div className="attempts__header">
        <h3 className="attempts__title" id="attempts-title">Your attempts</h3>
        <button
          type="button"
          className="attempts__clear"
          onClick={() => setConfirmingClear(true)}
        >
          Clear
        </button>
      </div>

      <dl className="attempts__stats">
        <div className="attempts__stat">
          <dt>Runs</dt>
          <dd>{trend.count}</dd>
        </div>
        <div className="attempts__stat">
          <dt>Best</dt>
          <dd className="attempts__stat-value--best">{pct(trend.best.probability)}</dd>
        </div>
        <div className="attempts__stat">
          <dt>Latest</dt>
          <dd>{pct(trend.latest.probability)}</dd>
        </div>
        {trend.gainPoints !== null && (
          <div className="attempts__stat">
            <dt>Since first</dt>
            <dd className={trend.gainPoints > 0 ? 'attempts__stat-value--gain' : undefined}>
              {trend.gainPoints > 0 ? '+' : ''}{Math.round(trend.gainPoints)} pts
            </dd>
          </div>
        )}
      </dl>

      <svg
        className="attempts__chart"
        viewBox={`0 0 ${CHART.width} ${CHART.height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={
          `Success probability across ${trend.count} `
          + `${trend.count === 1 ? 'run' : 'runs'}, oldest to newest. `
          + `First ${pct(trend.first.probability)}, best ${pct(trend.best.probability)}, `
          + `latest ${pct(trend.latest.probability)}.`
        }
      >
        <line
          className="attempts__chart-best"
          x1={0} x2={CHART.width} y1={bestY} y2={bestY}
        />
        {points.length > 1 && (
          <polyline
            className="attempts__chart-line"
            points={points.map(p => `${p.x},${p.y}`).join(' ')}
          />
        )}
        {points.map((point, i) => (
          <circle
            key={attempts[i].at + i}
            className={
              attempts[i] === trend.best
                ? 'attempts__chart-dot attempts__chart-dot--best'
                : 'attempts__chart-dot'
            }
            cx={point.x}
            cy={point.y}
            r={3}
          />
        ))}
      </svg>

      <table className="attempts__table">
        <caption className="attempts__caption">
          LOCAL ONLY: This record does not follow your account to another device.
        </caption>
        <thead>
          <tr>
            <th scope="col">Run</th>
            <th scope="col">Probability</th>
            <th scope="col">Dice rolls</th>
            <th scope="col">When</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ attempt, number }) => (
            <tr
              key={attempt.at + number}
              className={attempt === trend.best ? 'attempts__row--best' : undefined}
            >
              <th scope="row" className="attempts__run">{number}</th>
              <td className="attempts__prob">
                {pct(attempt.probability)}
                {attempt === trend.best && (
                  <span className="attempts__badge"> best</span>
                )}
              </td>
              <td className="attempts__dice">{attempt.diceCount}</td>
              <td className="attempts__when">{when(attempt.at)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {confirmingClear && (
        <ConfirmDialog
          title="Clear your attempt history?"
          message={
            `This forgets all ${trend.count} recorded `
            + `${trend.count === 1 ? 'run' : 'runs'} at this puzzle on this device. `
            + 'Scores already on the leaderboard are not affected.'
          }
          confirmLabel="Clear history"
          destructive
          onConfirm={handleClear}
          onCancel={() => setConfirmingClear(false)}
        />
      )}
    </section>
  );
}
