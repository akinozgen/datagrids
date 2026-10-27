---
title: keyboardGrid
type: module
description: Opt-in APG grid keyboard navigation on the native table — one tab stop, arrow keys between cells, Home/End, Ctrl+Home/End and PageUp/PageDown.
since: 0.1.0
---

# keyboardGrid

Turns the table into one tab stop with arrow-key navigation between cells, following the WAI-ARIA
APG grid pattern — on the same native `<table>`.

<Demo id="mod-keyboard-grid" />

## When to use it

Use it for grids people work through with the keyboard all day: many rows, links or buttons in
every row, where tabbing through each control is slow. Without it the table is a regular table:
every link and button is its own tab stop, which is the better default for short lists and
content pages.

## Usage

```js
import { Datagrid, keyboardGrid } from "@akinozgen17/datagrids";

new Datagrid("#agents", { label: "Field agents", columns, data: rows, use: [keyboardGrid()] });
```

| Key | Moves to |
|---|---|
| `←` `→` `↑` `↓` | The neighbouring cell (left / right swap in right-to-left layouts); `↑` from the first body row reaches the header |
| `Home` / `End` | First / last cell of the row |
| `Ctrl` + `Home` / `End` | First cell of the header / last cell of the last row |
| `PageUp` / `PageDown` | Previous / next page (focus lands on the first row) |
| `Enter` / `F2` | Into a cell that holds several controls; `Esc` goes back to the cell |

A cell with exactly one control (a sort button, a checkbox, a link) passes focus straight to it.
Clicking a cell makes it the active cell.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `can` | `boolean` | `true` | Permission flag: `false` → a regular table. |

## API added to the grid

Available as `grid.keyboardGrid` (typed: `grid.module(keyboardGrid)`).

| Member | Returns | Description |
|---|---|---|
| `position()` | `{ row, col }` | The active cell. Row `0` is the header row; columns count visible cells. |
| `focus(row, col)` | `void` | Moves the active cell and focuses it. |

## Events

None of its own. `PageUp` / `PageDown` go through the core `beforePage` / `page` events.

## Accessibility

- The table gets `role="grid"`; on `destroy()` the original role comes back.
- Exactly one element in the table has `tabindex="0"` (the active cell or its single control);
  everything else is `-1`, so `Tab` enters and leaves the grid in one step.
- Typing in a text field inside a cell is never hijacked: arrow keys only navigate outside
  inputs.
- Collapsed [responsive](/modules/responsive) columns and detail rows are skipped.

## Replaces in DataTables

| DataTables | datagrids |
|---|---|
| KeyTable extension, `keys: true` (1.10 / 2.x / 3.x) | `keyboardGrid()` |
| `key-focus` event | Follow `focusin` on `grid.table` and read `grid.keyboardGrid.position()` |

## Gotchas

- **The arrow keys do nothing.** Focus is in a text field inside the cell; press `Esc` (back to
  the cell) or `Tab` out.
- **`PageDown` scrolls the page instead of paging.** Focus is outside the table.
- **With `virtual: true` the arrows stop at the rendered rows.** The module warns about it in the
  console; use paging for keyboard-heavy grids.

## Related

- [Accessibility](/guide/accessibility) · [selection](/modules/selection) · [actions](/modules/actions)
