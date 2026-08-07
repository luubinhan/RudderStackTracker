/**
 * Shared payload parsing for RudderStack track/batch bodies.
 * No Chrome APIs — safe to unit-test in Node.
 */

function extractLegacyEventName(payloadObj) {
  if (payloadObj) {
    return payloadObj.properties?.event_unformatted_name
      || payloadObj.properties?.event?.unformatted_name
      || payloadObj.properties?.event;
  }
  return "Unknown Event";
}

function resolveBatchItemMeta(item) {
  const rawType = item?.type;

  if (rawType === "identify") {
    return { eventType: "identify", eventName: "identify" };
  }

  if (rawType === "group") {
    return {
      eventType: "group",
      eventName: item.groupId || "Unknown Group"
    };
  }

  return {
    eventType: "track",
    eventName: item.properties?.event?.display_name
      || item.properties?.unformatted_name
      || item.properties?.event?.event_unformatted_name
      || item.properties?.event
      || "Unknown Event"
  };
}

/**
 * Build storage entries from a parsed payload object.
 * Returns [] when there is nothing useful to store (empty batch, or unparsed body).
 */
function buildTrackEntries(payloadObj, finalPayload) {
  const timestamp = new Date().toLocaleTimeString();
  const baseId = Date.now();

  if (payloadObj && Array.isArray(payloadObj.batch)) {
    if (payloadObj.batch.length === 0) {
      return [];
    }

    // Reverse so unshifting yields batch[0] above later items
    return payloadObj.batch.map((item, index) => {
      const { eventType, eventName } = resolveBatchItemMeta(item);
      return {
        id: baseId + index,
        eventType,
        eventName,
        timestamp,
        payload: JSON.stringify(item, null, 2)
      };
    }).reverse();
  }

  if (!payloadObj) {
    return [];
  }

  return [{
    id: baseId,
    eventType: "track",
    eventName: extractLegacyEventName(payloadObj),
    timestamp,
    payload: finalPayload
  }];
}

/**
 * Decode a request body string into { payloadObj, finalPayload }.
 * payloadObj is null when JSON parse fails; finalPayload is still the raw string.
 */
function parseBodyString(decodedString) {
  try {
    const payloadObj = JSON.parse(decodedString);
    return {
      payloadObj,
      finalPayload: JSON.stringify(payloadObj, null, 2)
    };
  } catch {
    return {
      payloadObj: null,
      finalPayload: decodedString
    };
  }
}

/**
 * Decode chrome.webRequest requestBody into { payloadObj, finalPayload }.
 * Returns null when the body cannot be read (e.g. sendBeacon → { error }).
 */
function decodeWebRequestBody(requestBody) {
  if (!requestBody) {
    return null;
  }

  if (requestBody.raw && requestBody.raw.length > 0 && requestBody.raw[0].bytes) {
    try {
      const decoder = new TextDecoder("utf-8");
      const decodedString = decoder.decode(requestBody.raw[0].bytes);
      return parseBodyString(decodedString);
    } catch {
      return {
        payloadObj: null,
        finalPayload: "Error decoding raw bytes."
      };
    }
  }

  if (requestBody.formData) {
    return {
      payloadObj: null,
      finalPayload: JSON.stringify(requestBody.formData, null, 2)
    };
  }

  // Chrome often returns { error: "Unknown error." } for sendBeacon bodies
  return null;
}

const ParsePayload = {
  extractLegacyEventName,
  buildTrackEntries,
  parseBodyString,
  decodeWebRequestBody
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = ParsePayload;
}

// Chrome MV3 service worker (importScripts) — expose on global
if (typeof self !== "undefined") {
  self.extractLegacyEventName = extractLegacyEventName;
  self.buildTrackEntries = buildTrackEntries;
  self.parseBodyString = parseBodyString;
  self.decodeWebRequestBody = decodeWebRequestBody;
}
