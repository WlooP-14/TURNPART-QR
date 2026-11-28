const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const Marks=require('../dist/part-marks.js'),State=require('../dist/handover-state.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function sync(configured=true){
 const server=[],states=[],values=new Map(),posts=[];
 const window={MouldHandoverEndpoint:configured?'https://script.google.com/macros/s/TEST/exec':'',addEventListener(){}};
 const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 const sandbox={window,localStorage:storage,navigator:{onLine:true},document:{hidden:false,createElement(){return {remove(){}};},head:{append(script){const callback=new URL(script.src).searchParams.get('callback');window[callback]({ok:true,records:structuredClone(server)});}}},setHandoverState:state=>states.push(structuredClone(state)),MouldMarks:Marks,MouldHandoverState:State,crypto:{randomUUID:()=> '12345678-1234-1234-1234-123456789012'},setInterval(){},setTimeout(){return 1;},clearTimeout(){},fetch:async(_,options)=>{const packet=JSON.parse(options.body);posts.push(packet);if(!server.some(row=>row.id===packet.id))server.push(packet);},URL,Date,Set,Promise,JSON};
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
 await assert.rejects(a.api.record(a.job,{mode:'partial',partIndexes:[0]}),/connection setup/);
 assert.equal(a.posts.length,0);assert.equal(a.states.at(-1).records.length,0);
 assert.equal([...a.values.keys()].some(key=>key.startsWith('mould-crate:handover-pending:')),false);
});
test('an offline configured connection preserves a retry packet without private data',async()=>{
 const a=sync();await tick();a.sandbox.navigator.onLine=false;
 await assert.rejects(a.api.record(a.job,{mode:'partial',partIndexes:[0]}),/not confirmed/);
 const saved=JSON.parse([...a.values].find(([key])=>key.startsWith('mould-crate:handover-pending:'))[1]);assert.equal(saved.length,1);assert.deepEqual(Object.keys(saved[0]).sort(),['handover_type','id','job_code','job_id','part_keys','source_sheet']);
});
