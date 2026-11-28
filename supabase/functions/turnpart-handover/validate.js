(function(root){
  'use strict';
  function packet(input){
    if(!input||! /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(input.id))throw Error('Invalid handover request ID.');
    if(!['Sheet5','JobDispatched'].includes(input.source_sheet)||!['full','partial'].includes(input.handover_type)||typeof input.job_id!=='string'||input.job_id.length>180)throw Error('Invalid handover source or mould.');
    if(!Array.isArray(input.part_keys)||!input.part_keys.length||input.part_keys.length>500||new Set(input.part_keys).size!==input.part_keys.length||input.part_keys.some(key=>typeof key!=='string'||key.length>3000))throw Error('Invalid selected parts.');
    return input;
  }
  function validate(input,jobs,keysForJob){
    packet(input);
    const job=jobs.find(job=>job.id===input.job_id);
    if(!job?.parts.length)throw Error('The mould is no longer in this source sheet. Refresh and review it again.');
    const available=new Set(keysForJob(job));
    if(input.part_keys.some(key=>!available.has(key)))throw Error('The selected parts or quantities changed. Refresh and review them again.');
    if(input.handover_type==='full'&&(input.part_keys.length!==available.size||!job.parts.every(part=>['YES','TRUE'].includes(String(part.ready).trim().toUpperCase()))))throw Error('Every turnpart must be ready for full handover.');
    return {id:input.id,job_id:job.id,job_code:job.code,source_sheet:input.source_sheet,handover_type:input.handover_type,part_keys:[...input.part_keys]};
  }
  function same(existing,input){return existing.job_id===input.job_id&&existing.source_sheet===input.source_sheet&&existing.handover_type===input.handover_type&&JSON.stringify(existing.part_keys)===JSON.stringify(input.part_keys);}
  const api={packet,validate,same};root.TurnpartHandoverValidation=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
