(function (root) {
  'use strict';
  const KEY = 'mould-crate:1na81bDrcdb0SAaYOBLHKD-WGb1VvHUTbDImeoRl43Ug:Sheet5:v1';
  function save(storage, table, fetchedAt) {
    try {
      storage.setItem(KEY, JSON.stringify({ version: 1, fetchedAt: fetchedAt.toISOString(), table }));
      return true;
    } catch { return false; }
  }
  function read(storage, model) {
    try {
      const data = JSON.parse(storage.getItem(KEY));
      if (!data || data.version !== 1 || typeof data.fetchedAt !== 'string') return null;
      const fetchedAt = new Date(data.fetchedAt);
      if (!Number.isFinite(fetchedAt.getTime()) || fetchedAt.getTime() > Date.now() + 60000) return null;
      return { jobs: model.parse(data.table), fetchedAt };
    } catch { return null; }
  }
  function clear(storage) {
    try { storage.removeItem(KEY); return true; } catch { return false; }
  }
  const api = { KEY, save, read, clear };
  root.MouldSnapshot = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
