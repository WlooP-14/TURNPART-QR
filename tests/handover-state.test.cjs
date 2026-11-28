const {test}=require('node:test');
const assert=require('node:assert/strict');
const State=require('../dist/handover-state.js');
test('shared coverage counts each part once across partial handovers and follows current part identities',()=>{
 const job={id:'1420-BAEM-0926'},keys=['pin','bush','ring'];
 const records=[{job_id:job.id,part_keys:['pin']},{job_id:job.id,part_keys:['pin','bush']},{job_id:'OTHER',part_keys:['ring']}];
 assert.equal(State.status(job,[],keys).state,'ongoing');
 assert.deepEqual(State.status(job,records,keys),{state:'partial',count:2,total:3});
 records.push({job_id:job.id,part_keys:keys});assert.equal(State.status(job,records,keys).state,'full');
 assert.equal(State.status(job,records,[...keys,'new part']).state,'partial');
 assert.equal(State.status(job,records,['changed identities']).state,'ongoing');
});
test('records keep part identity and handover type, without names, signatures or PDFs',()=>{
 const packet=State.record({id:'1420',code:'1420 BAEM 0926'},'partial',['pin'],'test-id');
 assert.deepEqual(Object.keys(packet),['id','job_id','job_code','handover_type','part_keys']);
 assert.throws(()=>State.record({id:'1420'},'partial',[],'id'));
 assert.throws(()=>State.record({id:'1420'},'partial',['pin','pin'],'id'));
});
