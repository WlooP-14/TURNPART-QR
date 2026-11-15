(function(root) {
  'use strict';
  function plan(entries) {
    const labels = [];
    for (const entry of entries) {
      if (!Number.isInteger(entry.copies) || entry.copies < 1 || entry.copies > 99) throw Error('Choose between 1 and 99 copies.');
      for (let i = 0; i < entry.copies; i++) labels.push(entry.job);
    }
    return {
      orientation: labels.length === 2 ? 'landscape' : 'portrait',
      pages: Array.from({ length: Math.ceil(labels.length / 4) }, (_, index) => labels.slice(index * 4, index * 4 + 4))
    };
  }
  root.MouldBatch = { plan };
  if (typeof module !== 'undefined') module.exports = { plan };
})(typeof window === 'undefined' ? globalThis : window);
