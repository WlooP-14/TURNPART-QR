const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Marks=require('../dist/part-marks.js');
const H=require('../dist/handover.js');
function ui(){
 const nodes=new Map();
 const pages=[],downloads=[],saved=[];
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
 const sandbox={MouldHandoverModel:H,MouldMarks:Marks,M:require('../dist/model.js'),partMarks:Marks.create(null),handedOver:()=>false,$:get,el:(tag,textContent)=>({tag,textContent,append(...children){this.children=children;}}),window:{},navigator:{onLine:true},sheetLive:true,fetched:new Date(),archiveState:{jobs:[],live:false,fetchedAt:null},jobs:[job],selected:job,structuredClone,Date,
  document:{fonts:{ready:Promise.resolve()},body:{append(){}},createElement(tag){
   if(tag==='a')return {click(){downloads.push(this.download);},remove(){}};
   const operations=[],ctx={font:'',fillRect(){},save(){},restore(){},translate(){},scale(){},drawImage(){},fillText(text,x,y){operations.push({text,x,y,font:this.font});},measureText(text){return {width:text.length*Number(this.font.match(/(\d+)px/)?.[1]||30)*.5};}};
   const page={operations,getContext:()=>ctx,toDataURL:()=> 'test-png'};pages.push(page);return page;
  }},Image:class{width=1600;height=600;set src(_){this.onload();}},PDFLib:{PDFDocument:{async create(){return {async embedPng(){return {};},addPage(){return {drawImage(){}};},setTitle(){},setSubject(){},async save(){return new Uint8Array([1]);}};}}},
  MouldHandoverRecords:{async record(_,draft){saved.push(draft);}},Blob,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},setTimeout(){}
 };
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../dist/handover-ui.js'),'utf8'),sandbox);
 const prepare=(archivedJob,mode='full')=>{
  if(archivedJob||mode==='partial')sandbox.window.MouldHandover.start(archivedJob||job,mode);else get('handoverButton').click();
  get('confirmHandover').click();get('dieMakerName').value='TEST Maker';get('senderName').value='TEST Sender';get('handoverReviewed').checked=true;
  get('handoverForm').events.submit({preventDefault(){}});
 };
 const stroke=()=>{
  get('signatureCanvas').events.pointerdown({button:0,clientX:10,clientY:10,pointerId:1,preventDefault(){}});
  get('signatureCanvas').events.pointermove({clientX:100,clientY:100,preventDefault(){}});
  get('signatureCanvas').events.pointerup();
 };
 return {get,sandbox,job,prepare,stroke,pages,downloads,saved,refresh:()=>sandbox.window.MouldHandover.refresh()};
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
test('dispatched handovers use archive freshness and archive parts, independently of the ongoing sheet',async()=>{
 const a=ui(),archive=structuredClone(a.job);archive.sourceSheet='JobDispatched';archive.code='ARCHIVED MOULD';
 a.sandbox.archiveState={jobs:[archive],live:true,fetchedAt:new Date()};a.sandbox.sheetLive=false;
 const api=a.sandbox.window.MouldHandover;
 assert.equal(api.canStart(archive),true);a.prepare(archive);assert.equal(api.usesArchive(),true);
 assert.equal(a.get('proofMould').textContent,'ARCHIVED MOULD');
 a.get('signProof').click();a.stroke();a.get('useSignature').click();assert.equal(a.get('saveHandover').disabled,false);
 a.sandbox.sheetLive=true;a.sandbox.archiveState.live=false;await a.get('saveHandover').click();
 assert.match(a.get('handoverMessage').textContent,/Refresh the sheet online/);
 a.sandbox.archiveState.live=true;a.sandbox.archiveState.fetchedAt=new Date(Date.now()-46000);assert.equal(api.canStart(archive),false);
 a.sandbox.archiveState.fetchedAt=new Date();archive.parts[0].ready='NO';a.refresh();
 assert.equal(a.get('saveHandover').disabled,true);assert.match(a.get('handoverMessage').textContent,/changed/);
});
test('partial handover follows green tap selection, excludes handed-over rows and invalidates a changed selection',()=>{
 const a=ui(),api=a.sandbox.window.MouldHandover;
 a.job.parts[0].stages=['DONE','DONE','DONE'];a.job.parts.push({...a.job.parts[0],name:'BUSH',qty:'2'});
 assert.equal(a.sandbox.M.progress(a.job).percent,100);
 const keys=[...Marks.keys(a.job).values()];
 for(const key of keys){a.sandbox.partMarks.cycle(key,true);a.sandbox.partMarks.cycle(key,true);}
 a.sandbox.handedOver=(_,key)=>key===keys[1];a.refresh();assert.equal(a.get('handoverButton').hidden,false);assert.equal(a.get('partialHandoverButton').hidden,false);assert.equal(a.get('partialHandoverButton').textContent,'Partial handover (1)');
 a.prepare(null,'partial');assert.equal(a.get('proofParts').hidden,false);
 const rows=a.get('proofPartsRows').children;assert.equal(rows.length,1);assert.equal(rows[0].children[0].textContent,'PIN');assert.equal(rows[0].children[1].textContent,4);
 a.sandbox.partMarks.cycle(keys[0],true);a.refresh();assert.equal(a.get('signProof').disabled,true);
});
test('long partial proofs paginate all selected rows, repeat the letter heading and sign only the final page',async()=>{
 const a=ui();a.job.parts=Array.from({length:60},(_,index)=>({name:'TEST PART '+index,qty:'4',material:'8620',ready:'YES'}));
 for(const key of Marks.keys(a.job).values()){a.sandbox.partMarks.cycle(key,true);a.sandbox.partMarks.cycle(key,true);}
 a.prepare(null,'partial');a.get('signProof').click();a.stroke();a.get('useSignature').click();await a.get('saveHandover').click();
 assert(a.pages.length>=3);assert.equal(a.downloads.length,1);assert.equal(a.saved.length,1);
 for(const page of a.pages){assert(page.operations.some(op=>op.text==='MOULD & CRATE'));assert(page.operations.some(op=>op.text==='PARTIAL TURNPART HANDOVER PROOF'));assert(page.operations.every(op=>op.y<=2265));}
 const texts=a.pages.flatMap(page=>page.operations.map(op=>op.text));
 for(let index=0;index<60;index++)assert(texts.some((text,offset)=>text==='TEST'&&texts[offset+2]==='PART'&&texts[offset+4]===String(index)));
 assert.equal(texts.filter(text=>text==='Die maker’s signature').length,1);
 assert(a.pages.at(-1).operations.some(op=>op.text==='Die maker’s signature'));
});
