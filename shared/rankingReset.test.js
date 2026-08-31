import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RankingResetValidationError,
  parseRankingResetTarget,
} from './rankingReset.js';

test('accepts complete, series, and puzzle ranking reset targets', () => {
  assert.deepEqual(parseRankingResetTarget('all'), { scope: 'all' });
  assert.deepEqual(parseRankingResetTarget('series', 'default'), { scope: 'series', id: 'default' });
  assert.deepEqual(parseRankingResetTarget('puzzle', 'scenario-006'), { scope: 'puzzle', id: 'scenario-006' });
});

test('rejects unknown scopes and unsafe ids', () => {
  assert.throws(() => parseRankingResetTarget('players', 'default'), RankingResetValidationError);
  assert.throws(() => parseRankingResetTarget('puzzle', '../scores'), RankingResetValidationError);
  assert.throws(() => parseRankingResetTarget('series', ''), RankingResetValidationError);
});
