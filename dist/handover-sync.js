'use strict';
(() => {
  const endpoint=window.MouldHandoverEndpoint||'',cacheKey='mould-crate:handover-shared:v2:'+endpoint,queueKey='mould-crate:handover-pending:v2:'+endpoint;
  let records=[],known=false,live=false,pending=[],sequence=0,reading=null,flushing=null,error='';
  const configured=/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(endpoint);
  function valid(rows){
    if(!Array.isArray(rows)||rows.some(row=>typeof row.id!=='string'||typeof row.job_id!=='string'||!['full','partial'].includes(row.handover_type)||!Array.isArray(row.part_keys)||!row.part_keys.length||row.part_keys.length>500||row.part_keys.some(key=>typeof key!=='string'||key.length>3000)))throw Error('Invalid shared handover data.');
    return rows;
  }
  function publish(){setHandoverState({records,known,live,error:!configured?'Shared handover saving needs the sheet connection setup.':error||(pending.length?pending.length+' handover(s) waiting to sync.':'')});}
  function persist(){try{localStorage.setItem(queueKey,JSON.stringify(pending));}catch{}}
  try{records=valid(JSON.parse(localStorage.getItem(cacheKey)));known=true;}catch{}
  try{pending=valid(JSON.parse(localStorage.getItem(queueKey)));}catch{}
  function refresh(){
    if(reading)return reading;
    if(!configured||navigator.onLine===false){live=false;error=configured?'Offline. Showing saved handover marks.':'';publish();return Promise.resolve(records);}
    reading=new Promise((resolve,reject)=>{
      const callback='turnpartHandoverResponse'+(++sequence),script=document.createElement('script');let done=false;
      const finish=()=>{done=true;clearTimeout(timeout);script.remove();delete window[callback];};
      const failed=message=>{if(done)return;finish();live=false;error=message;publish();reject(Error(message));};
      window[callback]=data=>{
        if(done)return;
        try{
          if(!data?.ok)throw Error(data?.error||'Could not read shared handovers.');
          const next=valid(data.records);finish();records=next;known=true;live=true;error='';
          const confirmed=new Set(records.map(row=>row.id));pending=pending.filter(row=>!confirmed.has(row.id));persist();
          try{localStorage.setItem(cacheKey,JSON.stringify(records));}catch{}
          publish();resolve(records);
        }catch(e){failed(e.message);}
      };
      const timeout=setTimeout(()=>failed('Shared handover status took too long to respond.'),20000);
      script.onerror=()=>failed('Could not refresh shared handover status.');
      script.src=endpoint+'?callback='+callback+'&_='+Date.now();document.head.append(script);
    }).finally(()=>{reading=null;});
    return reading;
  }
  async function flush(){
    if(flushing)return flushing;
    if(!configured||navigator.onLine===false)return;
    flushing=(async()=>{
      for(const packet of [...pending]){
        try{await fetch(endpoint,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(packet)});}catch{}
      }
      await refresh();
    })().finally(()=>{flushing=null;});
    return flushing;
  }
  async function record(job,draft){
    if(!configured)throw Error('PDF downloaded. Shared handover saving needs the sheet connection setup.');
    draft.recordId ||= crypto.randomUUID();
    if(records.some(row=>row.id===draft.recordId))return;
    if(!pending.some(row=>row.id===draft.recordId)){
      const keys=[...MouldMarks.keys(job).values()];
      pending.push({...MouldHandoverState.record(job,draft.mode,draft.partIndexes.map(index=>keys[index]),draft.recordId),source_sheet:job.sourceSheet||'Sheet5'});
      persist();publish();
    }
    await flush();
    if(!records.some(row=>row.id===draft.recordId))throw Error('PDF downloaded. The shared handover is not confirmed yet; it will retry when connected.');
  }
  window.MouldHandoverRecords={record,refresh,configured};
  publish();refresh().catch(()=>{});
  setInterval(()=>{if(!document.hidden)(pending.length?flush():refresh()).catch(()=>{});},15000);
  window.addEventListener('online',()=>{(pending.length?flush():refresh()).catch(()=>{});});
  window.addEventListener('offline',()=>{live=false;error='Offline. Showing saved handover marks.';publish();});
})();
