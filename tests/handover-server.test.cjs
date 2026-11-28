const {test}=require('node:test');
const assert=require('node:assert/strict');
const V=require('../supabase/functions/turnpart-handover/validate.js'),Marks=require('../dist/part-marks.js'),Model=require('../dist/model.js');
const job={id:'1420-BAEM-0926',code:'1420 BAEM 0926',parts:[{name:'GUIDE PIN',qty:'4',material:'8620',ready:'YES',stages:['DONE','DONE','DONE']},{name:'GUIDE BUSH',qty:'4',material:'8620',ready:'YES',stages:['DONE','DONE','DONE']},{name:'RING',qty:'1',material:'MS',ready:'YES',stages:['DONE','NOT APPLICABLE','NOT APPLICABLE']}]};
const keys=[...Marks.keys(job).values()],keysFor=job=>[...Marks.keys(job).values()];
const packet=()=>({id:'12345678-1234-1234-1234-123456789012',job_id:job.id,source_sheet:'JobDispatched',handover_type:'partial',part_keys:keys.slice(0,2)});
test('100-percent moulds allow partial handover of guide pins and bushes without requiring the remaining parts',()=>{
 assert.equal(Model.progress(job).percent,100);
 const record=V.validate(packet(),[job],keysFor);assert.deepEqual(record.part_keys,keys.slice(0,2));assert.equal(record.handover_type,'partial');
 const full=V.validate({...packet(),handover_type:'full',part_keys:keys},[job],keysFor);assert.equal(full.part_keys.length,3);
 assert.throws(()=>V.validate({...packet(),handover_type:'full'},[job],keysFor),/Every turnpart/);
});
test('server rejects unknown source, forged parts, changed quantities, duplicate selection and request-ID reuse',()=>{
 for(const patch of [{id:'bad'},{source_sheet:'OTHER'},{part_keys:[]},{part_keys:['forged']},{part_keys:[keys[0],keys[0]]}])assert.throws(()=>V.validate({...packet(),...patch},[job],keysFor));
 const changed=structuredClone(job);changed.parts[0].qty='8';assert.throws(()=>V.validate(packet(),[changed],keysFor),/changed/);
 assert.throws(()=>V.validate(packet(),[],keysFor),/no longer/);
 assert.equal(V.same(packet(),packet()),true);assert.equal(V.same(packet(),{...packet(),job_id:'other'}),false);
});
test('partial handover can rely on explicit green self-review while full handover requires sheet readiness',()=>{
 const changed=structuredClone(job);changed.parts[0].ready='NO';
 assert.equal(V.validate({...packet(),source_sheet:'Sheet5'},[changed],keysFor).part_keys.length,2);
 assert.throws(()=>V.validate({...packet(),handover_type:'full',part_keys:keys},[changed],keysFor),/Every turnpart/);
});
