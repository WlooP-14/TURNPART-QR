// Read-only live integration checks: validation_only never records a handover.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
const require=createRequire(import.meta.url),M=require('../dist/model.js'),Marks=require('../dist/part-marks.js');
const sandbox={window:{}};vm.runInNewContext(await readFile(new URL('../dist/handover-config.js',import.meta.url),'utf8'),sandbox);
const config=sandbox.window.MouldHandoverConfig,table=config.url+'/rest/v1/turnpart_handover_records',endpoint=config.url+'/functions/v1/turnpart-handover';
const headers={apikey:config.publishableKey,Authorization:'Bearer '+config.functionJwt,'Content-Type':'application/json'};
async function sheet(name){
 const response=await fetch('https://docs.google.com/spreadsheets/d/1na81bDrcdb0SAaYOBLHKD-WGb1VvHUTbDImeoRl43Ug/gviz/tq?sheet='+name+'&headers=2&tqx=out:json');
 const text=await response.text(),data=JSON.parse(text.slice(text.indexOf('(')+1,text.lastIndexOf(')')));
 return M.parse(data.table,{sheet:name,allowEmpty:true});
}
async function check(body,status,label){
 const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(body)}),data=await response.json();
 if(response.status!==status)throw Error(label+': HTTP '+response.status+' '+JSON.stringify(data));
 console.log(label+': passed (HTTP '+response.status+')');return data;
}
const initial=await fetch(table+'?select=id',{headers:{apikey:config.publishableKey}});
if(!initial.ok)throw Error('Shared table read failed: '+initial.status);
const before=await initial.json();console.log('Public read of dedicated handover table: passed');
const direct=await fetch(table,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify({id:randomUUID()})});
if(direct.status!==401&&direct.status!==403)throw Error('Direct browser insert should be blocked, got '+direct.status);
console.log('Direct browser inserts blocked: passed');
const preflight=await fetch(endpoint,{method:'OPTIONS',headers:{Origin:'http://localhost:3009','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,apikey,content-type'}});
if(!preflight.ok||preflight.headers.get('access-control-allow-origin')!=='*')throw Error('Browser preflight failed.');
console.log('Browser CORS preflight: passed');
await check({id:'invalid'},400,'Invalid request rejected');
const dispatched=await sheet('JobDispatched'),job=dispatched.find(job=>M.progress(job).percent===100&&job.parts.every(M.isReady));
if(!job)throw Error('Need a complete dispatched job for validation-only checks.');
const keys=[...Marks.keys(job).values()],base={id:randomUUID(),job_id:job.id,source_sheet:'JobDispatched',handover_type:'partial',part_keys:keys.slice(0,2),validation_only:true};
const valid=await check(base,200,'Partial handover on a 100-percent mould');if(valid.validated!==true)throw Error('Expected validation-only result.');
await check({...base,id:randomUUID(),part_keys:['forged-key']},409,'Forged part rejected');
await check({...base,id:randomUUID(),handover_type:'full',part_keys:keys},200,'Complete full handover validation');
const ongoing=(await sheet('Sheet5')).find(job=>job.parts.length&&!job.parts.every(M.isReady));
if(ongoing)await check({id:randomUUID(),job_id:ongoing.id,source_sheet:'Sheet5',handover_type:'full',part_keys:[...Marks.keys(ongoing).values()],validation_only:true},409,'Unready full handover rejected');
const final=await fetch(table+'?select=id',{headers:{apikey:config.publishableKey}}),after=await final.json();
if(before.length!==after.length)throw Error('The validation checks must not add handover records.');
console.log('No handover rows created by live checks: passed');
