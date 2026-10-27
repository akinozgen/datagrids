---
title: Server protocols
type: explanation
description: Which wire protocol to use between a datagrids grid and your server (SSP via ssp() or yajra(), Laravel paginator JSON, or the datagrids protocol v1) and how they differ.
---

# Server protocols

A server-side grid sends one request per page, sort, search or filter change. What that request and
its response look like is the **protocol**. datagrids speaks three, all through the same
`serverSide()` source:

```js
import { Datagrid, serverSide, yajra } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Agents",
  columns,
  use: [serverSide({ url: "/agents/data", protocol: yajra(), csrf: true })],
});
```

## Which one?

| You have… | Use | Page |
|---|---|---|
| An endpoint written for DataTables' server-side processing, in any language | `ssp()` | [SSP wire](/protocol/ssp) |
| A Laravel endpoint built with yajra/laravel-datatables | `yajra()` | [SSP wire](/protocol/ssp) |
| A Laravel endpoint returning `paginate()`, `simplePaginate()`, `cursorPaginate()` or an API resource collection | `laravelPaginator()` | [Laravel paginator](/protocol/laravel-paginator) |
| A new endpoint, or one you are free to change | `dgp()` | [datagrids protocol v1](/protocol/v1/) |

Keep an existing endpoint as it is: the SSP and paginator adapters exist so that you can move the
front end first and touch the back end later (or never). For new endpoints, prefer the datagrids
protocol: sorting by key, typed filters, optional counting and one error format.

## How they differ

| | `ssp()` / `yajra()` | `laravelPaginator()` | `dgp()` |
|---|---|---|---|
| Method | `ssp`: GET + `_=` timestamp; `yajra`: POST form body | GET | POST JSON (GET optional) |
| Untyped cells | `ssp`: text; `yajra`: **HTML** (yajra escapes values) | text | text |
| Sort | column index, several keys | first key only (`sort=-date`) | key, several keys |
| Search | `search[value]` | `search` | `q` |
| Page filters | plain parameters | plain parameters | `params` |
| Typed column filters | `columns[i][columnControl]` (no `between`, `notIn`) | value only (operator dropped) | `filters`, 15 operators |
| Counting | always | `paginate()`: yes; simple and cursor: next page only | `exact`, `estimate` or `none` |
| "All" (`length=-1`) | opt-in (`allowAll: true`) | no | no |
| Errors | HTTP status, or `error` in a 200 | HTTP status | RFC 9457 problem details |
| Side data | extra top-level keys | `meta`, `links` | `meta.aggregates`, `facets`, `warnings` |

"Untyped cells" are columns without a type: plain `{ key, title }` objects. Typed columns
(`column.text()`, `column.money()`, `column.date()`, `column.badge()`…) always render the same way,
whatever the protocol. Cells are text by default; HTML is an explicit opt-in (`column.html()`), and
`yajra()` is the one protocol whose untyped cells are HTML, because yajra escapes every non-raw
value on the server.

## What every protocol shares

These come from `serverSide()`, not from the protocol:

| Option | Default | What it does |
|---|---|---|
| `url` | required | Endpoint. A function `(query) => url` builds it per request |
| `protocol` | required | `ssp()`, `yajra()`, `laravelPaginator()` or `dgp()` |
| `method` | the protocol's | Overrides the method (`"GET"` or `"POST"`) |
| `csrf` | `configure({ csrf })`, else `false` | Reads `<meta name="csrf-token">`: `X-CSRF-TOKEN` header, plus `_token` in non-GET bodies |
| `params` | none | Extra request parameters: an object, or a function of the query called per request |
| `headers` | none | Extra request headers |
| `timeout` | `30000` ms | Aborts the request and shows the timeout error |
| `seed` | none | A response body rendered as the first page without a request (server-rendered first page) |
| `fetch` | `globalThis.fetch` | Custom transport |

And on every request:

- **Headers:** `X-Requested-With: XMLHttpRequest` (turn it off with `configure({ laravel: false })`)
  and an `Accept` header that fits the protocol. Cookies are sent (`credentials: "same-origin"`).
- **Last request wins:** a new request aborts the previous one, and responses are matched to
  requests by an internal sequence number, never by `draw` or `requestId`.
- **Debug keys:** `queries` and `input` members (Laravel debug output, which can hold SQL and
  personal data) are deleted from the response before any event, module or `lastResponse()` sees it.
- **Errors:** every failure becomes one `DatagridError` with a `kind`, a user-safe `message` and a
  `retryable` flag. See the [error table](/protocol/ssp#errors).
- **Session expiry:** `401`, `419` and redirects to a login page fire the `sessionexpired` event.

## Related

- [Server protocols guide](/guide/server-protocols): attaching a source, page filters, reloading.
- [Data sources](/guide/data-sources): client-side sources (`data`, DOM, `fetchAll`) and `customSource`.
- [States and errors](/guide/states-and-errors): loading, empty and error states in the grid.
- [Migrating from DataTables](/migration/from-datatables).
