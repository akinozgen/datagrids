---
title: Page filter panel
type: how-to
description: Drive a server grid from a filter form above it — selects, multi-selects and debounced text — and keep the view in a shareable URL.
---

# Page filter panel

**Goal:** a filter form above a server grid. Every request carries the form's current values, the
grid reloads when a control changes (text input is debounced), and the URL always describes the
current view so it can be bookmarked or shared.

<Demo id="rcp-filter-panel" />

Change the filters and look at the address bar: `?f.status=pending&f.unit=R.P.D.&f.name=redfield`.
Reload the page with that URL and the form, the search box and the grid come back in the same state.

## Steps

### 1. Write the form as plain HTML

Any native control works: `<select>`, `<select multiple>`, text inputs, checkboxes, radio groups.
The demo's **HTML** tab has the markup. Nothing in it is grid-specific.

### 2. Map request parameters to controls with `filterPanel`

```js
filterPanel({
  fields: {
    status: "#status", // <select>          → status=pending
    unit: "#unit",     // <select multiple> → unit[]=R.P.D.&unit[]=B.S.A.A.
    name: "#name",     // text input        → name=redfield (debounced)
  },
}),
```

The keys are the request parameter names. On a server grid the values are read **when each request
is built** (the same moment an old `ajax.data` function ran) and added as top-level parameters
next to the protocol's own. Changing a `<select>` reloads at once; typing waits for a 250 ms pause.

### 3. Add `urlSync()` for shareable links

`urlSync()` writes the search, sort, page and the filter panel's fields into the query string
(`q`, `sort`, `page`, `f.<field>`) and, on load, applies the URL before the first request — the URL
wins over defaults and saved state. Values equal to the form's initial state are left out, so a
fresh page has a clean URL. Use `grid.urlSync.link()` to get the link for a "Copy link" button.

### 4. Read the parameters on the server

```php
public function data(Request $request)
{
    $query = Agent::query()
        ->when($request->status, fn ($q, $status) => $q->where('status', $status))
        ->when($request->input('unit'), fn ($q, $units) => $q->whereIn('unit', (array) $units))
        ->when($request->name, fn ($q, $name) => $q->where('name', 'like', "%{$name}%"));

    return DataTables::eloquent($query)->toJson();
}
```

An empty select arrives as `status=` and `->when()` skips it; an empty multi-select is not sent at all.

## Variations

```js
// a "Filter" button instead of reloading on every change
filterPanel({ fields, auto: false });
document.querySelector("#apply").addEventListener("click", () => grid.filterPanel.apply());

// checkboxes send "1" / "0" on server grids; change both values if your controller expects others
filterPanel({ fields: { overdue: { el: "#overdue", value: "yes", unchecked: "no" } } });

// a widget that doesn't fire native change events, plus a value transform
filterPanel({
  fields: {
    period: {
      el: "#period",
      format: (value) => (value ? value.split(" – ") : null), // null = leave the parameter out
      subscribe: (el, notify) => {
        el.addEventListener("pick", notify);
        return () => el.removeEventListener("pick", notify);
      },
    },
  },
});

// set or reset controls from code (reloads unless { reload: false })
grid.filterPanel.set({ status: "open", unit: ["R.P.D."] });
grid.filterPanel.reset(); // back to the values the controls had at init
```

## Client grids: `grid.filters()`

When all rows are already in the browser, you don't need a form module: call `grid.filters()`
from any control. It filters in memory, resets to page 1 and re-renders.

<Demo id="rcp-filters-client" />

| Value | Matches |
|---|---|
| `"open"` | cells equal to the value |
| `["pending", "draft"]` | any of the values |
| `(value, row) => boolean` | rows the predicate accepts |
| `{ op: "gte", value: 100 }` | typed operators (the ones [column filters](/modules/column-filters) use) |
| `null`, `""`, `[]` | removes that filter |

`filterPanel` also works on client grids — it calls `grid.filters()` for you — so the same form can
serve both. On server grids prefer `filterPanel` (or the source's `params`): it controls exactly
which request parameters are sent.

## Notes

- **Controls re-rendered by your page** keep working: the module listens with one delegated
  listener and looks controls up by selector on every read.
- **Select widgets** (select2, Tom Select…) that update the native `<select>` and fire `change` need
  nothing extra; `filterPanel.set()` dispatches `change` so they repaint.
- **Two grids with `urlSync()` on one page:** give each its own key prefix with
  `urlSync({ namespace: "orders" })` (`orders.q=…`), or `namespace: true` for the grid's `name`.
  Without one, the second grid falls back to its name (or table id) and logs a warning.
- **History:** `urlSync()` replaces the current history entry by default. `urlSync({ mode: "push" })`
  adds entries and follows the back/forward buttons.

## Related

- [filterPanel module](/modules/filter-panel) — every option and API method
- [urlSync module](/modules/url-sync)
- [Laravel + yajra list](/recipes/laravel-yajra#extra-page-parameters) — `params` for one or two values
- [Selection + bulk action](/recipes/bulk-actions) — applying an action to "all matching" rows
