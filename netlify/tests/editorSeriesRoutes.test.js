import test from 'node:test';
import assert from 'node:assert/strict';
import { isSeriesAssignmentPath } from '../functions/editor-series.js';

test('series assignment recognises canonical and Netlify-rewritten API URLs', () => {
  assert.equal(isSeriesAssignmentPath('/api/editor/series-assignment'), true);
  assert.equal(isSeriesAssignmentPath('/.netlify/functions/editor-series/assignment'), true);
  assert.equal(isSeriesAssignmentPath('/api/editor/series-assignment/'), true);
});

test('ordinary series routes cannot accidentally become assignment requests', () => {
  assert.equal(isSeriesAssignmentPath('/api/editor/series/troll-toll'), false);
  assert.equal(isSeriesAssignmentPath('/.netlify/functions/editor-series'), false);
});
