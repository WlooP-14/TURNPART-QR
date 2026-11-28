// Bound Google Apps Script for TURNPART-QR. Deploy as a web app executing as you.
const TURNPART_SHEET_ID='1na81bDrcdb0SAaYOBLHKD-WGb1VvHUTbDImeoRl43Ug';
const TURNPART_LOG='TURNPART_HANDOVERS';
function handoverNormalize(value){return String(value==null?'':value).trim().replace(/\s+/g,' ');}
function handoverKey(value){return handoverNormalize(value).toUpperCase();}
function handoverJobs(book,sheetName){
  if(!['Sheet5','JobDispatched'].includes(sheetName))throw Error('Invalid source sheet.');
  const sheet=book.getSheetByName(sheetName);if(!sheet)throw Error('Source sheet not found.');
  const values=sheet.getDataRange().getDisplayValues(),jobs={};let job=null;
  for(let row=2;row<values.length;row++){
    const cells=values[row];
    if(handoverNormalize(cells[1])){
      const code=handoverNormalize(cells[1]),id=handoverKey(code).replace(/ /g,'-');
      if(jobs[id])throw Error('Duplicate mould identifier.');
      job={id,code,parts:[],occurrences:{}};jobs[id]=job;
    }
    if(!job||!handoverNormalize(cells[3]))continue;
    const signature=JSON.stringify([handoverKey(cells[3]),handoverKey(cells[5]),handoverKey(cells[4])]);
    const occurrence=job.occurrences[signature]||0;job.occurrences[signature]=occurrence+1;
    job.parts.push({key:JSON.stringify([job.id,signature,occurrence]),ready:['YES','TRUE'].includes(handoverKey(cells[15]))});
  }
  return jobs;
}
function handoverRecords(book){
  const sheet=book.getSheetByName(TURNPART_LOG);
  if(!sheet||sheet.getLastRow()<2)return [];
  return sheet.getRange(2,1,sheet.getLastRow()-1,6).getValues().map(row=>({id:String(row[0]),job_id:String(row[1]),job_code:String(row[2]),handover_type:String(row[3]),part_keys:JSON.parse(row[4]),created_at:new Date(row[5]).toISOString()}));
}
function doGet(e){
  const callback=String(e.parameter.callback||'');
  if(!/^turnpartHandoverResponse\d+$/.test(callback))return ContentService.createTextOutput('Invalid callback.');
  let data;
  try{data={ok:true,records:handoverRecords(SpreadsheetApp.openById(TURNPART_SHEET_ID))};}
  catch(error){data={ok:false,error:String(error.message||error)};}
  return ContentService.createTextOutput(callback+'('+JSON.stringify(data)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function doPost(e){
  let lock=null;
  try{
    if(!e.postData||e.postData.contents.length>150000)throw Error('Invalid request size.');
    const data=JSON.parse(e.postData.contents);
    if(!/^[0-9a-f-]{36}$/i.test(data.id)||!['full','partial'].includes(data.handover_type)||!Array.isArray(data.part_keys)||!data.part_keys.length||data.part_keys.length>500||new Set(data.part_keys).size!==data.part_keys.length)throw Error('Invalid handover.');
    lock=LockService.getScriptLock();lock.waitLock(10000);
    const book=SpreadsheetApp.openById(TURNPART_SHEET_ID);
    if(handoverRecords(book).some(record=>record.id===data.id))return ContentService.createTextOutput('Already recorded.');
    const job=handoverJobs(book,data.source_sheet)[data.job_id];
    if(!job||!job.parts.length)throw Error('Mould not found.');
    const available=new Set(job.parts.map(part=>part.key));
    if(data.part_keys.some(key=>typeof key!=='string'||!available.has(key)))throw Error('The selected parts have changed.');
    if(data.handover_type==='full'&&(data.part_keys.length!==available.size||!job.parts.every(part=>part.ready)))throw Error('All turnparts must be ready for full handover.');
    let sheet=book.getSheetByName(TURNPART_LOG);
    if(!sheet){sheet=book.insertSheet(TURNPART_LOG);sheet.appendRow(['REQUEST ID','JOB ID','MOULD','HANDOVER TYPE','PART KEYS','RECORDED AT']);sheet.setFrozenRows(1);}
    // No names, signatures, PDFs, or changes to the source part rows are stored here.
    sheet.appendRow([data.id,job.id,job.code,data.handover_type,JSON.stringify(data.part_keys),new Date()]);
    SpreadsheetApp.flush();return ContentService.createTextOutput('Recorded.');
  }catch(error){return ContentService.createTextOutput('Not recorded: '+String(error.message||error));}
  finally{if(lock)lock.releaseLock();}
}
