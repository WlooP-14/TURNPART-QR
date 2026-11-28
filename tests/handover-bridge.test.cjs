const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const Marks=require('../dist/part-marks.js');
function bridge(){
 const rows=[[],[],['1','1420 BAEM 0926','', 'PIN','4','8620','','','','','','','','','','YES'],['','','','BUSH','2','8620','','','','','','','','','','NO']];
 const sheets=new Map();
 const make=data=>({data,getDataRange(){return {getDisplayValues:()=>this.data};},getLastRow(){return this.data.length;},getRange(start,_,length){return {getValues:()=>this.data.slice(start-1,start-1+length)};},appendRow(row){this.data.push(row);},setFrozenRows(){}});
 sheets.set('Sheet5',make(rows));sheets.set('JobDispatched',make(rows));
 const book={getSheetByName:name=>sheets.get(name),insertSheet(name){const sheet=make([]);sheets.set(name,sheet);return sheet;}};
 const sandbox={SpreadsheetApp:{openById:()=>book,flush(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},ContentService:{MimeType:{JAVASCRIPT:'text/javascript'},createTextOutput(text){return {text,setMimeType(){return this;}};}},Date,JSON,Set};
 vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../google-apps-script/Handover.gs'),'utf8'),sandbox);
 const keys=[...Marks.keys({id:'1420-BAEM-0926',parts:[{name:'PIN',qty:'4',material:'8620'},{name:'BUSH',qty:'2',material:'8620'}]}).values()];
 const post=packet=>sandbox.doPost({postData:{contents:JSON.stringify(packet)}}).text;
 return {sandbox,rows,keys,post,packet:{id:'12345678-1234-1234-1234-123456789012',job_id:'1420-BAEM-0926',source_sheet:'Sheet5',handover_type:'partial',part_keys:[keys[0]]}};
}
test('Google Sheet handover bridge validates current parts and appends once without changing source rows',()=>{
 const b=bridge(),before=JSON.stringify(b.rows);
 assert.equal(b.post(b.packet),'Recorded.');assert.equal(b.post(b.packet),'Already recorded.');
 assert.equal(JSON.stringify(b.rows),before);
 const output=b.sandbox.doGet({parameter:{callback:'turnpartHandoverResponse1'}}).text;
 const records=JSON.parse(output.slice(output.indexOf('(')+1,-2)).records;
 assert.equal(records.length,1);assert.deepEqual(records[0].part_keys,[b.keys[0]]);
 assert(!output.includes('signature'));assert(!output.includes('maker'));
 assert.equal(b.sandbox.doGet({parameter:{callback:'alert(1)'}}).text,'Invalid callback.');
});
test('bridge rejects altered identities, duplicate selection, unknown sheets and incomplete full handovers',()=>{
 for(const patch of [{part_keys:['changed']},{part_keys:[]},{part_keys:['x','x']},{source_sheet:'OTHER'},{handover_type:'full'},{handover_type:'full',part_keys:null}]){
  const b=bridge();assert.match(b.post({...b.packet,...patch}),/^Not recorded:/);
 }
 const b=bridge();assert.match(b.post({...b.packet,handover_type:'full',part_keys:b.keys}),/^Not recorded:/);
 b.rows[3][15]='YES';assert.equal(b.post({...b.packet,handover_type:'full',part_keys:b.keys}),'Recorded.');
});
