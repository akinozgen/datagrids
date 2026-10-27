---
title: urlSync
type: module
description: Keep a grid's search, sort, page and filter values in the query string so every view is a shareable link that survives reloads and the back button.
since: 0.1.0
---

# urlSync

Writes the grid's search, sort, page and filter values into the page URL — and reads them back
when the page opens — so any view can be bookmarked or sent as a link.

::: info This demo changes this page's URL
Search, sort, page or pick a unit, then look at the address bar: the demo uses the namespace
`agents`, so its keys read `agents.q`, `agents.sort`, `agents.page` and `agents.f.unit`. Reload
the page and the same view comes back.
:::

<Demo id="mod-url-sync" />

## When to use it

Use it when people share or bookmark list views ("send me the link to the open R.P.D. records"),
or when the browser's reload and back button must keep the view. It works the same on client and
server grids. For per-user preferences that are not part of a link (hidden columns, page size),
use [stateSave](/modules/state-save); both can run together.

## Usage

```js
import { Datagrid, serverSide, yajra, filterPanel, urlSync } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    filterPanel({ fields: { unit: "#unit", status: "#status" } }),
    urlSync(),
  ],
});
// → /agents?q=wong&sort=-amount&page=3&f.unit=R.P.D.&f.status=open&f.status=pending
```

| Key | Holds | Example |
|---|---|---|
| `q` | Search text | `q=wong` |
| `sort` | Sort keys, `-` for descending, comma-separated. Written only when it differs from the configured `sort`; an empty `sort=` means "no sort" | `sort=-amount,name` |
| `page` | Page number, only when > 1 | `page=3` |
| `f.<key>` | A filter value; repeated for arrays | `f.status=open&f.status=pending` |

Two grids on one page, or keys that must not clash with your own parameters — use a namespace:

```js
urlSync({ namespace: "agents" }); // agents.q, agents.sort, agents.page, agents.f.unit
urlSync({ namespace: true });     // the grid's name (or table id) as the namespace
```

Add a history entry per change, so the back button walks through earlier views:

```js
urlSync({ mode: "push" });
```

Sync filters set with `grid.filters()` instead of (or besides) filterPanel fields:

```js
urlSync({ keys: ["unit", "status"] });
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `keys` | `string[]` | the [filterPanel](/modules/filter-panel) field keys | Filter keys written as `f.<key>`. |
| `namespace` | `string \| boolean` | none | Key prefix (`<ns>.q`); `true` = the grid's name or table id. A second grid without one is prefixed automatically (with a console warning). |
| `mode` | `"replace" \| "push"` | `"replace"` | `replace` rewrites the current history entry; `push` adds one per change and follows back / forward. |
| `can` | `boolean` | `true` | Permission flag: `false` → the URL is neither read nor written. |

## API added to the grid

Available as `grid.urlSync` (typed: `grid.module(urlSync)`).

| Member | Returns | Description |
|---|---|---|
| `link()` | `string` | Absolute URL of the current view (other query parameters and the hash are kept). |

## Events

None of its own.

## Pipelines it plugs into

- **Lifecycle (init)**: reads the URL in the grid's ready phase, before the first load, so the
  first request already carries the linked view. The URL wins over a state restored by
  [stateSave](/modules/state-save).
- **Lifecycle (changes)**: writes after `search`, `sort`, `page` and every load. Writing starts
  after the first load, so opening a page never adds a history entry.
- **History**: in `push` mode it listens to `popstate` and restores the view of that entry.

## Works with

- **Enhances** [filterPanel](/modules/filter-panel): the panel's controls are set from the URL
  (and their `change` events fire, so widgets follow).
- **With [stateSave](/modules/state-save)**: both can be attached; the link decides, stored state
  fills in the rest (hidden columns, page size).
- **With [columnFilters](/modules/column-filters)**: typed `{ op, value }` filters are not written
  to the URL — only plain values and arrays of plain values are.

## Accessibility

No UI of its own. In `push` mode the browser's back and forward buttons (and their keyboard
shortcuts) move between views, which is what most users expect from a filtered list.

## Replaces in DataTables

No direct equivalent in 1.10, 2.x or 3.x. The usual approach was reading `location.search` into
`search.search`, `order` and `displayStart` by hand and writing it back from a `draw` handler.

## Gotchas

- **The back button leaves the page instead of going to the previous view.** The default mode is
  `replace`; use `mode: "push"`.
- **The link has no `sort`.** The configured default sort is never written; only a different one
  is.
- **`?page=40` opened page 12.** A page past the end is corrected once the row count is known.
- **A second grid's search ended up in the first grid.** Give each grid a `namespace` (a grid
  without one is prefixed automatically after the first).
- **Column filters are missing from the shared link.** Typed filters are not written; use a
  filterPanel field for filters that must be shareable.

## Related

- [filterPanel](/modules/filter-panel) · [stateSave](/modules/state-save) · [Lifecycle](/guide/lifecycle)
