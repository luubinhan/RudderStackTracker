console.log('RudderStackTracker: background.js loaded');

const TARGET_URL_PATTERNS = [
  "*://*.rudderstack.com/v1/track*",
  "*://*.rudderstack.com/beacon/v1/batch*"
];

console.log('RudderStackTracker: Registering webRequest listener for:', TARGET_URL_PATTERNS);

function extractLegacyEventName(payloadObj) {
  if (payloadObj && payloadObj.properties && payloadObj.properties.event) {
    return payloadObj.properties.event_unformatted_name
      || payloadObj.properties.event?.unformatted_name
      || payloadObj.properties.event;
  }
  return "Unknown Event";
}

function buildTrackEntries(payloadObj, finalPayload) {
  const timestamp = new Date().toLocaleTimeString();
  const baseId = Date.now();

  if (payloadObj && Array.isArray(payloadObj.batch)) {
    if (payloadObj.batch.length === 0) {
      return [];
    }

    // Reverse so unshifting yields batch[0] above later items
    return payloadObj.batch.map((item, index) => ({
      id: baseId + index,
      eventName: item?.properties?.event?.display_name || "Unknown Event",
      timestamp,
      payload: JSON.stringify(item, null, 2)
    })).reverse();
  }

  return [{
    id: baseId,
    eventName: extractLegacyEventName(payloadObj),
    timestamp,
    payload: finalPayload
  }];
}

function storeTrackEntries(trackEntries) {
  if (trackEntries.length === 0) {
    return;
  }

  console.log('RudderStackTracker: Storing track entries:', trackEntries.map((e) => e.eventName));
  chrome.storage.local.get(['allTracks'], (result) => {
    if (chrome.runtime.lastError) {
      console.error('RudderStackTracker: Error getting storage:', chrome.runtime.lastError);
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
        console.error('RudderStackTracker: Error setting storage:', chrome.runtime.lastError);
        return;
      }
      console.log('RudderStackTracker: Tracks stored successfully, total:', allTracks.length);
    });

    chrome.action.setBadgeText({ text: allTracks.length.toString() });
    chrome.action.setBadgeBackgroundColor({ color: "#2ecc71" });
    console.log('RudderStackTracker: Badge updated:', allTracks.length);
  });
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    console.log('RudderStackTracker: Request captured:', details.url);
    if (details.method === "POST" && details.requestBody) {
      console.log('RudderStackTracker: POST request with body detected');

      let finalPayload = "No parsable data found.";
      let payloadObj = null;

      // 1. Handle JSON/Raw Data
      if (details.requestBody.raw) {
        try {
          const decoder = new TextDecoder("utf-8");
          const rawData = details.requestBody.raw[0].bytes;
          const decodedString = decoder.decode(rawData);

          try {
            payloadObj = JSON.parse(decodedString);
            finalPayload = JSON.stringify(payloadObj, null, 2);
          } catch {
            finalPayload = decodedString;
          }
        } catch (e) {
          finalPayload = "Error decoding raw bytes.";
        }
      }
      // 2. Handle Form Data
      else if (details.requestBody.formData) {
        finalPayload = JSON.stringify(details.requestBody.formData, null, 2);
      }

      const trackEntries = buildTrackEntries(payloadObj, finalPayload);
      storeTrackEntries(trackEntries);
    }
  },
  { urls: TARGET_URL_PATTERNS },
  ["requestBody", "extraHeaders"]
);
