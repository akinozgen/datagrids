---
title: colReorder
type: module
description: Let users reorder columns by dragging a header or with move buttons in the column menu; display order only, requests keep the definition order.
since: 0.1.0
---

# colReorder

Lets users change the column order: drag a header by its grip, or use the move buttons that
appear in the [colVis](/modules/colvis) panel.

<Demo id="mod-col-reorder-basic" />

## When to use it

Use it on wide lists where people have their own idea of which columns belong first. Pair it with
[stateSave](/modules/state-save) so the order survives the next visit, and with
[colVis](/modules/colvis) so keyboard users can reorder too. Skip it when the column order carries
meaning (a fixed report layout).

## Usage

```js
import { Datagrid, colReorder, colVis, stateSave } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns,
  data: rows,
  use: [colReorder(), colVis(), stateSave()],
});
```

Move buttons only (no header dragging), for example on touch-heavy screens:

```js
colReorder({ drag: false });
```

Set the order from code. Special columns (select, actions, row number) and `sticky` columns keep
their slots; only the others move:

```js
grid.colReorder.move("amount", 0); // first among the movable columns
grid.colReorder.reset();          // back to the definition order
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `drag` | `boolean` | `true` | Header dragging. The move buttons in the colVis panel are available either way. |
| `messages` | `Partial<ColReorderMessages>` | locale (`en` / `tr`) | `earlier(col)`, `later(col)` (move button names), `moved(col, pos, total)` (announcement), `hint` (grip tooltip). |
| `can` | `boolean` | `true` | Permission flag: `false` → no grips, no move buttons, no saved order. |

## API added to the grid

Available as `grid.colReorder` (typed: `grid.module(colReorder)`).

| Member | Returns | Description |
|---|---|---|
| `order()` | `string[]` | Current display order of all column keys. |
| `move(key, to)` | `void` | Moves a column to index `to` among the movable columns (0-based). |
| `reset()` | `void` | Restores the definition order. |
| `movable()` | `ResolvedColumn[]` | Columns that can move (not special, not sticky). |
| `messages` | `ColReorderMessages` | The resolved messages (colVis uses them for its buttons). |

The core method behind it is `grid.columnOrder(keys?)`.

## Events

None of its own. Every move emits the core `columnchange` event.

## Pipelines it plugs into

- **Header**: a grip in each movable header; pointer dragging shows a drop line between headers.
- **State**: contributes `colReorder` (the movable column keys in order) to
  [stateSave](/modules/state-save); `grid.state.reset()` restores the definition order.
- **Display only**: server requests keep the definition order — `columns[i]` indexes never change,
  so index-based controllers keep working. Exports follow the display order.

## Works with

- **Enhanced by** [colVis](/modules/colvis) (move buttons next to each checkbox) and
  [stateSave](/modules/state-save) (remembers the order).
- **Sticky and special columns** (`column.select()`, `column.actions()`, `sticky`) stay where
  they are.

## Accessibility

- Dragging is pointer-only, so the keyboard alternative lives in the colVis panel: "Move Amount
  earlier" / "Move Amount later" buttons on every row. Attach [colVis](/modules/colvis) whenever
  you attach colReorder.
- Each move is announced in the grid's live region: "Amount moved to position 3 of 5."
- On touch screens a drag starts only from the grip, so the header can still scroll the table
  sideways. `Esc` cancels a drag in progress; a finished drag never triggers the header's sort.

## Replaces in DataTables

| DataTables | datagrids |
|---|---|
| ColReorder extension, `colReorder: true` (1.10 / 2.x / 3.x) | `colReorder()` |
| `colReorder.order()` / `colReorder.reset()` | `grid.colReorder.order()` / `grid.colReorder.reset()` |
| `stateSave` with ColReorder | `stateSave()` stores the order automatically |

## Gotchas

- **A column has no grip and doesn't move.** It is a special or `sticky` column; those keep their
  slots.
- **Keyboard users can't reorder.** Attach [colVis](/modules/colvis); its panel carries the move
  buttons.
- **"Reset to default" in the Columns menu kept my order.** That button resets visibility only;
  use `grid.colReorder.reset()` or [button.resetState](/modules/buttons#button-resetstate).
- **The server still sees the old order.** By design: requests always use the definition order.

## Related

- [colVis](/modules/colvis) · [stateSave](/modules/state-save) · [Columns](/guide/columns)
