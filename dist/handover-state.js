(function(root){
  'use strict';
  const labels={ongoing:'Ongoing',partial:'Partially handed over',full:'Fully handed over',unknown:'Handover status unavailable'};
  function status(job,records,partKeys){
    const covered=new Set();
    for(const row of records)if(row.job_id===job.id)for(const key of row.part_keys||[])covered.add(key);
    const count=partKeys.filter(key=>covered.has(key)).length;
    return {state:count===0?'ongoing':count===partKeys.length?'full':'partial',count,total:partKeys.length};
  }
  function record(job,mode,partKeys,id){
    if(!job?.id||!['full','partial'].includes(mode)||!Array.isArray(partKeys)||!partKeys.length||partKeys.length>500||new Set(partKeys).size!==partKeys.length)throw Error('Invalid handover record.');
    return {id,job_id:job.id,job_code:job.code,handover_type:mode,part_keys:[...partKeys]};
  }
  const api={labels,status,record};root.MouldHandoverState=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
