(function(root) {
  'use strict';
  const STORAGE_KEY = 'mould-crate:part-marks:v1';
  const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  function keys(job) {
    const seen = new Map(), result = new Map();
    for (const part of job.parts) {
      const signature = JSON.stringify([normalize(part.name), normalize(part.material), normalize(part.qty)]);
      const occurrence = seen.get(signature) || 0;
      seen.set(signature, occurrence + 1);
      result.set(part, JSON.stringify([job.id, signature, occurrence]));
    }
    return result;
  }
  function create(storage) {
    let marks = new Map();
    try {
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY));
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        marks = new Map(Object.entries(saved).filter(([, value]) => value === 'red' || value === 'green'));
      }
    } catch {}
    return {
      get(key) { return marks.get(key) || 'normal'; },
      cycle(key) {
        const next = { normal: 'red', red: 'green', green: 'normal' }[marks.get(key) || 'normal'];
        if (next === 'normal') marks.delete(key); else marks.set(key, next);
        try { storage?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(marks))); } catch {}
        return next;
      }
    };
  }
  const api = { STORAGE_KEY, keys, create };
  root.MouldMarks = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
