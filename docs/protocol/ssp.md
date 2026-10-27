---
title: SSP wire (ssp / yajra)
type: reference
description: The exact request and response format datagrids uses with DataTables-style server-side processing endpoints (ssp() and yajra()), including encoding rules, column filters and error normalization.
---

# SSP wire: `ssp()` and `yajra()`

Endpoints written for DataTables' server-side processing (SSP) keep working unchanged: datagrids
sends the parameter set DataTables 1.10 sends, encoded byte for byte like jQuery's `$.param`, and
reads the same response. Two factories speak this wire:

| | `ssp()` | `yajra()` |
|---|---|---|
| For | any SSP endpoint (PHP, .NET, Python, Node…) | Laravel + [yajra/laravel-datatables](https://yajrabox.com/docs/laravel-datatables) |
| Default method | `GET` | `POST` |
| Untyped cells | text | HTML |
| Everything else | identical | identical |

`yajra()` renders untyped cells as HTML because yajra escapes every value that is not in
`rawColumns` on the server; rendering those as text would print `&amp;`. Any other SSP server may
send raw text, so `ssp()` keeps cells as text. Cells are text by default; HTML is an explicit
opt-in everywhere else.

Change the status, sort, search or page, then read the **Request** and **Response** tabs. The
**Simulate** buttons make the next response fail.

<Demo id="proto-ssp" faults="500,419,302,error200" />

## Options

```js
serverSide({ url: "/agents/data", protocol: yajra({ allowAll: true }) })
```

| Option | Type | Default | Description |
|---|---|---|---|
| `data` | object \| `(d) => unknown` | none | DataTables `ajax.data`: an object is deep-merged into the parameters; a function may mutate `d` or return a replacement (an object, or a ready-made string) |
| `dataSrc` | string \| `(json) => rows` | `data`, then `aaData` | DataTables `ajax.dataSrc`: a dotted path to the rows (`""` = the body is the array) or a function |
| `method` | `"GET"` \| `"POST"` | `ssp`: GET, `yajra`: POST | `serverSide({ method })` overrides it too |
| `cells` | `"text"` \| `"html"` | `ssp`: text, `yajra`: html | Render mode of untyped columns |
| `allowAll` | boolean | `false` | Lets a `-1` page size ("All") reach the server as `length=-1` |

Extra parameters belong in [`serverSide({ params })`](/protocol/#what-every-protocol-shares) or a
[filter panel](/modules/filter-panel); keep `data` for porting an existing `ajax.data` function.

## Request

### Transport

| | `yajra()` / `POST` | `ssp()` / `GET` |
|---|---|---|
| Where | form body | query string, plus `_=<timestamp>` (jQuery's `cache: false`) |
| `Content-Type` | `application/x-www-form-urlencoded; charset=UTF-8` | none |
| `Accept` | `application/json, text/javascript, */*; q=0.01` | same |
| `X-Requested-With` | `XMLHttpRequest` | same |
| CSRF (`csrf: true`) | `X-CSRF-TOKEN` header and a `_token` field | `X-CSRF-TOKEN` header |

A `_token` already present in the parameters is left alone. No JSON body is ever sent.

### Parameters

Every request carries the full set, in this order, whatever the user did:

```text
draw=1
columns[0][data]=
columns[0][name]=
columns[0][searchable]=false
columns[0][orderable]=false
columns[0][search][value]=
columns[0][search][regex]=false
columns[1][data]=name
columns[1][name]=
columns[1][searchable]=true
columns[1][orderable]=true
columns[1][search][value]=
columns[1][search][regex]=false
…
order[0][column]=3
order[0][dir]=desc
start=10
length=10
search[value]=leon kennedy
search[regex]=false
unit=R.P.D.
_token=…
```

| Parameter | Value |
|---|---|
| `draw` | Counter starting at 1, incremented per request of this protocol instance. Sent, never trusted |
| `columns[i][data]` | The column's `data` path, else its `key`. Empty for the index, select and actions columns |
| `columns[i][name]` | The column's `name` option, else empty |
| `columns[i][searchable]` | `true`/`false` from the column (`searchable`, default `true` for data columns) |
| `columns[i][orderable]` | `true`/`false` from the column's `sortable` |
| `columns[i][search][value]`, `[regex]` | A plain `grid.filters({ key: value })` on a searchable column: an anchored, escaped regex for equality (`^R\.P\.D\.$`, `regex: true`); an array becomes `^a$\|^b$`. A filter on a non-searchable column is not sent (dev notice). Otherwise empty / `false` (typed column filters use `columnControl`, below; `between` and `notIn` are not offered on this protocol) |
| `order[i][column]`, `order[i][dir]` | Index into `columns[]` and `asc`/`desc`, one entry per sort key |
| `start` | `(page - 1) × pageSize` |
| `length` | Page size, or `-1` (see below) |
| `search[value]`, `search[regex]` | The global search text; `regex` is always `false` |
| page filters, `_token` | Plain top-level parameters, after the protocol's own |

Rules:

1. **`columns[]` is in definition order and includes hidden columns.** Hiding a column (`visible:
   false`, the column menu) or reordering columns on screen never changes the indexes the server
   sees. A column with `can: false` does not exist at all: it is not sent.
2. **Default order.** While no sort is active the grid sends `order[0][column]=0&order[0][dir]=asc`,
   like DataTables' default `order: [[0, 'asc']]`. That includes clearing the sort at runtime (a
   header click, `grid.sort([])`, a state reset, `?sort=`), even when a `sort` option was given. Only
   an explicit `sort: []` option sends no `order` parameters (the server's own order). Once the user
   sorts, the chosen key is sent.
3. **`length=-1`** is sent when paging is off (`paging: false`), or when the user picks "All"
   (`-1` in `pageSizes`) and the protocol has `allowAll: true`. Without `allowAll`, "All" is clamped
   to `maxPageSize` (1000 by default) with the [DG013](/errors/DG013) warning.
4. **Page filters are plain parameters.** Values from `serverSide({ params })`,
   [`filterPanel()`](/modules/filter-panel), [`softDeletes()`](/modules/soft-deletes) (`_deleted=1`),
   `lazyColumns()` (`lazy[]=key` for each visible lazy column) and `grid.filters()` keys that are not
   column keys are appended as `name=value` (arrays as `name[]=a&name[]=b`). Your controller reads
   them like any request input.
5. **`data`** (the `ajax.data` port) runs last, after page filters, so it can still change
   `start`, `length` or `search`.
6. **DataTables 2.x and 3.x** additionally send `order[i][name]`. datagrids sends the 1.10 set; a
   server that reads `order[i][name]` should fall back to `columns[order[i][column]][name]`.

### Encoding

The body (or query string) is identical to jQuery 3's `$.param` output:

| Value | Encoded as |
|---|---|
| `true` / `false` | `k=true` / `k=false` |
| `null`, `undefined` | `k=` |
| `[]`, `{}` (empty) | nothing: the key is omitted |
| `["a", "b"]` | `k[]=a&k[]=b` |
| `[{ x: 1 }]` | `k[0][x]=1` |
| `{ a: { b: 1 } }` | `k[a][b]=1` |
| a function | called; its result is encoded |
| characters | `encodeURIComponent`; in POST bodies `%20` becomes `+` |

### Typed column filters (`columnControl`)

A typed filter on a column (`grid.filters({ amount: { op: "gte", value: 100 } })` or the
[`columnFilters()`](/modules/column-filters) header UI) travels in that column's entry, in the
DataTables ColumnControl format that yajra/laravel-datatables 12.7+ reads:

```text
columns[3][columnControl][search][value]=100
columns[3][columnControl][search][logic]=greaterOrEqual
columns[3][columnControl][search][type]=num
```

| `op` | Sent as |
|---|---|
| `eq`, `ne` | `logic=equal`, `notEqual` |
| `gt`, `gte`, `lt`, `lte` | `logic=greater`, `greaterOrEqual`, `less`, `lessOrEqual` |
| `contains`, `notContains`, `starts`, `ends` | same names |
| `empty`, `notEmpty` | same names, empty `value` |
| `in` | `columns[i][columnControl][list][]=a&…[list][]=b` |
| `between`, `notIn` | not sent: ColumnControl has no equivalent |

`type` is `num` for number and money columns, `date` for date columns, `text` otherwise. Filters on
columns with `searchable: false` are never sent (yajra would apply them anyway). Older yajra
versions ignore `columnControl`; filter with page parameters there.

## Response

```json
{
  "draw": 1,
  "recordsTotal": 1000,
  "recordsFiltered": 941,
  "data": [
    { "DT_RowId": "row_1993", "id": 1993, "name": "Ada Wong", "amount": 3121.74, "status_html": "<span class=\"dg-chip\" data-tone=\"bad\">Cancelled</span>" }
  ],
  "summary": { "total": 7617927.4 }
}
```

| Member | Read as |
|---|---|
| `data` (or `aaData`, or `dataSrc`) | The rows. Anything that is not an array becomes an empty page |
| `recordsTotal` / `recordsFiltered` (or `iTotalRecords` / `iTotalDisplayRecords`) | Parsed as base-10 integers, so numeric strings work. Missing: the row count is used, and `recordsFiltered` falls back to `recordsTotal` |
| `draw` | Ignored (see sequencing) |
| `error` (or `sError`) | A string or `true`: the rows still render and a non-blocking error banner appears (see [Errors](#errors)) |
| `DT_RowId` | The `<tr>` `id`, and the row key when the row has no `id` |
| `DT_RowClass` | Classes added to the `<tr>` |
| `DT_RowData`, `DT_RowAttr` | Not applied. Use the grid's `rowAttrs(row)` option |
| `queries`, `input` | Deleted before anything else sees the body (Laravel debug output) |
| any other top-level key | Kept: `result.meta` in the `response` event, the raw body in `grid.lastResponse()`, and bindable with [`metaBind()`](/modules/meta-bind) (`summary.total` in the demo) |

### Cells

| Column | `ssp()` | `yajra()` |
|---|---|---|
| Untyped (`{ key: "name" }`) | text | HTML |
| `column.text()` | text | text: escaped values show as `&amp;`, so prefer untyped columns for strings |
| `column.html()` | HTML | HTML |
| `column.number()`, `money()`, `date()`, `badge()`, `link()` | rendered from the value | rendered from the value |
| `render` returning a string | text, unless the column is `column.html()` | same |

### Sequencing

`draw` can arrive as a string, be missing or come back stale from a cache. datagrids doesn't depend on
it: every new request aborts the one in flight, and a response is used only if it belongs to the
latest request. A slow, stale or `draw`-less response can't freeze the grid in "Processing…".

## Errors

Every failure, on any protocol, becomes one `DatagridError` `{ kind, status, message, detail?, retryable }`.
The grid fires the `error` event, then shows the message: as a banner above the rows when rows are
already on screen, otherwise in place of the body. Server text (which may contain SQL) goes only into
`detail`: the console ([DG012](/errors/DG012)) and a collapsed "Details" field while warnings are on.

| Response | `kind` | Message shown | Retry |
|---|---|---|---|
| `200` with `error` / `sError` (string or `true`) | `server` | "The server returned an error (200)." (rows still render) | yes |
| `200` with `status: "error"` and a `message` | `server` | that message | yes |
| `200` whose body is not JSON | `parse` | "The server response could not be read." | no |
| redirect to a non-JSON page whose URL looks like a login page | `session` | "Your session has expired. Please sign in again." | no |
| redirect to any other non-JSON page | `forbidden` | "You are not allowed to view this list." | no |
| `401`, `419` | `session` | "Your session has expired. Please sign in again." | no |
| `403` | `forbidden` | the body's message, else "You are not allowed to view this list." | no |
| `410` | `protocol` | the body's message, else the generic text | no |
| `422` | `validation` | the body's message (Laravel's `message`, else the first `errors` entry) | no |
| `429` | `http` | the body's message, else the generic text | yes |
| other `4xx` | `http` | "The server returned an error (404)." | no |
| `5xx` | `http` | "The server returned an error (500)." | yes |
| network failure | `network` | "The server could not be reached. Check your connection." | yes |
| no answer within `timeout` (30 s) | `timeout` | "The server took too long to respond." | yes |
| aborted by a newer request | `abort` | nothing: silently dropped | — |

`session` errors also fire `sessionexpired` and call `configure({ onSessionExpired })` when set. The
messages come from the grid's [messages](/reference/messages) (English or Turkish, overridable).
Per grid, `errorMode: "silent"` keeps the grid quiet (events still fire) and `errorMode: "throw"`
rethrows. Nothing ever calls `alert()`.

## Compatibility tests

The rules on this page are pinned by unit tests in
[`tests/unit/server.test.ts`](https://github.com/akinozgen/datagrids/blob/main/tests/unit/server.test.ts).
The encoder is compared byte for byte with the real jQuery `$.param` on a corpus of inputs.

| Rule | Test |
|---|---|
| Encoding equals jQuery `$.param`; `+` for spaces in POST bodies | `case N`, "form body turns %20 into + like jQuery.ajax" |
| Full parameter set, DataTables order, hidden columns included | "sends the full parameter set in DataTables order, hidden columns included" |
| Default order while no sort is active; only an explicit `sort: []` sends none | "default order [[0,'asc']] only when no sort was configured; order:[] sends nothing", "clearing at runtime keeps the default order on the wire; only an explicit sort:[] drops it" |
| `length=-1` when paging is off | "paging off → length -1" |
| `data`: mutate, replace, deep merge | "ajax.data: mutate, return replacement, static deep merge" |
| POST form body and `Accept`; GET cache buster | "POST form body + jQuery Accept; GET adds _= cache buster" |
| Numeric strings, ignored `draw`, extra keys | "decode: numbers normalized, draw ignored, extras in meta" |
| `dataSrc` | "dataSrc string/function" |
| `columnControl` and page filters | "typed column filters become columnControl, page filters plain params" |
| Error table | "500 JSON: generic message, server text only in detail", "419 / 401 → session", "302 to HTML → forbidden (login → session)", "422 Laravel and RFC 9457", "403 / 410 / 429", "200 + error / status:error", "network / timeout" |

## Server checklist

- Read every parameter defensively; datagrids always sends the full set, other clients may not.
- Map `order[i][column]` through `columns[i][data]`/`[name]` and **whitelist** the result before it
  reaches SQL.
- Cap `length` (and decide whether `-1` is allowed).
- Answer expired sessions with `401`/`419` JSON and missing permissions with `403` JSON, not with a
  redirect to an HTML page.
- Keep `APP_DEBUG`-style output (`queries`, `input`, exception text in `error`) off in production;
  datagrids hides it from users, but it still crosses the network.

## Related

- [Server protocols overview](/protocol/): choosing between `ssp()`, `yajra()`, `laravelPaginator()` and `dgp()`.
- [Laravel + yajra recipe](/recipes/laravel-yajra): controller and page side by side.
- [CSRF and session expiry](/recipes/csrf-and-session).
- [Migrating from DataTables](/migration/from-datatables).
