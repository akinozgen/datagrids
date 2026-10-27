---
title: Selection + bulk action
type: how-to
description: Select rows across pages or all rows matching the current search, then send one POST that handles both payload shapes.
---

# Selection + bulk action

**Goal:** users tick rows on any page — or pick "all matching" without loading thousands of rows —
and one button sends a single request the server can act on.

<Demo id="rcp-bulk" />

Try both shapes: tick two rows on different pages, then tick the header checkbox and press
**Select all 941 matching** and untick one row. The payload under the grid is exactly what
**Send reminder** posts; the **Request** tab shows it on the wire.

## Steps

### 1. Add the checkbox column and the selection module

```js
columns: [column.select(), /* … */],
use: [
  serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
  selection({ bulk: { actions: [/* … */] } }),
],
```

`column.select()` places the checkbox column; `selection()` fills it, adds the header checkbox and
the bulk bar above the table. Selection survives paging, sorting and searching: rows are tracked by
key (`id`, else `DT_RowId`, or your `rowKey`).

### 2. Post the payload with `grid.action()`

Each bulk action gets `(payload, grid, selection)`. Hand the payload to
[`grid.action()`](/reference/methods) — it asks for confirmation, sends JSON with the CSRF header,
reports the result and reloads the grid (keeping the page) unless you say `reload: false`:

```js
onClick: async (payload, grid, sel) => {
  const result = await grid.action("/agents/bulk/remind", {
    body: payload,
    confirm: `Send a reminder to ${sel.count()} agents?`,
  });
  if (result !== undefined) sel.clear(); // undefined = the user cancelled
},
```

Return the promise (an `async` function does): the bar keeps its buttons disabled until it settles,
so nobody double-submits.

### 3. Handle both shapes on the server

| `payload` | Meaning |
|---|---|
| `{ all: false, keys: ["1998", "2000"] }` | exactly these rows |
| `{ all: true, except: ["1999"], query: { search, sort, filters, params } }` | every row matching `query`, minus `except` |

Keys are strings. `query` is the grid's state when "all matching" was chosen — paging left out.
`query.params` holds the page parameters of the request behind the rows on screen at that moment
([`grid.lastRequestParams()`](/reference/methods)): values from a [filter panel](/recipes/filter-panel),
[softDeletes](/modules/soft-deletes) or the source's `params`, without `_token`.

```php
// routes/web.php
Route::post('/agents/bulk/remind', [AgentBulkController::class, 'remind']);
```

```php
// app/Http/Controllers/AgentBulkController.php
public function remind(Request $request)
{
    $data = $request->validate([
        'all' => ['required', 'boolean'],
        'keys' => ['exclude_if:all,true', 'required', 'array', 'max:1000'],
        'keys.*' => ['integer'],
        'except' => ['array'],
        'except.*' => ['integer'],
        'query.search' => ['nullable', 'string', 'max:200'],
    ]);

    $agents = $data['all']
        ? Agent::query()->listSearch($data['query']['search'] ?? null)->whereKeyNot($data['except'] ?? [])
        : Agent::query()->whereKey($data['keys']);

    $count = 0;
    $agents->chunkById(500, function ($chunk) use (&$count) {
        foreach ($chunk as $agent) {
            $this->authorize('remind', $agent);
            SendReminder::dispatch($agent);
            $count++;
        }
    });

    return response()->json(['message' => "Reminder queued for {$count} agents."]);
}
```

```php
// app/Models/Agent.php — one search definition, used by the list endpoint and the bulk endpoint
public function scopeListSearch(Builder $query, ?string $term): void
{
    $query->when($term, fn ($q) => $q->where(fn ($q) => $q
        ->where('name', 'like', "%{$term}%")
        ->orWhere('ref', 'like', "%{$term}%")));
}
```

Rebuild "all matching" with the **same** search and filter code the list uses. If the bulk endpoint
searches differently, it acts on rows the user never saw.

## Notes

- **Page filters are in `payload.query.params`.** Rebuild "all matching" from them on the server
  together with `search` and `filters`; no need to send the form values separately.
- **"All matching" resets itself** when the search, filters or page parameters change, or when the
  matching count changes on reload, and the live region says so. A stale "all" never reaches your
  endpoint.
- **The success message:** `grid.action()` shows `success` if you pass it, else the `message` of
  the JSON response, else a generic "Done.". Pass `success: false` to stay silent. The demo passes
  `success` because its server returns no message.
- **Notifications** go to your `notify` adapter (toast library) when one is configured; without one
  they are announced to screen readers and errors also appear as a banner. See
  [Row actions](/recipes/row-actions#host-confirm-and-notify-adapters).
- **`can: false`** on a bulk action removes its button — for the UI only; the endpoint must still
  authorize every row, as above.
- Only the current page is in the browser on a server grid: `grid.selection.get()` returns the
  rows it has seen, `payload()` is what describes the whole selection.

## Related

- [selection module](/modules/selection) — modes, options, API and events
- [Row actions with confirm](/recipes/row-actions)
- [Page filter panel](/recipes/filter-panel)
