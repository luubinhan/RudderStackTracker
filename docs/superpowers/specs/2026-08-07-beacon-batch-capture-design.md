# Beacon Batch Capture Design

Capture RudderStack `beacon/v1/batch` requests in the existing Chrome extension, while keeping legacy `/v1/track` support.

## Goal

When apps send analytics via `dataplane.rudderstack.com/beacon/v1/batch`, the extension should list each batch event as its own row in the popup, labeled with the human-readable display name.

## Decisions

| Topic | Choice |
|-------|--------|
| Batch handling | One storage/list row per `batch[]` item |
| Event name | `properties.event.display_name` |
| URL scope | New batch URL **and** keep `*/v1/track*` |
| Approach | Minimal patch in `background.js` |
| `writeKey` | Ignored for now |
| Popup | Unchanged |

## Architecture

MV3 service worker (`background.js`) + popup. No new permissions.

Listener URL filters:

```js
[
  "*://*.rudderstack.com/v1/track*",
  "*://dataplane.rudderstack.com/beacon/v1/batch*"
]
```

Update `manifest.json` description to mention batch capture.

## Data flow

1. On matching POST with `requestBody`, decode raw UTF-8 bytes to string and parse JSON (same as today). Fall back to `formData` stringify if present.
2. If parsed object has a `batch` array:
   - For each item, create a track entry:
     - `eventName`: `item.properties?.event?.display_name` or `"Unknown Event"`
     - `payload`: pretty-printed JSON of that single item
     - `id`: unique (`Date.now()` + index)
     - `timestamp`: local time string (existing format)
   - Unshift items in reverse order so `batch[0]` appears above later items for that request.
3. Else: keep existing single-event extraction (`properties.event` / `unformatted_name` fallbacks).
4. Persist via `chrome.storage.local` key `allTracks`; keep last 50; update badge count.

## Error handling

- Decode/parse failure: keep current non-crashing error / "No parsable data" behavior.
- Empty `batch`: store nothing.
- Missing `display_name`: `"Unknown Event"`.

## Out of scope

- Storing or displaying `writeKey`
- Popup UI changes
- Broader `*.rudderstack.com/beacon/...` host matching
- Automated tests

## Manual test plan

1. Reload extension.
2. Trigger a page that fires beacon batch → popup shows rows like `Engage - Page Loaded`, one per batch item, payload is that item only.
3. Confirm legacy `/v1/track` still captures if used.
4. Search and clear still work.
5. After many events, list capped at 50.
