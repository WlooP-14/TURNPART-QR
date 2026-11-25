(function(root) {
  'use strict';
  const STORAGE_KEY = 'mould-crate:part-marks:v2';
  const LEGACY_KEY = 'mould-crate:part-marks:v1';
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
      const saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? storage?.getItem(LEGACY_KEY));
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        marks = new Map(Object.entries(saved).filter(([, value]) => value === 'red' || value === 'green' || (value && ['normal','red','green'].includes(value.colour) && typeof value.ready === 'boolean')));
      }
    } catch {}
    function persist() {
      try { storage?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(marks))); } catch {}
    }
    function get(key, ready = true) {
      let mark = marks.get(key);
      if (typeof mark === 'string') {
        mark = { colour: mark, ready }; marks.set(key, mark); persist();
      }
      if (mark && mark.ready !== ready) {
        marks.delete(key); persist(); mark = null;
      }
      return mark?.colour || (ready ? 'normal' : 'red');
    }
    return {
      get,
      cycle(key, ready = true) {
        const next = { normal: 'red', red: 'green', green: 'normal' }[get(key, ready)];
        marks.set(key, { colour: next, ready });
        persist();
        return next;
      }
    };
  }
  const api = { STORAGE_KEY, keys, create };
  root.MouldMarks = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
