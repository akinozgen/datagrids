---
title: lazyColumns
type: module
description: Mark expensive server columns as lazy — they are requested only while visible, and showing one reloads the current page in place.
since: 0.1.0
---

# lazyColumns

Some columns are expensive to compute on the server (a balance, a joined count). Mark them
`lazy: true`: the request lists only the lazy columns that are visible, and showing one from the
column menu reloads the same page with its data.

<Demo id="mod-lazy-columns" />

Show **Task** from the Columns menu, then open the **Request** tab: the body now carries
`lazy[]=task`, and the grid stayed on the same page. (The demo server ignores the parameter and
always sends every field; a real endpoint would compute the column only when asked.)

## When to use it

Use it on server grids where a few columns are costly — a computed balance, an aggregate over a
relation, a call to another service — and hidden by default. Skip it on client grids: every
column is already loaded there (the module warns in the console).

## Usage

```js
import { Datagrid, column, serverSide, yajra, colVis, lazyColumns } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns: [
    { key: "name", title: "Name" },
    column.money("balance", { title: "Balance", lazy: true, visible: false }),
  ],
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }), colVis(), lazyColumns()],
});
```

The endpoint computes only what is asked for:

```php
$table = DataTables::eloquent($query);
if (in_array('balance', (array) $request->input('lazy', []))) {
    $table->addColumn('balance', fn ($agent) => $agent->balance());
}
return $table->toJson();
```

Mark columns by key instead of on the column, or rename the parameter:

```js
lazyColumns({ keys: ["balance"], param: "with" });
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `keys` | `string[]` | `[]` | Lazy column keys, in addition to columns with `lazy: true`. |
| `param` | `string` | `"lazy"` | Request parameter that lists the visible lazy columns (their `data` path, else the key). |
| `can` | `boolean` | `true` | Permission flag: `false` → no parameter, no reloads. |

## API added to the grid

Available as `grid.lazyColumns` (typed: `grid.module(lazyColumns)`).

| Member | Returns | Description |
|---|---|---|
| `param` | `string` (read-only) | The request parameter carrying the lazy keys (`"lazy"` or your `param`). |
| `requested()` | `string[]` | Lazy columns sent with the last request. |
| `visible()` | `string[]` | Lazy columns visible right now. |

## Events

None of its own. Showing a lazy column that the last response did not include triggers
`grid.reload({ keepPage: true })` (`beforeLoad` / `load`).

## Pipelines it plugs into

- **Request middleware**: adds `lazy=[…]` with the visible lazy columns; an empty list is left
  out. ssp / yajra sends `lazy[]=balance`, the datagrids protocol puts it under `params`.
- **Lifecycle**: listens to `columnchange`; hiding a lazy column costs no request, showing one
  reloads the current page.

## Works with

- **Requires** a server data source ([serverSide](/guide/data-sources)).
- **Enhanced by** [colVis](/modules/colvis) (users show and hide the columns) and
  [stateSave](/modules/state-save) (a lazy column the user keeps visible is requested from the
  first load on).
- The column itself still travels in `columns[]` like every other column; only the extra
  parameter tells the server whether to fill it.

## Accessibility

No UI of its own. Showing a lazy column reloads like any other reload: the table is `aria-busy`
until the data arrives.

## Replaces in DataTables

No direct equivalent in 1.10, 2.x or 3.x. It replaces a `column-visibility.dt` handler that
called `ajax.reload(null, false)` together with an `ajax.data` function listing visible columns.

## Gotchas

- **The column stays empty after showing it.** The endpoint ignores the parameter; read `lazy`
  (or your `param`) on the server.
- **The console says the data source is not in server mode.** The module does nothing on client
  grids; remove it there.
- **The server receives `balance_total` instead of `balance`.** The parameter lists each column's
  `data` path when it has one.

## Related

- [colVis](/modules/colvis) · [Server protocols](/guide/server-protocols) · [Recipe: Laravel + yajra](/recipes/laravel-yajra)
