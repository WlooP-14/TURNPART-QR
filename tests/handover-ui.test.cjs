const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const H=require('../dist/handover.js');
function ui(){
 const nodes=new Map();
 const context={fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
 const get=id=>{
  if(!nodes.has(id))nodes.set(id,{events:{},value:'',checked:false,hidden:false,disabled:false,open:false,width:1600,height:600,
   addEventListener(type,fn){this.events[type]=fn;},click(){return this.events.click?.();},
   showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},reset(){},removeAttribute(){},
   replaceChildren(...children){this.children=children;},getContext(){return context;},
   getBoundingClientRect(){return {left:0,top:0,width:1600,height:600};},setPointerCapture(){},toDataURL(){return 'data:image/png;test';}
  });
  return nodes.get(id);
 };
 const job={id:'1420-BAEM-0926',code:'1420 BAEM 0926',name:'1420',customer:'BAEM',parts:[{name:'PIN',qty:4,material:'8620',ready:'YES'}]};
 const sandbox={MouldHandoverModel:H,$:get,el:(tag,textContent)=>({tag,textContent}),window:{},navigator:{onLine:true},sheetLive:true,fetched:new Date(),jobs:[job],selected:job,structuredClone,Date};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../dist/handover-ui.js'),'utf8'),sandbox);
 const prepare=()=>{
  get('handoverButton').click();get('confirmHandover').click();get('dieMakerName').value='TEST Maker';get('senderName').value='TEST Sender';get('handoverReviewed').checked=true;
  get('handoverForm').events.submit({preventDefault(){}});
 };
 const stroke=()=>{
  get('signatureCanvas').events.pointerdown({button:0,clientX:10,clientY:10,pointerId:1,preventDefault(){}});
  get('signatureCanvas').events.pointermove({clientX:100,clientY:100,preventDefault(){}});
  get('signatureCanvas').events.pointerup();
 };
 return {get,sandbox,job,prepare,stroke,refresh:()=>sandbox.window.MouldHandover.refresh()};
}
test('handover actions require all parts ready and a recent successful online fetch',()=>{
 const a=ui();assert.equal(a.get('handoverButton').hidden,false);assert.equal(a.get('handoverButton').disabled,false);
 a.job.parts[0].ready='NO';a.refresh();assert.equal(a.get('handoverButton').hidden,true);
 a.job.parts[0].ready='YES';a.sandbox.sheetLive=false;a.refresh();assert.equal(a.get('handoverButton').disabled,true);
 a.get('handoverButton').click();assert.equal(a.get('handoverDialog').open,false);
 a.sandbox.sheetLive=true;a.sandbox.fetched=new Date(Date.now()-46000);a.refresh();assert.equal(a.get('handoverButton').disabled,true);
 a.sandbox.fetched=new Date();a.sandbox.navigator.onLine=false;a.refresh();assert.equal(a.get('handoverButton').disabled,true);
});
test('blank and cleared signatures cannot enable saving; an actual stroke appears in the preview',()=>{
 const a=ui();a.prepare();assert.equal(a.get('handoverPreview').hidden,false);assert.equal(a.get('saveHandover').disabled,true);
 a.get('signProof').click();a.get('useSignature').click();assert.match(a.get('signatureMessage').textContent,/draw your signature/);assert.equal(a.get('saveHandover').disabled,true);
 a.stroke();a.get('clearSignature').click();a.get('useSignature').click();assert.equal(a.get('saveHandover').disabled,true);
 a.stroke();a.get('useSignature').click();assert.equal(a.get('signatureDialog').open,false);assert.equal(a.get('proofSignature').hidden,false);assert.equal(a.get('saveHandover').disabled,false);
 a.get('editHandover').click();assert.equal(a.get('handoverForm').hidden,false);
 a.get('handoverForm').events.submit({preventDefault(){}});assert.equal(a.get('saveHandover').disabled,true);
});
test('changed source data invalidates an open signed proof and a failed refresh blocks export',async()=>{
 const a=ui();a.prepare();a.get('signProof').click();a.stroke();a.get('useSignature').click();
 a.sandbox.sheetLive=false;await a.get('saveHandover').click();assert.match(a.get('handoverMessage').textContent,/Refresh the sheet online/);
 a.sandbox.sheetLive=true;a.job.parts[0].qty=8;a.refresh();assert.equal(a.get('saveHandover').disabled,true);assert.equal(a.get('signProof').disabled,true);
 assert.match(a.get('handoverMessage').textContent,/changed/);
 a.get('closeHandover').click();assert.equal(a.get('handoverDialog').open,false);
});
