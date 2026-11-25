const { test } = require('node:test');
const assert = require('node:assert/strict');
const Marks = require('../dist/part-marks.js');
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
test('each tap cycles normal, red, green, normal and persists without sheet access', () => {
  const local = storage(), marks = Marks.create(local);
  assert.equal(marks.get('part'), 'normal');
  assert.equal(marks.cycle('part'), 'red');
  assert.equal(Marks.create(local).get('part'), 'red');
  assert.equal(marks.cycle('part'), 'green');
  assert.equal(Marks.create(local).get('part'), 'green');
  assert.equal(marks.cycle('part'), 'normal');
  assert.equal(Marks.create(local).get('part'), 'normal');
});
test('keys distinguish jobs and repeated parts while surviving a new sheet snapshot', () => {
  const first = { name: 'GUIDE BUSH', material: '8620', qty: '4', ready: 'NO' };
  const job = { id: '1423-TNRV-0926', parts: [first, { ...first }] };
  const keys = [...Marks.keys(job).values()];
  assert.notEqual(keys[0], keys[1]);
  assert.notEqual(keys[0], [...Marks.keys({ ...job, id: '1403-BAEM-0826' }).values()][0]);
  const refreshed = { ...job, parts: job.parts.map(part => ({ ...part, ready: 'YES', stages: ['DONE'] })) };
  assert.deepEqual([...Marks.keys(refreshed).values()], keys);
  assert.equal(Marks.keys(job).get(first), keys[0]);
});
test('corrupt or blocked storage never prevents immediate tap cycling', () => {
  const denied = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const marks = Marks.create(denied);
  assert.equal(marks.cycle('part'), 'red'); assert.equal(marks.cycle('part'), 'green');
  const local = storage(); local.setItem(Marks.STORAGE_KEY, 'bad JSON');
  assert.equal(Marks.create(local).get('part'), 'normal');
  local.setItem(Marks.STORAGE_KEY, JSON.stringify({ part: 'blue', other: 'red' }));
  assert.equal(Marks.create(local).get('part'), 'normal');
  assert.equal(Marks.create(local).get('other'), 'red');
});
