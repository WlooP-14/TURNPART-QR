const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('../dist/handover.js');
const job=()=>({id:'1420-BAEM-0926',code:'1420 BAEM 0926',name:'1420',customer:'BAEM',bom:'12/10/2026',parts:[{name:'GUIDE PIN',qty:'4',material:'8620',ready:'YES'},{name:'BUSH',qty:'4',material:'8620',ready:'TRUE'}]});
test('handover requires a nonempty complete set explicitly ready to assemble',()=>{
 assert(H.eligible(job()));assert(!H.eligible(null));assert(!H.eligible({parts:[]}));
 for(const ready of ['NO','','TO PLAN',undefined]){const j=job();j.parts[1].ready=ready;assert(!H.eligible(j));assert.throws(()=>H.proof(j,'Test Maker','Test Sender',true));}
});
test('proof requires both names and explicit self-review, preserving Unicode safely as text',()=>{
 for(const [maker,sender,review]of [['','Test Sender',true],['Test Maker','',true],['Test Maker','Test Sender',false],['x'.repeat(101),'Test Sender',true]])assert.throws(()=>H.proof(job(),maker,sender,review));
 const p=H.proof(job(),'  Test   Maker  ','परीक्षण',true,new Date('2026-11-27T20:00:00Z'));
 assert.equal(p.maker,'Test Maker');assert.equal(p.sender,'परीक्षण');assert.equal(p.date,'28 November 2026');
 assert(p.paragraphs.some(text=>text.includes('turnparts only')));assert(p.paragraphs.some(text=>text.includes('proper self-review')));
 assert(p.paragraphs.join(' ').includes('Test Maker'));assert(p.paragraphs.join(' ').includes('परीक्षण'));
 assert.equal(p.code,'1420 BAEM 0926');assert.equal(p.filename,'1420BAEM turnpart handover proof.pdf');
});
test('proof snapshot detects readiness, part, material, quantity, and mould changes',()=>{
 const original=job(),fingerprint=H.fingerprint(original);
 for(const field of ['name','qty','material','ready']){const changed=job();changed.parts[0][field]='changed';assert.notEqual(H.fingerprint(changed),fingerprint);}
 const changed=job();changed.id='other';assert.notEqual(H.fingerprint(changed),fingerprint);
 assert(!/[\\/:*?"<>|]/.test(H.filename({name:'14/20',customer:'BAEM:*'})));
});
test('letter emphasizes actual mould, people, date and review details without changing the wording',()=>{
 const p=H.proof(job(),'Maker Name','Sender Name',true);
 assert.deepEqual(p.paragraphRuns.map(runs=>runs.map(run=>run.text).join('')),p.paragraphs);
 const bold=p.paragraphRuns.flat().filter(run=>run.bold).map(run=>run.text);
 for(const value of [p.code,p.maker,p.sender,p.date,'2','proper self-review','ready to assemble','turnparts only'])assert(bold.includes(value));
});
test('mixed regular and bold lines wrap only between complete words, retaining punctuation and emphasis',()=>{
 const runs=[{text:'For '},{text:'A. Maker',bold:true},{text:', mould '},{text:'1420BAEM',bold:true},{text:' is ready.'}];
 const measure=(text,bold)=>text.length*(bold?2:1);
 const lines=H.wrapRuns(runs,22,measure);
 const texts=lines.map(line=>line.map(run=>run.text).join(''));
 assert.equal(texts.join(' '),'For A. Maker, mould 1420BAEM is ready.');
 assert(texts.some(line=>line.includes('Maker,')));
 for(const line of lines)assert(line.reduce((sum,run)=>sum+measure(run.text,run.bold),0)<=22);
 assert(lines.flat().filter(run=>run.text==='1420BAEM').every(run=>run.bold));
 const long='OneUnusuallyLongIdentifier';
 assert.equal(H.wrapRuns([{text:long,bold:true}],4,measure)[0][0].text,long);
 assert.deepEqual(H.wrapRuns([],10,measure),[]);
});
