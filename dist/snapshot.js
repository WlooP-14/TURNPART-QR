(function (root) {
  'use strict';
  const KEY = 'mould-crate:1na81bDrcdb0SAaYOBLHKD-WGb1VvHUTbDImeoRl43Ug:Sheet5:v1';
  const keyFor=sheet=>{if(!['Sheet5','JobDispatched'].includes(sheet))throw Error('Invalid source.');return KEY.replace(':Sheet5:',':'+sheet+':');};
  function save(storage, table, fetchedAt, sheet='Sheet5') {
    try {
      storage.setItem(keyFor(sheet), JSON.stringify({ version: 1, fetchedAt: fetchedAt.toISOString(), table }));
      return true;
    } catch { return false; }
  }
  function read(storage, model, sheet='Sheet5') {
    try {
      const data = JSON.parse(storage.getItem(keyFor(sheet)));
      if (!data || data.version !== 1 || typeof data.fetchedAt !== 'string') return null;
      const fetchedAt = new Date(data.fetchedAt);
      if (!Number.isFinite(fetchedAt.getTime()) || fetchedAt.getTime() > Date.now() + 60000) return null;
      return { jobs: model.parse(data.table,{sheet,allowEmpty:sheet==='JobDispatched'}), fetchedAt };
    } catch { return null; }
  }
  function clear(storage) {
    try { storage.removeItem(KEY);storage.removeItem(keyFor('JobDispatched'));return true; } catch { return false; }
  }
  const api = { KEY, save, read, clear };
  root.MouldSnapshot = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
