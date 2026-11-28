(function(root){
 'use strict';
 const norm=s=>String(s??'').trim().replace(/\s+/g,' ');
 const key=s=>norm(s).toUpperCase().replace(/ /g,'-');
 const stage=s=>norm(s).toUpperCase();
 const isProcess=p=>p.stages.some(s=>stage(s)==='IN PROCESS');
 const isPlan=p=>p.stages.some(s=>stage(s)==='TO PLAN');
 const isDelayed=p=>p.stages.some(s=>['DELAY','DELAYED'].includes(stage(s)));
 const isReady=p=>['YES','TRUE'].includes(stage(p.ready));
 function searchJobs(active,finishedCodes,query){
  const search=norm(query).toLowerCase();
  const finished=new Map(finishedCodes.map(value=>{const code=norm(value);return [key(code),{id:key(code),code,name:code.split(' ')[0],finished:true}];}));
  const results=active.filter(job=>!finished.has(job.id)&&job.code.toLowerCase().includes(search));
  if(search)for(const job of finished.values())if(job.code.toLowerCase().includes(search))results.push(job);
  return results;
 }
 function progress(job){
  let completed=0,total=0;
  for(const part of job.parts){
   for(const value of part.stages){
    const state=stage(value);
    if(state==='NOT APPLICABLE')continue;
    total++;if(state==='DONE')completed++;
   }
  }
  const percent=total?Math.floor(completed*100/total):(job.parts.length&&job.parts.every(isReady)?100:0);
  return {completed,total,percent};
 }
 function parse(table,{sheet='Sheet5',allowEmpty=false}={}){
  if(!table||!Array.isArray(table.rows))throw Error('The sheet returned an unexpected format.');
  const labels=(table.cols||[]).map(c=>stage(c.label));
  if(!labels[3]?.includes('PART NAME')||!labels[10]?.includes('TURNING')||!labels[15]?.includes('READY TO ASSEMBLE'))throw Error('The sheet columns have changed. Please check the tracker connection.');
  const jobs=[];let job=null;
  for(const row of table.rows){
   const cells=row.c||[];const val=i=>cells[i]?.f??cells[i]?.v??'';
   if(norm(val(1))){
    const code=norm(val(1)),id=key(code);
    if(jobs.some(j=>j.id===id))throw Error('More than one mould has the identifier '+code+'. Each mould needs a unique job/customer/received combination.');
    const tokens=code.split(' '),date=tokens.at(-1),month=Number(date.slice(0,2));
    const received=/^\d{4}$/.test(date)&&month>=1&&month<=12?new Intl.DateTimeFormat('en-IN',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(2000+Number(date.slice(2)),month-1,1))):date;
    job={id,code,sourceSheet:sheet,serial:norm(val(0)),name:tokens[0],customer:tokens.slice(1,-1).join(' '),received,bom:norm(val(2)),trial:norm(val(18)),dispatchReady:norm(val(20)),parts:[]};jobs.push(job);
   }
   if(!job||!norm(val(3)))continue;
   job.parts.push({name:norm(val(3)),qty:norm(val(4)),material:norm(val(5)),materialAcquired:cells[6]?.v===true||stage(val(6))==='TRUE',dispatch:norm(val(7)),due:norm(val(8)),vendors:[norm(val(9)),norm(val(11)),norm(val(13))],stages:[norm(val(10)),norm(val(12)),norm(val(14))],ready:norm(val(15))});
  }
  if(!jobs.length&&!allowEmpty)throw Error('No mould records were found in '+sheet+'.');return jobs;
 }
 const api={norm,key,stage,isProcess,isPlan,isDelayed,isReady,searchJobs,progress,parse};root.MouldModel=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
