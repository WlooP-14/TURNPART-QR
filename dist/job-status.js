(function(root) {
  'use strict';
  const normalize = value => String(value ?? '').trim().replace(/\s+/g, ' ');
  const id = value => normalize(value).toUpperCase().replace(/ /g, '-');
  function parseArchive(table) {
    const column = table?.cols?.findIndex(col => String(col.label).toUpperCase().includes('CUSTOMER CODE')) ?? -1;
    if (!Array.isArray(table?.rows) || column < 0) throw Error('The completed-mould sheet format has changed.');
    return codes(table.rows.map(row => row.c?.[column]?.f ?? row.c?.[column]?.v ?? '').filter(value => String(value).trim()));
  }
  function codes(values) {
    if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !normalize(value))) throw Error('Invalid completed mould list.');
    const normalized = values.map(normalize);
    if (new Set(normalized.map(id)).size !== normalized.length) throw Error('Duplicate completed mould identifier.');
    return normalized;
  }
  function combine(active, completed) {
    const list = new Map(active.map(job => [job.id, { id: job.id, code: job.code, done: false }]));
    for (const code of codes(completed)) list.set(id(code), { id: id(code), code, done: true });
    return [...list.values()];
  }
  const api = { parseArchive, codes, combine };
  root.MouldStatus = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
