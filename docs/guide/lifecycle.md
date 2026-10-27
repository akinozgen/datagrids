---
title: Lifecycle
type: explanation
description: Load modes (eager, visible, manual), reload, accessing grids (get, find, reload by name), destroy and remount, runtime column changes and declarative init with upgrade() and presets.
---

# Lifecycle

## Create

```js
const grid = new Datagrid("#agents", { label: "Agents", columns, use: [source, colVis()] });
```

- The target is a `<table>` element or a selector matching **exactly one** table
  ([DG005](/errors/DG005) otherwise).
- Constructing on a table that already has a grid returns that grid.
- Construction is synchronous: methods, events and module APIs are usable on the next line. The
  first load starts in a microtask, so listeners you add right away still see it.

## Load modes

| `load` | First request | Use for |
|---|---|---|
| `"eager"` (default) | right after construction | normal pages |
| `"visible"` | when the grid first comes within 200 px of the viewport (IntersectionObserver) | tabs, accordions, modals, long pages |
| `"manual"` | only on `grid.load()` or the built-in **Load** button | expensive reports, search-first screens |

<Demo id="guide-manual" />

There is no "adjust columns" call to remember: a ResizeObserver keeps the layout (and the narrow /
wide breakpoint stored in `data-bp`) correct when a hidden grid becomes visible.

## Reload

```js
await grid.reload();                    // page 1
await grid.reload({ keepPage: true });  // stay on the current page (after an edit)
await grid.reload({ silent: true });    // no busy card, only aria-busy (polling)
```

In server mode a reload sends a fresh request; the previous one, if still running, is aborted.
Array and DOM sources re-run search, sort and paging over the current rows, so `setData()`,
`addRows()` and `removeRow()` changes stay; `fetchAll` re-fetches.
For periodic reloads use the [autoRefresh](/modules/auto-refresh) module.

## Find a grid

| Call | Returns |
|---|---|
| `Datagrid.get(tableOrSelector)` | the grid on that table (or the table around an element), or `null` |
| `get(target)` | same, as a named export / `Datagrids.get` |
| `find(name)` | the grid created with `name`, or `null` |
| `reload(name, { keepPage, silent })` | reloads it and returns `true`; `false` and [DG006](/errors/DG006) if there is none |

`get()` **never** creates a grid. Code that runs before initialization gets `null` instead of
silently creating a second, unconfigured grid.

```js
import { find, reload } from "@akinozgen17/datagrids";

// e.g. after saving a record in a modal on another part of the page
reload("agents", { keepPage: true });
```

## Batch state changes

`grid.batch(fn)` applies several changes (sort, page size, filters…) without intermediate loads or
announcements; call `grid.load()` afterwards if you need a load.

## Change columns

`grid.setColumns(defs)` replaces the column set in place: the header is rebuilt, sorts on removed
columns are dropped, `columnchange` fires and the data reloads (keeping the page). No destroy needed.

## Destroy and remount

```js
grid.destroy();               // idempotent
const fresh = grid.remount(); // destroy + new Datagrid(same table, same options)
```

`destroy()` aborts requests, lets every module clean up (in reverse order), removes listeners and
observers, and **restores the original table**: its classes and attributes, `<thead>`, `<tfoot>`, the
original `<tbody>` rows (adopted rows included) and its position in the document. The grid is
unregistered, so `Datagrid.get()` returns `null` and a new grid can be created on the same table.

`remount(table?)` is for DOM-morphing frameworks (Livewire, Turbo, htmx swaps): it re-creates the
grid from its constructor options plus every module attached later with `grid.use()`, optionally on
a replacement table.

## Declarative init: `upgrade()`

Server templates can mark tables instead of writing JavaScript per page. Register a **preset** (a
function returning the module list for a table) once, then call `upgrade()`:

<Demo id="guide-upgrade" />

- `upgrade(root = document)` initializes every `table[data-datagrid]` under `root` that has no grid
  yet and returns the new grids — calling it again is harmless (idempotent). Call it after inserting
  HTML (AJAX partials, Turbo frames).
- `data-datagrid="name"` picks the preset registered with `preset(name, (table) => modules)`.
- Only a small whitelist of scalar attributes is read on the table: `data-dg-name`, `data-dg-label`,
  `data-dg-load`, `data-dg-page-size`, `data-dg-sort="key:desc"`, `data-dg-theme`, `data-dg-size`,
  `data-dg-density`. Columns come from `<thead>` and its
  [`data-dg-*` header attributes](/guide/data-sources#dom-progressive-enhancement) (plus
  `data-dg-type="number|money|date|html|text"` and `data-dg-sort-key`).
- There is deliberately no JSON configuration attribute: behaviour lives in presets (JavaScript),
  templates only name the preset and set a few scalars.

## Related

- [Grids in tabs & modals](/recipes/tabs-and-modals)
- [Destroy, re-init & Livewire](/recipes/destroy-and-reinit)
- [Instance methods](/reference/methods) · [Static API](/reference/static)
