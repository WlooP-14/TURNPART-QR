'use strict';
(() => {
  const install = document.getElementById('installApp');
  const dialog = document.getElementById('installDialog');
  const update = document.getElementById('updateApp');
  const status = document.getElementById('pwaStatus');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let promptEvent = null, registration = null, reloadRequested = false;

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
    if (registration.waiting && navigator.serviceWorker.controller) update.hidden = false;
  }
  update.addEventListener('click', () => {
    if (!registration?.waiting) return;
    reloadRequested = true;
    update.disabled = true;
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested) location.reload();
  });
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
      status.textContent = 'App ready for offline opening. Saved statuses may be out of date.';
    } catch {
      status.textContent = 'Offline app setup failed. You can still use the tracker online.';
    }
  });
})();
