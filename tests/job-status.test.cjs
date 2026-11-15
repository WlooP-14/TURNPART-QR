const { test } = require('node:test');
const assert = require('node:assert/strict');
const Status = require('../dist/job-status.js');

test('completed list reads job names only from merged archive group headers', () => {
  const table = {
    cols: [{ label: 'SR NO.' }, { label: 'TURNING PART VENDORS CUSTOMER CODE' }],
    rows: [
      { c: [null, { v: '1407   FBMS   0826' }, null, { v: 'LOCATING RING' }] },
      { c: [null, null, null, { v: 'GUIDE PIN' }] },
      { c: [null, { v: '1392 FBMS 0826' }, null, { v: 'BUSH' }] }
    ]
  };
  assert.deepEqual(Status.parseArchive(table), ['1407 FBMS 0826', '1392 FBMS 0826']);
});

test('archive entries are Done, ongoing entries stay ongoing, and duplicate sources do not double-count', () => {
  const jobs = [{ id: '1423-TNRV-0926', code: '1423 TNRV 0926' }, { id: '1407-FBMS-0826', code: '1407 FBMS 0826' }];
  const combined = Status.combine(jobs, ['1407 FBMS 0826', '1392 FBMS 0826']);
  assert.equal(combined.length, 3);
  assert.equal(combined.find(job => job.id === '1423-TNRV-0926').done, false);
  assert.equal(combined.find(job => job.id === '1407-FBMS-0826').done, true);
  assert.equal(combined.filter(job => job.done).length, 2);
  assert(combined.every(job => !('parts' in job)));
});

test('changed archive columns, duplicate names, and corrupt saved lists are rejected', () => {
  assert.throws(() => Status.parseArchive({ cols: [{}, { label: 'Unexpected' }], rows: [] }));
  assert.throws(() => Status.codes(['1407 FBMS 0826', '1407  FBMS 0826']));
  for (const value of [null, {}, [null], ['']]) assert.throws(() => Status.codes(value));
  assert.deepEqual(Status.codes([]), []);
});
