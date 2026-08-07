/**
 * Runs in the page MAIN world. Chrome's webRequest API often cannot read
 * navigator.sendBeacon bodies ({ error: "Unknown error." }), so we capture
 * the payload here before it is sent and forward it via a DOM event.
 *
 * fetch/XHR are left to chrome.webRequest (those bodies are usually readable).
 */
(function () {
  const EVENT_NAME = "__rudderstack_tracker_payload__";

  function isRudderUrl(url) {
    if (!url || typeof url !== "string") {
      return false;
    }
    try {
      const absolute = new URL(url, location.href);
      return (
        absolute.hostname.endsWith("rudderstack.com") &&
        (absolute.pathname.includes("/v1/track") ||
          absolute.pathname.includes("/v1/batch") ||
          absolute.pathname.includes("/beacon/v1/batch"))
      );
    } catch {
      return false;
    }
  }

  async function bodyToString(data) {
    if (data == null) {
      return "";
    }
    if (typeof data === "string") {
      return data;
    }
    if (typeof Blob !== "undefined" && data instanceof Blob) {
      return data.text();
    }
    if (data instanceof ArrayBuffer) {
      return new TextDecoder("utf-8").decode(data);
    }
    if (ArrayBuffer.isView(data)) {
      return new TextDecoder("utf-8").decode(data);
    }
    return String(data);
  }

  function emitPayload(url, body) {
    window.dispatchEvent(
      new CustomEvent(EVENT_NAME, {
        detail: { url: String(url), body: String(body) }
      })
    );
  }

  async function capture(url, data) {
    if (!isRudderUrl(url)) {
      return;
    }
    try {
      const body = await bodyToString(data);
      if (body) {
        emitPayload(url, body);
      }
    } catch (err) {
      console.warn("RudderStackTracker: failed to read beacon body", err);
    }
  }

  const originalSendBeacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function (url, data) {
    capture(url, data);
    return originalSendBeacon(url, data);
  };
})();
