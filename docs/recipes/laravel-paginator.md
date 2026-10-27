---
title: Laravel paginator & API resources
type: how-to
description: Use the JSON of Laravel's paginate(), simplePaginate() or JsonResource::collection() directly as a server-paged grid source.
---

# Laravel paginator & API resources

**Goal:** a server-paged grid on top of an ordinary Laravel endpoint that returns `paginate()`,
`simplePaginate()` or an API resource collection — no extra package on the server.

<Demo id="rcp-paginator" switches="simple" />

Switch the demo server to **simplePaginate()**: the response no longer has a total, so the pager
shows previous/next without a page count and the summary drops the record total.

## Steps

### 1. Write the endpoint

```php
// app/Http/Controllers/Api/AgentController.php
use App\Models\Agent;
use Illuminate\Http\Request;

public function index(Request $request)
{
    $sort = $request->string('sort', '-date')->toString();   // "-date" = date descending
    $column = ltrim($sort, '-');
    abort_unless(in_array($column, ['ref', 'name', 'unit', 'status', 'amount', 'date'], true), 422);

    return Agent::query()
        ->when($request->search, fn ($q, $term) => $q->where(fn ($q) => $q
            ->where('name', 'like', "%{$term}%")
            ->orWhere('ref', 'like', "%{$term}%")))
        ->orderBy($column, str_starts_with($sort, '-') ? 'desc' : 'asc')
        ->paginate(min($request->integer('per_page', 15), 100));
}
```

```php
// routes/api.php (or web.php)
Route::get('/agents', [AgentController::class, 'index']);
```

`paginate()` reads `?page=` by itself. Whitelist the sort column: it goes straight into `ORDER BY`.

### 2. Attach `laravelPaginator()`

The demo's **JavaScript** tab is the whole client side:

```js
use: [serverSide({ url: "/api/agents", protocol: laravelPaginator() })],
```

The grid sends `GET /api/agents?page=2&per_page=10&sort=-date&search=jill` and reads the response
shape on its own — there is nothing to configure for the variants below.

## Response shapes it understands

| Server returns | JSON | Pager |
|---|---|---|
| `->paginate($n)` | `{ data, current_page, last_page, total, … }` | full: pages, jump, "1–10 / 941 records" |
| `->simplePaginate($n)` | `{ data, current_page, next_page_url, … }` (no `total`) | previous / next; no page count |
| `AgentResource::collection($q->paginate($n))` | `{ data, links, meta: { total, last_page, … } }` | full |
| `AgentResource::collection($q->simplePaginate($n))` | `{ data, links, meta }` (no `meta.total`) | previous / next |
| `->cursorPaginate($n)`, or a resource collection of it | `{ data, next_cursor, prev_cursor, … }` (or in `meta`) | previous / next; pages are reached in order, the count appears once the last page was seen |

With `cursorPaginate()` page 2 onwards is requested as `?cursor=…` instead of `?page=…`; end the
query's order with a unique column (`->orderBy('id')`). Details in
[Protocol: Laravel paginator](/protocol/laravel-paginator#cursor-pagination).

API resources are the cleanest way to control what reaches the browser:

```php
// app/Http/Resources/AgentResource.php
public function toArray(Request $request): array
{
    return [
        'id' => $this->id,
        'ref' => $this->ref,
        'name' => $this->name,
        'unit' => $this->unit,
        'status' => $this->status,
        'amount' => $this->amount,
        'date' => $this->created_at,
    ];
}

// controller
return AgentResource::collection($query->paginate(min($request->integer('per_page', 15), 100)));
```

A resource's extra `meta` (and `links`) is available in the `load` event as `result.meta`.

## Parameter names and sort format

If your endpoint already uses other names, map them instead of changing the endpoint:

```js
laravelPaginator({
  query: { page: "p", perPage: "limit", sort: "order", search: "q" },
  sortFormat: "key:dir", // ?order=date:desc instead of ?order=-date
});
```

| Option | Default | Meaning |
|---|---|---|
| `query.page` | `"page"` | page number parameter (1-based) |
| `query.perPage` | `"per_page"` | page size parameter |
| `query.sort` | `"sort"` | sort parameter; only the first sort key is sent |
| `query.search` | `"search"` | search parameter; left out while the search box is empty |
| `query.cursor` | `"cursor"` | cursor parameter (Laravel's `cursorName`), `cursorPaginate()` only |
| `sortFormat` | `"-key"` | `"-key"` → `-date` / `date`; `"key:dir"` → `date:desc` / `date:asc` |

Page filters ([filter panel](/recipes/filter-panel), `grid.filters()`, `params`) travel as plain
query parameters next to these: `?page=1&per_page=10&status=open`. Values only, no operator: the
[column filter](/modules/column-filters) menu offers just "equals" and "any of" on this protocol.

## Notes

- **Cells are text by default; HTML is an explicit opt-in.** Paginator JSON is raw model data, so
  untyped columns render as text. Use `column.html()` only for fields you sanitized on the server.
- **No `csrf: true` needed** for a `GET` endpoint. The grid still sends `X-Requested-With` and
  `Accept: application/json`, so an expired session comes back as `401` JSON instead of a redirect
  to the login page — see [CSRF & session expiry](/recipes/csrf-and-session).
- **`per_page` is user input.** Cap it on the server (`min(…, 100)` above); the grid caps its own
  menu with `maxPageSize`.
- **Counting is the expensive part** of `paginate()` on big tables. If users rarely need the total,
  `simplePaginate()` skips the `COUNT(*)` query and the grid adapts.
- Validation errors (`422` with `errors`) show their first message inline; see
  [States & errors](/guide/states-and-errors).

## Related

- [Protocol: Laravel paginator](/protocol/laravel-paginator) — every field the adapter reads
- [Server protocols](/guide/server-protocols)
- [Laravel + yajra list](/recipes/laravel-yajra)
