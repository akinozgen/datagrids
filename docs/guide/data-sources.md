---
title: Data sources
type: explanation
description: Client mode (array, existing DOM rows, fetch once) versus server mode (serverSide with a protocol), plus custom sources and row keys.
---

# Data sources

Every grid has exactly one data source, attached like any other module. The source decides the
**mode**:

- **client** — all rows are in the browser; search, sort, filters and paging run in memory
  (Turkish-aware collation and accent-folding search included).
- **server** — the server pages, sorts and searches; the grid sends a query per change, keeps only
  the current page and lets the latest request win (earlier ones are aborted).

| Source | Mode | Typical use |
|---|---|---|
| `data: rows` (shorthand) / `arraySource(rows)` | client | rows you already have |
| DOM source (automatic) / `domSource()` | client | a server-rendered `<tbody>` |
| `fetchAll({ url, dataSrc, method, csrf, body })` | client | one JSON request, then local search/sort/paging |
| `serverSide({ url, protocol, … })` | server | large lists; see [Server protocols](/guide/server-protocols) |
| `customSource({ mode, load })` | either | anything else |

If you attach no source, the grid uses `data` when given, otherwise the DOM source when the table
already has body rows, otherwise an empty array.

::: tip Chaining works too
`new Datagrid(el, { columns }).use(serverSide(...))` replaces the default source the grid picked,
as long as no source was given explicitly. A second explicit source throws
[DG008](/errors/DG008).
:::

## Arrays

```js
new Datagrid("#agents", { label: "Agents", columns, data: rows });
// same as: use: [arraySource(rows)]
```

Change the rows later without re-creating the grid:

| Method | Effect |
|---|---|
| `grid.setData(rows)` | replace every row |
| `grid.addRows(rows, { keepPage })` | append (jumps to the last page unless `keepPage`); ignored on a server source |
| `grid.removeRow(key)` | remove by row key |
| `grid.refreshRow(key, row?)` | re-render one row (optionally with a new object) |

## DOM (progressive enhancement)

Give the grid a table that already has rows and nothing else. `<thead>` becomes the column list and
the existing `<tr>` elements are **adopted**, not re-created: cell HTML, links, inputs and event
listeners survive. Search, sort and paging run in the browser.

<Demo id="guide-dom" />

Header attributes refine each column:

| Attribute on `<th>` | Effect |
|---|---|
| `data-dg-key="qty"` | column key (default: a slug of the header text) |
| `data-dg-type="number"` / `"money"` | numeric sorting, end alignment |
| `data-dg-sortable="false"` | not sortable |
| `data-dg-searchable="false"` | not searched |
| `data-dg-visible="false"` | starts hidden |
| `data-dg-hideable="false"` | locked in the column menu |
| `data-dg-export="false"` | left out of exports |
| `data-dg-align="end"` / `"center"` | alignment |

On cells, `data-order="42"` gives the value used for sorting and searching instead of the visible
text; a row's `id` becomes its key. `destroy()` puts every adopted row back, attributes included.

To initialize tables declaratively (`<table data-datagrid="name">`), see
[Lifecycle → upgrade()](/guide/lifecycle#declarative-init-upgrade).

## Fetch once

`fetchAll` loads one JSON document and then works in client mode — good for lists of a few thousand
rows that should feel instant.

<Demo id="guide-fetchall" />

| Option | Default | Description |
|---|---|---|
| `url` | — | endpoint |
| `method` | `"GET"` (`"POST"` with `body`) | |
| `dataSrc` | `data` key, or the body itself when it is an array | path or `(json) => rows` |
| `csrf` | `configure().csrf` | send `X-CSRF-TOKEN` from `<meta name="csrf-token">` |
| `body` | — | JSON body |

`reload()` fetches again.

## Server

```js
import { serverSide, yajra } from "@akinozgen17/datagrids";

use: [serverSide({ url: "/agents/data", protocol: yajra(), csrf: true })]
```

The transport (fetch, abort, timeout, CSRF, Laravel headers, error normalization) is shared; the
**protocol** decides the wire format. Three ship with the library — the classic SSP wire (`ssp()`,
and its `yajra()` preset), Laravel's paginator JSON (`laravelPaginator()`) and the datagrids
protocol (`dgp()`). See [Server protocols](/guide/server-protocols).

## Custom sources

`customSource` takes a `mode` and a `load(query, ctx)` function and returns
`{ rows, total, filtered, hasMore?, meta? }`. In server mode you receive the neutral
[query](/reference/methods#query) for the current page; in client mode return every row once.

<Demo id="guide-custom" />

Throw (or reject with) an object shaped like `{ kind, status, message, retryable }` to show the
error state; honor `ctx.signal` so superseded loads stop early.

## Row keys

Selection, row actions, `refreshRow` and focus keeping need a stable key per row. The grid uses, in
order: the `rowKey` option (a field name or `(row) => string`), `row.id`, `row.DT_RowId`. Without
any of them it falls back to the row index and prints [DG003](/errors/DG003).

```js
new Datagrid("#agents", { columns, data, rowKey: "uuid" });
```

## Related

- [Server protocols](/guide/server-protocols)
- [Lifecycle](/guide/lifecycle) — load modes, reload, destroy
- [Grid options](/reference/options)
