'use strict';
const M=MouldModel,$=id=>document.getElementById(id);
let jobs=[],selected=null,fetched=null,activeScript=null,timer=null,request=0,busy=false;
let archiveState={codes:[],known:false,busy:false,error:'',fetchedAt:null};
let partMarks;
try{partMarks=MouldMarks.create(localStorage);}catch{partMarks=MouldMarks.create(null);}
const time=d=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)+' IST';
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function notice(text,error=false){$('notice').replaceChildren();if(text)$('notice').append(el('p',text,error?'notice error':'notice'));}
function badge(value){const s=M.stage(value);let cls='grey';if(s==='IN PROCESS')cls='yellow';else if(s==='DONE'||s==='YES')cls='green';else if(s==='NOT APPLICABLE')cls='blue';else if(['NO','DELAY','DELAYED'].includes(s))cls='red';else if(s&&s!=='TO PLAN')cls='neutral';return el('span',value||'—','badge '+cls);}
function archiveMessage() {
  if (archiveState.busy) return 'Checking finished jobs…';
  if (archiveState.error) return archiveState.error + (archiveState.fetchedAt ? ' Saved list from ' + time(archiveState.fetchedAt) + '.' : '');
  return '';
}
function setArchiveState(state) {
  archiveState = state;
  drawDirectory();
  if (!$('home').hidden) drawHome();
}
function finishedLabel(job, className) {
  const row = el('article', undefined, className + ' finished-job');
  const identity = el('span', undefined, 'home-job-identity');
  identity.append(el('strong', 'Job ' + job.name), el('span', job.code));
  row.append(identity, el('span', 'Job finished', 'badge green finished-description'));
  return row;
}
function drawDirectory() {
  const query = $('jobSearch').value, list = $('jobs');
  const visible = M.searchJobs(jobs, archiveState.codes, query);
  list.replaceChildren();
  $('jobCount').textContent = M.searchJobs(jobs, archiveState.codes, '').length;
  $('directoryArchiveNotice').textContent = query.trim() ? archiveMessage() : '';
  for (const job of visible) {
    if (job.finished) { list.append(finishedLabel(job, 'job-item')); continue; }
    const button = el('button', undefined, 'job-item' + (job.id === selected?.id ? ' selected' : ''));
    button.setAttribute('aria-pressed', String(job.id === selected?.id));
    const top = el('span', undefined, 'job-item-top');
    top.append(el('strong', 'Job ' + job.name), el('small', job.customer));
    button.append(top, el('span', job.code, 'job-code'), el('small', job.parts.length + ' parts · ' + job.received), el('small', 'B.O.M. date: ' + (job.bom || '—'), 'bom-date'));
    const progress = M.progress(job), work = el('span', undefined, 'directory-progress'), meter = el('progress');
    meter.max = 100; MouldMotion.progress(meter, progress.percent, 'directory:' + job.id);
    meter.setAttribute('aria-label', 'Work completed for ' + job.code);
    work.append(meter, el('strong', progress.percent + '%')); button.append(work);
    button.addEventListener('click', () => selectJob(job, true)); list.append(button);
  }
  if (!visible.length) list.append(el('p', 'No matching moulds.', 'muted'));
}
function selectJob(j,push=false){const animateView=selected?.id!==j.id||$('workspace').hidden;if(push||selected?.id!==j.id)$('mouldDropdown').open=false;$('selectedMouldLabel').textContent=j.code;$('selectedMouldProgress').textContent=M.progress(j).percent+'%';document.body.classList.remove('home-view');$('home').hidden=true;$('backToHome').hidden=false;selected=j;if(push){const u=new URL(location.href);u.searchParams.set('job',j.id);history.pushState({},'',u);window.scrollTo({top:0,behavior:'auto'});$('partSearch').value='';$('statusFilter').value='all';}drawDirectory();$('loading').hidden=true;$('workspace').hidden=false;$('jobTitle').textContent='Job '+j.name;$('jobSerial').textContent=j.code;$('jobMeta').textContent='Customer '+j.customer+'  ·  Received '+j.received+'  ·  B.O.M. date: '+(j.bom||'—')+'  ·  Trial (T0) '+(j.trial||'—');$('totalParts').textContent=j.parts.length;$('inProcess').textContent=j.parts.filter(M.isProcess).length;$('toPlan').textContent=j.parts.filter(M.isPlan).length;const ready=j.parts.filter(M.isReady).length;$('readyCount').textContent=ready+' / '+j.parts.length;$('readyText').textContent=ready===j.parts.length?'All part entries marked ready':(j.parts.length-ready)+' still to be marked ready';drawParts();if(animateView)MouldMotion.enter($('workspace'));}
function drawHome() {
  const query = $('homeSearch').value, list = $('homeJobs');
  const visible = M.searchJobs(jobs, archiveState.codes, query);
  list.replaceChildren();
  $('homeCount').textContent = (query.trim() ? visible.length + ' matching moulds' : visible.length + ' moulds');
  $('homeArchiveNotice').textContent = query.trim() ? archiveMessage() : '';
  for (const job of visible) {
    if (job.finished) { list.append(finishedLabel(job, 'home-job')); continue; }
    const progress = M.progress(job);
    const row = el('button', undefined, 'home-job');
    const identity = el('span', undefined, 'home-job-identity');
    identity.append(el('strong', 'Job ' + job.name), el('span', job.code), el('small', job.parts.length + ' part entries'), el('small', 'B.O.M. date: ' + (job.bom || '—'), 'bom-date'));
    const work = el('span', undefined, 'home-job-work');
    const meter = el('progress'); meter.max = 100; MouldMotion.progress(meter, progress.percent, 'home:' + job.id);
    meter.setAttribute('aria-label', 'Work completed for ' + job.code);
    work.append(el('strong', progress.percent + '%'), meter);
    row.append(identity, work, el('span', '→', 'home-job-arrow'));
    row.addEventListener('click', () => selectJob(job, true));
    list.append(row);
  }
  if (!visible.length) list.append(el('p', 'No matching moulds.', 'muted home-empty'));
}
function showHome(push = false) {
  const animateView = $('home').hidden;
  if (push) { const url = new URL(location.href); url.searchParams.delete('job'); history.pushState({}, '', url); window.scrollTo({top:0,behavior:'auto'}); }
  selected = null;
  document.body.classList.add('home-view');
  $('workspace').hidden = true; $('home').hidden = !jobs.length; $('loading').hidden = !!jobs.length;
  $('backToHome').hidden = true;
  drawDirectory(); drawHome();
  if (animateView) MouldMotion.enter($('home'));
}
function renderRoute() {
  const wanted = new URL(location.href).searchParams.get('job');
  if (!wanted) { showHome(); return; }
  const job = jobs.find(job => job.id === M.key(wanted));
  if (job) { selectJob(job); return; }
  selected = null;
  document.body.classList.add('home-view');
  $('workspace').hidden = true; $('home').hidden = true; $('loading').hidden = false;
  $('backToHome').hidden = false;
  $('loading').querySelector('h1').textContent = 'Mould not found';
  $('loading').querySelector('p').textContent = 'This QR identifier is not in the available records. Return to all moulds to choose another job.';
  drawDirectory();
}
function setRefreshBusy(value) {
  for (const id of ['refresh', 'homeRefresh']) { $(id).disabled = value; $(id).textContent = value ? 'Refreshing…' : '↻ Refresh'; }
}
function drawParts(){if(!selected)return;const markKeys=MouldMarks.keys(selected);const q=$('partSearch').value.toLowerCase(),filter=$('statusFilter').value,pred={all:()=>true,process:M.isProcess,plan:M.isPlan,delay:M.isDelayed,ready:M.isReady}[filter];const rows=selected.parts.filter(p=>(p.name+' '+p.material+' '+p.vendors.join(' ')).toLowerCase().includes(q)&&pred(p));const body=$('parts');body.replaceChildren();for(const p of rows){const row=el('tr');const nameCell=el('th',undefined,'part-col manual-part');nameCell.scope='row';const nameButton=el('button',p.name,'part-name-button');nameButton.type='button';const markKey=markKeys.get(p);const applyMark=colour=>{nameCell.className='part-col manual-part'+(colour==='normal'?'':' part-mark-'+colour);nameButton.setAttribute('aria-label',p.name+'. Colour: '+colour+'. Change colour.');};applyMark(partMarks.get(markKey,M.isReady(p)));nameButton.addEventListener('click',()=>applyMark(partMarks.cycle(markKey,M.isReady(p))));nameCell.append(nameButton);row.append(nameCell);row.append(el('td',p.qty||'—','qty'),el('td',p.material||'—'));const acquiredCell=el('td');const tick=el('span',p.materialAcquired?'✓':'—',p.materialAcquired?'material-acquired ready':'material-acquired');tick.setAttribute('aria-label',p.materialAcquired?'Material acquired':'Material not acquired');acquiredCell.append(tick);row.append(acquiredCell);for(let i=0;i<3;i++){row.append(el('td',p.vendors[i]||'—','vendor'));const c=el('td');c.append(badge(p.stages[i]));row.append(c);}const r=el('td');r.append(badge(p.ready));row.append(r,el('td',p.dispatch||'—'),el('td',p.due||'—'));body.append(row);}if(!rows.length){const row=el('tr'),c=el('td','No parts match these filters.','empty');c.colSpan=13;row.append(c);body.append(row);}$('visibleCount').textContent=rows.length+' of '+selected.parts.length+' parts';}
function fail(message){busy=false;setRefreshBusy(false);$('syncDot').classList.add('offline');$('syncText').textContent=fetched?'Last fetched '+time(fetched)+' · stale':'Sheet unavailable';$('homeSyncText').textContent=$('syncText').textContent;notice(message+(fetched?' Showing previously fetched data; statuses may have changed.':''),true);if(!jobs.length){$('loading').hidden=false;$('loading').querySelector('h1').textContent='Unable to load the sheet';$('loading').querySelector('p').textContent='Use Refresh to try again. The source sheet must remain readable to the tracker.';const btn=el('button','Retry connection','primary');btn.addEventListener('click',load);if(!$('loading').querySelector('button'))$('loading').append(btn);}}
function applyData(nextJobs, when, saved = false) {
  jobs = nextJobs;
  fetched = when;
  $('syncText').textContent = (saved ? 'Saved copy · ' : 'Fetched ') + time(fetched);
  $('syncDot').classList.toggle('offline', saved);
  $('homeSyncText').textContent = $('syncText').textContent;
  renderRoute();
}
function load() {
  if (busy) return;
  if (navigator.onLine === false) {
    fail('You are offline. Connect to the internet for current statuses.');
    return;
  }
  busy = true;
  setRefreshBusy(true);
  const callback = 'mouldSheetResponse' + (++request);
  if (activeScript) activeScript.remove();
  let done = false;
  const cleanup = () => {
    clearTimeout(timer);
    if (activeScript) activeScript.remove();
    delete window[callback];
  };
  window[callback] = data => {
    if (done) return;
    done = true;
    cleanup();
    try {
      if (data.status !== 'ok') throw Error('Google Sheets could not return the records.');
      const nextJobs = M.parse(data.table), when = new Date();
      applyData(nextJobs, when);
      let saved = false;
      try { saved = MouldSnapshot.save(localStorage, data.table, when); } catch {}
      notice(saved ? '' : 'Live data loaded. Saving for offline use is unavailable on this device.');
      busy = false;
      setRefreshBusy(false);
    } catch (error) { fail(error.message); }
  };
  activeScript = document.createElement('script');
  activeScript.src = 'https://docs.google.com/spreadsheets/d/1na81bDrcdb0SAaYOBLHKD-WGb1VvHUTbDImeoRl43Ug/gviz/tq?sheet=Sheet5&headers=2&tqx=' + encodeURIComponent('out:json;responseHandler:' + callback) + '&_=' + Date.now();
  activeScript.onerror = () => {
    if (done) return;
    done = true;
    cleanup();
    fail('Could not reach Google Sheets. Please check the connection and sheet access.');
  };
  timer = setTimeout(() => {
    if (done) return;
    done = true;
    cleanup();
    fail('Google Sheets took too long to respond. Please try Refresh.');
  }, 20000);
  document.head.append(activeScript);
}
function mouldUrl(){const u=new URL(location.href);u.search='';u.hash='';u.searchParams.set('job',selected.id);return u.href;}
$('jobSearch').addEventListener('input',drawDirectory);$('partSearch').addEventListener('input',()=>{drawParts();MouldMotion.enter($('parts'));});$('statusFilter').addEventListener('change',()=>{drawParts();MouldMotion.enter($('parts'));});$('refresh').addEventListener('click',load);
$('qrButton').addEventListener('click',()=>{const url=mouldUrl(),qr=qrcode(0,'M');qr.addData(url);qr.make();$('qrImage').innerHTML=qr.createSvgTag({cellSize:6,margin:24,scalable:true,alt:'QR for '+selected.code,title:'Scan for current mould status'});$('qrJob').textContent=selected.code;$('qrUrl').textContent=url;$('copyStatus').textContent='';$('qrDialog').showModal();});$('closeQr').addEventListener('click',()=>$('qrDialog').close());$('printQr').addEventListener('click',()=>MouldPrint.print([selected]));$('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(mouldUrl());$('copyStatus').textContent='Mould link copied.';}catch{$('copyStatus').textContent='Copy the link shown below the QR code.';}});
window.addEventListener('popstate', renderRoute);
$('backToHome').addEventListener('click', () => showHome(true));
$('homeSearch').addEventListener('input', drawHome);
$('homeRefresh').addEventListener('click', load);
$('clearSaved').addEventListener('click', () => {
  let cleared = false;
  try { cleared = MouldSnapshot.clear(localStorage); } catch {}
  notice(cleared ? 'Saved job data cleared from this device. The next successful refresh will save a new offline copy.' : 'Could not clear saved data. You can remove it in your browser site settings.');
});
window.addEventListener('online', load);
window.addEventListener('offline', () => {
  $('syncDot').classList.add('offline');
  $('syncText').textContent = fetched ? 'Offline · saved ' + time(fetched) : 'Offline';
  $('homeSyncText').textContent = $('syncText').textContent;
  notice('You are offline.' + (fetched ? ' Showing data fetched ' + time(fetched) + '; statuses may have changed.' : ' Visit online once to save statuses for this device.'), true);
});
try {
  const snapshot = MouldSnapshot.read(localStorage, M);
  if (snapshot) {
    applyData(snapshot.jobs, snapshot.fetchedAt, true);
    notice('Saved copy from ' + time(snapshot.fetchedAt) + '. Checking for current statuses…');
  }
} catch {}
load();
setInterval(() => { if (!document.hidden) load(); }, 15000);
