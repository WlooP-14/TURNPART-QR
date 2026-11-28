'use strict';
(() => {
  const H=MouldHandoverModel, modal=$('handoverDialog'), pad=$('signatureDialog'), canvas=$('signatureCanvas'), ctx=canvas.getContext('2d');
  let source=null, draft=null, signature=null, invalid=false, drawing=false, last=null, distance=0;
  const fresh=()=>sheetLive&&navigator.onLine!==false&&fetched&&Date.now()-fetched.getTime()<45000;
  function error(message){$('handoverMessage').textContent=message;}
  function validCurrent(){
    if(!fresh())throw Error('Refresh the sheet online before completing the handover.');
    const current=jobs.find(job=>job.id===source?.id);
    if(!H.eligible(current)||H.fingerprint(current)!==H.fingerprint(source))throw Error('The mould’s parts or readiness changed. Close this proof and start again.');
    return current;
  }
  function refresh(){
    $('handoverButton').hidden=!H.eligible(selected);
    $('handoverButton').disabled=!fresh();
    $('handoverButton').title=fresh()?'':'Refresh the sheet online before handover';
    if(modal.open&&source){
      const current=jobs.find(job=>job.id===source.id);
      if(!H.eligible(current)||H.fingerprint(current)!==H.fingerprint(source)){
        invalid=true;signature=null;$('saveHandover').disabled=true;$('signProof').disabled=true;
        error('The mould’s parts or readiness changed. Close this proof and start again.');
      }
    }
  }
  window.MouldHandover={refresh};
  function step(name){for(const id of ['handoverAsk','handoverForm','handoverPreview'])$(id).hidden=id!==name;error('');}
  $('handoverButton').addEventListener('click',()=>{
    if(!H.eligible(selected)||!fresh())return;
    source=structuredClone(selected);draft=null;signature=null;invalid=false;
    $('handoverMould').textContent=source.code;$('handoverForm').reset();step('handoverAsk');modal.showModal();
  });
  $('closeHandover').addEventListener('click',()=>modal.close());
  $('cancelHandover').addEventListener('click',()=>modal.close());
  $('confirmHandover').addEventListener('click',()=>step('handoverForm'));
  $('handoverForm').addEventListener('submit',event=>{
    event.preventDefault();
    try{
      if(invalid)throw Error('Close this proof and start again with the latest mould data.');
      validCurrent();draft=H.proof(source,$('dieMakerName').value,$('senderName').value,$('handoverReviewed').checked);
      signature=null;$('signProof').disabled=false;$('saveHandover').disabled=true;
      $('proofMould').textContent=draft.code;$('proofDate').textContent=draft.date;$('proofBom').textContent=draft.bom;
      $('proofSender').textContent=draft.sender;$('proofMaker').textContent=draft.maker;
      $('proofBody').replaceChildren(...draft.paragraphs.map(text=>el('p',text)));
      $('proofSignature').hidden=true;$('signProof').textContent='Ready to sign?';step('handoverPreview');
    }catch(e){error(e.message);}
  });
  $('editHandover').addEventListener('click',()=>{signature=null;draft=null;step('handoverForm');});
  function clearPad(){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);distance=0;drawing=false;last=null;$('signatureMessage').textContent='';}
  $('signProof').addEventListener('click',()=>{
    try{
      validCurrent();if(invalid||!draft)throw Error('Prepare a fresh proof first.');
      $('signatureMaker').textContent=draft.maker;pad.showModal();
      const rect=canvas.getBoundingClientRect();
      if(rect.width&&rect.height)canvas.height=Math.round(canvas.width*rect.height/rect.width);
      clearPad();
    }catch(e){error(e.message);}
  });
  $('clearSignature').addEventListener('click',clearPad);
  $('cancelSignature').addEventListener('click',()=>pad.close());
  function point(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*canvas.width/rect.width,y:(event.clientY-rect.top)*canvas.height/rect.height};}
  canvas.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;event.preventDefault();drawing=true;last=point(event);canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!drawing)return;event.preventDefault();const next=point(event);
    ctx.strokeStyle='#142e2b';ctx.lineWidth=6;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(next.x,next.y);ctx.stroke();
    distance+=Math.hypot(next.x-last.x,next.y-last.y);last=next;
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>{drawing=false;last=null;});
  $('useSignature').addEventListener('click',()=>{
    try{
      validCurrent();if(invalid||!draft)throw Error('Prepare a fresh proof first.');
      if(distance<12){$('signatureMessage').textContent='Please draw your signature before continuing.';return;}
      signature=canvas.toDataURL('image/png');$('proofSignature').src=signature;$('proofSignature').hidden=false;
      $('signProof').textContent='Sign again';$('saveHandover').disabled=false;pad.close();
    }catch(e){$('signatureMessage').textContent=e.message;}
  });
  async function makePdf(draft,signature){
    const page=document.createElement('canvas');page.width=1654;page.height=2339;
    const c=page.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,page.width,page.height);
    const left=145,width=1364;
    function text(value,y,size=28,bold=false){c.fillStyle='#203538';c.font=(bold?'600 ':'')+size+'px system-ui, sans-serif';c.fillText(value,left,y);}
    function wrap(value,y,size=29){
      c.font=size+'px system-ui, sans-serif';c.fillStyle='#203538';let line='';
      for(const word of value.split(/\s+/)){
        const next=line?line+' '+word:word;
        if(c.measureText(next).width<=width){line=next;continue;}
        if(line){c.fillText(line,left,y);y+=49;line='';}
        for(const char of word){
          if(c.measureText(line+char).width>width){c.fillText(line,left,y);y+=49;line='';}
          line+=char;
        }
      }
      if(line)c.fillText(line,left,y);return y+65;
    }
    text('MOULD & CRATE',170,26,true);text('TURNPART HANDOVER PROOF',255,46,true);
    c.fillStyle='#164e50';c.fillRect(left,290,width,5);
    let y=365;
    for(const [label,value] of [['Mould',draft.code],['B.O.M. date',draft.bom],['Handover date',draft.date],['Handed over by',draft.sender],['Received by (Die maker)',draft.maker]])y=wrap(label+': '+value,y,27);
    y+=40;for(const paragraph of draft.paragraphs)y=wrap(paragraph,y)+22;
    if(y>1850)throw Error('The proof is too long to fit. Please shorten the names.');
    text('Die maker’s signature',y+35,27,true);
    const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Could not prepare the signature.'));image.src=signature;});
    const signatureScale=Math.min(670/image.width,251/image.height);
    c.drawImage(image,left,y+60,image.width*signatureScale,image.height*signatureScale);
    text(draft.maker,y+355,27);text(draft.date,y+405,25);
    const pdf=await PDFLib.PDFDocument.create();const img=await pdf.embedPng(page.toDataURL('image/png'));const sheet=pdf.addPage([595.28,841.89]);sheet.drawImage(img,{x:0,y:0,width:595.28,height:841.89});
    pdf.setTitle(draft.filename.replace(/\.pdf$/,''));pdf.setSubject('Turnparts-only handover acknowledgement');return pdf.save();
  }
  $('saveHandover').addEventListener('click',async()=>{
    try{
      validCurrent();if(invalid||!draft||!signature)throw Error('The Die maker must sign before the PDF can be saved.');
      const today=H.proof(source,draft.maker,draft.sender,true);
      if(today.date!==draft.date)throw Error('The date has changed. Prepare and sign a new proof for today.');
      $('saveHandover').disabled=true;$('saveHandover').textContent='Preparing PDF…';
      const preparedDraft=draft,preparedSignature=signature;
      const bytes=await makePdf(preparedDraft,preparedSignature);validCurrent();
      if(invalid||draft!==preparedDraft||signature!==preparedSignature)throw Error('The proof changed while preparing the PDF. Please start again.');
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');
      link.href=url;link.download=draft.filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      error('Your signed PDF is ready for download.');
    }catch(e){error(e.message);}finally{$('saveHandover').textContent='Save signed PDF';$('saveHandover').disabled=invalid||!signature;}
  });
  modal.addEventListener('close',()=>{source=null;draft=null;signature=null;$('proofSignature').removeAttribute('src');clearPad();});
  refresh();
})();
