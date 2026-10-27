---
title: Custom toolbar (headless)
type: how-to
description: Drive a grid from your own search box, sort and page-size controls through its methods and events, or place your own elements into the toolbar slots with a tiny module.
---

# Custom toolbar (headless)

**Goal:** the page's design calls for its own controls — a search field in the page header, a sort
dropdown, a "New" button next to the search box. Two ways, pick by where the controls live:

| Your controls live… | Use |
|---|---|
| anywhere on the page, styled by your app | the grid's **methods and events** (headless) |
| inside the grid's toolbar, next to its own controls | a small **toolbar module** that fills a slot |

## Your own controls, the grid's state

<Demo id="rcp-headless" />

Type in **Search**, change **Sort** and **Rows**, then click a column header: the header click also
updates the **Sort** dropdown, because the page listens to the grid's `sort` event.

### Steps

1. **Turn the built-in search box off** with `search: false`. Everything else (header sorting,
   pager, page-size menu) stays; hide what you replace with CSS on the
   [documented classes](/reference/css) if needed.
2. **Call the grid's methods from your controls.** Each one updates the state, resets to page 1
   where that makes sense, and loads:

   | Your control | Call |
   |---|---|
   | search field | `grid.search("redfield")` — debounce typing yourself (the demo waits 250 ms) |
   | sort dropdown | `grid.sort([["amount", "desc"]])`; `grid.sort([])` clears it |
   | page size | `grid.pageSize(25)` (capped by `maxPageSize`) |
   | page buttons | `grid.page(3)` |
   | column chooser | `grid.colVis.open()` (with the [colVis](/modules/colvis) module) |

   Called without an argument, each method returns the current value: `grid.search()`,
   `grid.sort()`, `grid.page()`, `grid.pageSize()`.
3. **Listen to the grid's events to keep your controls in sync** — the header, the pager, saved
   state or a shared URL can change the same state:

   | Event | Detail |
   |---|---|
   | `search` | `{ search }` |
   | `sort` | `{ sort: [{ key, dir }] }` |
   | `page` | `{ page }` |
   | `pagesize` | `{ pageSize }` |
   | `columnchange` | `{ columns }` — visibility or order changed |
   | `load` | after every load: read `grid.status()` for `{ total, filtered }` |

   `beforeSort` and `beforePage` can be cancelled (`e.cancel()`).

Several changes at once (for example a "Reset view" button) should go into `grid.batch()` so they
cause one request instead of three:

```js
grid.batch(() => {
  grid.search("");
  grid.sort([["date", "desc"]]);
  grid.pageSize(10);
});
grid.load();
```

## Your elements inside the toolbar

<Demo id="rcp-toolbar-slots" />

The toolbar has three slots. A module puts an element into one with `ctx.toolbar()`:

```js
const toolbarItem = (name, slot, order, el) => ({
  name, // unique per grid; becomes grid[name]
  kind: "toolbar",
  setup(ctx) {
    ctx.toolbar({ slot, order, el });
    return { api: { el } };
  },
});

use: [toolbarItem("statusFilter", "start", 15, statusSelect)];
```

| Slot | Where | Built-in items (order) |
|---|---|---|
| `start` | left, grows | search box (0), column menu (10), reload (20), reset state (30), export menu (40), custom buttons (50), button groups (60) |
| `end` | right | auto-refresh toggle (−20), show deleted (−10), record count |
| `filters` | full-width row under the toolbar | filter presets (−20), column filter chips (100) |

Items are sorted by `order` inside their slot (ties keep registration order). Give your element the
grid's own classes — `dg-btn` (with `data-variant="primary"` or `"ghost"`) and `dg-select` — and it
matches the toolbar, including dark mode and density. The module's `name` must not clash with a grid
method or another module.

For a plain button, you don't need a module of your own: `button.custom({ label, onClick, slot, order })`
does this, plus a disabled state derived from the last response — see [buttons](/modules/buttons).

## Notes

- **colVis always renders its own toolbar button**; its panel opens next to it, also when you call
  `grid.colVis.open()` from elsewhere. Use `open()` for an extra entry point (a shortcut, a menu
  item), not to replace the button.
- **Server grids** work the same: the methods change the query and the next request carries it.
- **Accessibility:** your controls need their own labels (`<label>` or `aria-label`). The grid still
  announces search results and page changes in its live region.

## Related

- [Instance methods](/reference/methods) and [Events](/reference/events)
- [Writing a module](/reference/modules) — `ctx.toolbar()`, `ctx.above()` and the other hooks
- [Anatomy](/guide/anatomy) — the toolbar's DOM and classes
- [Page filter panel](/recipes/filter-panel)
