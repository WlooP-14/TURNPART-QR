(function (root) {
  'use strict';
  function filename(jobs, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const date = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
    const numbers = [...new Set(jobs.map(job => String(job.name || job.code?.split(/\s+/)[0] || job.id?.split('-')[0] || 'mould').replace(/[^a-zA-Z0-9-]/g, '-')))];
    let name = 'Mould-QR', included = 0;
    for (const number of numbers) {
      if (name.length + number.length > 200) break;
      name += '_' + number; included++;
    }
    if (included < numbers.length) name += '_plus-' + (numbers.length - included);
    return name + '_' + date;
  }
  let originalTitle = null;
  function restore() {
    if (originalTitle !== null) { document.title = originalTitle; originalTitle = null; }
  }
  function print(jobs) {
    if (originalTitle === null) originalTitle = document.title;
    document.title = filename(jobs);
    try { window.print(); } catch (error) { restore(); throw error; }
  }
  if (typeof window !== 'undefined') window.addEventListener('afterprint', restore);
  root.MouldPrint = { filename, print };
  if (typeof module !== 'undefined') module.exports = { filename };
})(typeof window === 'undefined' ? globalThis : window);
