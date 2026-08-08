import assert from 'node:assert/strict';
import test from 'node:test';
import { readEntries, updateEntries } from '../functions/blobEntries.js';

/**
 * A minimal fake of the @netlify/blobs store surface updateEntries/readEntries
 * actually use, so these tests exercise the etag retry loop without any
 * network or Netlify credentials.
 */
function makeFakeStore({ data, etag } = {}) {
  let state = { data, etag };
  const setCalls = [];

  return {
    async getWithMetadata() {
      return { data: state.data, etag: state.etag };
    },
    /** Queues a scripted result/behavior for the next N `set` calls. */
    _script(results) {
      this._results = [...results];
    },
    async set(key, value, conditions) {
      setCalls.push({ value, conditions });
      const scripted = this._results?.shift();
      if (scripted?.throw) throw scripted.throw;
      if (scripted?.modified === false) return { modified: false };
      state = { data: value, etag: scripted?.nextEtag ?? `etag-${setCalls.length}` };
      return { modified: true };
    },
    get setCalls() {
      return setCalls;
    },
  };
}

test('readEntries returns an empty list when the key has never been written', async () => {
  const store = makeFakeStore({ data: undefined, etag: undefined });
  assert.deepEqual(await readEntries(store, 'k'), { entries: [], etag: undefined });
});

test('readEntries treats corrupt JSON as empty rather than failing the request', async () => {
  const store = makeFakeStore({ data: 'not-json{', etag: 'e1' });
  assert.deepEqual(await readEntries(store, 'k'), { entries: [], etag: undefined });
});

test('readEntries treats a non-array payload as empty but keeps the etag', async () => {
  const store = makeFakeStore({ data: JSON.stringify({ oops: true }), etag: 'e1' });
  assert.deepEqual(await readEntries(store, 'k'), { entries: [], etag: 'e1' });
});

test('readEntries parses a stored array and returns its etag', async () => {
  const entries = [{ id: 'a' }, { id: 'b' }];
  const store = makeFakeStore({ data: JSON.stringify(entries), etag: 'e1' });
  assert.deepEqual(await readEntries(store, 'k'), { entries, etag: 'e1' });
});

test('updateEntries writes onlyIfNew on a key that has never been written', async () => {
  const store = makeFakeStore({ data: undefined, etag: undefined });
  const result = await updateEntries(store, 'k', entries => [...entries, { id: 'a' }]);

  assert.deepEqual(result, [{ id: 'a' }]);
  assert.equal(store.setCalls.length, 1);
  assert.deepEqual(store.setCalls[0].conditions, { onlyIfNew: true });
});

test('updateEntries writes onlyIfMatch against the read etag when one exists', async () => {
  const store = makeFakeStore({ data: JSON.stringify([{ id: 'a' }]), etag: 'e1' });
  const result = await updateEntries(store, 'k', entries => [...entries, { id: 'b' }]);

  assert.deepEqual(result, [{ id: 'a' }, { id: 'b' }]);
  assert.deepEqual(store.setCalls[0].conditions, { onlyIfMatch: 'e1' });
});

test('updateEntries retries on a conflicting precondition and re-reads before mutating again', async () => {
  const store = makeFakeStore({ data: JSON.stringify([{ id: 'a' }]), etag: 'e1' });
  // First write loses the precondition race; by the time the retry re-reads,
  // a concurrent writer has already landed entry 'c'.
  store._script([
    { modified: false },
  ]);
  let reads = 0;
  const originalGet = store.getWithMetadata.bind(store);
  store.getWithMetadata = async () => {
    reads += 1;
    if (reads === 2) return { data: JSON.stringify([{ id: 'a' }, { id: 'c' }]), etag: 'e2' };
    return originalGet();
  };

  const result = await updateEntries(store, 'k', entries => [...entries, { id: 'b' }]);

  assert.deepEqual(result, [{ id: 'a' }, { id: 'c' }, { id: 'b' }]);
  assert.equal(store.setCalls.length, 2);
  assert.deepEqual(store.setCalls[0].conditions, { onlyIfMatch: 'e1' });
  assert.deepEqual(store.setCalls[1].conditions, { onlyIfMatch: 'e2' });
});

test('updateEntries writes unconditionally on the final attempt so it always converges', async () => {
  const store = makeFakeStore({ data: JSON.stringify([{ id: 'a' }]), etag: 'e1' });
  // Every attempt reports a losing precondition — a store whose etag can never
  // be read successfully must still not reject the submission forever.
  store._script([
    { modified: false },
    { modified: false },
    { modified: false },
    { modified: false },
  ]);

  const result = await updateEntries(store, 'k', entries => [...entries, { id: 'b' }]);

  assert.deepEqual(result, [{ id: 'a' }, { id: 'b' }]);
  assert.equal(store.setCalls.length, 4);
  // Every attempt but the last used a precondition; the last did not.
  assert.deepEqual(store.setCalls[0].conditions, { onlyIfMatch: 'e1' });
  assert.deepEqual(store.setCalls[3].conditions, {});
});

test('updateEntries surfaces the last error if even the final attempt throws', async () => {
  const store = makeFakeStore({ data: undefined, etag: undefined });
  const failure = new Error('store unavailable');
  store._script([
    { throw: failure },
    { throw: failure },
    { throw: failure },
    { throw: failure },
  ]);

  await assert.rejects(
    () => updateEntries(store, 'k', entries => [...entries, { id: 'a' }]),
    failure,
  );
});
