const { test } = require('node:test');
const assert = require('node:assert/strict');
const { plan } = require('../dist/batch.js');

test('A4 batches never exceed four QR labels per page', () => {
  for (const count of [1, 2, 3, 4, 5, 6, 8, 9, 39, 99]) {
    const result = plan([{ job: { id: '1423-TNRV-0926' }, copies: count }]);
    assert.equal(result.pages.length, Math.ceil(count / 4));
    assert(result.pages.every(page => page.length <= 4));
    assert.equal(result.pages.flat().length, count);
    assert.equal(result.orientation, count === 2 ? 'landscape' : 'portrait');
  }
});
test('copies retain their mould IDs and selection order across page boundaries', () => {
  const first = { id: '1423-TNRV-0926' }, second = { id: '1403-BAEM-0826' };
  const result = plan([{ job: first, copies: 3 }, { job: second, copies: 3 }]);
  assert.deepEqual(result.pages, [[first, first, first, second], [second, second]]);
});
test('an empty selection has no printable pages and invalid copy quantities are rejected', () => {
  assert.deepEqual(plan([]).pages, []);
  for (const copies of [0, -1, 100, 1.5, NaN, '2']) assert.throws(() => plan([{ job: {}, copies }]));
});
