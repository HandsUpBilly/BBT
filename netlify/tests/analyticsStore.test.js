import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeAnalyticsBatch } from '../functions/analyticsStore.js';

function store() {
  let data;
  let etag;
  return {
    async getWithMetadata() { return { data, etag }; },
    async set(_key, next, conditions) {
      if (conditions.onlyIfNew && data) return { modified: false };
      data = next;
      etag = 'next';
      return { modified: true };
    },
    value() { return JSON.parse(data); },
  };
}

test('mergeAnalyticsBatch persists one idempotent session summary', async () => {
  const fake = store();
  const batch = {
    schemaVersion: 1,
    batchId: '33333333-3333-4333-8333-333333333333',
    sessionId: '22222222-2222-4222-8222-222222222222',
    sessionStartedAt: '2026-08-19T11:00:00.000Z',
    events: [{ type: 'interaction', at: '2026-08-19T11:00:00.000Z', data: { name: 'settings', outcome: 'opened' } }],
  };
  await mergeAnalyticsBatch(fake, batch);
  await mergeAnalyticsBatch(fake, batch);
  assert.equal(fake.value().interactions['settings:opened'], 1);
});
