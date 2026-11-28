const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const Marks=require('../dist/part-marks.js'),State=require('../dist/handover-state.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function sync(configured=true,sharedServer=[]){
 const server=sharedServer,states=[],values=new Map(),posts=[];
 const window={MouldHandoverConfig:configured?{url:'https://test.supabase.co',publishableKey:'public-test-key',functionJwt:'public-anon-jwt'}:{},addEventListener(){}};
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const sandbox={window,localStorage:storage,navigator:{onLine:true},document:{hidden:false},setHandoverState:state=>states.push(structuredClone(state)),MouldMarks:Marks,MouldHandoverState:State,crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789012'},setInterval(){},setTimeout(){return 1;},clearTimeout(){},AbortController,fetch:async(url,options)=>{
  if(options.method==='POST'){
   const packet=JSON.parse(options.body);posts.push(packet);
   if(sandbox.rejectPost)return {ok:false,status:sandbox.rejectPost,json:async()=>({error:'The selected parts changed. Review again.'})};
   if(!server.some(row=>row.id===packet.id))server.push(packet);
   return {ok:true,status:200,json:async()=>({ok:true,id:packet.id})};
  }
  assert.match(url,/\/rest\/v1\/turnpart_handover_records\?/);
  const offset=Number(new URL(url).searchParams.get('offset')||0);
  return {ok:true,status:200,json:async()=>structuredClone(server.slice(offset,offset+1000))};
 },URL,Date,Set,Promise,JSON};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../dist/handover-sync.js'),'utf8'),sandbox);
 const job={id:'1420-BAEM-0926',code:'1420 BAEM 0926',sourceSheet:'JobDispatched',parts:[{name:'PIN',qty:'4',material:'8620'}]};
 return {api:window.MouldHandoverRecords,job,states,server,posts,values,sandbox};
}
test('shared sync confirms writes from the server and reuses a request ID on repeated PDF downloads',async()=>{
 const a=sync();await tick();const draft={mode:'partial',partIndexes:[0]};
 await a.api.record(a.job,draft);assert.equal(a.posts.length,1);assert.equal(a.posts[0].source_sheet,'JobDispatched');
 assert.equal(a.states.at(-1).records.length,1);assert.equal(a.states.at(-1).live,true);
 await a.api.record(a.job,draft);assert.equal(a.posts.length,1);
 assert(!JSON.stringify(a.posts).includes('maker'));assert(!JSON.stringify(a.posts).includes('signature'));
});
test('missing setup does not claim success or queue past PDFs for later automatic handover',async()=>{
 const a=sync(false);await tick();assert.equal(a.states.at(-1).known,false);
 await assert.rejects(a.api.record(a.job,{mode:'partial',partIndexes:[0]}),/not configured/);
 assert.equal(a.posts.length,0);assert.equal(a.states.at(-1).records.length,0);
 assert.equal([...a.values.keys()].some(key=>key.startsWith('mould-crate:handover-pending:')),false);
});
test('an offline configured connection preserves a retry packet without private data',async()=>{
 const a=sync();await tick();a.sandbox.navigator.onLine=false;
 await assert.rejects(a.api.record(a.job,{mode:'partial',partIndexes:[0]}),/not confirmed/);
 const saved=JSON.parse([...a.values].find(([key])=>key.startsWith('mould-crate:handover-pending:'))[1]);assert.equal(saved.length,1);assert.deepEqual(Object.keys(saved[0]).sort(),['handover_type','id','job_code','job_id','part_keys','source_sheet']);
});

test('another device sees the same saved marks and reads beyond the first thousand records',async()=>{
 const server=Array.from({length:1002},(_,index)=>({id:'row-'+index,job_id:'OTHER',source_sheet:'Sheet5',handover_type:'partial',part_keys:['key-'+index]}));
 const first=sync(true,server),second=sync(true,server);await tick();
 assert.equal(second.states.at(-1).records.length,1002);
 await first.api.record(first.job,{mode:'partial',partIndexes:[0]});await second.api.refresh();
 assert.equal(second.states.at(-1).records.length,1003);assert.equal(second.states.at(-1).records.at(-1).job_id,first.job.id);
});
test('a rejected stale selection is reported and is not retried forever',async()=>{
 const a=sync();await tick();a.sandbox.rejectPost=409;
 await assert.rejects(a.api.record(a.job,{mode:'partial',partIndexes:[0]}),/selected parts changed/);
 const saved=JSON.parse([...a.values].find(([key])=>key.startsWith('mould-crate:handover-pending:'))[1]);assert.deepEqual(saved,[]);
 assert.equal(a.states.at(-1).records.length,0);
});
