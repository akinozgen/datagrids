---
title: colVis
type: module
description: A "Columns" toolbar menu with native checkboxes to show and hide columns, locked columns, show all and reset to default.
since: 0.1.0
---

# colVis

Adds a **Columns** button to the toolbar. Its panel lists every column with a checkbox; the badge
shows how many are visible.

<Demo id="mod-colvis-basic" />

## When to use it

Use it when a list has more columns than most people need at once: define the rarely used ones
with `visible: false` and let users opt in. Combine it with [stateSave](/modules/state-save) so
the choice survives the next visit. Skip it on small grids where every column matters.

## Usage

```js
import { Datagrid, column, colVis } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns: [
    column.text("name", { title: "Name", hideable: false }), // locked: always visible
    column.text("unit", { title: "Unit" }),
    column.text("task", { title: "Task", visible: false }),  // hidden until the user opts in
  ],
  data: rows,
  use: [colVis()],
});
```

Move the button to the end of the toolbar and rename it:

```js
colVis({ slot: "end", messages: { button: "Fields" } });
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `searchAbove` | `number` | `12` | Shows a "Find column…" field in the panel when the menu lists more columns than this. |
| `slot` | `"start" \| "end"` | `"start"` | Toolbar slot. |
| `order` | `number` | `10` | Position inside the slot (lower first). |
| `messages` | `Partial<ColVisMessages>` | locale (`en` / `tr`) | `button`, `legend`, `showAll`, `reset`, `search`, `searchLabel`, `noMatch`, `locked`. |
| `can` | `boolean` | `true` | Permission flag: `false` → no button. |

Column options that matter here: `visible` (initial visibility, also what "Reset to default"
restores) and `hideable: false` (the box is disabled and shows a lock).

## API added to the grid

Available as `grid.colVis` (typed: `grid.module(colVis)`).

| Member | Returns | Description |
|---|---|---|
| `open()` | `void` | Opens the panel and focuses the first checkbox (or the search field). |
| `close()` | `void` | Closes the panel and returns focus to the button. |
| `toggle()` | `void` | Opens or closes. |
| `reset()` | `void` | Restores the visibility from the column definitions. |
| `count()` | `{ visible, total }` | Visible / total of the columns the menu lists. |

To change visibility from code, use the core method `grid.setColumnVisible(key, visible)`.

## Events

None of its own. Every change emits the core `columnchange` event.

## Pipelines it plugs into

- **Toolbar**: `start` slot, order `10`.
- **State**: nothing of its own — hidden columns are part of the core state that
  [stateSave](/modules/state-save) stores.

## Works with

- **Enhanced by** [stateSave](/modules/state-save) (remembers the choice) and
  [button.resetState](/modules/buttons#button-resetstate).
- **Export**: [excel, csv and print](/modules/export) include visible columns only.
- **Server grids**: hidden columns are still sent in `columns[]`, in their original order, so
  index-based controllers keep working.

## Accessibility

- The button's accessible name includes the count ("Columns 5/6"), even when a narrow grid hides
  the text. It has `aria-haspopup="dialog"` and `aria-controls`.
- The panel is a labelled `role="dialog"` with a `<fieldset>`/`<legend>` of native checkboxes.
  Locked columns are disabled and say why ("This column can't be hidden").
- Keys: arrows, `Home` and `End` move between checkboxes; `Space` toggles; `↓` in the search field
  jumps to the list; `Esc` clears the search, then closes; `Tab` past either end closes the panel
  and returns to the button.

## Replaces in DataTables

| DataTables | datagrids |
|---|---|
| Buttons `colvis` button (1.10 / 2.x / 3.x), the retired ColVis extension (1.10) | `colVis()` |
| `columns.visible: false` | `visible: false` on the column |
| `className: "noVis"` + `columns: ":not(.noVis)"` | `hideable: false` |
| `colvisRestore` button | "Reset to default" in the panel, `grid.colVis.reset()` |

## Gotchas

- **A column is missing from the menu.** Columns without a `title`, and the special select /
  actions / row-number columns, are not listed.
- **A checkbox can't be unchecked.** The column has `hideable: false`; the row shows a lock.
- **A hidden column is not in the Excel file.** Exports follow what is visible; set the column
  visible (or use `exportValue` on a visible one).
- **Only the icon and "5/6" are visible.** On narrow grids the button text collapses; the
  accessible name and the tooltip keep the full label.

## Related

- [stateSave](/modules/state-save) · [button.resetState](/modules/buttons#button-resetstate) · [Columns](/guide/columns)
