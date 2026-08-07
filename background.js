importScripts("parse-payload.js");

console.log("RudderStackTracker: background.js loaded");

const TARGET_URL_PATTERNS = [
  "*://*.rudderstack.com/v1/track*",
  "*://*.rudderstack.com/v1/batch*",
  "*://*.rudderstack.com/beacon/v1/batch*"
];

function isRudderStackAnalyticsUrl(url) {
  try {
    const u = new URL(url);
    return (
      u.hostname.endsWith("rudderstack.com") &&
      (u.pathname.includes("/v1/track") ||
        u.pathname.includes("/v1/batch") ||
        u.pathname.includes("/beacon/v1/batch"))
    );
  } catch {
    return false;
  }
}

console.log("RudderStackTracker: Registering webRequest listener for:", TARGET_URL_PATTERNS);

function storeTrackEntries(trackEntries) {
  if (trackEntries.length === 0) {
    return;
  }

  console.log(
    "RudderStackTracker: Storing track entries:",
    trackEntries.map((e) => e.eventName)
  );
  chrome.storage.local.get(["allTracks"], (result) => {
    if (chrome.runtime.lastError) {
      console.error(
        "RudderStackTracker: Error getting storage:",
        chrome.runtime.lastError
      );
      return;
    }
    const allTracks = result.allTracks || [];
    for (const entry of trackEntries) {
      allTracks.unshift(entry);
    }

    while (allTracks.length > 50) {
      allTracks.pop();
    }

    chrome.storage.local.set({ allTracks: allTracks }, () => {
      if (chrome.runtime.lastError) {
        console.error(
          "RudderStackTracker: Error setting storage:",
          chrome.runtime.lastError
        );
        return;
      }
      console.log(
        "RudderStackTracker: Tracks stored successfully, total:",
        allTracks.length
      );
    });

    chrome.action.setBadgeText({ text: allTracks.length.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#2ecc71" });
    console.log("RudderStackTracker: Badge updated:", allTracks.length);
  });
}

function ingestPayloadString(bodyString, source) {
  if (!bodyString || typeof bodyString !== "string") {
    console.log("RudderStackTracker: Empty body from", source);
    return;
  }

  const { payloadObj, finalPayload } = parseBodyString(bodyString);
  const trackEntries = buildTrackEntries(payloadObj, finalPayload);
  if (trackEntries.length === 0) {
    console.log(
      "RudderStackTracker: No storeable entries from",
      source,
      "(body unreadable or empty batch)"
    );
    return;
  }
  console.log("RudderStackTracker: Ingested from", source);
  storeTrackEntries(trackEntries);
}

// Page-hook path: sendBeacon / fetch bodies Chrome webRequest cannot read
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "RUDDERSTACK_PAYLOAD") {
    return;
  }

  if (!isRudderStackAnalyticsUrl(message.url || "")) {
    sendResponse({ ok: false, reason: "url" });
    return;
  }

  ingestPayloadString(message.body, "page-hook");
  sendResponse({ ok: true });
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    console.log("RudderStackTracker: Request captured:", details.url);
    if (details.method !== "POST" || !details.requestBody) {
      return;
    }

    const decoded = decodeWebRequestBody(details.requestBody);
    if (!decoded) {
      // Typical for navigator.sendBeacon — page-hook should capture instead
      console.log(
        "RudderStackTracker: webRequest body unavailable (likely sendBeacon); waiting for page-hook",
        details.requestBody.error || details.requestBody
      );
      return;
    }

    const trackEntries = buildTrackEntries(
      decoded.payloadObj,
      decoded.finalPayload
    );
    storeTrackEntries(trackEntries);
  },
  { urls: TARGET_URL_PATTERNS },
  ["requestBody", "extraHeaders"]
);
