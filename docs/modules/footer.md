---
title: footer
type: module
description: A summary row in the table's tfoot — sum, average, count or your own function per column, over the current page or every matching row.
since: 0.1.0
---

# footer

Adds a summary row to the table's `<tfoot>`: a sum, an average, a count or your own value per
column, formatted like the cells above it.

<Demo id="mod-footer-page" />

On a server grid, show a total the server computed over **every** matching row (here the
`summary.total` key of the yajra response):

<Demo id="mod-footer-response" />

## When to use it

Use it for totals that belong under their column: amounts, quantities, counts. For totals shown
elsewhere on the page (KPI tiles, a heading), use [metaBind](/modules/meta-bind).

## Usage

```js
import { Datagrid, footer } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns,
  data: rows,
  use: [footer({ cols: { amount: "sum" } })],
});
```

Every matching row instead of the current page (client grids), with your own label:

```js
footer({ cols: { amount: "sum", ref: "count" }, scope: "response", label: "All agents" });
```

A server total from the response — `raw` is the last response body:

```js
footer({ scope: "response", cols: { amount: (rows, raw) => raw?.summary?.total } });
```

### Aggregates

| Value | Result |
|---|---|
| `"sum"` | Sum of the column's numbers |
| `"avg"` | Average of the column's numbers (empty cells don't count) |
| `"count"` | Number of non-empty cells |
| `(rows, raw, grid) => value` | Your value: a number (formatted like the column), a string or a DOM node |

Numbers are read the way exports read them: `exportValue` first, and numeric text in Turkish
format (`"1.234,50"`) is understood. Sums are rounded to remove floating-point noise. On money and
number columns the result is rendered with the column's own format.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `cols` | `Record<string, "sum" \| "avg" \| "count" \| function>` | — (required) | Column key → aggregate. |
| `scope` | `"page" \| "response"` | `"page"` | `page`: the rows on screen. `response`: every filtered row on client grids; on server grids the built-in aggregates still see the page, so read server totals from `raw` with a function. |
| `label` | `string` | "Page total" / "Total" (by scope) | Text in the first visible column(s) that carry no value. |
| `messages` | `{ page, total }` | locale (`en` / `tr`) | Default labels. |
| `can` | `boolean` | `true` | Permission flag: `false` → no summary row. |

## API added to the grid

Available as `grid.footer` (typed: `grid.module(footer)`).

| Member | Returns | Description |
|---|---|---|
| `values()` | `Record<string, unknown>` | The last computed values by column key. |
| `refresh()` | `void` | Recomputes and repaints the row. |

## Events

None of its own. It repaints after every `render` and `columnchange`.

## Pipelines it plugs into

- **Render**: writes one `<tr>` into the table's `<tfoot>` (creating it when needed); hidden while
  the table has no rows. An existing `<tfoot>` is restored on `destroy()`.
- **Export**: `excel({ footer: true })`, `csv({ footer: true })` and `print({ footer: true })` add
  the row after the data — as numbers in Excel.

## Works with

- **Enhances** [excel, csv and print](/modules/export) (`footer: true`).
- **With [colVis](/modules/colvis)**: hidden columns are skipped; the label widens over the leading
  columns without a value.
- **On server grids** pair it with a server-computed total (yajra `->with('summary', …)`).

## Accessibility

The label is a `<th scope="row">`, so screen readers announce "Page total" with each value in the
row. Figures use tabular numerals and the same alignment as the column.

## Replaces in DataTables

| DataTables (1.10 / 2.x / 3.x) | datagrids |
|---|---|
| `footerCallback` + `api.column(i, { page: "current" }).data().reduce(…)` | `footer({ cols: { amount: "sum" } })` |
| `api.column(i, { search: "applied" })` (all filtered rows) | `scope: "response"` (client grids) |
| `api.ajax.json().summary` in `footerCallback` | A function reading `raw` |
| A hand-written `<tfoot>` | Created and filled for you |

## Gotchas

- **The total equals the page total on a server grid.** The browser only has the current page;
  return the server's total from `raw` with a function.
- **The console says `footer: unknown column "amont"`.** A key in `cols` matches no column.
- **There is no label.** The first visible column has a value; the label only uses leading
  columns without one.
- **The row is gone when nothing matches.** By design: an empty table has no summary.

## Related

- [metaBind](/modules/meta-bind) · [excel · csv · print](/modules/export)
