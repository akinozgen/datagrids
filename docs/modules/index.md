---
title: Modules
type: reference
description: Catalog of every datagrids module — what it does, how to import it, where its API lives on the grid and which pipelines it plugs into.
---

# Modules

Everything beyond "a table with columns" is a module: saved state, the column menu, filters,
selection, row actions, export, summaries, toolbar buttons — and the data sources themselves.
A module is an **immutable definition** created by a factory function (`colVis()`, `excel({ … })`)
and attached with `use`. The same definition can be shared by many grids; each grid binds its own
copy when it is created.

```js
import { Datagrid, serverSide, yajra, colVis, stateSave, excel } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns: [{ key: "name", title: "Name" }],
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }), colVis(), stateSave(), excel()],
});
```

(String columns on yajra grids are plain `{ key, title }` objects: the server already escapes the
values — see [Server protocols](/guide/server-protocols).)

Modules are separate exports, so a bundler drops the ones you never import (tree-shaking). Read
[Concepts → Modules](/guide/concepts#modules) for the mental model; this page is the catalog.

## Catalog

Each module's API is added to the grid under the name in the "Grid API" column
(`grid.state.reset()`, `grid.selection.payload()`). In TypeScript, `grid.module(stateSave)` returns the typed API.

| Module | Import | What it does | Grid API | Pipelines |
|---|---|---|---|---|
| [stateSave](/modules/state-save) | `stateSave()` | Remembers sort, page size, hidden columns | `state` | state |
| [colVis](/modules/colvis) | `colVis()` | Show / hide columns menu | `colVis` | toolbar |
| [colReorder](/modules/col-reorder) | `colReorder()` | Drag or move columns | `colReorder` | header, state |
| [multiSort](/modules/multi-sort) | `multiSort()` | Shift+click sorts by several columns | `multiSort` | header |
| [columnFilters](/modules/column-filters) | `columnFilters()` | Typed filter in each header | `columnFilters` | filters, toolbar |
| [filterPanel](/modules/filter-panel) | `filterPanel()` | Binds your own filter form | `filterPanel` | request, filters |
| [urlSync](/modules/url-sync) | `urlSync()` | View state in the query string | `urlSync` | lifecycle |
| [responsive](/modules/responsive) | `responsive()` | Collapse columns on narrow screens | `responsive` | render, header |
| [lazyColumns](/modules/lazy-columns) | `lazyColumns()` | Request costly columns only when visible | `lazyColumns` | request |
| [stickyHeader](/modules/sticky-header) | `stickyHeader()` | Header stays visible while the page scrolls | `stickyHeader` | lifecycle |
| [filterPresets](/modules/filter-presets) | `filterPresets()` | Named filter chips | `filterPresets` | filters, toolbar, state |
| [autoRefresh](/modules/auto-refresh) | `autoRefresh()` | Silent reload on an interval | `autoRefresh` | toolbar, lifecycle |
| [softDeletes](/modules/soft-deletes) | `softDeletes()` | "Show deleted" toggle | `softDeletes` | request, row, toolbar |
| [actions](/modules/actions) | `actions()` | Row buttons and `⋯` menu | `actions` | row |
| [selection](/modules/selection) | `selection()` | Checkboxes, select all, bulk bar | `selection` | row |
| [rowReorder](/modules/row-reorder) | `rowReorder()` | Drag or keyboard-move rows, save in `onEnd` | `rowReorder` | row |
| [keyboardGrid](/modules/keyboard-grid) | `keyboardGrid()` | Arrow-key cell navigation, one tab stop | `keyboardGrid` | lifecycle |
| [excel](/modules/export) | `excel()` | `.xlsx` download | `excel` | toolbar, export |
| [csv](/modules/export) | `csv()` | `.csv` download | `csv` | toolbar, export |
| [print](/modules/export) | `print()` | Print view (and PDF) | `print` | toolbar, export |
| [footer](/modules/footer) | `footer()` | Summary row in `<tfoot>` | `footer` | render, export |
| [metaBind](/modules/meta-bind) | `metaBind()` | Response fields → page elements | `metaBind` | render |
| [button.reload](/modules/buttons#button-reload) | `button.reload()` | Reload button | `reloadButton` | toolbar |
| [button.resetState](/modules/buttons#button-resetstate) | `button.resetState()` | Reset the saved view | `resetStateButton` | toolbar |
| [button.custom](/modules/buttons#button-custom) | `button.custom()` | Your own toolbar button | its `name` | toolbar |
| [button.group](/modules/buttons#button-group) | `button.group()` | Toolbar dropdown | its `name` | toolbar |

Pipelines: **request** = request middleware (adds parameters to server requests) · **filters** =
writes the grid's filter state, which the protocol encodes · **row** = row mutator (runs after each
row renders) · **toolbar** = toolbar slot · **state** = saved-state contribution · **export** =
feeds the export sheet · **render** = repaints after each render · **header** = decorates the header row · **lifecycle** = init / load /
destroy hooks.

Data sources (`serverSide`, `arraySource`, `domSource`, `fetchAll`, `customSource`) are modules
too, with exactly one per grid — see [Data sources](/guide/data-sources).

### Toolbar order

Toolbar modules place themselves in a named slot with an `order` (lower first). colVis, the
`button.*` modules, softDeletes, autoRefresh and filterPresets accept `slot` and `order` to move
them. The shared Export menu (`start`, 40) moves with `slot` / `order` on the first export module
attached (`excel({ slot: "end" })`); the column filter chips (`filters`, 100) have a fixed place.

| Slot | Default contents (order) |
|---|---|
| `start` | search box (0) · colVis (10) · button.reload (20) · button.resetState (30) · Export menu (40) · button.custom (50) · button.group (60) |
| `end` | autoRefresh (−20) · softDeletes (−10) · record count (`count: true`, 0) |
| `filters` | filterPresets (−20) · columnFilters chips (100) |

## Presets

A preset is just an array of modules. Put your house standard in one function and every list page
becomes one line; arrays nest, so a preset can be mixed with page-specific modules.

```js
import { serverSide, yajra, colVis, button, stateSave, excel, print } from "@akinozgen17/datagrids";

export const listPage = (url) => [
  serverSide({ url, protocol: yajra(), csrf: true }),
  colVis(),
  button.reload(),
  stateSave(),
  excel(),
  print(),
];
```

<Demo id="mod-preset" />

Add page-specific modules next to it: `use: [listPage("/api/agents"), selection()]`. For
declarative markup (`table[data-datagrid="list"]`), register the same array with
[`preset()`](/reference/static).

## Permission flag `can`

Every module accepts `can`. With `can: false` the module is still attached (so code that calls
its API keeps working — the calls do nothing) but it contributes nothing: no button, no menu item,
no request parameter, no state.

```js
use: [
  serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
  excel({ can: user.canExport }),
  softDeletes({ can: user.isAdmin }),
];
```

- **Columns** take the same flag: a column with `can: false` does not exist at all — it is not
  rendered, not in the column menu, not exported, not saved in state and not sent to the server.
- **Row actions** are the only place where `can` may be a function of the row:
  `{ id: "delete", can: (row) => row.status !== "done" }`. See [actions](/modules/actions).
- `can` is a UX flag. Your endpoints must still authorize every request.

## Module rules

- One instance per module per grid: attaching the same module twice throws
  [DG009](/errors/DG009); two data sources throw [DG008](/errors/DG008).
- A module that depends on another (`button.resetState` → `stateSave`) throws
  [DG007](/errors/DG007) when the dependency is missing.
- Request middleware runs in attach order. See [Writing a module](/reference/modules) for the full
  module contract.
