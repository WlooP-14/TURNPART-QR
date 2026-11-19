(function(root) {
  'use strict';
  const previous = new Map(), active = new WeakMap();
  const reduced = () => root.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  function enter(node) {
    if (!node || reduced() || typeof node.animate !== 'function') return;
    active.get(node)?.cancel();
    const animation = node.animate([
      { opacity: 0, transform: 'translateY(10px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { duration: 260, easing: 'cubic-bezier(.22,1,.36,1)' });
    active.set(node, animation);
  }
  function progress(node, value, key) {
    const target = Math.max(0, Math.min(100, value));
    const from = previous.get(key) ?? 0;
    previous.set(key, target);
    if (reduced() || from === target || typeof root.requestAnimationFrame !== 'function') { node.value = target; return; }
    node.value = from;
    let started;
    function frame(now) {
      if (node.isConnected === false || reduced()) { node.value = target; return; }
      started ??= now;
      const fraction = Math.min(1, (now - started) / 380);
      node.value = from + (target - from) * (1 - Math.pow(1 - fraction, 3));
      if (fraction < 1) root.requestAnimationFrame(frame);
    }
    root.requestAnimationFrame(frame);
  }
  const api = { enter, progress };
  root.MouldMotion = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
