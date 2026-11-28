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
    return { jobId:job.id, code:job.code, bom:job.bom||'—', maker,sender,date, count:job.parts.length, stamp:fingerprint(job), filename:filename(job),
      paragraphs:[
        `I, ${sender}, confirm that I have completed a proper self-review of all turnparts listed for mould ${job.code}. All ${job.parts.length} turnpart entries are marked ready to assemble at the time of this handover.`,
        `On ${date}, I am handing over this complete set of turnparts to ${maker}, Die maker, for assembly of the above mould. This handover covers turnparts only; it does not certify the transfer or readiness of any other mould components.`,
        `I, ${maker}, acknowledge receipt of the above turnparts for mould assembly.`
      ] };
  }
  const api={eligible,fingerprint,filename,proof}; root.MouldHandoverModel=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
