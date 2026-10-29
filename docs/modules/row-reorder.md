---
title: rowReorder
type: module
description: Let users reorder rows by dragging a grip or with the keyboard, and save the new order through one onEnd callback.
since: 0.1.0
---

# rowReorder

Adds a grip to every row. Drag it — or focus it and press `Space`, then the arrow keys — to move
the row; `onEnd` saves the new order, and a failed save puts the row back.

<Demo id="mod-row-reorder" />

## When to use it

Use it for lists whose order is data: priorities, playlists, patrol routes, menu items. Skip it
for lists sorted by a value (date, amount) — moving rows there means nothing.

## Usage

Add `reorderColumn()` for a dedicated grip column (or let the grip sit in the first data column)
and save in `onEnd`:

```js
import { Datagrid, column, rowReorder, reorderColumn } from "@akinozgen17/datagrids";

const grid = new Datagrid("#patrols", {
  label: "Patrol order",
  columns: [reorderColumn(), column.number("position", { title: "#" }), column.text("name", { title: "Name" })],
  data: rows,
  sort: [["position", "asc"]],
  use: [
    rowReorder({
      orderKey: "position",
      onEnd: ({ key, prevKey, nextKey }) =>
        grid.action(`/patrols/${key}/move`, { method: "PATCH", body: { after: prevKey, before: nextKey }, reload: false }),
    }),
  ],
});
```

- **Moving is allowed** while the grid is unsorted or sorted by `orderKey`. Sorted by any other
  column, the grips are disabled and explain why ("Sort by “#” to move rows").
- **Not while rows are hidden:** a search or an active filter (`grid.filters()`) turns the grips off
  ("Clear the search and filters to move rows"). The order of a partial list would say nothing
  about the hidden rows, and `onEnd` would save it as if it did.
- **Client grids**: the row moves in the data at once; while sorted by `orderKey`, the order
  values of the touched rows are renumbered. **Server grids**: the row moves on screen, and the
  page reloads (keeping the page) after `onEnd` resolves — the server's order is the truth.
- **A rejected `onEnd`** puts the row back and shows the error (`notify` adapter or the error
  banner).

`onEnd` receives `{ row, key, from, to, offset, prevKey, nextKey, rows }`: indexes are zero-based
within the current page (`offset` + index = absolute position); `prevKey` / `nextKey` are the new
neighbours, which is all a "place between" endpoint needs.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `onEnd` | `(e: RowReorderEnd) => unknown` | — (required) | Saves the move; a rejected promise reverts it. |
| `orderKey` | `string` | none | Column key that stands for the stored order (moving is allowed while sorted by it). |
| `handle` | `string` | `reorderColumn()`, else the first visible data column | Column that holds the grip. |
| `label` | `(row) => string` | the first text column's value | Row name in the grip's name and the announcements. |
| `messages` | `Partial<RowReorderMessages>` | locale (`en` / `tr`) | Grip name, instructions, announcements, the `sorted` / `filtered` / `virtual` reasons, save errors. |
| `can` | `boolean` | `true` | Permission flag: `false` → no grips. |

`reorderColumn(options?)` creates the grip column: narrow, not sortable, searchable, exportable or
hideable, with a visually hidden "Order" header.

## API added to the grid

Available as `grid.rowReorder` (typed: `grid.module(rowReorder)`).

| Member | Returns | Description |
|---|---|---|
| `enabled()` | `boolean` | `true` while grips are active (no search or filter, not sorted by another column, nothing saving). |
| `move(key, to)` | `Promise<boolean>` | Moves a row of the current page to index `to`, through the same path as a drag. |

## Events

| Event | Payload | When |
|---|---|---|
| `beforeReorder` | `RowReorderEnd` + `cancel()` | Before the move is applied; `cancel()` puts the row back. |
| `reorder` | `RowReorderEnd` | After `onEnd` resolved. |
| `reordererror` | `RowReorderEnd` + `error` | `onEnd` rejected; the row is back in place. |

## Accessibility

- Each grip is a native `<button aria-pressed>` named "Move: Jill Valentine", described by the
  instructions. Keyboard: `Space` / `Enter` picks the row up, `↑` `↓` `Home` `End` move it,
  `Space` / `Enter` drops it, `Esc` (or `Tab`) cancels.
- Every step is announced: "Jill Valentine picked up, position 3 of 8", "… dropped, position 1
  of 8", "Move cancelled".
- Disabled grips stay focusable (`aria-disabled`) and say why when activated; the row being saved
  is `aria-busy`.
- Dragging near the edge of the page or of a `maxHeight` frame scrolls it; `Esc` cancels a drag.

## Replaces in DataTables

| DataTables | datagrids |
|---|---|
| RowReorder extension, `rowReorder: { dataSrc: "position" }` (1.10 / 2.x / 3.x) | `rowReorder({ orderKey: "position", onEnd })` |
| `row-reorder` event + an `$.ajax` save | `onEnd` (a rejection reverts) |
| `rowReorder.selector` | `reorderColumn()` or `handle` |

## Gotchas

- **The grips are greyed out.** The grid is sorted by another column (sort by `orderKey` or clear
  the sort), or a search or filter is active (clear it). The grip's tooltip names the reason.
- **Rows only move within the page.** Moves are page-local; raise the page size for long manual
  orderings.
- **The order jumped back after the save on a server grid.** The reload shows the server's order:
  the endpoint did not store the move.

## Related

- [actions](/modules/actions) · [Methods → action()](/reference/methods) · [Events](/reference/events)
