import test from 'node:test';
import assert from 'node:assert/strict';
import { parseExportSelection, filterExportItems } from './contentExportSelection.js';

const versions = { dirty: { scenarios: ['test-puzzle','private-draft'], series: ['hidden-series'] } };
const allowed = new Set(['scenarios/test-puzzle','scenarios/private-draft','series/hidden-series']);

test('explicit one-item selection cannot export unrelated unpublished drafts', () => {
  const selected = parseExportSelection([{kind:'scenarios',id:'test-puzzle',revision:3}],allowed);
  assert.deepEqual(filterExportItems(versions,selected),[{kind:'scenarios',id:'test-puzzle'}]);
});
test('empty, wildcard, duplicate, and unknown selections fail closed', () => {
  for(const items of [undefined,[],[{kind:'scenarios',id:'*',revision:1}],
    [{kind:'scenarios',id:'unknown',revision:1}],
    [{kind:'scenarios',id:'test-puzzle',revision:1},{kind:'scenarios',id:'test-puzzle',revision:1}]]) {
    assert.throws(()=>parseExportSelection(items,allowed),TypeError);
  }
});
test('selection needs explicit safe integer revision',()=>{
  assert.throws(()=>parseExportSelection([{kind:'series',id:'hidden-series'}],allowed));
  assert.throws(()=>parseExportSelection([{kind:'series',id:'hidden-series',revision:-1}],allowed));
});
test('multiple kinds include only selected items',()=>{
  const selected=parseExportSelection([{kind:'series',id:'hidden-series',revision:2},
    {kind:'scenarios',id:'test-puzzle',revision:1}],allowed);
  assert.deepEqual(filterExportItems(versions,selected),[
    {kind:'scenarios',id:'test-puzzle'}, {kind:'series',id:'hidden-series'}
  ]);
});
