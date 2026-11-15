import { describe, expect, it } from 'vitest';
import { humanBlocker, orcBlocker, makeState } from './test/gameState';
import { applyFoulAction, applyFoulTarget, foulTargetKeys, applyClick } from './useGameState';
import { summarizeActionLog } from './riskyMoves';
import { startRun, declareFoul, chooseFoulTarget, runSummary, toSubmissionTree } from './branchRun';

function board(overrides: Parameters<typeof orcBlocker>[0] = {}) {
  return {
    ...makeState([
      humanBlocker({ position: { col: 7, row: 10 } }),
      orcBlocker({ down: true, position: { col: 7, row: 9 }, ...overrides }),
    ]),
    objective: 'injure-by-foul' as const,
  };
}

describe('foul action', () => {
  it('requires a prone opposing player and consumes exactly one foul', () => {
    const standing = { ...board(), pieces: board().pieces.map(p => ({ ...p, down: false })) };
    expect(foulTargetKeys(standing, standing.pieces[0]).size).toBe(0);
    expect(applyFoulAction(standing, standing.pieces[0].id)).toBe(standing);

    const initial = board();
    const choosing = applyFoulAction(initial, 'human1');
    expect(choosing.isFoulTargeting).toBe(true);
    const nominated = applyFoulTarget(choosing, { col: 7, row: 9 });
    expect(nominated.pendingFoul).toBe(true);
    expect(nominated.foulTargetId).toBe('orc1');
    const done = applyFoulTarget(nominated, { col: 7, row: 9 });
    expect(done.phase).toBe('injure-by-foul');
    expect(done.foulUsed).toBe(true);
    expect(done.pieces.find(p => p.id === 'human1')?.activated).toBe(true);
    expect(done.actionLog.at(-1)?.kind).toBe('foul');
    expect(summarizeActionLog(done.actionLog).cumulativeProb).toBeGreaterThan(0);
    expect(applyFoulAction(done, 'human1')).toBe(done);
  });

  it('rejects illegal targets and does not allow an early end-activation click', () => {
    const initial = board();
    const choosing = applyFoulAction(initial, 'human1');
    expect(applyFoulTarget(choosing, { col: 0, row: 0 })).toBe(choosing);
    const nominated = applyFoulTarget(choosing, { col: 7, row: 9 });
    expect(applyClick(nominated, { col: 7, row: 10 })).toBe(nominated);
    expect(applyFoulTarget(nominated, { col: 0, row: 0 })).toBe(nominated);
  });

  it('keeps shared branch score and submission arithmetic consistent', () => {
    let run = startRun(board());
    run = declareFoul(run, 'human1');
    run = chooseFoulTarget(run, { col: 7, row: 9 });
    run = chooseFoulTarget(run, { col: 7, row: 9 });
    const result = runSummary(run);
    expect(result.score).toBeGreaterThan(0);
    expect(toSubmissionTree(run).outcome).toBe('scored');
    expect(toSubmissionTree(run).lineProb).toBeCloseTo(result.score);
  });

  it('assists increase foul injury odds and are tracked in its log', () => {
    const original = board();
    const assisted = {
      ...original,
      pieces: [...original.pieces, humanBlocker({
        id: 'helper', position: { col: 8, row: 9 }, name: 'Helper',
      })],
    };
    const resolve = (state: typeof original) => {
      const choice = applyFoulAction(state, 'human1');
      return applyFoulTarget(applyFoulTarget(choice, { col: 7, row: 9 }), { col: 7, row: 9 });
    };
    const unassisted = resolve(original);
    const withAssist = resolve(assisted);
    expect(withAssist.actionLog.at(-1)?.actionProb).toBeGreaterThan(unassisted.actionLog.at(-1)?.actionProb ?? 0);
    expect(withAssist.actionLog.at(-1)?.kind).toBe('foul');
  });
});
