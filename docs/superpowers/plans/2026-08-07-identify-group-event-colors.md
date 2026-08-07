# Identify / Group Event Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Label and color-code RudderStack `identify` (orange) and `group` (blue) batch items in the popup, while leaving track rows green.

**Architecture:** `buildTrackEntries` in `parse-payload.js` adds `eventType` and type-specific `eventName`. The popup reads `eventType` and applies CSS modifier classes for whole-card orange/blue styling.

**Tech Stack:** Vanilla JS Chrome MV3 extension, Node `assert` unit tests (`node parse-payload.test.js`), CSS class modifiers.

## Global Constraints

- Whole accordion card styling (border + header background), not badge-only.
- identify = orange; group = blue; track = existing green.
- identify `eventName` is exactly `"identify"`.
- group `eventName` is `item.groupId`, else `"Unknown Group"`.
- Store `eventType` on each entry; missing `eventType` → green default.
- No popup automated tests; unit-test parse layer only.
- Out of scope: `page`/`alias`, search changes, storage migration.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `parse-payload.js` | Build storage entries with `eventType` + type-aware `eventName` |
| `parse-payload.test.js` | Unit tests for identify/group/track naming |
| `popup.js` | Apply `accordion-item--identify` / `--group` from `track.eventType` |
| `popup.css` | Orange / blue accordion variants |

No new files.

---

### Task 1: Parse layer — eventType and type-aware names

**Files:**
- Modify: `parse-payload.js`
- Test: `parse-payload.test.js`

**Interfaces:**
- Consumes: existing `buildTrackEntries(payloadObj, finalPayload)` → array of `{ id, eventName, timestamp, payload }`
- Produces: same function; each entry also includes `eventType: "track" | "identify" | "group"`; identify/group naming per Global Constraints

- [ ] **Step 1: Write the failing tests**

Append to `parse-payload.test.js`:

```js
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
```

Also update the existing `"batch item uses properties.event.display_name"` test to assert `eventType === "track"` if not covered by the new track test alone (the new track test is enough; leave existing assertions intact).

- [ ] **Step 2: Run tests to verify they fail**

Run: `node parse-payload.test.js`

Expected: FAIL on identify/group/eventType assertions (`eventType` undefined and/or wrong `eventName`).

- [ ] **Step 3: Implement naming helper and wire into buildTrackEntries**

In `parse-payload.js`, add:

```js
function resolveBatchItemMeta(item) {
  const eventType = item?.type || "track";

  if (eventType === "identify") {
    return { eventType, eventName: "identify" };
  }

  if (eventType === "group") {
    return {
      eventType,
      eventName: item.groupId || "Unknown Group"
    };
  }

  return {
    eventType: eventType === "track" ? "track" : eventType,
    eventName: item.properties?.event?.display_name
      || item.properties?.unformatted_name
      || item.properties?.event?.event_unformatted_name
      || item.properties?.event
      || "Unknown Event"
  };
}
```

For unknown types that are not identify/group, prefer treating display as track-style naming while still storing `item.type` if present — but per spec, unknown/missing type should behave as track. Simplify to:

```js
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
```

Update the batch map in `buildTrackEntries`:

```js
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
```

Update the legacy single-entry return:

```js
return [{
  id: baseId,
  eventType: "track",
  eventName: extractLegacyEventName(payloadObj),
  timestamp,
  payload: finalPayload
}];
```

Export `resolveBatchItemMeta` only if needed for tests; prefer testing via `buildTrackEntries` only (do not export unless used elsewhere).

Remove the debug `console.log` in `extractLegacyEventName` if still present (cleanup while touching that area is fine; do not expand scope otherwise).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node parse-payload.test.js`

Expected: `All tests passed.` (and each `PASS ...` line).

- [ ] **Step 5: Commit**

```bash
git add parse-payload.js parse-payload.test.js docs/superpowers/specs/2026-08-07-identify-group-event-colors-design.md
git commit -m "$(cat <<'EOF'
Add eventType and type-aware names for identify/group batch items.

EOF
)"
```

Include the design spec in this commit if it is still untracked.

---

### Task 2: Popup CSS + class wiring for orange/blue cards

**Files:**
- Modify: `popup.css`
- Modify: `popup.js` (accordion class assignment around the `accordionItem.className = 'accordion-item'` line)

**Interfaces:**
- Consumes: `track.eventType` from Task 1 (`"identify" | "group" | "track"` or undefined)
- Produces: CSS classes `accordion-item--identify` and `accordion-item--group`; green remains default `.accordion-item`

- [ ] **Step 1: Add CSS variants**

Append to `popup.css` (after existing `.accordion-item` / header rules):

```css
/* identify — orange */
.accordion-item--identify {
  background: #fff8f0;
  border-color: #f0a04b;
}

.accordion-item--identify .accordion-header {
  background: #fff8f0;
}

.accordion-item--identify .accordion-header:hover {
  background: #ffeed9;
}

/* group — blue */
.accordion-item--group {
  background: #f0f6ff;
  border-color: #4b8cf0;
}

.accordion-item--group .accordion-header {
  background: #f0f6ff;
}

.accordion-item--group .accordion-header:hover {
  background: #e0ecff;
}
```

- [ ] **Step 2: Apply modifier class in popup.js**

Replace the accordion item class assignment:

```js
const accordionItem = document.createElement('div');
const typeClass =
  track.eventType === 'identify' ? ' accordion-item--identify'
  : track.eventType === 'group' ? ' accordion-item--group'
  : '';
accordionItem.className = 'accordion-item' + typeClass;
```

Keep all other rendering logic unchanged.

- [ ] **Step 3: Manual verification checklist**

1. Reload the extension in `chrome://extensions`.
2. Clear tracks in the popup.
3. Trigger a page that sends a batch including `track`, `identify`, and `group`.
4. Confirm:
   - track row green, label from display_name
   - identify row orange, label `identify`
   - group row blue, label = `groupId`
5. Confirm search still filters by `eventName`.

- [ ] **Step 4: Commit**

```bash
git add popup.js popup.css
git commit -m "$(cat <<'EOF'
Color identify and group accordion cards in the popup.

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| Whole-card color | Task 2 |
| identify orange / group blue / track green | Task 2 |
| Store `eventType` | Task 1 |
| identify → `"identify"` | Task 1 |
| group → `groupId` / `"Unknown Group"` | Task 1 |
| Legacy / missing type → track + green | Task 1 + Task 2 |
| Unit tests | Task 1 |
| Manual color check | Task 2 |
| Out of scope items | Not implemented |

No placeholders remaining. Property names consistent: `eventType`, `eventName`, `accordion-item--identify`, `accordion-item--group`.
