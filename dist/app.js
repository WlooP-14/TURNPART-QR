'use strict';
const M=MouldModel,$=id=>document.getElementById(id);
let jobs=[],selected=null,fetched=null,activeScript=null,timer=null,request=0,busy=false;
const time=d=>new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d)+' IST';
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function notice(text,error=false){$('notice').replaceChildren();if(text)$('notice').append(el('p',text,error?'notice error':'notice'));}
function badge(value){const s=M.stage(value);let cls='grey';if(s==='IN PROCESS')cls='yellow';else if(s==='DONE'||s==='YES')cls='green';else if(s==='NOT APPLICABLE')cls='blue';else if(['NO','DELAY','DELAYED'].includes(s))cls='red';else if(s&&s!=='TO PLAN')cls='neutral';return el('span',value||'—','badge '+cls);}
function drawDirectory(){const q=$('jobSearch').value.toLowerCase(),list=$('jobs');list.replaceChildren();$('jobCount').textContent=jobs.length;for(const j of jobs.filter(j=>j.code.toLowerCase().includes(q))){const b=el('button',undefined,'job-item'+(j.id===selected?.id?' selected':''));b.setAttribute('aria-pressed',String(j.id===selected?.id));const top=el('span',undefined,'job-item-top');top.append(el('strong','Job '+j.name),el('small',j.customer));b.append(top,el('span',j.code,'job-code'),el('small',j.parts.length+' parts · '+j.received));b.addEventListener('click',()=>selectJob(j,true));list.append(b);}if(!list.children.length)list.append(el('p','No matching jobs.','muted'));}
function selectJob(j,push=false){selected=j;if(push){const u=new URL(location.href);u.searchParams.set('job',j.id);history.pushState({},'',u);$('partSearch').value='';$('statusFilter').value='all';}drawDirectory();$('loading').hidden=true;$('workspace').hidden=false;$('jobTitle').textContent='Job '+j.name;$('jobSerial').textContent=j.code;$('jobMeta').textContent='Customer '+j.customer+'  ·  Received '+j.received+'  ·  BOM '+(j.bom||'—')+'  ·  Trial (T0) '+(j.trial||'—');$('totalParts').textContent=j.parts.length;$('inProcess').textContent=j.parts.filter(M.isProcess).length;$('toPlan').textContent=j.parts.filter(M.isPlan).length;const ready=j.parts.filter(M.isReady).length;$('readyCount').textContent=ready+' / '+j.parts.length;$('readyText').textContent=ready===j.parts.length?'All part entries marked ready':(j.parts.length-ready)+' still to be marked ready';drawParts();}
function drawParts(){if(!selected)return;const q=$('partSearch').value.toLowerCase(),filter=$('statusFilter').value,pred={all:()=>true,process:M.isProcess,plan:M.isPlan,delay:M.isDelayed,ready:M.isReady}[filter];const rows=selected.parts.filter(p=>(p.name+' '+p.material+' '+p.vendors.join(' ')).toLowerCase().includes(q)&&pred(p));const body=$('parts');body.replaceChildren();for(const p of rows){const row=el('tr');row.append(el('th',p.name,'part-col'));row.firstChild.scope='row';row.append(el('td',p.qty||'—','qty'),el('td',p.material||'—'));const acquiredCell=el('td');const tick=el('span',p.materialAcquired?'✓':'—',p.materialAcquired?'material-acquired ready':'material-acquired');tick.setAttribute('aria-label',p.materialAcquired?'Material acquired':'Material not acquired');acquiredCell.append(tick);row.append(acquiredCell);for(let i=0;i<3;i++){row.append(el('td',p.vendors[i]||'—','vendor'));const c=el('td');c.append(badge(p.stages[i]));row.append(c);}const r=el('td');r.append(badge(p.ready));row.append(r,el('td',p.dispatch||'—'),el('td',p.due||'—'));body.append(row);}if(!rows.length){const row=el('tr'),c=el('td','No parts match these filters.','empty');c.colSpan=13;row.append(c);body.append(row);}$('visibleCount').textContent=rows.length+' of '+selected.parts.length+' parts';}
function fail(message){busy=false;$('refresh').disabled=false;$('refresh').textContent='↻ Refresh';$('syncDot').classList.add('offline');$('syncText').textContent=fetched?'Last fetched '+time(fetched)+' · stale':'Sheet unavailable';notice(message+(fetched?' Showing previously fetched data; statuses may have changed.':''),true);if(!jobs.length){$('loading').hidden=false;$('loading').querySelector('h1').textContent='Unable to load the sheet';$('loading').querySelector('p').textContent='Use Refresh to try again. The source sheet must remain readable to the tracker.';const btn=el('button','Retry connection','primary');btn.addEventListener('click',load);if(!$('loading').querySelector('button'))$('loading').append(btn);}}
function applyData(nextJobs, when, saved = false) {
  jobs = nextJobs;
  fetched = when;
  $('syncText').textContent = (saved ? 'Saved copy · ' : 'Fetched ') + time(fetched);
  $('syncDot').classList.toggle('offline', saved);
  const wanted = new URL(location.href).searchParams.get('job');
  const job = wanted ? jobs.find(j => j.id === M.key(wanted)) : jobs[0];
  if (job) selectJob(job);
  else {
    selected = null;
    $('workspace').hidden = true;
    $('loading').hidden = false;
    $('loading').querySelector('h1').textContent = 'Mould not found';
    $('loading').querySelector('p').textContent = 'This QR identifier is not in the available records. Choose a mould from the directory or check its job/customer/received code.';
    drawDirectory();
  }
}
function load() {
  if (busy) return;
  if (navigator.onLine === false) {
    fail('You are offline. Connect to the internet for current statuses.');
    return;
  }
  busy = true;
  $('refresh').disabled = true;
  $('refresh').textContent = 'Refreshing…';
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
      $('refresh').disabled = false;
      $('refresh').textContent = '↻ Refresh';
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
$('jobSearch').addEventListener('input',drawDirectory);$('partSearch').addEventListener('input',drawParts);$('statusFilter').addEventListener('change',drawParts);$('refresh').addEventListener('click',load);
$('qrButton').addEventListener('click',()=>{const url=mouldUrl(),qr=qrcode(0,'M');qr.addData(url);qr.make();$('qrImage').innerHTML=qr.createSvgTag({cellSize:6,margin:24,scalable:true,alt:'QR for '+selected.code,title:'Scan for current mould status'});$('qrJob').textContent=selected.code;$('qrUrl').textContent=url;$('copyStatus').textContent='';$('qrDialog').showModal();});$('closeQr').addEventListener('click',()=>$('qrDialog').close());$('printQr').addEventListener('click',()=>MouldPrint.print([selected]));$('copyLink').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(mouldUrl());$('copyStatus').textContent='Mould link copied.';}catch{$('copyStatus').textContent='Copy the link shown below the QR code.';}});
window.addEventListener('popstate',()=>{const wanted=new URL(location.href).searchParams.get('job'),j=wanted?jobs.find(j=>j.id===M.key(wanted)):jobs[0];if(j)selectJob(j);else{selected=null;$('workspace').hidden=true;notice('Mould not found. Choose a job from the directory.',true);drawDirectory();}});
$('clearSaved').addEventListener('click', () => {
  let cleared = false;
  try { cleared = MouldSnapshot.clear(localStorage); } catch {}
  notice(cleared ? 'Saved job data cleared from this device. The next successful refresh will save a new offline copy.' : 'Could not clear saved data. You can remove it in your browser site settings.');
});
window.addEventListener('online', load);
window.addEventListener('offline', () => {
  $('syncDot').classList.add('offline');
  $('syncText').textContent = fetched ? 'Offline · saved ' + time(fetched) : 'Offline';
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
