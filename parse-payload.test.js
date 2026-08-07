const assert = require("assert");
const {
  buildTrackEntries,
  parseBodyString,
  decodeWebRequestBody
} = require("./parse-payload.js");

// Minimal shape matching network payload from Sinch Engage beacon/v1/batch
const BEACON_BATCH_PAYLOAD = {
  batch: [
    {
      properties: {
        sinch_sdk_version: "0.0.0+5e02cfaa",
        event: {
          tracing_id: "gevrdQXuKuYsj_szPNDUg",
          type: "com.sinch.frontend.event",
          name: "engage_page_loaded",
          unformatted_name: "page_loaded",
          display_name: "Engage - Page Loaded"
        },
        user: { id: "7cd4316b-159c-45c0-94e8-e59317bb54e0" }
      },
      event: "com.sinch.frontend.event",
      type: "track",
      channel: "web"
    }
  ],
  writeKey: "dummy"
};

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

test("batch item uses properties.event.display_name", () => {
  const entries = buildTrackEntries(
    BEACON_BATCH_PAYLOAD,
    JSON.stringify(BEACON_BATCH_PAYLOAD, null, 2)
  );
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].eventName, "Engage - Page Loaded");
  const stored = JSON.parse(entries[0].payload);
  assert.strictEqual(stored.type, "track");
  assert.strictEqual(stored.properties.event.name, "engage_page_loaded");
});

test("parseBodyString accepts real batch JSON string", () => {
  const raw = JSON.stringify(BEACON_BATCH_PAYLOAD);
  const { payloadObj, finalPayload } = parseBodyString(raw);
  assert.ok(payloadObj);
  assert.ok(Array.isArray(payloadObj.batch));
  const entries = buildTrackEntries(payloadObj, finalPayload);
  assert.strictEqual(entries[0].eventName, "Engage - Page Loaded");
});

test("unreadable webRequest body (sendBeacon) yields no store entries", () => {
  const decoded = decodeWebRequestBody({ error: "Unknown error." });
  assert.strictEqual(decoded, null);
  const entries = buildTrackEntries(null, "No parsable data found.");
  assert.deepStrictEqual(entries, []);
});

test("empty batch stores nothing", () => {
  const entries = buildTrackEntries({ batch: [] }, "{}");
  assert.deepStrictEqual(entries, []);
});

test("legacy single track still named from properties.event", () => {
  const legacy = {
    properties: {
      event: "button_clicked",
      event_unformatted_name: "button_clicked"
    },
    type: "track"
  };
  const entries = buildTrackEntries(legacy, JSON.stringify(legacy, null, 2));
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].eventName, "button_clicked");
});

test("decodeWebRequestBody reads raw UTF-8 bytes", () => {
  const raw = JSON.stringify(BEACON_BATCH_PAYLOAD);
  const bytes = new TextEncoder().encode(raw).buffer;
  const decoded = decodeWebRequestBody({ raw: [{ bytes }] });
  assert.ok(decoded.payloadObj);
  const entries = buildTrackEntries(decoded.payloadObj, decoded.finalPayload);
  assert.strictEqual(entries[0].eventName, "Engage - Page Loaded");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
