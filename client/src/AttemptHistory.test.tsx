import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AttemptHistory } from './AttemptHistory';
import { recordAttempt } from './attemptStore';

/** jsdom here has no Storage API — see the note in attemptStore.test.ts. */
function installFakeStorage() {
  const data = new Map<string, string>();
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => { data.set(key, value); },
      removeItem: (key: string) => { data.delete(key); },
    },
  });
}

const originalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');

beforeEach(installFakeStorage);

afterEach(() => {
  // vitest runs without `globals`, so Testing Library's automatic cleanup never
  // registers and every render would otherwise stack up in the same document.
  cleanup();
  if (originalStorage) Object.defineProperty(window, 'localStorage', originalStorage);
  else Reflect.deleteProperty(window, 'localStorage');
});

function play(scenarioId: string, probability: number, diceCount = 2, at = '2026-08-01T10:00:00.000Z') {
  recordAttempt(scenarioId, { at, probability, diceCount });
}

describe('AttemptHistory', () => {
  it('explains itself rather than showing an empty table before the first run', () => {
    render(<AttemptHistory scenarioId="scn-001" />);

    expect(screen.getByText(/every run you finish/i)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('lists every run, newest first, and marks the best one', () => {
    play('scn-001', 0.4);
    play('scn-001', 0.9);
    play('scn-001', 0.2);

    render(<AttemptHistory scenarioId="scn-001" />);
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);

    expect(rows).toHaveLength(3);
    // Run 3 (20%) is the most recent, so it heads the table.
    expect(within(rows[0]).getByRole('rowheader').textContent).toBe('3');
    expect(rows[0].textContent).toContain('20%');
    // The 90% run is not the latest, and is still the one called best.
    expect(rows[1].className).toContain('attempts__row--best');
    expect(rows[1].textContent).toContain('best');
  });

  it('summarizes the trend against the best run, not the latest', () => {
    play('scn-001', 0.3);
    play('scn-001', 0.8);
    play('scn-001', 0.5);

    render(<AttemptHistory scenarioId="scn-001" />);

    expect(screen.getByText('Runs').nextElementSibling?.textContent).toBe('3');
    expect(screen.getByText('Best').nextElementSibling?.textContent).toBe('80%');
    expect(screen.getByText('Latest').nextElementSibling?.textContent).toBe('50%');
    expect(screen.getByText('Since first').nextElementSibling?.textContent).toBe('+50 pts');
  });

  it('offers no improvement figure from a single run', () => {
    play('scn-001', 0.5);
    render(<AttemptHistory scenarioId="scn-001" />);

    expect(screen.queryByText('Since first')).toBeNull();
  });

  it('describes the chart for anyone who cannot see it', () => {
    play('scn-001', 0.3);
    play('scn-001', 0.75);

    render(<AttemptHistory scenarioId="scn-001" />);

    expect(screen.getByRole('img').getAttribute('aria-label'))
      .toBe('Success probability across 2 runs, oldest to newest. First 30%, best 75%, latest 75%.');
  });

  it('plots one point per run and connects them', () => {
    play('scn-001', 0.3);
    play('scn-001', 0.75);
    play('scn-001', 0.6);

    const { container } = render(<AttemptHistory scenarioId="scn-001" />);

    expect(container.querySelectorAll('.attempts__chart-dot')).toHaveLength(3);
    expect(container.querySelector('.attempts__chart-line')).toBeTruthy();
    expect(container.querySelectorAll('.attempts__chart-dot--best')).toHaveLength(1);
  });

  it('draws a single run as a lone point with no line to nowhere', () => {
    play('scn-001', 0.5);

    const { container } = render(<AttemptHistory scenarioId="scn-001" />);

    expect(container.querySelectorAll('.attempts__chart-dot')).toHaveLength(1);
    expect(container.querySelector('.attempts__chart-line')).toBeNull();
  });

  it('shows only the requested puzzle', () => {
    play('scn-001', 0.4);
    play('scn-002', 0.9);

    render(<AttemptHistory scenarioId="scn-002" />);

    expect(screen.getByText('Runs').nextElementSibling?.textContent).toBe('1');
    expect(screen.getByText('Best').nextElementSibling?.textContent).toBe('90%');
  });

  it('confirms before clearing, and leaves the history alone on cancel', () => {
    play('scn-001', 0.4);
    render(<AttemptHistory scenarioId="scn-001" />);

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('table')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));

    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText(/every run you finish/i)).toBeTruthy();
  });
});
