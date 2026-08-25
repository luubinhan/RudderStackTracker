const assert = require("assert");
const {
  buildTrackEntries,
  parseBodyString,
  decodeWebRequestBody
} = require("./parse-payload.js");

// Flattened track properties from /v1/batch (event_* fields on properties)
const BEACON_BATCH_PAYLOAD = {
  batch: [
    {
      properties: {
        app_name: "Engage",
        event_name: "engage_page_loaded",
        event_unformatted_name: "page_loaded",
        event_display_name: "Engage - Page Loaded",
        user_id: "e22f17b6-9a76-40a2-a3d6-c8e45ebe071b"
      },
      event: "Engage - Page Loaded",
      type: "track",
      channel: "web"
    }
  ],
  sentAt: "2026-08-25T02:22:46.316Z"
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

test("batch item uses properties.event_display_name", () => {
  const entries = buildTrackEntries(
    BEACON_BATCH_PAYLOAD,
    JSON.stringify(BEACON_BATCH_PAYLOAD, null, 2)
  );
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].eventName, "Engage - Page Loaded");
  const stored = JSON.parse(entries[0].payload);
  assert.strictEqual(stored.type, "track");
  assert.strictEqual(stored.properties.event_name, "engage_page_loaded");
  assert.strictEqual(stored.event, "Engage - Page Loaded");
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

test("identify batch item uses eventName identify and eventType identify", () => {
  const payload = {
    batch: [
      {
        type: "identify",
        traits: { email: "a@b.com" },
        userId: "u1"
      }
    ],
    writeKey: "dummy"
  };
  const entries = buildTrackEntries(payload, JSON.stringify(payload, null, 2));
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].eventName, "identify");
  assert.strictEqual(entries[0].eventType, "identify");
});

test("group batch item uses groupId and eventType group", () => {
  const payload = {
    batch: [
      {
        type: "group",
        groupId: "org_123",
        traits: { name: "Acme" }
      }
    ],
    writeKey: "dummy"
  };
  const entries = buildTrackEntries(payload, JSON.stringify(payload, null, 2));
  assert.strictEqual(entries.length, 1);
  assert.strictEqual(entries[0].eventName, "org_123");
  assert.strictEqual(entries[0].eventType, "group");
});

test("group without groupId falls back to Unknown Group", () => {
  const payload = {
    batch: [{ type: "group", traits: {} }],
    writeKey: "dummy"
  };
  const entries = buildTrackEntries(payload, JSON.stringify(payload, null, 2));
  assert.strictEqual(entries[0].eventName, "Unknown Group");
  assert.strictEqual(entries[0].eventType, "group");
});

test("track batch item includes eventType track", () => {
  const entries = buildTrackEntries(
    BEACON_BATCH_PAYLOAD,
    JSON.stringify(BEACON_BATCH_PAYLOAD, null, 2)
  );
  assert.strictEqual(entries[0].eventType, "track");
  assert.strictEqual(entries[0].eventName, "Engage - Page Loaded");
});

test("legacy single track includes eventType track", () => {
  const legacy = {
    properties: {
      event: "button_clicked",
      event_unformatted_name: "button_clicked"
    },
    type: "track"
  };
  const entries = buildTrackEntries(legacy, JSON.stringify(legacy, null, 2));
  assert.strictEqual(entries[0].eventType, "track");
});

test("nested properties.event.display_name still resolves", () => {
  const payload = {
    batch: [
      {
        properties: {
          event: {
            name: "engage_page_loaded",
            display_name: "Engage - Page Loaded"
          }
        },
        event: "com.sinch.frontend.event",
        type: "track"
      }
    ]
  };
  const entries = buildTrackEntries(payload, JSON.stringify(payload, null, 2));
  assert.strictEqual(entries[0].eventName, "Engage - Page Loaded");
});

if (!process.exitCode) {
  console.log("All tests passed.");
}
