---
title: metaBind
type: module
description: Bind fields of the server response — totals, counters, flags — to elements anywhere on the page, refreshed after every load.
since: 0.1.0
---

# metaBind

Writes values from each response into elements on the page — KPI tiles, counters, a total in a
heading — and keeps them in step with every reload, search and filter.

<Demo id="mod-meta-bind" />

## When to use it

Use it when the endpoint returns more than rows — a filtered total, a count of overdue items, a
balance — and the page shows it outside the table. For a total under its column, use
[footer](/modules/footer).

## Usage

Map a CSS selector to a dotted path in the response:

```js
import { Datagrid, serverSide, yajra, metaBind } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    metaBind({
      "#kpi-matching": { value: "recordsFiltered", format: "number" },
      "#kpi-total": { value: "summary.total", format: "money" },
      "#kpi-overdue": "summary.overdue",
    }, { currency: "TRY" }),
  ],
});
```

```php
// yajra: extra top-level keys travel next to the rows
return DataTables::eloquent($query)
    ->with('summary', fn () => ['total' => (clone $query)->sum('amount'), 'overdue' => …])
    ->toJson();
```

A function gets the raw response and the grid — useful for derived values and client grids:

```js
metaBind({
  "#kpi-open": (raw, grid) => grid.viewRows().filter((r) => r.status === "open").length,
  "#kpi-label": { value: "summary.total", format: (v) => (v > 0 ? "In credit" : "In debt") },
});
```

### Formats

| Format | Output (en-US / tr-TR) |
|---|---|
| `"text"` (default) | The value as text |
| `"number"` | `1,234.5` / `1.234,5` (up to 2 decimals) |
| `"money"` | `1,234.50 $` / `1.234,50 ₺` — fixed `decimals`, the `currency` symbol after the number (`TRY` ₺, `USD` $, `EUR` €, else the code) |
| `(v) => string \| number \| Node` | Your own; return a node for markup |

Number formats also accept numeric text, including Turkish-formatted strings (`"1.234,50"`);
other text passes through unchanged. Use a function with `Intl.NumberFormat` when you need the
symbol in front (`$1,234.50`), as the demo does.

## Options

`metaBind(bindings, options?)`

| Option | Type | Default | Description |
|---|---|---|---|
| `bindings` | `Record<selector, path \| function \| { value, format? }>` | — (required) | Selector → value source. Every element the selector matches is updated. |
| `format` | `"text" \| "number" \| "money" \| function` | `"text"` | Default format for bindings without one. |
| `currency` | `string` | `"TRY"` | ISO code for `"money"`. |
| `decimals` | `number` | `2` | Decimals for `"money"`. |
| `empty` | `string` | `"—"` | Text for missing values. |
| `root` | `ParentNode` | `document` | Where selectors are resolved (a dialog, a component). |
| `can` | `boolean` | `true` | Permission flag: `false` → nothing is written. |

## API added to the grid

Available as `grid.metaBind` (typed: `grid.module(metaBind)`).

| Member | Returns | Description |
|---|---|---|
| `refresh()` | `void` | Re-reads the last response and writes every binding. |

## Events

None of its own. It writes after every `render`, when `grid.lastResponse()` already holds the new
response.

## Pipelines it plugs into

- **Render**: one pass over the bindings after each render. A function may return a promise (for
  example `grid.exportRows("all")` on a client grid); a newer render wins over a slower promise.
- **Lifecycle**: the original contents of every bound element are restored on `destroy()`.

## Works with

- **Every source**: `raw` is the server response on server grids and the fetched JSON with
  [fetchAll](/guide/data-sources); on array and DOM grids use a function that reads the grid.
- **With [footer](/modules/footer)**: the footer for column totals, metaBind for the rest of the
  page.

## Accessibility

The bound elements are your markup. Values change silently after each load; if a figure matters
to screen-reader users, put it inside your own `aria-live="polite"` region.

## Replaces in DataTables

| DataTables (1.10 / 2.x / 3.x) | datagrids |
|---|---|
| `$("#t").on("xhr.dt", (e, s, json) => $("#total").text(json.summary.total))` | `metaBind({ "#total": "summary.total" })` |
| `drawCallback` reading `settings.json` | Same |
| Side effects in `ajax.dataSrc` | Same |

## Gotchas

- **A tile shows "—".** The path does not exist in the response (check the **Response** tab, or
  `grid.lastResponse()`); paths are dotted (`summary.total`).
- **Money shows `1,234.50 $` instead of `$1,234.50`.** The `"money"` format puts the symbol after
  the number; use a function with `Intl.NumberFormat` for the other order.
- **Nothing updates on an array grid.** There is no response; use a function `(raw, grid) => …`.
- **Debug keys are gone from `raw`.** The ssp / yajra adapter strips Laravel's debug `queries` key
  before you see the response.

## Related

- [footer](/modules/footer) · [Data sources](/guide/data-sources) · [Recipe: Laravel + yajra](/recipes/laravel-yajra)
