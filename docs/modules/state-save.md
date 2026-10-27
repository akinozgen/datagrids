---
title: stateSave
type: module
description: Remember each user's sort, page size and hidden columns per grid in localStorage, with versioning, a sliding expiry and a one-call reset.
since: 0.1.0
---

# stateSave

Remembers how a user left the grid — sort, page size, hidden columns — and restores it on the next
visit, before the first request.

<Demo id="mod-state-save-basic" />

## When to use it

Use it on list pages people return to every day and tune to their taste (hidden columns, a
favourite sort). Skip it when the view must always open the same way (dashboards, embedded
widgets), or when the state belongs in a shareable link — that is [urlSync](/modules/url-sync).

Search text and the current page are **not** saved by default: a list that reopens filtered or on
page 7 looks broken. Opt in per part with `include`.

## Usage

```js
import { Datagrid, serverSide, yajra, stateSave } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns,
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }), stateSave()],
});
```

Also keep the search text and the filter values:

```js
stateSave({ include: ["search", "filters"] });
```

Drop every stored state after you changed the columns in a way old states should not survive:

```js
stateSave({ version: 2 });
```

Per browser tab instead of per browser, and expire after a day of inactivity:

```js
stateSave({ storage: sessionStorage, ttl: 24 * 60 * 60 * 1000 });
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | grid `name`, then the table `id`, then `"grid"` | Id part of the storage key. The full key is `dg:1:<key>:<location.pathname>`. |
| `version` | `number` | `1` | A stored state with another version is discarded (and removed). |
| `ttl` | `number` (ms) | 90 days | Maximum age. Restoring refreshes the timestamp, so the expiry slides with use. `0` never expires. |
| `include` | `Array<"search" \| "filters" \| "page">` | `[]` | Extra parts to save. Sort, page size and hidden columns are always saved. |
| `storage` | `Storage \| null` | `localStorage` | Any Web Storage object; `null` disables persistence (the API still works). |
| `delay` | `number` (ms) | `250` | Write debounce. Pending writes are flushed on `pagehide` and `destroy()`. |
| `can` | `boolean` | `true` | Permission flag: `false` attaches the module but saves and restores nothing. |

## API added to the grid

Available as `grid.state` (typed: `grid.module(stateSave)`).

| Member | Returns | Description |
|---|---|---|
| `key` | `string` | The storage key in use. |
| `save()` | `void` | Writes the current state now (skips the debounce). |
| `read()` | `StatePayload \| null` | The stored payload; `null` when missing, expired, from another version or unreadable. |
| `clear()` | `void` | Removes the stored state. The current view stays as it is. |
| `reset()` | `Promise<void>` | Removes the stored state, restores the initial view (columns, sort, page size, opted-in parts) and reloads once. Never reloads the page. |

The stored payload is `{ v, t, fp, core: { sort, pageSize, hidden, search?, filters?, page? }, modules }`
— `fp` is the list of column keys at save time, `modules` holds what other modules contributed.

## Events

None of its own. It saves after `sort`, `pagesize` and `columnchange` (plus `search`, `page` and
`load` for the opted-in parts).

## Pipelines it plugs into

- **State**: owns the state pipeline. Other modules contribute their own part (`ctx.state({ key, save, load })`), stored under `modules`.
- **Lifecycle**: restores in the grid's ready phase, after the columns are resolved and before the
  first load — the first request already carries the restored sort and page size.

## Works with

- **Enhanced by** [button.resetState](/modules/buttons#button-resetstate) (a toolbar button for
  `grid.state.reset()`) and [colVis](/modules/colvis) (hidden columns are saved).
- **With [urlSync](/modules/url-sync)**: the URL wins over the stored state at init, so a shared
  link always opens what it says.
- **With [filterPanel](/modules/filter-panel)**: `include: ["filters"]` also saves the panel's
  control values and sets the controls back on restore (and on `reset()`), next to filters set
  through `grid.filters()` or [columnFilters](/modules/column-filters).

## Accessibility

No UI of its own. Restoring happens before the first render, so assistive technology hears no
extra sort or page announcements.

## Replaces in DataTables

| DataTables (1.10 / 2.x / 3.x) | datagrids |
|---|---|
| `stateSave: true` | `stateSave()` |
| `stateDuration` (seconds; `-1` = sessionStorage) | `ttl` (ms), `storage: sessionStorage` |
| `stateSaveParams` deleting `search` / `start` | Nothing — search and page are not saved by default |
| `stateLoadParams` guarding against changed columns | Nothing — unknown columns and sort keys are dropped automatically |
| `table.state.clear()` + `location.reload()` | `grid.state.reset()` |

## Gotchas

- **The search box is empty after a reload.** By design; add `include: ["search"]`.
- **The same grid on two URLs remembers two different views.** The storage key ends with
  `location.pathname`; query string and hash are ignored.
- **A renamed or removed column lost its saved sort.** Sort keys that no longer exist (or are no
  longer sortable) are dropped; columns added since the save keep their default visibility.
- **Saved page size is smaller than expected.** Restored sizes are clamped to `maxPageSize`.
- **Nothing persists in a private window or a sandboxed iframe.** When storage is not writable the
  module logs one console warning and the grid works without persistence.
- **Changes made in the last 250 ms are lost.** They are not: a pending write is flushed on
  `pagehide` and on `destroy()`.

## Related

- [button.resetState](/modules/buttons#button-resetstate) · [colVis](/modules/colvis) · [urlSync](/modules/url-sync)
- [Writing a module](/reference/modules) — contributing to the state pipeline
