import '../_shared/model.js';
import '../_shared/part-marks.js';
import './validate.js';

const M=(globalThis as any).MouldModel,Marks=(globalThis as any).MouldMarks,V=(globalThis as any).TurnpartHandoverValidation;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const sheetId='1na81bDrcdb0SAaYOBLHKD-WGb1VvHUTbDImeoRl43Ug';

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return reply(405,{ok:false,error:'Use POST to record a handover.'});
  const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!secret)return reply(503,{ok:false,error:'Shared handover storage is unavailable.'});
  const headers={apikey:secret,Authorization:'Bearer '+secret,'Content-Type':'application/json'};
  const table=url+'/rest/v1/turnpart_handover_records';
  async function existing(id:string){
    const response=await fetch(table+'?id=eq.'+encodeURIComponent(id)+'&select=id,job_id,source_sheet,handover_type,part_keys',{headers,signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('Shared storage lookup failed.');
    return (await response.json())[0];
  }
  let input:any;
  try{
    if(Number(req.headers.get('content-length'))>150000)return reply(413,{ok:false,error:'Handover request is too large.'});
    const body=await req.text();if(body.length>150000)return reply(413,{ok:false,error:'Handover request is too large.'});
    input=V.packet(JSON.parse(body));
  }catch(error){return reply(400,{ok:false,error:error instanceof Error?error.message:'Invalid handover request.'});}
  try{
    const previous=await existing(input.id);
    if(previous)return V.same(previous,input)?reply(200,{ok:true,id:input.id}):reply(409,{ok:false,error:'This request ID belongs to a different handover.'});
    const source='https://docs.google.com/spreadsheets/d/'+sheetId+'/gviz/tq?sheet='+encodeURIComponent(input.source_sheet)+'&headers=2&tqx=out:json&_='+Date.now();
    const response=await fetch(source,{signal:AbortSignal.timeout(12000)});
    if(!response.ok)return reply(503,{ok:false,error:'The Google Sheet is unavailable. Please retry.'});
    const text=await response.text(),start=text.indexOf('('),end=text.lastIndexOf(')');
    const data=JSON.parse(text.slice(start+1,end));
    if(data.status!=='ok')return reply(503,{ok:false,error:'Could not verify the latest sheet data.'});
    let record;
    try{
      const jobs=M.parse(data.table,{sheet:input.source_sheet,allowEmpty:true});
      record=V.validate(input,jobs,(job:unknown)=>[...Marks.keys(job).values()]);
    }catch(error){return reply(409,{ok:false,error:error instanceof Error?error.message:'The sheet data changed. Please review it again.'});}
    if(input.validation_only===true)return reply(200,{ok:true,validated:true});
    const saved=await fetch(table,{method:'POST',headers,body:JSON.stringify(record),signal:AbortSignal.timeout(8000)});
    if(saved.status===409){
      const repeated=await existing(input.id);
      return repeated&&V.same(repeated,input)?reply(200,{ok:true,id:input.id}):reply(409,{ok:false,error:'This request ID belongs to a different handover.'});
    }
    if(!saved.ok){console.error('Turnpart storage write failed:',saved.status);return reply(503,{ok:false,error:'Could not save the shared handover. Please retry.'});}
    return reply(200,{ok:true,id:record.id});
  }catch(error){console.error('Turnpart handover verification unavailable:',error instanceof Error?error.name:'Unknown');return reply(503,{ok:false,error:'Could not confirm the handover. It will retry when connected.'});}
});
