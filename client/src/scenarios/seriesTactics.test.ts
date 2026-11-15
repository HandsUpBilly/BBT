import { expect, test } from 'vitest';
import { blockBoardStates } from '../blockBranching';
import { blockCombinedProbability, fromKey } from '../bfs';
import type { GameState, Position, Scenario } from '../types';
import {
  applyBlockAction, applyBlockBoardState, applyBlockTarget, applyClick, applyHandoffAction,
  applyHandoffTarget, applyPushChoice, makeScenarioState,
} from '../useGameState';
import trollToll from '../series/troll-toll.json';
import bloodFeud from '../series/blood-feud.json';
import plans from '../test/seriesTacticsRoutes.json';
import { allScenarios } from './index';

const square = ([col, row]: number[]): Position => ({ col, row });
const walk = (state: GameState, route: number[][]): GameState =>
  route.reduce((board, step) => applyClick(board, square(step)), state);
const score = (state: GameState): number => state.actionLog.at(-1)?.cumulativeProb ?? 1;

function touchdown(scenario: Scenario, target: string, route: number[][] | number[][][]) {
  let state = makeScenarioState(scenario);
  const carrier = state.pieces.find(piece => piece.hasBall)!;
  if (target === 'run') return walk(applyClick(state, carrier.position), route as number[][]);
  const receiver = state.pieces.find(piece => piece.id === target)!;
  const [approach, finish] = route as number[][][];
  state = walk(applyHandoffAction(state, carrier.id), approach);
  state = applyClick(state, approach.length ? square(approach.at(-1)!) : carrier.position);
  state = applyHandoffTarget(state, receiver.position);
  return walk(applyClick(state, receiver.position), finish);
}

function surf(scenario: Scenario, plan: string, route: number[][]) {
  const [targetId, attackerId] = plan.split('/');
  let state = makeScenarioState(scenario);
  const target = state.pieces.find(piece => piece.id === targetId)!;
  const attacker = state.pieces.find(piece => piece.id === attackerId)!;
  const blitz = route.length > 0;
  state = applyBlockTarget(applyBlockAction(state, attackerId, blitz), target.position);
  if (blitz) state = applyBlockTarget(walk(state, route), target.position);
  const choice = state.blockChoice;
  if (!choice) return 0;
  const context = { attackerId, defenderId: targetId, isBlitz: blitz };
  const resolution = blockBoardStates(attacker.skills, target.skills);
  const faces = resolution.states.flatMap(outcome => {
    if (!outcome.defenderPushed) return [];
    const pushed = applyBlockBoardState(state, outcome, context);
    const off = [...pushed.pushTargetKeys].map(fromKey).find(point => point.col < 0 || point.col >= 15
      || point.row < 0 || point.row >= 26);
    return off && applyPushChoice(pushed, off, false).phase === 'crowd-surf' ? outcome.faces : [];
  });
  return score(state) * blockCombinedProbability(faces, choice.diceCount, choice.picker);
}

test('tactical routes cover every puzzle in Series 2 and 3', () => {
  const seriesIds = [...trollToll.scenarioIds, ...bloodFeud.scenarioIds];
  expect(Object.keys(plans).sort()).toEqual(seriesIds.sort());
});

for (const [id, candidates] of Object.entries(plans)) {
  test(`${id} offers two competitive ways to complete its objective`, () => {
    const scenario = allScenarios.find(item => item.id === id)!;
    const routes = candidates as [string, number[][] | number[][][]][];
    const [first, second] = routes.map(([plan, route]) => {
      if (scenario.objective === 'crowd-surf') return surf(scenario, plan, route as number[][]);
      const state = touchdown(scenario, plan, route);
      return state.phase === 'touchdown' ? score(state) : 0;
    });
    // Two receivers, a carry versus a transfer, or two different surf victims.
    expect(routes[0][0].split('/')[0]).not.toBe(routes[1][0].split('/')[0]);
    expect(Math.min(first, second)).toBeGreaterThan(0);
    expect(Math.min(first, second) / Math.max(first, second)).toBeGreaterThanOrEqual(0.75);
  });
}
