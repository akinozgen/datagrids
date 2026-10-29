---
title: Server protocols
type: explanation
description: serverSide transport options, the three built-in protocols (classic SSP wire with the yajra preset, Laravel paginator, datagrids protocol v1), CSRF, Laravel headers, error normalization and session expiry.
---

# Server protocols

A server grid is `serverSide({ url, protocol })`: one **transport** (fetch, abort, timeout, CSRF,
Laravel headers, error normalization) plus one **protocol** that turns the grid's neutral query into
a request and the response back into rows.

```js
import { serverSide, yajra, ssp, dgp, laravelPaginator } from "@akinozgen17/datagrids";

use: [serverSide({ url: "/agents/data", protocol: yajra(), csrf: true })]
```

## Which protocol?

| | `ssp()` | `yajra()` | `laravelPaginator()` | `dgp()` |
|---|---|---|---|---|
| Server side | any server speaking the classic `draw/start/length/columns[]` wire | yajra/laravel-datatables | `paginate()`, `simplePaginate()`, API resources | the [datagrids protocol v1](/protocol/v1/) |
| Method / body | GET query (POST form with `method`) | POST, form-encoded | GET query | POST JSON (GET optional) |
| Untyped cells | text | **HTML** (server escapes) | text | text |
| Sorting | column index | column index | first sort key (`-date`) | keys, multiple |
| Search | `search[value]` | `search[value]` | `search` | `q` |
| Column filters | equality as anchored regex in `columns[i][search]`; typed: ColumnControl `columns[i][columnControl]` (no `between` / `notIn`) | same | plain params (`eq`, `in` only) | typed `{ op, value }` |
| Counting | always | always | `paginate` yes, `simplePaginate` no | `exact`, `estimate` or `none` |
| Errors | Laravel/HTTP shapes, `error` key | same | Laravel/HTTP shapes | RFC 9457 problem details |

Use `yajra()` (or `ssp()`) to keep an existing endpoint untouched. Use `laravelPaginator()` for
plain Eloquent pagination and API resources. Use `dgp()` for new endpoints: typed filters, optional
counting, real error documents.

## Transport options

| Option | Type | Default | Description |
|---|---|---|---|
| `url` | `string \| (query) => string` | — | endpoint |
| `protocol` | `Protocol` | — | `ssp()`, `yajra()`, `laravelPaginator()`, `dgp()` or your own |
| `method` | `"GET" \| "POST"` | protocol's | overrides the protocol default |
| `params` | `object \| (query) => object` | — | extra parameters on every request (page filters) |
| `headers` | `Record<string, string>` | — | extra headers |
| `csrf` | `boolean` | `configure().csrf` (`false`) | `X-CSRF-TOKEN` from `<meta name="csrf-token">`, plus `_token` in form bodies |
| `timeout` | `number` (ms) | `30000` | then a `timeout` error with Retry |
| `fetch` | `typeof fetch` | `configure().fetch` → `globalThis.fetch` | custom transport (resolved at call time, so stubs work) |
| `seed` | response body | — | rendered as the first page **without** a request (server-embedded first page) |

`serverSide(...).params(fn)` returns a **new** definition with an extra params function — module
definitions are immutable, so the original stays reusable:

```js
const agents = serverSide({ url: "/agents/data", protocol: yajra(), csrf: true });
const active = agents.params(() => ({ status: "open" }));
```

### What the transport adds

- `X-Requested-With: XMLHttpRequest` on every request (Laravel's `$request->ajax()`), unless
  `configure({ laravel: false })`.
- With `csrf`: `X-CSRF-TOKEN` and, for non-GET form bodies, `_token`.
- `credentials: "same-origin"`, an abort signal (a newer request aborts the older one) and the
  timeout.
- Debug keys some servers leak in development (`queries`, `input`) are deleted from the response
  before any event or module sees it.
- Responses are matched to requests by an internal sequence number — never by `draw` — so a stale
  response can't overwrite a newer page.

## The classic SSP wire: `ssp()` and `yajra()`

The endpoint receives the full parameter set on every request, encoded exactly like jQuery's
`$.param`: `draw`, `start`, `length`, `search[value]`, `search[regex]`, `order[i][column|dir]` and
`columns[i][data|name|searchable|orderable|search][value|regex]` — columns in **definition order,
hidden ones included**. The demo sends an extra `unit` parameter from the select; open the
**Request** tab.

<Demo id="guide-yajra" faults="500,419,error200" />

`yajra()` is `ssp()` with two defaults changed: `method: "POST"` and **untyped cells render as
HTML**, because yajra escapes every value on the server and sends `rawColumns` as markup. That is
why every string column in the demo is a plain `{ key, title }` object, including the
server-rendered status badge. Typed columns that parse their value (`column.money`, `date`,
`badge`) work as usual; avoid `column.text()` here — it would print the server's entities
(`&amp;`) literally.

| `ssp()` / `yajra()` option | Default | Description |
|---|---|---|
| `data` | — | extra payload: an object (deep-merged) or `(d) => void \| object` (mutate `d` or return a replacement) |
| `dataSrc` | `"data"` | path to the rows, `""` for a bare array, or `(json) => rows` |
| `cells` | `"text"` / `"html"` | default render mode for untyped columns |
| `method` | `"GET"` / `"POST"` | |
| `allowAll` | `false` | allow `length=-1` ("All" in `pageSizes`); otherwise sizes are capped by `maxPageSize` |

Extra top-level response keys (yajra's `->with([...])`) arrive in `grid.lastResponse()`, in the
`response` event's `raw`, and can be bound to page elements with [metaBind](/modules/meta-bind).
A response `error` string shows a non-blocking banner (rows that did arrive stay visible). The exact
rules, with the tests that pin them, are in the [SSP wire reference](/protocol/ssp).

## Laravel paginator: `laravelPaginator()`

```php
return AgentResource::collection(
    Agent::query()->search($request->search)->sortBy($request->sort)->paginate($request->integer('per_page', 25))
);
```

<Demo id="guide-paginator" switches="simple" />

The response shape is detected automatically: `paginate()` (`total`, `last_page`), `simplePaginate()`
(no total — the pager switches to "total unknown" and enables *Next* from `next_page_url`),
`cursorPaginate()` (the next page's `cursor` is learned from `next_cursor`, so pages are reached in
order) and `JsonResource::collection()` (`data` + `meta` + `links`).

| Option | Default | Description |
|---|---|---|
| `query` | `{ page: "page", perPage: "per_page", sort: "sort", search: "search", cursor: "cursor" }` | parameter names |
| `sortFormat` | `"-key"` | or `"key:dir"` (`date:desc`) |

Page filters (`grid.filters()` keys that are not columns, `params`) are sent as plain query
parameters. Details: [Laravel paginator reference](/protocol/laravel-paginator).

## datagrids protocol: `dgp()`

```json
{ "v": 1, "page": { "size": 25, "number": 1 }, "sort": [{ "key": "amount", "dir": "desc" }],
  "q": "jill", "filters": { "status": { "op": "in", "value": ["open", "pending"] } },
  "fields": ["name", "status", "amount", "date"], "count": "exact", "requestId": "r-3" }
```

<Demo id="guide-dgp" switches="count" faults="422,500" />

A JSON request with key-based sorting, typed filters (`eq ne gt gte lt lte between in notIn contains
notContains starts ends empty notEmpty`), the field list, and a `count` mode. Switch the demo to
`count: none` and the pager stops showing totals; *Next* follows `page.hasMore`. Errors are
`application/problem+json` (RFC 9457) with `code`, `retryable` and field `errors`.

| Option | Default | Description |
|---|---|---|
| `method` | `"POST"` | `"GET"` sends `page[size]`, `sort=-amount`, `filter[status][in]=open,pending` |
| `count` | `"exact"` | `"estimate"` or `"none"` |

The normative spec and JSON Schemas: [datagrids protocol v1](/protocol/v1/).

## Errors and session expiry

Every failure — network, timeout, HTTP status, an `error` key in a 200 response, unreadable JSON —
becomes one `DatagridError`:

```ts
{ kind, status, message, detail?, retryable, raw? }
// kind: network | timeout | abort | http | server | session | forbidden | validation | parse | protocol
```

| Server says | kind | Shown message | Retry |
|---|---|---|---|
| network failure | `network` | "The server could not be reached…" | yes |
| no answer in `timeout` | `timeout` | "The server took too long to respond." | yes |
| 419 or 401, or a redirect to a login page | `session` | "Your session has expired…" | no |
| 403, or a redirect elsewhere | `forbidden` | server message or "You are not allowed…" | no |
| 422 | `validation` | the first validation message | no |
| 429 | `http` | server message | yes |
| 5xx | `http` | "The server returned an error (500)." | yes |
| 200 with `error` | `server` | "The server returned an error (200)." | yes |

The grid shows it in place (blocking error state when there are no rows, a banner when rows are
already on screen), fires `error`, and for `session` also fires `sessionexpired` and calls
`configure({ onSessionExpired })`. Server-provided details (an exception message, SQL) are never
shown to users; they go to the console as [DG012](/errors/DG012) and appear in a collapsed
"Details" block only while warnings are enabled. `errorMode: "silent" | "throw"` changes the
in-place behaviour per grid. See [States & errors](/guide/states-and-errors).

```js
configure({
  csrf: true,
  onSessionExpired: () => location.assign("/login"),
});
```

## Writing your own protocol

A protocol is an object with `name`, `cells`, `encode(req, query, grid)` → `{ url, init, params? }` and
`decode(body, query, grid)` → `{ rows, total, filtered, hasMore?, meta? }`. The transport keeps doing
CSRF, headers, abort, timeout and error handling for you. `grid` is the grid the request belongs to
(keep per-grid state, such as cursors, in a `WeakMap` keyed by it). Optional fields:

| Field | Description |
|---|---|
| `method` | default HTTP method (`"GET"` or `"POST"`); `serverSide({ method })` overrides it |
| `filterOps` | column filter operators the wire can carry; the [column filter](/modules/column-filters) menu offers only these (omitted: all) |
| `allowAll` | `true`: page size `-1` ("All") is accepted |

To send a server default order when the sort is empty, check `query.sortDefault` in `encode`: it is
`false` only when the grid was created with `sort: []`.

`encode` may also return `params`: the page parameters that actually reached the wire beyond the
protocol's own fields. `grid.lastRequestParams()` (and with it the "all matching" payload of
[selection](/modules/selection)) reports them; without it, the request's `params` are reported. The
built-in `ssp` / `yajra` return everything on the top level except `draw`, `columns`, `order`,
`start`, `length` and `search`, so additions of a `data` function count too.

## Related

- [Protocol reference](/protocol/) — exact wire formats
- [Laravel + yajra recipe](/recipes/laravel-yajra)
- [CSRF & session expiry recipe](/recipes/csrf-and-session)
