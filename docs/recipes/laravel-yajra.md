---
title: Laravel + yajra list
type: how-to
description: Point a grid at an existing yajra/laravel-datatables controller without changing it — HTML columns, extra page parameters and joined columns included.
---

# Laravel + yajra list

**Goal:** a server-paged list backed by a controller that already returns
[yajra/laravel-datatables](https://yajrabox.com/docs/laravel-datatables) JSON. The controller stays
exactly as it is; only the page script changes.

<Demo id="rcp-yajra" faults="500" />

Open the **Request** tab: the grid sends the classic `draw/start/length/search/order/columns[]`
form body plus `_token` and the `unit` page parameter. The **Status** column is HTML the controller
rendered.

## Steps

### 1. Keep the controller

```php
// app/Http/Controllers/AgentController.php
use App\Models\Agent;
use Illuminate\Http\Request;
use Yajra\DataTables\Facades\DataTables;

public function data(Request $request)
{
    $query = Agent::query()
        ->when($request->unit, fn ($q, $unit) => $q->where('unit', $unit));

    return DataTables::eloquent($query)
        ->addColumn('status_html', fn (Agent $agent) => view('agents.partials.status', compact('agent'))->render())
        ->rawColumns(['status_html'])
        ->toJson();
}
```

```php
// routes/web.php
Route::post('/agents/data', [AgentController::class, 'data'])->name('agents.data');
```

The route is a `POST` in the `web` group, so Laravel checks the CSRF token: the grid sends it with
`csrf: true` (see [CSRF & session expiry](/recipes/csrf-and-session)).

### 2. Render the table and the token

```blade
{{-- layouts/app.blade.php, inside <head> --}}
<meta name="csrf-token" content="{{ csrf_token() }}">

{{-- agents/index.blade.php --}}
<label>Unit
  <select id="unit">
    <option value="">All units</option>
    @foreach ($units as $unit)
      <option>{{ $unit }}</option>
    @endforeach
  </select>
</label>

<table id="agents" data-url="{{ route('agents.data') }}"></table>

@vite('resources/js/pages/agents.js')
```

### 3. Attach a `serverSide` source with the `yajra()` protocol

The **JavaScript** tab of the demo is the complete script. In the app, take the URL from the route
instead of hard-coding it:

```js
// resources/js/pages/agents.js
import { Datagrid, column, serverSide, yajra } from "@akinozgen17/datagrids";
import "@akinozgen17/datagrids/css";

const table = document.querySelector("#agents");
const unit = document.querySelector("#unit");

const grid = new Datagrid(table, {
  label: "Field agents",
  columns: [/* as in the demo */],
  sort: [["date", "desc"]],
  use: [
    serverSide({
      url: table.dataset.url,
      protocol: yajra(),
      csrf: true,
      params: () => ({ unit: unit.value }),
    }),
  ],
});

unit.addEventListener("change", () => grid.reload());
```

## HTML cells: `yajra()` vs `ssp()`

Cells are text by default; HTML is an explicit opt-in. `yajra()` is the one place where the default
flips, because yajra escapes every column on the server with `e()` — except the ones you list in
`rawColumns()`.

| | `yajra()` | `ssp()` |
|---|---|---|
| Untyped columns (`{ key, title }`) render | as HTML | as text |
| Why | the server already escaped every value | a generic endpoint may send raw user input |
| Default method | `POST` | `GET` (set `method: "POST"` if needed) |
| Wire format | identical | identical |

- **Leave server-escaped string columns untyped** on a yajra grid. `column.text()` always writes
  text, so a value the server sent as `O&#039;Brien` would appear with the entity visible.
- Typed columns that parse their value (`column.money()`, `column.date()`, `column.badge()`) work
  on both protocols.
- `column.number()` and `column.money()` read data strings as machine numbers (`"1500.50"`;
  `"1.500"` = 1.5). For Turkish-formatted text from `number_format()` (`"1.500"` = 1500) add
  `source: "tr"`; for money HTML rendered by the controller use `column.money(key, { source: "html" })`.
- Force text for one column with `text: true`; force HTML on an `ssp()` grid with `column.html()`.
- **A `render` that reads other fields** gets them escaped, as the server sent them: `row.name` is
  `Ada &amp; Leon`. Use `ctx.text(row, "name")` for the text (`Ada & Leon`). The `value` argument
  is already decoded.

  ```js
  column.text("summary", { render: (v, row, ctx) => `${ctx.text(row, "name")} · ${ctx.text(row, "unit")}` })
  ```
- Use `ssp()` for any other server that speaks the same wire format (hand-written server-side
  scripts, other frameworks): it is the same protocol with the safe default.

## Extra page parameters

Whatever your old `ajax.data` added goes into `params`. Keys become top-level request parameters
(`$request->unit`).

```js
// static
serverSide({ url, protocol: yajra(), params: { type: "field" } });

// computed on every request; `query` is { page, pageSize, sort, search, filters, columns }
serverSide({ url, protocol: yajra(), params: (query) => ({ unit: unit.value }) });

// derived from a shared base source: definitions are immutable, .params() returns a new one
const agentsSource = serverSide({ url, protocol: yajra(), csrf: true });
const fieldAgents = agentsSource.params(() => ({ type: "field" }));
```

`.params(fn)` merges its result on top of the base definition's `params`, so a shared source (for
example in a [preset](/recipes/destroy-and-reinit#declarative-init-with-upgrade)) can be narrowed per
page. For a whole filter form, use the [filter panel recipe](/recipes/filter-panel) instead of
reading each control by hand.

::: warning Don't reuse protocol names
`draw`, `start`, `length`, `search`, `order` and `columns` belong to the protocol. A page parameter
with one of these names overwrites the generated value.
:::

## Joined columns: `name`

When the query joins another table, tell yajra which SQL column to search and sort with `name`
(sent as `columns[i][name]`). `key` is still where the value sits in the row JSON.

```php
$query = Order::query()
    ->join('agents', 'agents.id', '=', 'orders.agent_id')
    ->select('orders.*', 'agents.name as agent_name');
```

```js
columns: [
  { key: "ref", name: "orders.ref", title: "Ref" },
  { key: "agent_name", name: "agents.name", title: "Agent" },
],
```

Without `name`, yajra would put the alias `agent_name` into a `WHERE` clause, which SQL rejects.

## What the grid sends and expects

- **Request:** form-encoded exactly like jQuery's `$.param` (booleans as `"true"`/`"false"`, empty
  arrays left out). `search` and `order` are always present, and `columns[]` lists every column in
  definition order — hidden ones included — so controllers that address columns by index keep
  working.
- **Response:** `data`, `recordsTotal`, `recordsFiltered` and `error`. Responses are matched to the
  latest request on the client (the last request wins); `draw` is echoed but never trusted.
- **Row keys:** a row's key is its `id`, else `DT_RowId` (or your `rowKey`). `DT_RowId` and
  `DT_RowClass` become the `<tr>`'s `id` and `class`. `DT_RowAttr` is not applied automatically:
  map it with `rowAttrs: (row) => row.DT_RowAttr`.
- **Extra keys** from `->with('summary', …)` arrive untouched: read them in the `response` event
  (`grid.on("response", ({ raw }) => raw.summary)`) or bind them with
  [metaBind](/modules/meta-bind) / [footer](/modules/footer).
- **Debug output:** with `APP_DEBUG` on, yajra adds `queries` and `input` to the JSON. The grid
  drops both before any event or module sees them, and a yajra `error` text goes to the console
  ([DG012](/errors/DG012)), never into the page.

The full wire format is in [Protocol: ssp](/protocol/ssp).

## Notes

- **"All" in the page-size menu:** yajra accepts `length=-1`. The grid sends it only when you opt in
  on both sides: `pageSizes: [10, 25, 100, -1]` and `yajra({ allowAll: true })`. Without the opt-in,
  page sizes are capped by `maxPageSize` (1000 by default).
- **Typed column filters** reach yajra as `columns[i][columnControl]` parameters — see
  [Column filters](/modules/column-filters).
- **Errors** (500, 419, a `200` with `error`) never raise an `alert()`: they become the `error`
  event and an inline error with a **Retry** button. Try **Simulate → HTTP 500** above.

## Related

- [Server protocols](/guide/server-protocols) — yajra, Laravel paginator and the datagrids protocol side by side
- [Columns](/guide/columns) — typed factories and the HTML opt-in
- [Laravel paginator & API resources](/recipes/laravel-paginator)
- [Migration guide](/migration/from-datatables)
