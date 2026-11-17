const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Model = require('../dist/model.js');
const Snapshot = require('../dist/snapshot.js');

function table() {
  const cols = Array.from({ length: 21 }, () => ({ label: '' }));
  cols[3].label = 'PART NAME'; cols[10].label = 'TURNING'; cols[15].label = 'READY TO ASSEMBLE';
  const row = values => ({ c: Array.from({ length: 21 }, (_, index) => values[index] === undefined ? null : { v: values[index] }) });
  return { cols, rows: [
    row({ 0: 1, 1: '1423  TNRV 0926', 2: '23/10/2026', 3: 'GUIDE PIN', 4: 4, 5: '8620', 6: true, 9: 'SAI', 10: 'IN PROCESS', 12: 'TO PLAN', 14: 'TO PLAN', 15: 'NO' }),
    row({ 3: 'BUSH', 4: 2, 10: 'DONE', 12: 'NOT APPLICABLE', 14: 'NOT APPLICABLE', 15: 'YES' }),
    row({ 0: 2, 1: '1403 BAEM 0826', 3: 'SPRUE BUSH', 4: 1, 10: 'DELAY', 15: 'NO' })
  ] };
}
function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}

test('merged job groups and full QR identifiers survive an offline round trip', () => {
  const cache = storage(), when = new Date('2026-01-02T03:04:05Z');
  assert.equal(Snapshot.save(cache, table(), when), true);
  const saved = Snapshot.read(cache, Model);
  assert.equal(saved.fetchedAt.toISOString(), when.toISOString());
  assert.equal(saved.jobs.length, 2);
  assert.equal(saved.jobs[0].id, '1423-TNRV-0926');
  assert.equal(saved.jobs[0].received, 'September 2026');
  assert.equal(saved.jobs[0].parts.length, 2);
  assert.equal(saved.jobs[1].parts[0].name, 'SPRUE BUSH');
  assert.equal(saved.jobs[0].parts[0].materialAcquired, true);
  assert.equal(saved.jobs[0].parts[0].vendors[0], 'SAI');
  assert(Model.isProcess(saved.jobs[0].parts[0]));
  assert(Model.isPlan(saved.jobs[0].parts[0]));
  assert(Model.isReady(saved.jobs[0].parts[1]));
  assert(Model.isDelayed(saved.jobs[1].parts[0]));
});

test('corrupt, future-dated, changed-column and duplicate-job snapshots are rejected', () => {
  const cache = storage();
  for (const invalid of ['bad json', 'null', '{"version":2}', JSON.stringify({ version: 1, fetchedAt: 'bad', table: table() })]) {
    cache.setItem(Snapshot.KEY, invalid); assert.equal(Snapshot.read(cache, Model), null);
  }
  Snapshot.save(cache, table(), new Date(Date.now() + 3600000));
  assert.equal(Snapshot.read(cache, Model), null);
  const changed = table(); changed.cols[10].label = 'UNEXPECTED';
  Snapshot.save(cache, changed, new Date()); assert.equal(Snapshot.read(cache, Model), null);
  const duplicate = table(); duplicate.rows.push(duplicate.rows[0]);
  Snapshot.save(cache, duplicate, new Date()); assert.equal(Snapshot.read(cache, Model), null);
});

test('storage denial is nonfatal and clear removes the saved copy', () => {
  const denied = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); }, removeItem() { throw Error('blocked'); } };
  assert.equal(Snapshot.save(denied, table(), new Date()), false);
  assert.equal(Snapshot.read(denied, Model), null);
  assert.equal(Snapshot.clear(denied), false);
  const cache = storage(); Snapshot.save(cache, table(), new Date());
  assert.equal(Snapshot.clear(cache), true); assert.equal(Snapshot.read(cache, Model), null);
});

function worker() {
  const handlers = {}, buckets = new Map(), network = [], deleted = [];
  let claimed = 0, skipped = 0;
  const caches = {
    async open(name) {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const bucket = buckets.get(name);
      return {
        async addAll(paths) { for (const path of paths) bucket.set(path, new Response(path === '/index.html' ? '<html>App shell</html>' : path)); },
        async match(path) { return bucket.get(path)?.clone(); }
      };
    },
    async keys() { return [...buckets.keys()]; },
    async delete(name) { deleted.push(name); return buckets.delete(name); }
  };
  const self = {
    location: { origin: 'https://tracker.example' },
    clients: { async claim() { claimed++; } },
    skipWaiting() { skipped++; },
    addEventListener(name, handler) { handlers[name] = handler; }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/sw.js'), 'utf8'), { self, caches, URL, fetch: async request => { network.push(request); throw Error('offline'); } });
  async function lifecycle(name) { let pending; handlers[name]({ waitUntil(promise) { pending = promise; } }); await pending; }
  async function fetchEvent(url, options = {}) {
    let response;
    handlers.fetch({ request: { url, method: 'GET', mode: 'cors', ...options }, respondWith(promise) { response = promise; } });
    return response ? await response : undefined;
  }
  return { handlers, buckets, network, deleted, lifecycle, fetchEvent, claimed: () => claimed, skipped: () => skipped };
}

test('offline QR navigations keep their query and receive the cached app shell', async () => {
  const sw = worker(); await sw.lifecycle('install');
  const response = await sw.fetchEvent('https://tracker.example/?job=1423-TNRV-0926', { mode: 'navigate' });
  assert.equal(await response.text(), '<html>App shell</html>');
  assert.equal(sw.network.length, 0);
  const script = await sw.fetchEvent('https://tracker.example/model.js');
  assert.equal(await script.text(), '/model.js');
});

test('sheet feeds and arbitrary requests are never handled by the offline shell cache', async () => {
  const sw = worker(); await sw.lifecycle('install');
  assert.equal(await sw.fetchEvent('https://docs.google.com/spreadsheets/d/example/gviz/tq'), undefined);
  assert.equal(await sw.fetchEvent('https://tracker.example/api/status'), undefined);
  assert.equal(await sw.fetchEvent('https://tracker.example/app.js', { method: 'POST' }), undefined);
});

test('updates activate only on request and remove only old tracker shell caches', async () => {
  const sw = worker(); await sw.lifecycle('install');
  assert.equal(sw.skipped(), 0);
  sw.buckets.set('mould-crate-shell-v1', new Map()); sw.buckets.set('unrelated-app-cache', new Map());
  await sw.lifecycle('activate');
  assert.deepEqual(sw.deleted, ['mould-crate-shell-v1']);
  assert(sw.buckets.has('unrelated-app-cache')); assert.equal(sw.claimed(), 1);
  sw.handlers.message({ data: { type: 'ACTIVATE_UPDATE' } }); assert.equal(sw.skipped(), 1);
});

test('manifest icons have real PNG dimensions including a separate maskable icon', () => {
  const manifest = JSON.parse(fs.readFileSync(require.resolve('../dist/manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) {
    const png = fs.readFileSync(require.resolve('../dist' + icon.src));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width); assert.equal(png.readUInt32BE(20), height);
  }
  assert(manifest.icons.some(icon => icon.purpose === 'maskable'));
});
