---
title: stickyHeader
type: module
description: Keep the column header visible while the page scrolls, even when the table sits in a horizontally scrolling frame.
since: 0.1.0
---

# stickyHeader

Keeps the column header in view while the page scrolls. It works where CSS `position: sticky`
cannot: inside the grid's horizontal scroll frame.

<Demo id="mod-sticky-header" />

Scroll the page down past the demo's header: a copy of the header stays under the site's top bar
and follows the table's horizontal scroll.

## When to use it

Use it for long pages of wide rows (25+ rows per page, many columns) where people lose track of
which column is which. For a grid with its own fixed height, use the core `maxHeight` option
instead — its header already sticks inside the frame, and this module stays idle.

## Usage

```js
import { Datagrid, stickyHeader } from "@akinozgen17/datagrids";

new Datagrid("#agents", { label: "Field agents", columns, data: rows, use: [stickyHeader()] });
```

Below a fixed app bar, pass its height (a function is read on every frame):

```js
stickyHeader({ offset: () => document.querySelector("#app-bar").offsetHeight });
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `offset` | `number \| () => number` | `0` | Distance from the top of the viewport, in px. |
| `can` | `boolean` | `true` | Permission flag: `false` → no copied header. |

## API added to the grid

Available as `grid.stickyHeader` (typed: `grid.module(stickyHeader)`).

| Member | Returns | Description |
|---|---|---|
| `stuck()` | `boolean` | `true` while the copied header is showing. |
| `refresh()` | `void` | Copies and measures again (after a host layout change). |

## Events

None of its own. While the copy shows, the grid root carries `data-dg-header-stuck`.

## Accessibility

The copied header is `aria-hidden` and its controls are out of the tab order: assistive
technology and keyboard users keep using the real header, which is never removed. Pointer clicks
on the copy are forwarded to the real header (sort, filter, select all). The copy is not printed.

## Replaces in DataTables

| DataTables | datagrids |
|---|---|
| FixedHeader extension, `fixedHeader: true` (1.10 / 2.x / 3.x) | `stickyHeader()` |
| `fixedHeader: { headerOffset: 64 }` | `offset: 64` |

## Gotchas

- **The copy hides under my top bar.** Set `offset` to the bar's height.
- **Nothing happens on a grid with `maxHeight`.** The header already sticks inside that frame.
- **Column widths are off after my layout changed.** Call `grid.stickyHeader.refresh()`; window
  resizes and table size changes are picked up automatically.

## Related

- [responsive](/modules/responsive) · [Anatomy](/guide/anatomy) · [Performance](/guide/performance)
