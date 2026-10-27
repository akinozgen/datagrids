---
title: Migrating from DataTables
type: how-to
description: Map DataTables 1.10, 2.x and 3.x options, events and API calls to datagrids, keep your server endpoints, and migrate one page at a time.
---

# Migrating from DataTables

This guide covers DataTables 1.10, 2.x and 3.x. Legacy 1.9-style (Hungarian) names are listed in the
[appendix](#appendix-legacy-1-9-names). The short version: your server endpoints stay as they are,
each DataTables option becomes a grid option, a column option or a module, and pages move over one
at a time.

## Why migrate (and what you give up)

DataTables 3 no longer needs jQuery, so "drop jQuery" is not a reason on its own. These are:

- **You gain:**
  - A small core plus modules you import only where you use them; nothing global to configure first.
  - Styling the host page can't deform: component-scoped `--dg-*` tokens, a low-specificity reset,
    states as attributes. One `--dg-accent` rebrands it.
  - Accessible defaults: a native `<table>`, real `<button>` sort controls with `aria-sort`, a skip
    link, polite announcements for search results and page changes.
  - Text-by-default cells. HTML is an explicit opt-in per column.
  - Laravel conveniences as single flags: CSRF, session expiry, paginator JSON, row actions.
  - Excel export without extra libraries, with real numbers and dates.
  - Costly server columns computed only while they are visible (`lazyColumns()`).
  - Per-grid error handling with a Retry button: no `alert()`, no global error mode.
- **You keep:** your server endpoints. datagrids speaks the DataTables server-side protocol
  byte for byte (see [Your server keeps working](#your-server-keeps-working)).
- **You give up:**
  - Editor, SearchPanes, SearchBuilder, RowGroup, Scroller and child rows.
  - Column header filter rows (`orderCellsTop`). Typed column filters live in a header menu instead.
  - PDF and copy buttons. Print, then use the browser's "Save as PDF".
  - The large ecosystem of third-party plug-ins and themes.

## Concept mapping

| DataTables mindset | datagrids mindset |
|---|---|
| One options object per table | A grid with columns, plus modules in `use: [...]` |
| `dom` / `layout` strings | Named toolbar slots (`start`, `end`, `filters`); modules place their own controls |
| `buttons: [...]` | Modules: `colVis()`, `excel()`, `print()`, `button.reload()`… |
| `serverSide: true` + `ajax` | A `serverSide()` source with a protocol: `yajra()`, `ssp()`… |
| `ajax.data` function | `serverSide({ params })`, or a `filterPanel()` bound to the page's filter form |
| `createdRow`, `drawCallback` | `rowClass`/`rowAttrs` options and events (`render`, `load`) |
| `$.fn.dataTable.defaults` | `configure()` and presets (arrays of modules) |
| `$('#t').DataTable()` creates a table if there is none | `Datagrid.get('#t')` returns `null` if there is none |
| Page numbers start at 0 (`page()`) | Page numbers start at 1 (`grid.page()`) |

## Config mapping

Names are DataTables 1.10's. Where 2.x / 3.x use a different name, it follows as "2.x+".

### Data and server

| DataTables | datagrids | Notes |
|---|---|---|
| `serverSide: true` + `ajax: { url, type }` | `use: [serverSide({ url, protocol: yajra() })]` | `ssp()` for non-Laravel servers. Endpoint unchanged |
| `ajax: "/url"` without `serverSide` | `use: [fetchAll({ url })]` | One request, then search, sort and paging in the browser |
| `ajax.type` | `serverSide({ method })` | `yajra()` defaults to POST, `ssp()` to GET |
| `ajax.data` (object or function) | `serverSide({ params })` | An object, or a function called per request. To port a function verbatim: `yajra({ data })` |
| `ajax.dataSrc` | `yajra({ dataSrc })` / `ssp({ dataSrc })` | `fetchAll({ dataSrc })` for client mode |
| `ajax.headers` | `serverSide({ headers })` |  |
| `ajax.timeout` | `serverSide({ timeout })` | Default 30 s |
| `_token` in `ajax.data` | `serverSide({ csrf: true })` | Or once for all grids: `configure({ csrf: true })` |
| `ajax.error`, `$.fn.dataTable.ext.errMode`<br>2.x+: `DataTable.ext.errMode` | `grid.on("error", fn)`, `errorMode` | Per grid (`"inline"`, `"silent"`, `"throw"`), or `configure({ errorMode })` |
| `ajax` as a function | `use: [customSource({ mode: "server", load })]` | `load(query, { signal })` resolves to `{ rows, total, filtered }` |
| `data: [...]` | `data: [...]` | Client mode |
| Rows already in `<tbody>` | Nothing to do | The DOM source is automatic; see [Data sources](/guide/data-sources#dom-progressive-enhancement) |
| `deferLoading` with a server-rendered first page (removed in 2.0, back in 2.1) | `serverSide({ seed })` | `seed` is the first response body, rendered without a request |
| `deferLoading` to wait for the user | `load: "manual"` | Or `load: "visible"`: loads when scrolled into view |
| `processing: true` | Built in | Loading state with `aria-busy` |
| `rowId` | `rowKey` | Default: `id`, then `DT_RowId` |

### Layout, buttons and paging

| DataTables | datagrids | Notes |
|---|---|---|
| `dom: '…'`<br>2.x+: `layout: {…}` (`dom` deprecated) | Toolbar slots | No layout strings; see [custom toolbar](/recipes/custom-toolbar) |
| `buttons: ['colvis']` | `colVis()` |  |
| `buttons: ['excel']` / `'excelHtml5'` | `excel({ filename })` | No JSZip. Numbers and dates come from typed columns and `exportValue` |
| `buttons: ['csv']` / `'csvHtml5'` | `csv()` |  |
| `buttons: ['print']` | `print()` |  |
| `buttons: ['pdf']` / `'pdfHtml5'` | — | `print()` and the browser's "Save as PDF" |
| `buttons: ['copy']` | — | Not in v1 |
| `{ text, action }` button | `button.custom({ label, onClick })` | `disabled(raw)` derives the state from the last response |
| `{ extend: 'collection', buttons }` | `button.group({ label, items })` |  |
| A "reload" button | `button.reload()` |  |
| `pageLength` | `pageSize` | Default 25 |
| `lengthMenu` | `pageSizes` | Default `[10, 25, 50, 100]` |
| `-1` in `lengthMenu` ("All") | `-1` in `pageSizes` + `yajra({ allowAll: true })` | Without `allowAll` "All" is capped at `maxPageSize` (1000) |
| `paging: false` | `paging: false` |  |
| `info`, `lengthChange` | — | The info text and page-size menu are part of the pager |
| `pagingType` | — | One pager: first/last, page field, native select on narrow screens |
| `scrollX` | Built in | The pager stays outside the horizontal scroll area |
| `scrollY` | `maxHeight: "60vh"` | Bounded body with a sticky header |
| `fixedHeader` | `stickyHeader()`, or `maxHeight` | `stickyHeader()` keeps a header copy at the top of the page; with `maxHeight` the body scrolls under a CSS-sticky header |
| `fixedColumns: { leftColumns: 1 }`<br>2.x+: `fixedColumns: { start: 1 }` | `sticky: "start"` on that column | One column per side (`"start"` / `"end"`) |
| `deferRender` (the default in 2.x+), Scroller | Built in | Pages of 300+ rows switch to virtual rows (`virtual` option) |

### Sorting, searching and columns

| DataTables | datagrids | Notes |
|---|---|---|
| `order: [[3, 'desc']]`<br>2.x+: also `[{ name, dir }]` | `sort: [["amount", "desc"]]` | By column key, not index |
| `order: []` | `sort: []` | Keeps the server's order. Otherwise, while no sort is active (no `sort` option, or the sort cleared at runtime), the SSP wire sends DataTables' default `[[0, 'asc']]` |
| `ordering: false` | `sortable: false` on each column | No grid-level switch |
| `searching: false` | `search: false` |  |
| `searchDelay` | `search: { delay }` | Default 400 ms on server grids, 200 ms in the browser |
| `columns[].data` | the column `key` | Plus `data: "unit.name"` for a dotted path |
| `columns[].name` | `name` | Sent as `columns[i][name]` |
| `columns[].title`, `visible`, `searchable`, `className` | same names |  |
| `columns[].orderable` (1.10 also accepts `sortable`) | `sortable` |  |
| `columns[].width`, `autoWidth` | CSS | No inline widths; headers realign with a ResizeObserver |
| `columns[].defaultContent` | `defaultContent` | Text |
| `columns[].render(data, type, row, meta)` | `render(value, row, ctx)` | Return a string or a Node. Cells are text by default; HTML is an explicit opt-in (`column.html()`) |
| `render` branching on `type === 'export'` / `'sort'`, `orthogonal` | `exportValue(row)`, `value(row)`, `compare` |  |
| `$.fn.dataTable.render.text()`<br>2.x+: `DataTable.render.text()` | Default behavior |  |
| `$.fn.dataTable.render.number(…)`<br>2.x+: `DataTable.render.number(…)` | `column.number()`, `column.money()` | Formatted, right-aligned, exported as numbers. Data strings are read as machine numbers (`"1.500"` = 1.5); use `source: "tr"` for Turkish-formatted text (`"1.500"` = 1500), and `source: "html"` on `money()` for server-rendered HTML |
| `columns[].type` | Typed factories | `column.date()`, `column.badge()`, `column.link()`, `column.phone()`… |
| — | `lazy: true` on a column + `lazyColumns()` | Costly server columns are requested only while visible (`lazy[]=key`) |
| `columnDefs` | Options on each column |  |
| `columns[].orderData` | `sortKey` | Browser sorting; on server grids the server decides |
| `columns[].createdCell` | `render(value, row, ctx)` | `ctx.td` is the cell |
| `data: null` + `defaultContent: '<button>…'` | `column.actions()` + `actions({ items })` | See [row actions](/modules/actions) |
| `createdRow`, `rowCallback` | `rowClass(row)`, `rowAttrs(row)`, `rowTone(row)` |  |
| `initComplete` | `grid.on("load", fn)` | The first `load` carries the data. `init` fires earlier, after setup |
| `drawCallback` | `grid.on("render", fn)` |  |
| `footerCallback`, sums in `<tfoot>` | `footer({ cols: { amount: "sum" } })` |  |
| `language` | `messages`, `locale` | English and Turkish bundled; [messages](/reference/messages) |
| `language.url` | — | No remote language files |

### Extensions and instance options

| DataTables | datagrids | Notes |
|---|---|---|
| `stateSave: true` | `stateSave()` | Sort, page size, visible columns (and column order with `colReorder()`) |
| `stateSaveParams`, `stateLoadParams` | `stateSave({ include })` | Search and page are not saved by default; `include: ["search", "filters", "page"]` opts in |
| `stateDuration` (seconds; `-1` = session) | `stateSave({ ttl })` (milliseconds) / `stateSave({ storage: sessionStorage })` | Default 90 days. A changed column set drops the saved state |
| Select extension | `column.select()` + `selection()` | Selection survives paging; "select all matching" |
| `colReorder` | `colReorder()` | Display order only; requests keep the definition order |
| `responsive` | `responsive()` | Collapsed columns move to a detail row |
| ColumnControl extension (2.3+) | `columnFilters()` | Sends ColumnControl's wire format to yajra |
| `rowReorder` | `rowReorder({ onEnd })` + `reorderColumn()` | Drag or keyboard; `onEnd` saves the order, a rejection reverts it |
| `keys` (KeyTable) | `keyboardGrid()` | APG grid navigation: one tab stop, arrow keys between cells |
| Saved search presets (SearchBuilder / StateRestore style) | `filterPresets({ presets })` | Named filter sets in the toolbar |
| `setInterval(() => table.ajax.reload(null, false), …)` | `autoRefresh({ every })` | Silent reload that keeps the page; pauses while the tab is hidden or the user is busy |
| `rowGroup`, `searchPanes`, `searchBuilder`, child rows | — | Not in v1 |
| `orderCellsTop` with a filter row | — | Not in v1; use `columnFilters()` |
| `destroy: true` | `Datagrid.get(el)?.destroy()` before creating, or `grid.remount()` |  |
| `retrieve: true` | `Datagrid.get(el)` |  |
| `$.fn.dataTable.defaults`<br>2.x+: `DataTable.defaults` | `configure({ … })` + presets | `configure()` affects grids created afterwards |

## Event mapping

`grid.on(name, fn)` returns an unsubscribe function (there is no `off`). Every event is also
dispatched on the grid root as a DOM event named `dg:<name>`.

| DataTables (1.10 / 2.x / 3.x) | datagrids | Notes |
|---|---|---|
| `init.dt` | `init` | After setup, before data. Data arrives with `load` |
| `preXhr.dt` | `beforeLoad` | Cancelable (`e.cancel()`); `e.query` is the neutral query. Change parameters with `params` |
| `xhr.dt` | `response` | `{ raw, result }`; `raw` is the JSON body |
| `draw.dt` | `render` | `{ keys, rows }` of the rendered page |
| `processing.dt` | `loadingchange` | `{ loading }` |
| `page.dt` | `page` | `beforePage` is cancelable |
| `length.dt` | `pagesize` | |
| `order.dt` | `sort` | `beforeSort` is cancelable |
| `search.dt` | `search` | |
| `column-visibility.dt`, `column-reorder.dt` | `columnchange` | `{ columns }` in display order |
| `responsive-resize.dt` | `collapse` | From `responsive()` |
| `stateSaveParams.dt`, `stateLoadParams.dt`, `stateLoaded.dt` | — | `stateSave({ include })`; read with `grid.state.read()` |
| `error.dt` (1.10), `dt-error.dt` (2.x+) | `error` | `{ error }`: kind, status, message, retryable |
| — | `sessionexpired` | 401, 419, or a redirect to a login page |
| `destroy.dt` | `destroy` | |
| `select.dt`, `deselect.dt` | `selectionchange` | `{ count, keys, all }` |
| `pre-row-reorder.dt` / `row-reorder.dt` | `beforeReorder` (cancelable) / `reorder`, `reordererror` | rowReorder module |

## API mapping

| DataTables | datagrids | Notes |
|---|---|---|
| `$('#t').DataTable()`<br>2.x+: also `new DataTable('#t')` | `Datagrid.get('#t')` | Returns `null` when there is no grid. DataTables creates one in that case |
| `isDataTable(el)` on `$.fn.dataTable`<br>2.x+: on `DataTable` | `Datagrid.get(el) !== null` |  |
| A table in another tab or module | `find("agents")`, `reload("agents")` | By the grid's `name` |
| `.ajax.reload()` | `grid.reload()` | Returns a Promise |
| `.ajax.reload(null, false)` | `grid.reload({ keepPage: true })` | `silent: true` skips the busy overlay |
| `.ajax.url(u).load()` | `serverSide({ url: (query) => … })` | The URL function runs per request |
| `.ajax.json()` | `grid.lastResponse()` |  |
| `.ajax.params()` | `grid.lastRequestParams()`, `grid.query()` | `lastRequestParams()`: the page parameters actually sent for the rows on screen (`_token` excluded). `query()`: the neutral query (page, sort, search, filters), not the encoded wire |
| `.draw()` | Not needed | State changes re-render the affected region |
| `.search(v).draw()` | `grid.search(v)` |  |
| `.column(i).search(v)` | `grid.filters({ key: v })` | Arrays mean "any of"; `{ op, value }` for typed filters |
| `$.fn.dataTable.ext.search`<br>2.x+: `DataTable.ext.search`, `search.fixed()` | `grid.filters({ name: (value, row) => … })` | Browser-side grids; per grid, not global |
| `.page(n).draw('page')` | `grid.page(n + 1)` | 1-based |
| `.page.info()` | `grid.status()`, `grid.page()`, `grid.pageSize()` | `status()` has `total`, `filtered`, `hasMore` |
| `.page.len(n).draw()` | `grid.pageSize(n)` |  |
| `.order([[i, 'desc']]).draw()` | `grid.sort([["amount", "desc"]])` |  |
| `.columns.adjust()` | Not needed | ResizeObserver |
| `.column(i).visible(b)` | `grid.setColumnVisible("key", b)` |  |
| `.columns().visible()` (read) | `grid.columns()` | Each column has `visible` |
| `.rows().data()` | `grid.rows()` | Server grids: the current page |
| `.rows({ page: 'current' }).data()` | `grid.viewRows()` |  |
| `.rows({ search: 'applied' }).data()` | `await grid.exportRows("all")` | Server grids: one request, up to `maxPageSize` rows |
| `.row(tr).data()` | `grid.delegate()` context, `grid.rowByKey(key)` |  |
| `.row(x).data(d).draw()`, `.row().invalidate()` | `grid.refreshRow(key, row)` |  |
| `.rows.add(arr).draw()` | `grid.addRows(arr)` | Client grids only; server grids ignore it (with a console notice): `reload()` instead |
| `.clear()` + `.rows.add(arr)` | `grid.setData(arr)` | `setData([])` empties the grid |
| `.row(x).remove().draw()` | `grid.removeRow(key)` |  |
| `.destroy()` | `grid.destroy()` | Restores the original table |
| `.state.clear()` | `grid.state.reset()` | `clear()` keeps the current view |
| `.state.save()`, `.state.loaded()` | `grid.state.save()`, `grid.state.read()` |  |
| `.rows({ selected: true }).data()` | `grid.selection.get()` | Bulk requests: `payload()` |
| `.button(…).trigger()` on an export button | `grid.excel.download()` | Also `grid.csv`, `grid.print` |
| `.buttons.exportData()` | `await grid.exportRows("all")` | Every filtered row; `exportRows()` alone returns the current page |
| `.settings()` | — | No private settings; use events and module APIs |
| A delegated `$(document).on('click', '.archive', …)` reading `.row(tr).data()` | `grid.delegate("click", ".archive", (e, { row }) => …)` | Also gives `key`, `tr`, `td`, `column` |
| `$('#t tbody').on('click', 'tr', …)` | `rowClick: (row, event) => …` option | Adds a permanent "open" indicator column |
| `$.post(url).done(() => table.ajax.reload(null, false))` | `grid.action(url, { method, confirm })` | Confirm, CSRF, notify, reload keeping the page |

## Your server keeps working

`ssp()` and `yajra()` send exactly what DataTables 1.10 sends, so controllers keep working as they
are:

- The full parameter set on every request: `draw`, `columns[i][data|name|searchable|orderable|search][value|regex]`,
  `order[i][column|dir]`, `start`, `length`, `search[value|regex]`, then your page parameters.
- Encoding identical to jQuery's `$.param`: booleans as `"true"` / `"false"`, `null` as an empty value,
  empty arrays omitted, `k[]=` for arrays, `k[a][b]=` for objects, `+` for spaces in POST bodies.
  No JSON body.
- `columns[]` in definition order with hidden columns included, so `order[i][column]` indexes never
  shift when users hide or reorder columns.
- While no sort is active (no `sort` option, or the sort cleared at runtime) the default
  `order[0][column]=0&order[0][dir]=asc` is sent, like DataTables. Only an explicit `sort: []`
  sends no order.
- Headers: `X-Requested-With: XMLHttpRequest` and jQuery's `Accept`. With `csrf: true`, also
  `X-CSRF-TOKEN` and a `_token` field.
- The response is read the same way: `data`, `recordsTotal`, `recordsFiltered` (numeric strings
  accepted), `error`, `DT_RowId`, `DT_RowClass`, and any extra top-level keys (on the `response`
  event, in `grid.lastResponse()`, bindable with [`metaBind()`](/modules/meta-bind)).
- `draw` is sent but not trusted. The latest request wins; earlier ones are aborted.
- With `yajra()`, untyped columns render as HTML because yajra escapes values on the server.
  `ssp()` renders them as text.
- `length=-1` ("All") passes through only with `allowAll: true`; otherwise it is capped by
  `maxPageSize`.
- Not supported: the pre-1.10 request format (`sEcho`, `iDisplayStart`, `iSortCol_0`…). Responses
  with `aaData`, `iTotalRecords` and `iTotalDisplayRecords` are still read.

Every rule, with the error normalization table, is in the [SSP wire reference](/protocol/ssp).

## Step by step: a typical server-side page

Before (DataTables 1.10):

```html
<select id="unit-filter">…</select>
<table id="agents">
  <thead><tr><th>#</th><th>Name</th><th>Unit</th><th>Amount</th><th>Status</th></tr></thead>
</table>
<script>
$('#agents').DataTable({
  processing: true,
  serverSide: true,
  stateSave: true,
  stateSaveParams: function (settings, data) { data.search.search = ''; data.start = 0; },
  ajax: {
    url: '/api/agents',
    type: 'POST',
    data: function (d) {
      d._token = $('meta[name="csrf-token"]').attr('content');
      d.unit = $('#unit-filter').val();
    }
  },
  dom: '<"toolbar"fB>rtip',
  buttons: ['colvis', 'excelHtml5', 'print'],
  order: [[3, 'desc']],
  pageLength: 10,
  columns: [
    { data: 'DT_RowIndex', orderable: false, searchable: false },
    { data: 'name' },
    { data: 'unit' },
    { data: 'amount', className: 'text-end', render: $.fn.dataTable.render.number(',', '.', 2, '$') },
    { data: 'status_html', orderable: false, searchable: false }
  ]
});
$('#unit-filter').on('change', function () { $('#agents').DataTable().ajax.reload(); });
</script>
```

After: the same page with datagrids, live against an in-page server that answers like a
yajra/laravel-datatables controller. Pick a unit, then open the **Request** tab.

<Demo id="mig-after" faults="500,419" />

What changed:

| Before | After |
|---|---|
| `serverSide`, `ajax.url`, `type: 'POST'` | `serverSide({ url, protocol: yajra() })`; POST is `yajra()`'s default |
| `d._token = …` | `csrf: true`, or `configure({ csrf: true })` once for every grid |
| `d.unit = …` + a `change` handler calling `ajax.reload()` | `filterPanel({ fields: { unit: "#mig-after-unit" } })`: sent as `unit`, reloads on change |
| `stateSave` + `stateSaveParams` | `stateSave()`: search and page are never saved by default |
| `dom` + `buttons` | `colVis()`, `button.reload()`, `excel()`, `print()`: each places its own control |
| `order: [[3, 'desc']]` | `sort: [["amount", "desc"]]` |
| `DT_RowIndex` column | `column.index()` numbers rows in the browser |
| `render.number(…)`, `className: 'text-end'` | `column.money()`: formatted, right-aligned, exported as a number (the server sends plain numbers) |
| `name`, `unit`, `status_html` | Untyped columns: with `yajra()` they render the server's (escaped) HTML |
| `processing: true` | Built in |

Three things to check on your own pages:

- **Numbers the server formats:** `column.number()` and `column.money()` read data strings as
  machine numbers (`"1500.50"`; `"1.500"` = 1.5). If the controller sends Turkish-formatted text
  (`number_format($v, 0, ',', '.')` → `"1.500"` for 1500), add `source: "tr"`; for server-rendered
  money HTML, `column.money(key, { source: "html" })`.
- **String columns on yajra endpoints:** keep them untyped (`{ key: "name", title: "Name" }`).
  `column.text()` always renders text, so a value yajra escaped (`O&#039;Brien`) would show the
  entity.
- **`columns[i][data]` changes for the index column:** `column.index()` sends an empty `data`. If your
  controller looks columns up by `data`, keep `{ key: "DT_RowIndex", title: "#", sortable: false, searchable: false }`
  instead.

## Turn repeated configuration into a preset

Most pages repeat the same source, buttons and saved state. A preset is a function that returns an
array of modules; arrays nest inside `use`:

```js
// list-page.js
import { serverSide, yajra, stateSave, colVis, button, excel, print } from "@akinozgen17/datagrids";

export const listPage = (url, o = {}) => [
  serverSide({ url, protocol: yajra(), csrf: true, ...o }),
  stateSave(),
  colVis(),
  button.reload(),
  excel(),
  print(),
];
```

```js
import { Datagrid, filterPanel } from "@akinozgen17/datagrids";
import { listPage } from "./list-page.js";

new Datagrid("#agents", {
  label: "Agents",
  columns,
  use: [listPage("/api/agents"), filterPanel({ fields: { unit: "#unit-filter" } })],
});
```

For server-rendered pages without a build step, register it with `preset("list-page", (table) => [...])`
and mark tables with `data-datagrid="list-page"`; [`upgrade()`](/guide/lifecycle#declarative-init-upgrade)
enhances them. Host-wide defaults (CSRF, page sizes, confirm and toast adapters, messages) go into
`configure()` once.

## Behavior differences and deliberate decisions

1. `Datagrid.get()` never creates a grid. `$(el).DataTable()` initializes a table with defaults
   when there is none, and a later "real" initialization is then ignored.
2. Loading is explicit: `load: "eager" | "visible" | "manual"`. In DataTables 1.10, any non-null
   `deferLoading` value defers the first request, even `false`.
3. Cells are text by default; HTML is a per-column opt-in. `yajra()` is the one exception, for
   untyped columns, because yajra escapes on the server.
4. Page numbers are 1-based in every API (`grid.page(1)` is the first page).
5. No PDF export. Use the print view and the browser's "Save as PDF".
6. Column widths live in CSS. No inline widths, no `columns.adjust()`: a ResizeObserver keeps
   headers aligned in tabs and modals.
7. No layout strings. Modules place their controls in named toolbar slots.
8. Errors are per grid: an `error` event plus an inline error state or banner with Retry. No
   `alert()`, no global error mode. Server error text (SQL, stack traces) never reaches the UI.
9. Responses are matched to requests, not to `draw`. A missing, stale or string `draw` can't freeze
   the table in "Processing…".
10. Saved state skips search and page by default, carries a version and a TTL, and is dropped when
    the column set changes.
11. The pager belongs to its table and sits outside the horizontal scroll area.
12. Exports read typed values (`exportValue`), not cell HTML.
13. Session expiry (419, 401, or a redirect to a login page) fires `sessionexpired`.
14. Unknown options print a console warning ([DG001](/errors/DG001)) that names the replacement:
    passing `ajax`, `dom` or `buttons` tells you which module to use.

## Finding everything to migrate

```bash
# Every initialization, jQuery style and DataTables 2+/3 style
rg -n -e '\.(DataTable|dataTable)\s*\(\s*\{' -e 'new\s+DataTable\s*\(' .
# Accessor calls: DataTables initializes the table here if it isn't yet
rg -n -e '\.DataTable\(\s*\)' .
# Global defaults and extensions that change behavior site-wide
rg -n -e '(dataTable|DataTable)\.(defaults|ext)' .
# DataTables event listeners
rg -n -e "\.on\(\s*['\"][a-z-]+\.dt" .
# Server endpoints that read DataTables parameters (PHP example)
rg -n -e "request\(\s*'(draw|start|length|order|columns|search)'" -e 'DataTables::(of|eloquent|query)' .
```

Configurations embedded in server templates (Blade, Twig, ERB, Razor) mix template syntax into
JavaScript, so codemods can't parse them reliably. Migrate those by hand with the tables above.

## FAQ

- **Can DataTables and datagrids run on the same page?** Yes. datagrids emits no `dataTable`
  classes and no `.dt` events, so global DataTables plug-ins and listeners don't touch it. Migrate
  one page at a time.
- **Do I have to change my controllers?** No. Keep them and use `yajra()` or `ssp()`. When you write
  a new endpoint, consider the [datagrids protocol](/protocol/v1/).
- **My cells show `&amp;`.** The column renders the server's escaped HTML as text. On yajra
  endpoints use an untyped column (`{ key: "name" }`) instead of `column.text()`; elsewhere use
  `column.html()` only for values your server escaped.
- **Other scripts call `$('#t').DataTable().ajax.reload()`.** Give the grid a `name` and call
  `reload("agents")`, or `Datagrid.get('#t')?.reload()`.
- **Where are header filter rows, RowGroup and PDF?** Not in v1. See the
  [deliberate decisions](#behavior-differences-and-deliberate-decisions) above.
- **No bundler?** Use the IIFE build: everything is on `window.Datagrids` (`Datagrids.Datagrid`,
  `Datagrids.serverSide`…). See [Getting started](/guide/getting-started#without-a-bundler).

## Appendix: legacy 1.9 names

Map to 1.10 names first, then use the tables above.

| 1.9 | 1.10+ |
|---|---|
| `bServerSide`, `sAjaxSource`, `fnServerParams`, `fnServerData` | `serverSide`, `ajax`, `ajax.data`, `ajax` (function) |
| `aaSorting`, `aLengthMenu`, `iDisplayLength`, `sDom`, `oLanguage` | `order`, `lengthMenu`, `pageLength`, `dom`, `language` |
| `aoColumns`, `aoColumnDefs`, `mData`, `mRender` | `columns`, `columnDefs`, `columns.data`, `columns.render` |
| `sTitle`, `sClass`, `sWidth`, `bVisible`, `bSortable`, `bSearchable`, `sDefaultContent` | `title`, `className`, `width`, `visible`, `orderable`, `searchable`, `defaultContent` |
| `bPaginate`, `bFilter`, `bSort`, `bInfo`, `bLengthChange`, `bProcessing`, `bStateSave`, `sPaginationType` | `paging`, `searching`, `ordering`, `info`, `lengthChange`, `processing`, `stateSave`, `pagingType` |
| `fnDrawCallback`, `fnRowCallback`, `fnCreatedRow`, `fnInitComplete`, `fnFooterCallback` | `drawCallback`, `rowCallback`, `createdRow`, `initComplete`, `footerCallback` |
| `fnClearTable`, `fnAddData`, `fnDeleteRow`, `fnDraw`, `fnFilter`, `fnSort`, `fnGetData`, `fnSettings` | `clear()`, `rows.add()`, `row().remove()`, `draw()`, `search()`, `order()`, `data()`, `settings()` |

## Related

- [Concepts](/guide/concepts): grid, columns, modules, pipelines.
- [Server protocols](/protocol/) and the [SSP wire reference](/protocol/ssp).
- [Laravel + yajra recipe](/recipes/laravel-yajra).
- [Module catalog](/modules/).
