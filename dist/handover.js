(function(root) {
  'use strict';
  function eligible(job) { return !!job?.parts?.length && job.parts.every(part => ['YES','TRUE'].includes(String(part.ready).trim().toUpperCase())); }
  function fingerprint(job) { return JSON.stringify([job.id,job.code,job.bom, job.parts.map(part => [part.name,part.qty,part.material,String(part.ready).trim().toUpperCase()])]); }
  function filename(job) {
    const label = String(job.name || '') + String(job.customer || '');
    return (label.replace(/[\\/:*?"<>|\x00-\x1f]/g, '').trim().slice(0,150) || 'Mould') + ' turnpart handover proof.pdf';
  }
  function proof(job, maker, sender, reviewed, now = new Date()) {
    if (!eligible(job)) throw Error('Every turnpart must be marked ready to assemble.');
    const clean = value => String(value ?? '').trim().replace(/\s+/g,' ');
    maker=clean(maker); sender=clean(sender);
    if (!maker || !sender || maker.length>100 || sender.length>100) throw Error('Enter both names (up to 100 characters each).');
    if (!reviewed) throw Error('Confirm the self-review before preparing the proof.');
    const date = new Intl.DateTimeFormat('en-IN',{day:'2-digit',month:'long',year:'numeric',timeZone:'Asia/Kolkata'}).format(now);
    const normal=text=>({text,bold:false}), bold=text=>({text:String(text),bold:true});
    const paragraphRuns=[
      [normal('I, '),bold(sender),normal(', confirm that I have completed a '),bold('proper self-review'),normal(' of all turnparts listed for mould '),bold(job.code),normal('. All '),bold(job.parts.length),normal(' turnpart entries are marked '),bold('ready to assemble'),normal(' at the time of this handover.')],
      [normal('On '),bold(date),normal(', I am handing over this complete set of turnparts to '),bold(maker),normal(', Die maker, for assembly of the above mould. This handover covers '),bold('turnparts only'),normal('; it does not certify the transfer or readiness of any other mould components.')],
      [normal('I, '),bold(maker),normal(', acknowledge receipt of the above turnparts for mould assembly.')]
    ];
    return { jobId:job.id, code:job.code, bom:job.bom||'—', maker,sender,date, count:job.parts.length, stamp:fingerprint(job), filename:filename(job),
      paragraphRuns, paragraphs:paragraphRuns.map(runs=>runs.map(run=>run.text).join('')) };
  }
  // Keep words intact across style boundaries (including punctuation after bold names).
  function wrapRuns(runs,width,measure){
    const words=[];let word=[],space=false;
    for(const run of runs)for(const token of run.text.match(/\s+|\S+/gu)||[]){
      if(/^\s+$/u.test(token)){space=true;continue;}
      if(space&&word.length){words.push(word);word=[];}
      word.push({text:token,bold:!!run.bold});space=false;
    }
    if(word.length)words.push(word);
    const lines=[];let line=[],used=0;
    for(const parts of words){
      const size=parts.reduce((sum,run)=>sum+measure(run.text,run.bold),0),gap=line.length?measure(' ',false):0;
      if(line.length&&used+gap+size>width){lines.push(line);line=[];used=0;}
      if(line.length){line.push({text:' ',bold:false});used+=gap;}
      line.push(...parts);used+=size;
    }
    if(line.length)lines.push(line);
    return lines;
  }
  const api={eligible,fingerprint,filename,proof,wrapRuns}; root.MouldHandoverModel=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
