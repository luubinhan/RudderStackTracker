# Identify / Group Event Colors Design

Differentiate RudderStack `identify` and `group` batch items from `track` in the popup list: distinct labels and whole-card colors.

## Goal

When a beacon batch includes `identify` or `group` items, the popup should show a distinct event name and accordion color so those calls are easy to spot next to green track rows.

## Decisions

| Topic | Choice |
|-------|--------|
| Color target | Whole accordion card (border + header background) |
| identify color | Orange |
| group color | Blue |
| track color | Existing green (unchanged) |
| Type signal | Store `eventType` on each entry |
| identify label | `"identify"` |
| group label | `item.groupId` (fallback `"Unknown Group"`) |
| Legacy entries | Default to green when `eventType` missing |

## Architecture

Changes in three places only:

1. `parse-payload.js` — naming + `eventType` when building storage entries
2. `popup.js` — apply type CSS class from `track.eventType`
3. `popup.css` — orange / blue accordion variants

No background listener or permission changes.

## Entry shape

Each stored track entry:

| Field | Rule |
|-------|------|
| `eventType` | Batch: `item.type` when present, else `"track"`. Legacy single body: `"track"`. |
| `eventName` | `group` → `item.groupId` or `"Unknown Group"`; `identify` → `"identify"`; else existing display_name / unformatted_name / event chain |
| `id`, `timestamp`, `payload` | Unchanged |

## Data flow

1. Capture / parse batch as today.
2. `buildTrackEntries` maps each batch item with the naming rules above and sets `eventType`.
3. Popup renders accordion; if `eventType` is `identify` or `group`, add `accordion-item--identify` or `accordion-item--group`.
4. CSS styles those classes with orange / blue border and header backgrounds; default remains green.

## Error handling

- Missing `groupId` on a group item → `eventName: "Unknown Group"`, still `eventType: "group"`.
- Unknown / missing `type` → treat as track (green + existing name chain).
- Old stored rows without `eventType` → green default (no migration).

## Testing

- Unit tests in `parse-payload.test.js`:
  - identify → `eventName: "identify"`, `eventType: "identify"`
  - group → `eventName` from `groupId`, `eventType: "group"`
  - existing track cases still pass with `eventType: "track"`
- Manual: reload extension, fire identify/group/track batch items, confirm labels and card colors.

## Out of scope

- Other RudderStack types (`page`, `alias`, etc.)
- Search behavior changes
- Migrating or rewriting already-stored tracks
- Automated popup / CSS tests
