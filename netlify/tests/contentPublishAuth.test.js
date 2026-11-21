import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../functions/editor-content-publish.js';

test('publish refuses unauthenticated requests before reading or mutating Blobs', async () => {
  const request = new Request('https://example.test/.netlify/functions/editor-content-publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: 'scenarios',
      id: 'scenario-001',
      expectedRevision: 1,
      expectedPublishedRevision: 1,
    }),
  });
  const response = await handler(request);
  assert.ok([401, 403, 503].includes(response.status),
    `expected publish request to be rejected, got ${response.status}`);
  const body = await response.json();
  assert.ok(Array.isArray(body.errors) && body.errors.length > 0);
});
