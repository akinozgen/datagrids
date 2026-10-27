---
title: responsive
type: module
description: When the table is wider than its frame, collapse the least important columns and show their values in an expandable detail row.
since: 0.1.0
---

# responsive

When the table no longer fits its frame, the least important columns collapse one by one, and
every row gets an expand button that shows the collapsed values in a detail row.

<Demo id="mod-responsive" />

## When to use it

Use it for lists that must stay readable on phones and narrow panels without horizontal
scrolling. Skip it when people compare many columns side by side — horizontal scrolling with a
[sticky](/guide/columns) first column is better there.

## Usage

```js
import { Datagrid, responsive } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns,
  use: [responsive({ priority: { name: 1, status: 2, amount: 3 } })],
});
```

Columns collapse from the **highest** priority number down; columns without a priority come after
the listed ones, last column first. The first data column never collapses — it carries the expand
button — and neither do `sticky` columns or the ones in `keep`:

```js
responsive({ keep: ["status"] });   // never collapse Status
responsive({ details: false });     // just drop columns, no expand buttons
```

The grid measures its frame with a `ResizeObserver`, after every render and after column
changes. If your layout changes in a way the frame does not notice, call `grid.responsive.refit()`.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `priority` | `Record<string, number>` | definition order | Lower numbers are kept longer. |
| `keep` | `string[]` | `[]` | Columns that never collapse (the first data column and sticky columns never do). |
| `details` | `boolean` | `true` | Expand buttons and detail rows with the collapsed values. |
| `messages` | `{ show, hide }` | locale (`en` / `tr`) | Expand button names: "Show hidden columns" / "Hide hidden columns". |
| `can` | `boolean` | `true` | Permission flag: `false` → nothing collapses. |

## API added to the grid

Available as `grid.responsive` (typed: `grid.module(responsive)`).

| Member | Returns | Description |
|---|---|---|
| `collapsed()` | `string[]` | Keys of the columns collapsed right now. |
| `refit()` | `void` | Measures again. |
| `toggle(rowKey, open?)` | `void` | Opens or closes a row's detail. |

## Events

| Event | Payload | When |
|---|---|---|
| `collapse` | `{ columns: string[] }` | The set of collapsed columns changed. |

## Pipelines it plugs into

- **Render**: after each render it marks collapsed cells (`data-dg-collapsed`, hidden by the
  stylesheet), adds the expand button to the first data cell and re-creates open detail rows.
- **Header**: header cells of collapsed columns are hidden the same way.
- **Lifecycle**: a `ResizeObserver` on the frame; everything is removed on `destroy()`.

## Works with

- **With [colVis](/modules/colvis)**: independent. colVis decides which columns exist on screen;
  responsive only collapses visible ones and never changes the user's choices.
- **Export**: collapsed columns are still visible columns, so [exports](/modules/export) include
  them.
- **Virtual rows** (`virtual: true`): collapsing is switched off while rows are virtualized.

## Accessibility

- The expand button is a native `<button>` with `aria-expanded`, `aria-controls` and a name
  ("Show hidden columns"); it is always visible, not on hover.
- The detail row is a real table row holding a `<dl>`: each collapsed column's title is a `<dt>`,
  its value a `<dd>`, so screen readers read "Place: Light Tower".
- Collapsed cells are hidden, not removed — the table keeps its column semantics.

## Replaces in DataTables

| DataTables (Responsive, 1.10 / 2.x / 3.x) | datagrids |
|---|---|
| `responsive: true` | `responsive()` |
| `columns.responsivePriority` | `priority` |
| `className: "all"` | `keep` |
| `responsive.details: false` | `details: false` |
| `responsive.recalc()` | `grid.responsive.refit()` |
| `responsive-resize` event | `collapse` event |

## Gotchas

- **Nothing collapses although the table overflows.** The overflow happens outside the grid's
  frame — usually host CSS that turns `table` into a scrolling block (`display: block;
  overflow-x: auto`). The grid measures its own frame.
- **A column I need on phones collapsed first.** Give it a low `priority` number or list it in
  `keep`.
- **The first column never collapses.** It holds the expand button; reorder the columns if a
  different column should anchor the row.

## Related

- [colVis](/modules/colvis) · [Columns](/guide/columns) · [Performance](/guide/performance)
