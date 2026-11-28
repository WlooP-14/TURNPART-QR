'use strict';
(() => {
  const modal = $('jobStatusDialog'), search = $('jobStatusSearch'), filter = $('jobStatusFilter');
  const cacheKey = 'mould-crate:1na81bDrcdb0SAaYOBLHKD-WGb1VvHUTbDImeoRl43Ug:JobDispatched:names:v1';
  let completed = [], archiveJobs = [], live = false, fetchedAt = null, known = false, busy = false, request = 0, error = '', lastAttempt = 0;
  function publish() { setArchiveState({ codes: completed, jobs:archiveJobs, live, fetchedAt, known, busy, error }); }
  function render() {
    const entries = MouldStatus.combine(jobs, completed);
    const query = search.value.toLowerCase(), selection = filter.value;
    const filtered = entries.filter(entry => entry.code.toLowerCase().includes(query) && (selection === 'all' || entry.done === (selection === 'done')));
    $('jobStatusList').replaceChildren();
    for (const entry of filtered) {
      const row = el('li', undefined, 'mould-status-row');
      row.append(el('span', entry.code), el('span', entry.done ? 'Done' : 'Ongoing', 'badge ' + (entry.done ? 'green' : 'grey')));
      $('jobStatusList').append(row);
    }
    if (!filtered.length) $('jobStatusList').append(el('li', !known && selection === 'done' ? (busy ? 'Loading completed moulds…' : 'Completed list unavailable.') : 'No matching moulds.', 'muted status-empty'));
    $('jobStatusCount').textContent = filtered.length + (filtered.length === 1 ? ' mould' : ' moulds');
  }
  function fail(message) {
    live=false;error = message; publish();
    $('jobStatusNotice').textContent = message + (fetchedAt ? ' Showing the saved list from ' + time(fetchedAt) + '.' : ' Please try again when connected.');
  }
  function refresh() {
    if (busy) return;
    if (navigator.onLine === false) { fail('You are offline.'); render(); return; }
    busy = true; error = ''; lastAttempt = Date.now(); publish(); $('refreshJobStatus').disabled = true;
    $('jobStatusNotice').textContent = fetchedAt ? 'Refreshing saved list from ' + time(fetchedAt) + '…' : 'Checking completed moulds…';
    render();
    const callback = 'mouldDispatchedResponse' + (++request), script = document.createElement('script');
    let done = false;
    const finish = () => { done = true; clearTimeout(timeout); script.remove(); delete window[callback]; busy = false; $('refreshJobStatus').disabled = false; };
    const failed = message => { if (done) return; finish(); fail(message); render(); };
    window[callback] = data => {
      if (done) return;
      try {
        if (data.status !== 'ok') throw Error('Could not load completed moulds.');
        const next = MouldStatus.parseArchive(data.table);
        const nextJobs=M.parse(data.table,{sheet:'JobDispatched',allowEmpty:true});
        completed = next;archiveJobs=nextJobs;live=true;fetchedAt = new Date(); known = true;
        try{MouldSnapshot.save(localStorage,data.table,fetchedAt,'JobDispatched');}catch{}
        try { localStorage.setItem(cacheKey, JSON.stringify({ codes: completed, fetchedAt: fetchedAt.toISOString() })); } catch {}
        finish(); publish(); $('jobStatusNotice').textContent = 'Updated ' + time(fetchedAt); render();
      } catch (error) { failed(error.message); }
    };
    script.onerror = () => failed('Could not refresh completed moulds.');
    const timeout = setTimeout(() => failed('The completed-mould sheet took too long to respond.'), 20000);
    script.src = 'https://docs.google.com/spreadsheets/d/1na81bDrcdb0SAaYOBLHKD-WGb1VvHUTbDImeoRl43Ug/gviz/tq?sheet=JobDispatched&headers=2&tqx=' + encodeURIComponent('out:json;responseHandler:' + callback) + '&_=' + Date.now();
    document.head.append(script);
  }
  try {
    const saved = JSON.parse(localStorage.getItem(cacheKey));
    const date = new Date(saved?.fetchedAt);
    if (saved && Number.isFinite(date.getTime()) && date.getTime() <= Date.now() + 60000) {
      completed = MouldStatus.codes(saved.codes); fetchedAt = date; known = true;
    }
  } catch {}
  try{
    const saved=MouldSnapshot.read(localStorage,M,'JobDispatched');
    if(saved){archiveJobs=saved.jobs;completed=archiveJobs.map(job=>job.code);fetchedAt=saved.fetchedAt;known=true;}
  }catch{}
  publish();refresh();
  function refreshSearch() {
    if (!document.hidden && navigator.onLine !== false && Date.now() - lastAttempt >= 15000) refresh();
    else if (navigator.onLine === false) fail('You are offline. Finished jobs may be out of date.');
  }
  $('homeSearch').addEventListener('input', refreshSearch);
  $('jobSearch').addEventListener('input', refreshSearch);
  $('homeRefresh').addEventListener('click', refresh);
  $('refresh').addEventListener('click', refresh);
  setInterval(refreshSearch, 15000);
  $('openJobStatus').addEventListener('click', () => {
    filter.value = 'done'; search.value = ''; render(); modal.showModal(); refresh();
  });
  $('closeJobStatus').addEventListener('click', () => modal.close());
  search.addEventListener('input', render); filter.addEventListener('change', render);
  $('refreshJobStatus').addEventListener('click', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('offline',()=>{live=false;publish();});
  // Keep the device-data clearing action consistent with the completed-name cache.
  $('clearSaved').addEventListener('click', () => { try { localStorage.removeItem(cacheKey); } catch {} });
})();
