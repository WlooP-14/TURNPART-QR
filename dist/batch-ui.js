'use strict';
(() => {
  const dialog = $('batchDialog'), choices = new Map(), qrImages = new Map();
  const search = $('batchSearch'), list = $('batchJobs');
  let currentPlan = { pages: [], orientation: 'portrait' };
  function makeLabel(job) {
    const label = el('article', undefined, 'batch-label');
    const url = new URL(location.href); url.search = ''; url.hash = ''; url.searchParams.set('job', job.id);
    if (!qrImages.has(url.href)) {
      const qr = qrcode(0, 'M'); qr.addData(url.href); qr.make();
      qrImages.set(url.href, qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true }));
    }
    const image = el('div', undefined, 'batch-qr');
    image.innerHTML = qrImages.get(url.href);
    label.append(el('div', 'MOULD & CRATE', 'label-brand'), image, el('h3', job.code), el('p', 'Scan to view current part statuses'));
    return label;
  }
  function renderPreview() {
    const entries = [...choices].map(([id, copies]) => ({ job: allJobs().find(job => job.id === id), copies })).filter(entry => entry.job);
    currentPlan = MouldBatch.plan(entries);
    const preview = $('batchPreview'); preview.replaceChildren();
    let number = 0;
    for (const page of currentPlan.pages) {
      const section = el('section', undefined, 'batch-page ' + currentPlan.orientation);
      section.setAttribute('aria-label', 'Sheet ' + (++number));
      for (const job of page) section.append(makeLabel(job));
      preview.append(section);
    }
    const count = entries.reduce((sum, entry) => sum + entry.copies, 0);
    $('batchCount').textContent = count + (count === 1 ? ' label' : ' labels');
    $('printBatchButton').disabled = count === 0;
    if (!count) preview.append(el('p', 'Select moulds to preview their labels.', 'muted batch-empty'));
  }
  function renderChoices() {
    const query = search.value.toLowerCase(); list.replaceChildren();
    for (const job of allJobs().filter(job => job.code.toLowerCase().includes(query))) {
      const row = el('div', undefined, 'batch-choice');
      const label = el('label'), checkbox = el('input');
      checkbox.type = 'checkbox'; checkbox.checked = choices.has(job.id);
      label.append(checkbox, el('span', job.code));
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) choices.set(job.id, 1); else choices.delete(job.id);
        renderChoices(); renderPreview();
      });
      const copies = el('input'); copies.type = 'number'; copies.min = '1'; copies.max = '99'; copies.step = '1';
      copies.value = choices.get(job.id) || 1; copies.disabled = !checkbox.checked;
      copies.setAttribute('aria-label', 'Copies for ' + job.code);
      copies.addEventListener('change', () => {
        const value = Number(copies.value);
        if (!Number.isInteger(value) || value < 1 || value > 99) {
          copies.value = choices.get(job.id); return;
        }
        choices.set(job.id, value); renderPreview();
      });
      row.append(label, copies); list.append(row);
    }
    if (!list.children.length) list.append(el('p', 'No matching moulds.', 'muted'));
  }
  $('batchOpen').addEventListener('click', () => {
    choices.clear(); if (selected) choices.set(selected.id, 1);
    search.value = ''; $('qrDialog').close();
    renderChoices(); renderPreview(); dialog.showModal();
  });
  $('closeBatch').addEventListener('click', () => dialog.close());
  search.addEventListener('input', renderChoices);
  $('batchSelectAll').addEventListener('click', () => {
    const query = search.value.toLowerCase();
    for (const job of allJobs().filter(job => job.code.toLowerCase().includes(query))) if (!choices.has(job.id)) choices.set(job.id, 1);
    renderChoices(); renderPreview();
  });
  $('batchClear').addEventListener('click', () => { choices.clear(); renderChoices(); renderPreview(); });
  $('printBatchButton').addEventListener('click', () => {
    if (!currentPlan.pages.length) return;
    const print = $('batchPrint'); print.replaceChildren(...[...$('batchPreview').children].map(page => page.cloneNode(true)));
    document.body.classList.add('printing-batch');
    $('batchPageStyle').textContent = '@page { size: A4 ' + currentPlan.orientation + '; margin: 10mm; }';
    MouldPrint.print(currentPlan.pages.flat());
  });
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-batch'); $('batchPageStyle').textContent = '';
  });
  // Single-label printing remains available after cancelling a batch print.
  $('printQr').addEventListener('click', () => {
    document.body.classList.remove('printing-batch'); $('batchPageStyle').textContent = '';
  }, { capture: true });
})();
