/**
 * Isolated-world bridge: forward MAIN-world beacon captures to the service worker.
 * page-hook.js is registered separately with "world": "MAIN".
 */
(function () {
  const EVENT_NAME = "__rudderstack_tracker_payload__";

  window.addEventListener(EVENT_NAME, (event) => {
    const detail = event.detail;
    if (!detail || !detail.url || !detail.body) {
      return;
    }
    chrome.runtime.sendMessage(
      {
        type: "RUDDERSTACK_PAYLOAD",
        url: detail.url,
        body: detail.body
      },
      () => {
        // Ignore "Extension context invalidated" after reload
        void chrome.runtime.lastError;
      }
    );
  });
})();
