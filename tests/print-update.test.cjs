const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { filename } = require('../dist/print.js');

test('PDF names include unique mould numbers and the Indian print date', () => {
  const date = new Date('2026-11-14T20:00:00Z');
  assert.equal(filename([{ name: '1423' }], date), 'Mould-QR_1423_2026-11-15');
  assert.equal(filename([{ name: '1423' }, { name: '1403' }, { name: '1423' }], date), 'Mould-QR_1423_1403_2026-11-15');
  assert.equal(filename([{ id: '1420-BAEM-0926' }], date), 'Mould-QR_1420_2026-11-15');
  assert(filename(Array.from({ length: 100 }, (_, i) => ({ name: String(1000 + i) })), date).length < 240);
  assert(!/[\\/:*?"<>|]/.test(filename([{ name: 'bad/name:*?' }], date)));
});

test('print title is set before opening the dialog and restored after printing or cancellation', () => {
  const events = {}, document = { title: 'Mould & Crate' }, seen = [];
  const window = { addEventListener: (name, fn) => { events[name] = fn; }, print: () => seen.push(document.title) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/print.js'), 'utf8'), { window, document });
  window.MouldPrint.print([{ name: '1423' }]);
  assert.match(seen[0], /^Mould-QR_1423_/); assert.equal(document.title, seen[0]);
  events.afterprint(); assert.equal(document.title, 'Mould & Crate');
  window.MouldPrint.print([{ name: '1403' }]); events.afterprint();
  assert.equal(document.title, 'Mould & Crate'); assert.match(seen[1], /^Mould-QR_1403_/);
  window.print = () => { throw Error('unavailable'); };
  assert.throws(() => window.MouldPrint.print([{ name: '1420' }]));
  assert.equal(document.title, 'Mould & Crate');
});

function updater({ controlled = true, waiting = true } = {}) {
  const elements = new Map(), windowEvents = {}, swEvents = {}, documentEvents = {}, sent = [], timers = [];
  let reloads = 0, checks = 0;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      hidden: false, open: false, disabled: false, textContent: '', events: {},
      addEventListener(name, fn) { this.events[name] = fn; },
      showModal() { this.open = true; },
      close() { this.open = false; this.events.close?.(); }
    });
    return elements.get(id);
  }
  const worker = { postMessage(message) { sent.push(message.type); } };
  const registration = { waiting: waiting ? worker : null, addEventListener() {}, async update() { checks++; } };
  const navigator = { onLine: true, serviceWorker: {
    controller: controlled ? {} : null, ready: Promise.resolve(),
    addEventListener(name, fn) { swEvents[name] = fn; }, async register() { return registration; }
  } };
  const document = { hidden: false, getElementById: element, body: { classList: { contains: () => false } }, addEventListener(name, fn) { documentEvents[name] = fn; } };
  const window = { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener(name, fn) { windowEvents[name] = fn; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/pwa.js'), 'utf8'), {
    window, document, navigator, location: { reload() { reloads++; } },
    setInterval: () => {}, setTimeout: fn => timers.push(fn)
  });
  return { element, windowEvents, documentEvents, swEvents, sent, timers, registration, worker, document, start: () => windowEvents.load(), reloads: () => reloads, checks: () => checks };
}

test('an available update opens a modal, Later leaves a reminder, and Update explicitly applies it', async () => {
  const ui = updater(); await ui.start();
  assert.equal(ui.element('updateDialog').open, true);
  assert.equal(ui.sent.length, 0);
  ui.element('updateLater').events.click();
  assert.equal(ui.element('updateDialog').open, false);
  assert.equal(ui.element('updateReminder').hidden, false);
  ui.element('reopenUpdate').events.click();
  assert.equal(ui.element('updateDialog').open, true);
  ui.element('updateApp').events.click();
  assert.deepEqual(ui.sent, ['ACTIVATE_UPDATE']); assert.equal(ui.element('updateApp').disabled, true);
  ui.swEvents.controllerchange(); assert.equal(ui.reloads(), 1);
});

test('first install does not show an update popup or reload the page', async () => {
  const ui = updater({ controlled: false }); await ui.start();
  assert.equal(ui.element('updateDialog').open, false);
  ui.swEvents.controllerchange(); assert.equal(ui.reloads(), 0);
});

test('hidden pages defer the popup until visible and a stalled update can be retried', async () => {
  const ui = updater(); ui.document.hidden = true; await ui.start();
  assert.equal(ui.element('updateDialog').open, false);
  ui.document.hidden = false; await ui.documentEvents.visibilitychange();
  assert.equal(ui.element('updateDialog').open, true); assert.equal(ui.checks(), 1);
  ui.element('updateApp').events.click(); ui.timers[0]();
  assert.equal(ui.element('updateApp').disabled, false);
  assert.equal(ui.element('updateApp').textContent, 'Try again');
});
