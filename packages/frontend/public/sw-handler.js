(function () {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.addEventListener('message', function (event) {
    try {
      if (event && event.data && event.data.type === 'SW_CLEANUP_RELOAD') {
        window.location.reload();
      }
    } catch (error) {
      console.warn('[sw-cleanup] reload handler failed', error);
    }
  });
})();
