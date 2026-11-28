'use strict';
(() => {
  const config=window.MouldHandoverConfig||{},base=config.url||'',cacheKey='mould-crate:handover-shared:supabase:v1:'+base,queueKey='mould-crate:handover-pending:supabase:v1:'+base;
  const table=base+'/rest/v1/turnpart_handover_records',endpoint=base+'/functions/v1/turnpart-handover';
  let records=[],known=false,live=false,pending=[],reading=null,flushing=null,error='',submissionError='';
  const configured=/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(base)&&!!config.publishableKey&&!!config.functionJwt;
  const headers={apikey:config.publishableKey};
  function valid(rows){
    if(!Array.isArray(rows)||rows.some(row=>typeof row.id!=='string'||typeof row.job_id!=='string'||!['full','partial'].includes(row.handover_type)||!Array.isArray(row.part_keys)||!row.part_keys.length||row.part_keys.length>500||row.part_keys.some(key=>typeof key!=='string'||key.length>3000)))throw Error('Invalid shared handover data.');
    return rows;
  }
  const same=(a,b)=>a.id===b.id&&a.job_id===b.job_id&&a.source_sheet===b.source_sheet&&a.handover_type===b.handover_type&&JSON.stringify(a.part_keys)===JSON.stringify(b.part_keys);
  function publish(){setHandoverState({records,known,live,error:!configured?'Shared handover saving is not configured.':error||(pending.length?pending.length+' handover(s) waiting to sync.':'')});}
  function persist(){try{localStorage.setItem(queueKey,JSON.stringify(pending));}catch{}}
  try{records=valid(JSON.parse(localStorage.getItem(cacheKey)));known=true;}catch{}
  try{pending=valid(JSON.parse(localStorage.getItem(queueKey)));}catch{}
  async function request(url,options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),25000);
    try{
      const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});
      const data=await response.json().catch(()=>null);
      if(!response.ok){const failure=Error(data?.error||'Could not reach shared handover storage.');failure.status=response.status;throw failure;}
      return data;
    }finally{clearTimeout(timeout);}
  }
  function refresh(){
    if(reading)return reading;
    if(!configured||navigator.onLine===false){live=false;error=configured?'Offline. Showing saved handover marks.':'';publish();return Promise.resolve(records);}
    reading=(async()=>{
      try{
        const next=[];
        for(let offset=0;;offset+=1000){
          const page=valid(await request(table+'?select=id,job_id,job_code,source_sheet,handover_type,part_keys,created_at&order=created_at.asc,id.asc&limit=1000&offset='+offset,{headers}));
          next.push(...page);if(page.length<1000)break;
        }
        records=next;known=true;live=true;error='';pending=pending.filter(packet=>!records.some(row=>same(row,packet)));persist();
        try{localStorage.setItem(cacheKey,JSON.stringify(records));}catch{}
        publish();return records;
      }catch(failure){live=false;error='Could not refresh shared handover status. Showing the last saved marks.';publish();throw failure;}
    })().finally(()=>{reading=null;});return reading;
  }
  async function flush(){
    if(flushing)return flushing;
    if(!configured||navigator.onLine===false)return;
    flushing=(async()=>{
      submissionError='';
      for(const packet of [...pending]){
        try{
          const result=await request(endpoint,{method:'POST',headers:{...headers,Authorization:'Bearer '+config.functionJwt,'Content-Type':'application/json'},body:JSON.stringify(packet)});
          if(!result?.ok)throw Error('Could not confirm the shared handover.');
        }catch(failure){
          submissionError=failure.message;
          if([400,409,413,422].includes(failure.status)){pending=pending.filter(row=>row.id!==packet.id);persist();}
        }
      }
      await refresh();
      if(submissionError){error=submissionError;publish();}
    })().finally(()=>{flushing=null;});return flushing;
  }
  async function record(job,draft){
    if(!configured)throw Error('PDF downloaded. Shared handover saving is not configured.');
    draft.recordId ||= crypto.randomUUID();
    const keys=[...MouldMarks.keys(job).values()],packet={...MouldHandoverState.record(job,draft.mode,draft.partIndexes.map(index=>keys[index]),draft.recordId),source_sheet:job.sourceSheet||'Sheet5'};
    const previous=records.find(row=>row.id===packet.id);
    if(previous){if(same(previous,packet))return;throw Error('This request ID belongs to a different handover.');}
    if(!pending.some(row=>row.id===packet.id)){pending.push(packet);persist();publish();}
    try{await flush();}catch{throw Error('PDF downloaded. Shared handover recording is waiting to sync.');}
    if(!records.some(row=>same(row,packet)))throw Error('PDF downloaded. '+(submissionError||'The shared handover is not confirmed yet; it will retry when connected.'));
  }
  window.MouldHandoverRecords={record,refresh,configured};
  publish();refresh().catch(()=>{});
  setInterval(()=>{if(!document.hidden)(pending.length?flush():refresh()).catch(()=>{});},15000);
  window.addEventListener('online',()=>{(pending.length?flush():refresh()).catch(()=>{});});
  window.addEventListener('offline',()=>{live=false;error='Offline. Showing saved handover marks.';publish();});
})();
