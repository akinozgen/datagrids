---
title: Laravel paginator
type: reference
description: How laravelPaginator() maps Laravel's paginate(), simplePaginate(), cursorPaginate() and API resource collection JSON to a grid, and which query parameters it sends.
---

# Laravel paginator: `laravelPaginator()`

Point a grid at any Laravel endpoint that returns a paginator, raw or wrapped in an API resource
collection. The format is detected from each response; there is nothing to configure on the server
beyond reading the query parameters.

```js
import { Datagrid, serverSide, laravelPaginator } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Agents",
  columns,
  use: [serverSide({ url: "/api/agents", protocol: laravelPaginator() })],
});
```

Switch between `paginate()` and `simplePaginate()` and watch the pager: with `simplePaginate()` the
total is unknown, so the info reads "1–5 shown · total unknown" and **Last** is disabled.

<Demo id="proto-paginator" switches="simple" />

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `query` | `{ page?, perPage?, sort?, search?, cursor? }` | `page`, `per_page`, `sort`, `search`, `cursor` | Query parameter names |
| `sortFormat` | `"-key"` \| `"key:dir"` | `"-key"` | `sort=-date` or `sort=date:desc` |

The method is always `GET`, cells default to text, and the shared
[`serverSide()` options](/protocol/#what-every-protocol-shares) (`params`, `headers`, `csrf`,
`timeout`…) apply.

## Request

```http
GET /api/paginator/agents?page=2&per_page=25&sort=-date&search=kennedy&status=open HTTP/1.1
Accept: application/json
X-Requested-With: XMLHttpRequest
```

| Parameter | Value | Sent when |
|---|---|---|
| `page` | 1-based page number | always (not in cursor mode, see below) |
| `per_page` | page size | always |
| `sort` | the first sort key: `date` or `-date` (`sortFormat: "key:dir"`: `date:asc` / `date:desc`) | a sort is set |
| `search` | the search box text | not empty |
| `cursor` | the cursor of the requested page | cursor mode, page 2 onwards |
| filters, `params` | plain parameters: `status=open`, arrays as `unit[]=a&unit[]=b` | set |

Rules:

1. Only the first sort key is sent; Laravel paginators have no multi-sort convention.
2. Filters from `grid.filters()` travel by value: a typed filter such as `{ op: "gte", value: 100 }`
   arrives as `amount=100`, without its operator; the column filter menu therefore offers only "equals" and "any of" here. Use operator-free filters (or page filters via
   [`filterPanel()`](/modules/filter-panel)) with this protocol, and [dgp](/protocol/v1/) when you
   need operators.
3. Laravel reads only `page` (and `cursor`) by itself. `per_page`, `sort`, `search` and the filters
   are your controller's job, as is capping `per_page`.

```php
public function index(Request $request)
{
    $sortable = ['ref', 'name', 'status', 'amount', 'date'];
    $sort = $request->string('sort', '-date')->toString();
    $column = ltrim($sort, '-');
    abort_unless(in_array($column, $sortable, true), 422, 'Unknown sort key.');

    $perPage = min(max($request->integer('per_page', 25), 1), 1000);

    return AgentResource::collection(
        Agent::query()
            ->when($request->filled('search'), fn ($q) => $q->where('name', 'like', '%'.$request->string('search').'%'))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderBy($column, str_starts_with($sort, '-') ? 'desc' : 'asc')
            ->orderBy('id')
            ->paginate($perPage)
    );
}
```

The whitelist matters: never pass `sort` to `orderBy` unchecked.

## Response mapping

| Server returns | Detected by | Total | Next page |
|---|---|---|---|
| `->paginate()` | numeric `total` | `total` | `current_page < last_page` |
| `->simplePaginate()` | no `total` | unknown | `next_page_url` |
| `->cursorPaginate()` | `next_cursor` / `prev_cursor` | unknown until the last page | `next_cursor` |
| Resource collection of `paginate()` | `meta.total` | `meta.total` | `meta.current_page < meta.last_page` |
| Resource collection of `simplePaginate()` | `meta` without `total` | unknown | `links.next` |
| Resource collection of `cursorPaginate()` | `meta.next_cursor` | unknown until the last page | `meta.next_cursor` |

Rows always come from `data`. For resource collections, `result.meta` in the `response` event holds
`meta` plus `links`; for raw cursor paginators it holds `path`, `per_page`, the cursors and the page
URLs. The whole body stays available as `grid.lastResponse()`, so extra keys added with
`->additional([...])` can be bound with [`metaBind()`](/modules/meta-bind).

With an unknown total the grid uses the "total unknown" pager: "1–25 shown · total unknown",
**Next** while there is a next page, **Last** disabled.

## Cursor pagination

`cursorPaginate()` pages by position (a keyset), not by page number, so it stays fast on large tables
and never skips or repeats rows while data changes. The grid keeps the familiar page numbers on top:

1. The first request carries no cursor. Each response's `next_cursor` is remembered as the cursor
   of the following page, so page N+1 is requested as `?cursor=…` instead of `?page=N+1`.
2. Pages are reached in order. A jump past the furthest page seen so far (typing 50 in the page
   field) lands on that furthest page.
3. When the last page has been seen, the row count is known: the pager shows it and enables **Last**.
4. Changing the sort, search, filters or page size starts again from page 1. Cursors are kept per
   query, so going back to an earlier query reuses its cursors.

The order must be unique for cursor pagination, so end it with `->orderBy('id')`.

<Demo id="proto-cursor" />

## Errors

Laravel's usual responses map like on every protocol: `419`/`401` fire `sessionexpired`, `422`
shows the validation `message`, `5xx` shows a generic text with Retry. See the
[error table](/protocol/ssp#errors).

## Related

- [Server protocols overview](/protocol/)
- [Laravel paginator recipe](/recipes/laravel-paginator)
- [datagrids protocol v1](/protocol/v1/): typed filters, multi-key sort and optional counting.
