const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function motion() {
  let reduce = false;
  const frames = [];
  const window = { matchMedia: () => ({ matches: reduce }), requestAnimationFrame: callback => frames.push(callback) };
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/motion.js'), 'utf8'), { window });
  return { api: window.MouldMotion, frames, reduce: value => { reduce = value; } };
}

test('progress eases toward the target and uses its previous value after refresh', () => {
  const m = motion(), first = { isConnected: true };
  m.api.progress(first, 60, 'home:1423');
  m.frames.shift()(0); m.frames.shift()(190);
  assert(first.value > 0 && first.value < 60);
  m.frames.shift()(380); assert.equal(first.value, 60);
  const unchanged = {};
  m.api.progress(unchanged, 60, 'home:1423');
  assert.equal(unchanged.value, 60); assert.equal(m.frames.length, 0);
  const changed = {};
  m.api.progress(changed, 70, 'home:1423');
  assert.equal(changed.value, 60);
  m.frames.shift()(0); m.frames.shift()(380); assert.equal(changed.value, 70);
});

test('reduced motion immediately displays accurate values and disables view animations', () => {
  const m = motion(); m.reduce(true);
  let animated = false;
  m.api.enter({ animate() { animated = true; } });
  const bar = {}; m.api.progress(bar, 75, 'reduced');
  assert.equal(animated, false); assert.equal(bar.value, 75); assert.equal(m.frames.length, 0);
  m.reduce(false); m.api.progress(bar, 90, 'reduced');
  m.reduce(true); m.frames.shift()(100);
  assert.equal(bar.value, 90); assert.equal(m.frames.length, 0);
});

test('rapid view changes cancel the old animation, and unsupported browsers remain usable', () => {
  const m = motion(); let cancellations = 0, starts = 0;
  const node = { animate() { starts++; return { cancel() { cancellations++; } }; } };
  m.api.enter(node); m.api.enter(node);
  assert.equal(starts, 2); assert.equal(cancellations, 1);
  assert.doesNotThrow(() => m.api.enter({}));
  const window = {};
  vm.runInNewContext(fs.readFileSync(require.resolve('../dist/motion.js'), 'utf8'), { window });
  const bar = {}; window.MouldMotion.progress(bar, 45, 'fallback');
  assert.equal(bar.value, 45);
});
