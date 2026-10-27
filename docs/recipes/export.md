---
title: Export
type: how-to
description: Add Excel, CSV and print to a server grid, choose between the current page and all filtered rows, and hand huge exports to the server with grid.query().
---

# Export

**Goal:** an **Export** menu on a server-paged list that produces real spreadsheets (numbers stay
numbers, dates stay dates), exports exactly what the user filtered, and still works when the list
is far too big to download through the browser.

<Demo id="rcp-export" />

Search for something, then open **Export → CSV**: the file holds every matching row, not just the
visible page. The link under the grid is what a server-side export would receive for the same view.

## Steps

### 1. Attach the export modules

```js
use: [
  serverSide({ url: "/agents/data", protocol: yajra(), csrf: true }),
  excel({ scope: "all", filename: () => `agents-${today()}` }),
  csv({ scope: "all", filename: () => `agents-${today()}` }),
  print(),
],
```

The three modules share one **Export** menu in the toolbar. Attach only the ones you want. Excel
files are written by the library itself (no spreadsheet dependency).

### 2. Pick the scope

| `scope` | Exports | Default for |
|---|---|---|
| `"page"` | the rows on screen | server grids |
| `"all"` | every row matching the current search, sort, filters and page parameters | client grids |

On a server grid, `"all"` makes **one** extra request with the current query and
`pageSize = maxPageSize` (1000 by default). If more rows match, the file holds the first 1000 and
the user is told how many were left out. Raise the cap per grid with `maxPageSize` only if your
endpoint can answer that many rows quickly; otherwise use step 4.

### 3. Check what each column exports

- Typed columns export typed values: `column.money()` and `column.number()` real numbers,
  `column.date()` real dates, `column.badge()` its label.
- HTML cells (the yajra default, `column.html()`) are exported as their plain text.
- Leave a column out with `exportable: false`; override a value with `exportValue: (row) => …`.
  Selection and action columns are never exported.
- CSV uses `,` (`;` for Turkish locales), adds a UTF-8 byte order mark so spreadsheet apps detect
  the encoding, and prefixes cells that start with `=`, `+`, `-` or `@` with `'` so they can't run
  as formulas.

### 4. Export huge lists on the server

For tens of thousands of rows, don't page through the API from the browser. Send the current query
to an export endpoint and let it stream the file:

```js
document.querySelector("#export-all").addEventListener("click", () => {
  const { search, sort, filters } = grid.query();
  const params = new URLSearchParams({
    ...grid.lastRequestParams(), // page parameters (filter panel, params…) as last sent
    ...filters,
    search,
    sort: sort.map((s) => (s.dir === "desc" ? "-" : "") + s.key).join(","),
  });
  location.assign(`/agents/export.csv?${params}`);
});
```

`grid.query()` returns the grid's current state: `{ page, pageSize, sort, search, filters, columns }`.
Page parameters (a [filter panel](/recipes/filter-panel), `softDeletes()`, the source's `params`)
are not part of it: `grid.lastRequestParams()` returns the ones actually sent for the rows on
screen, without `_token`.

```php
// routes/web.php
Route::get('/agents/export.csv', [AgentExportController::class, 'csv']);
```

```php
public function csv(Request $request)
{
    $query = Agent::query()->listSearch($request->search);   // the list's own search/filter code
    foreach (array_filter(explode(',', (string) $request->sort)) as $s) {
        $column = ltrim($s, '-');
        abort_unless(in_array($column, ['ref', 'name', 'unit', 'status', 'amount', 'date'], true), 422);
        $query->orderBy($column, str_starts_with($s, '-') ? 'desc' : 'asc');
    }

    return response()->streamDownload(function () use ($query) {
        $out = fopen('php://output', 'w');
        fputcsv($out, ['Ref', 'Name', 'Unit', 'Status', 'Amount', 'Date']);
        foreach ($query->cursor() as $a) {
            fputcsv($out, [$a->ref, $a->name, $a->unit, $a->status, $a->amount, $a->date]);
        }
        fclose($out);
    }, 'agents-'.now()->toDateString().'.csv');
}
```

A plain link navigation keeps the session cookie, needs no CSRF token (it's a `GET`) and lets the
browser show its own download progress.

## Your own buttons

Each module adds its API to the grid, so you can trigger exports from anywhere:

| Call | Does |
|---|---|
| `grid.excel.download()` | builds and downloads the `.xlsx` |
| `grid.excel.blob()` | builds it and returns a `Blob` (upload, attach to a mail…) |
| `grid.csv.download()` / `grid.csv.text()` | the same for CSV |
| `grid.print.open()` | opens the print view |

## Notes

- **Print** renders a light, text-only copy of the table (no page CSS, no cell HTML) in a hidden
  frame and opens the browser's print dialog — "Save as PDF" turns it into a PDF. Listen to
  `beforePrint` to adjust the document or cancel.
- **File names** default to `{grid name}-{date}`; `filename` accepts a string or a function.
- **Footer rows** (`<tfoot>`, the [footer module](/modules/footer)) are included with
  `footer: true`.
- **Permissions:** `excel({ can: false })` removes the menu item; enforce the same rule on the
  export endpoint.

## Related

- [export modules](/modules/export) — every option
- [Columns](/guide/columns) — `exportValue`, `exportType`, `exportable`
- [Page filter panel](/recipes/filter-panel)
