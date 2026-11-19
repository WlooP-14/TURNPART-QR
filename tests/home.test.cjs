const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Model = require('../dist/model.js');

test('progress counts completed applicable work stages and excludes not-applicable stages', () => {
  assert.deepEqual(Model.progress({ parts: [
    { stages: ['DONE', 'IN PROCESS', 'NOT APPLICABLE'] },
    { stages: ['DONE', 'TO PLAN', 'DONE'] }
  ] }), { completed: 3, total: 5, percent: 60 });
  assert.equal(Model.progress({ parts: [{ stages: ['DONE', 'DONE', 'DONE'] }] }).percent, 100);
  assert.equal(Model.progress({ parts: [{ stages: ['TO PLAN', '', 'DELAY'] }] }).percent, 0);
  assert.equal(Model.progress({ parts: [] }).percent, 0);
  assert.equal(Model.progress({ parts: [{ stages: ['NOT APPLICABLE'], ready: 'YES' }] }).percent, 100);
  assert.equal(Model.progress({ parts: [{ stages: ['NOT APPLICABLE'], ready: 'NO' }] }).percent, 0);
});

test('unfinished work cannot round up to 100 percent', () => {
  const stages = Array(299).fill('DONE'); stages.push('IN PROCESS');
  assert.equal(Model.progress({ parts: [{ stages }] }).percent, 99);
});

function app(url = 'https://tracker.example/') {
  class Node {
    constructor() { this.children = []; this.events = {}; this.value = ''; this.hidden = false; this.textContent = ''; const set = new Set(); this.classList = { add: value => set.add(value), remove: value => set.delete(value), contains: value => set.has(value), toggle: (value, enabled) => enabled ? set.add(value) : set.delete(value) }; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    addEventListener(type, handler) { this.events[type] = handler; }
    setAttribute() {}
    get firstChild() { return this.children[0]; }
    querySelector(tag) { if (tag === 'button') return null; this.tags ||= {}; return this.tags[tag] ||= new Node(); }
    click() { this.events.click?.(); }
  }
  const nodes = new Map(), events = {}, animations = [];
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  get('statusFilter').value = 'all';
  const location = { href: url };
  const window = { addEventListener: (name, handler) => { events[name] = handler; }, scrollTo() {} };
  const sandbox = {
    MouldModel: Model, document: { getElementById: get, createElement: () => new Node(), head: new Node(), body: new Node() },
    window, location, URL, navigator: { onLine: true }, history: { pushState(_, __, next) { location.href = String(next); } },
    MouldSnapshot: { read: () => null }, MouldMotion: { enter(node) { animations.push(node); }, progress(node, value) { node.value = value; } }, localStorage: {}, setTimeout: () => 1, clearTimeout() {}, setInterval() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('../dist/app.js'), 'utf8'), sandbox);
  const jobs = [{ id: '1423-TNRV-0926', code: '1423 TNRV 0926', name: '1423', customer: 'TNRV', received: 'September 2026', parts: [] }];
  sandbox.fixtureJobs = jobs;
  const refresh = () => vm.runInContext('applyData(fixtureJobs, new Date())', sandbox);
  refresh();
  return { get, location, events, refresh, jobs, animations, document: sandbox.document };
}

test('the root opens the mould list, refresh stays home, and choosing a mould opens details', () => {
  const ui = app();
  assert.equal(ui.get('home').hidden, false); assert.equal(ui.get('workspace').hidden, true);
  assert.equal(ui.document.body.classList.contains('home-view'), true);
  ui.refresh(); assert.equal(ui.get('home').hidden, false);
  ui.get('homeJobs').children[0].click();
  assert.match(ui.location.href, /job=1423-TNRV-0926/);
  assert.equal(ui.get('workspace').hidden, false); assert.equal(ui.get('home').hidden, true);
  ui.refresh(); assert.equal(ui.get('workspace').hidden, false);
  ui.get('backToHome').click();
  assert.equal(new URL(ui.location.href).searchParams.has('job'), false);
  assert.equal(ui.get('home').hidden, false);
});

test('QR links open details directly and browser history returns to the overview', () => {
  const ui = app('https://tracker.example/?job=1423-TNRV-0926');
  assert.equal(ui.get('workspace').hidden, false); assert.equal(ui.get('home').hidden, true);
  ui.location.href = 'https://tracker.example/'; ui.events.popstate();
  assert.equal(ui.get('home').hidden, false); assert.equal(ui.get('workspace').hidden, true);
});

test('an unknown QR never silently opens another mould and provides a route home', () => {
  const ui = app('https://tracker.example/?job=missing');
  assert.equal(ui.get('home').hidden, true); assert.equal(ui.get('workspace').hidden, true);
  assert.equal(ui.get('loading').querySelector('h1').textContent, 'Mould not found');
  assert.equal(ui.get('backToHome').hidden, false);
  ui.get('backToHome').click(); assert.equal(ui.get('home').hidden, false);
});

test('directory shows percentages, closes on selection, and stays open during a sheet refresh', () => {
  const ui = app('https://tracker.example/?job=1423-TNRV-0926');
  ui.jobs.push({ id: '1403-BAEM-0826', code: '1403 BAEM 0826', name: '1403', customer: 'BAEM', parts: [
    { name: 'GUIDE PIN', stages: ['DONE', 'TO PLAN', 'NOT APPLICABLE'], vendors: ['', '', ''], ready: 'NO' }
  ] });
  ui.refresh();
  assert.equal(ui.get('mouldDropdown').open, false);
  const item = ui.get('jobs').children[1];
  assert.equal(item.children.at(-1).children[1].textContent, '50%');
  ui.get('mouldDropdown').open = true;
  item.click();
  assert.equal(ui.get('mouldDropdown').open, false);
  assert.equal(ui.get('selectedMouldLabel').textContent, '1403 BAEM 0826');
  assert.equal(ui.get('selectedMouldProgress').textContent, '50%');
  ui.get('mouldDropdown').open = true;
  ui.get('jobSearch').value = '1403';
  ui.refresh();
  assert.equal(ui.get('mouldDropdown').open, true);
  assert.equal(ui.get('jobs').children.length, 1);
});


test('automatic refreshes do not replay view transitions', () => {
  const ui = app();
  const initial = ui.animations.length;
  ui.refresh(); assert.equal(ui.animations.length, initial);
  ui.get('homeJobs').children[0].click();
  assert.equal(ui.animations.length, initial + 1);
  ui.refresh(); assert.equal(ui.animations.length, initial + 1);
  ui.get('backToHome').click(); assert.equal(ui.animations.length, initial + 2);
});
