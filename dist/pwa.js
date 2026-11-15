'use strict';
(() => {
  const install = document.getElementById('installApp');
  const dialog = document.getElementById('installDialog');
  const update = document.getElementById('updateApp');
  const updateDialog = document.getElementById('updateDialog');
  const reminder = document.getElementById('updateReminder');
  const updateStatus = document.getElementById('updateStatus');
  const status = document.getElementById('pwaStatus');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let promptEvent = null, registration = null, reloadRequested = false, offeredWorker = null, lastCheck = 0;

  function installed() { return standalone.matches || navigator.standalone === true; }
  function updateInstallButton() { install.hidden = installed(); }
  updateInstallButton();
  standalone.addEventListener('change', updateInstallButton);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    promptEvent = event;
    updateInstallButton();
  });
  window.addEventListener('appinstalled', () => {
    promptEvent = null;
    install.hidden = true;
    status.textContent = 'App installed.';
  });
  install.addEventListener('click', async () => {
    if (promptEvent) {
      const pending = promptEvent;
      promptEvent = null;
      try { await pending.prompt(); await pending.userChoice; }
      catch { dialog.showModal(); }
    } else dialog.showModal();
  });
  document.getElementById('closeInstall').addEventListener('click', () => dialog.close());

  if (!('serviceWorker' in navigator)) {
    status.textContent = 'Offline app support is unavailable in this browser.';
    return;
  }
  function offerUpdate() {
    if (!registration?.waiting || !navigator.serviceWorker.controller) return;
    if (document.hidden || document.body.classList.contains('printing-batch') || window.matchMedia('print').matches) return;
    if (offeredWorker === registration.waiting) return;
    offeredWorker = registration.waiting;
    update.disabled = false;
    update.textContent = 'Update now';
    updateStatus.textContent = '';
    reminder.hidden = true;
    if (!updateDialog.open) updateDialog.showModal();
  }
  document.getElementById('updateLater').addEventListener('click', () => updateDialog.close());
  updateDialog.addEventListener('close', () => {
    if (registration?.waiting && !reloadRequested) reminder.hidden = false;
  });
  document.getElementById('reopenUpdate').addEventListener('click', () => {
    reminder.hidden = true;
    if (!updateDialog.open) updateDialog.showModal();
  });
  update.addEventListener('click', () => {
    if (!registration?.waiting) return;
    reloadRequested = true;
    update.disabled = true;
    update.textContent = 'Updating…';
    updateStatus.textContent = 'Applying the update…';
    reminder.hidden = true;
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    setTimeout(() => {
      if (!reloadRequested) return;
      reloadRequested = false;
      update.disabled = false;
      update.textContent = 'Try again';
      updateStatus.textContent = 'The update is taking longer than expected. Please try again.';
    }, 20000);
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested) location.reload();
  });
  async function checkForUpdate() {
    offerUpdate();
    if (!registration || document.hidden || navigator.onLine === false || Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    try { await registration.update(); } catch { /* Retry on the next online check. */ }
  }
  document.addEventListener('visibilitychange', checkForUpdate);
  window.addEventListener('online', checkForUpdate);
  window.addEventListener('afterprint', offerUpdate);
  setInterval(checkForUpdate, 60000);
  window.addEventListener('load', async () => {
    try {
      registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
      offerUpdate();
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') offerUpdate();
        });
      });
      await navigator.serviceWorker.ready;
      offerUpdate();
      status.textContent = 'App ready for offline opening. Saved statuses may be out of date.';
    } catch {
      status.textContent = 'Offline app setup failed. You can still use the tracker online.';
    }
  });
})();
