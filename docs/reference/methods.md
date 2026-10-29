---
title: Instance methods
type: reference
description: Every member of a grid instance (DatagridApi) with signature, return value and behaviour, plus the API each module adds to the grid.
---

# Instance methods

A grid instance (`new Datagrid(…)`, `Datagrid.get(el)`, `find(name)`) implements `DatagridApi`.
Methods that change state (`search`, `page`, `sort`, `filters`…) load data themselves; you never call
`refresh()` or `draw()`.

```js
const grid = Datagrid.get("#agents");
grid.batch(() => {
  grid.sort([["date", "desc"]]);
  grid.filters({ unit: "R.P.D." });
});
await grid.reload();
```

## Data loading

| Member | Returns | Description |
|---|---|---|
| `load()` | `Promise<void>` | Loads with the current query. Fires `beforeLoad` (cancelable). The last request wins: a running request is aborted and stale responses are dropped (matched by sequence, never by the server's `draw`). In client mode, once data is loaded, it recomputes the view locally without a request. |
| `reload({ keepPage?, silent? })` | `Promise<void>` | Loads again. Goes back to page 1 unless `keepPage: true`. `silent: true` skips the busy overlay. Array and DOM sources re-run search, sort and paging over the current rows, keeping `setData()` / `addRows()` / `removeRow()` changes; `fetchAll` refetches. With `errorMode: "throw"` the promise rejects on failure. |
| `setData(rows)` | `void` | Client mode: replaces the rows and re-renders. |
| `addRows(rows, { keepPage? })` | `void` | Client mode: appends rows and jumps to the last page unless `keepPage: true`. Ignored in server mode (a development notice is printed); change the data on the server and `reload()`. |
| `removeRow(key)` | `void` | Removes the row with this key: from the data (client) or from the current page until the next load (server). |
| `refreshRow(key, row?)` | `void` | Re-renders one row in place, optionally replacing its data object first. Row mutators run again. |
| `exportRows(scope?)` | `Promise<Row[]>` | Rows for an export. `"page"` (default): the current view. `"all"`: every filtered row; client mode computes them locally, server mode sends one request with `pageSize = maxPageSize` (request middleware included). |
| `lastResponse()` | `unknown` | Raw JSON body of the last load (server sources and `fetchAll`); `null` for array and DOM sources. |
| `lastRequestParams()` | `object` | Page parameters of the request behind the rows on screen, as they reached the wire: filter panel, toggles, `params`, after every middleware. With `ssp` / `yajra` also non-column `filters()` and whatever a `data` function added; the protocol's own fields (`draw`, `columns`, `order`, `start`, `length`, `search`) and `_token` are left out. `{}` for local sources. Use it to rebuild "all matching" on the server. |

## State: getters and setters

Each setter returns the current value, so calling it without an argument reads it.

| Member | Returns | Description |
|---|---|---|
| `search(text?)` | `string` | Sets the search text, goes to page 1, loads and announces the result count. Fires `search`. Also updates the toolbar box. |
| `page(n?)` | `number` | Goes to page `n` (1-based), clamped to the page count (open-ended when the total is unknown). Fires `beforePage` (cancelable) and `page`; scrolls the table to the top. Before the first load it only stores the value. |
| `pageSize(n?)` | `number` | Sets rows per page and goes to page 1. Values above `maxPageSize` or below 0 are clamped ([DG013](/errors/DG013)); `-1` is "All" where the protocol allows it. `0` means paging is off. Fires `pagesize`. |
| `sort(spec?)` | `SortSpec[]` | Sets the sort: `[["date", "desc"]]` or `[{ key: "date", dir: "desc" }]`; `[]` clears it. Goes to page 1, announces the new order. Fires `beforeSort` (cancelable) and `sort`. |
| `filters(patch?)` | `Readonly<Record<string, unknown>>` | Merges `patch` into the filters (`null`, `""` or `[]` removes a key), goes to page 1 and loads. See [Filters](#filters). |
| `query()` | `Query` | The current request payload, see [Query](#query). |
| `status()` | `GridStatus` | Loading status, totals and the last error, see [GridStatus](#gridstatus). |
| `batch(fn)` | `void` | Runs `fn` with loads and sort announcements suppressed, so several setters don't each fire a request. Nothing loads afterwards on its own: call `reload()` once `fn` returns. |
| `stateContributions()` | `ReadonlyArray<StateContribution>` | Parts registered with `ctx.state()` by modules (what `stateSave` persists). |

### Filters

`filters()` is the one filter store for every filter UI (filter panels, column filters, your own code).

| Value | Client mode |
|---|---|
| string / number / boolean | equals (compared as strings) |
| array | any of the values |
| `{ op, value }` | typed operator: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `between`, `in`, `notIn`, `contains`, `notContains`, `starts`, `ends`, `empty`, `notEmpty` |
| `(value, row) => boolean` | predicate |

In client mode a key that is a column key compares the cell value; any other key reads that path
of the row. On a server source the protocol encodes the filters (functions are never sent):

| Protocol | How filters travel |
|---|---|
| `ssp()` / `yajra()` | Keys that are not column keys: extra form parameters (`unit=R.P.D.`). `{ op, value }` on a searchable column: `columns[i][columnControl]` (no `between` / `notIn`). A plain value on a column key is an equality: an anchored, escaped regex in `columns[i][search][value]` (`^R\.P\.D\.$`, `regex=true`; an array becomes `^a$\|^b$`). Filters on columns with `searchable: false` are not sent (development notice). |
| `dgp()` | `filters: { key: { op, value } }`; a plain value becomes `eq`, an array `in`. |
| `laravelPaginator()` | Query parameters `key=value`; typed filters send their `value`, so only `eq` and `in` mean what they say (the column filter menu offers only those). |

### Query

| Field | Type | Description |
|---|---|---|
| `page` | `number` | 1-based page. |
| `pageSize` | `number` | Rows per page; `0` = paging off, `-1` = all. |
| `sort` | `SortSpec[]` | `{ key, dir }` entries. |
| `search` | `string` | Toolbar search text. |
| `filters` | `Record<string, unknown>` | Copy of the filter store. |
| `columns` | `ResolvedColumn[]` | Columns in **definition** order (the wire order), with resolved `title`, `sortable`, `searchable`, `visible`, `hideable`, `exportable`, `defaultVisible`, `index`. |
| `sortDefault` | `boolean` | `false` only when the grid was created with an explicit `sort: []`. While it is `true`, an empty sort on the SSP wire sends the first column ascending — also after the sort was cleared at runtime. |
| `pristine` | `boolean` | The query is still the one the grid was configured with (nothing restored or changed yet). |

### GridStatus

| Field | Type | Description |
|---|---|---|
| `status` | `"idle" \| "loading" \| "reloading" \| "ready" \| "error"` | `idle`: `load: "manual"` before the first load. `loading`: first load. `reloading`: later loads (the rows stay on screen). |
| `loaded` | `boolean` | At least one load succeeded. |
| `total` | `number \| null` | Records before filtering; `null` when the server doesn't count. |
| `filtered` | `number \| null` | Records after search and filters. |
| `hasMore` | `boolean \| null` | Next page exists (servers that don't count, e.g. `simplePaginate`). |
| `error` | `DatagridError \| null` | Last error: `{ kind, status, message, detail?, retryable, raw? }`. Cleared by the next successful load. |

## Rows

| Member | Returns | Description |
|---|---|---|
| `rows()` | `Row[]` | Client mode: every row. Server mode: the current page. |
| `viewRows()` | `Row[]` | The rows currently rendered (after client search, filters, sort and paging; or the server page). |
| `keyOf(row)` | `string` | The row's key (`rowKey`, else `id`, else `DT_RowId`, else a position key with [DG003](/errors/DG003)). |
| `rowByKey(key)` | `Row \| undefined` | Row object for a key, among the loaded rows. |

## Columns

| Member | Returns | Description |
|---|---|---|
| `columns()` | `ReadonlyArray<ResolvedColumn>` | Columns in **display** order (after reordering). `query().columns` keeps the definition order. |
| `setColumns(defs)` | `void` | Replaces the column definitions, drops sort entries for missing keys, re-renders the header, fires `columnchange` and reloads keeping the page. |
| `setColumnVisible(key, visible)` | `void` | Shows or hides a column without a request. Hiding a column with `hideable: false` is refused. Fires `columnchange`. |
| `columnOrder(keys?)` | `string[]` | Sets the display order (keys not listed keep their relative order at the end; special and sticky columns keep their slots) and returns the full order. The request keeps the definition order. Fires `columnchange`. |

## Events

| Member | Returns | Description |
|---|---|---|
| `on(type, fn)` | `() => void` | Subscribes to a grid event; returns the unsubscribe function. See [Events](/reference/events). |
| `emit(type, detail)` | `boolean` | Fires an event (listeners + a `dg:<type>` DOM event on the root). Returns `false` when a listener cancelled it; events whose name starts with `before` get a `cancel()` method. For modules that publish their own events. |
| `delegate(type, selector, fn)` | `() => void` | DOM event delegation on the root with row context: `fn(event, { row, key, tr, td, column })`. Only fires for rows of this grid. Returns the remover. |

## Actions and host adapters

| Member | Returns | Description |
|---|---|---|
| `action(url, options?)` | `Promise<unknown>` | Row action helper: optional confirm → same-origin request with `X-CSRF-TOKEN` (from `meta[name=csrf-token]`), `Accept: application/json` and `X-Requested-With` → success notification (the response's `message`, else `messages.actionDone`) → `reload({ keepPage: true })`. Resolves with the parsed response, `undefined` when the confirm was declined. Errors are notified and rethrown; 401/419 or a redirect to a login page also fire `sessionexpired` and call the `onSessionExpired` adapter. A redirect to any other page (a classic `return back()`) counts as success. A 2xx whose body reports a failure counts only through an `isError` rule (below). |
| `notify(kind, message)` | `void` | Uses the `notify` host adapter; without one it announces the message in the live region and shows errors as a banner above the table. `kind`: `"success" \| "error" \| "info"`. |
| `confirm(message, options?)` | `Promise<boolean>` | Uses the `confirm` host adapter, else the built-in `<dialog>`. Options: `title`, `tone` (`"danger" \| "default"`), `confirmLabel`, `cancelLabel`, `subject`. |

`action()` options:

| Option | Type | Default | Description |
|---|---|---|---|
| `method` | `"GET" \| "POST" \| "PUT" \| "PATCH" \| "DELETE"` | `"POST"` | Anything else throws. |
| `body` | `Record<string, unknown> \| FormData \| null` | — | Objects are sent as JSON (not for GET); `FormData` as is. |
| `confirm` | `string \| { message, title?, tone?, confirmLabel?, cancelLabel?, subject? }` | — | Ask first. |
| `success` | `string \| false` | response `message` | Success text; `false` = no notification. |
| `reload` | `false \| { keepPage?, silent? }` | `{ keepPage: true }` | Reload after success. |
| `headers` | `Record<string, string>` | — | Extra request headers. |
| `isError` | `(body, res) => boolean \| string \| null` | `configure({ isError })` | Decides whether a 2xx response failed after all (`{ status: false, error }`). Truthy = failure: the error is notified and thrown (`kind: "server"`, the body in `raw`) and nothing reloads; a string is the message, `true` uses `messages.actionFailed`. Without a rule every 2xx is a success. |

The URL must be same-origin http(s).

## Modules and lifecycle

| Member | Returns | Description |
|---|---|---|
| `use(module \| modules[])` | `this` | Attaches modules after construction and re-renders. A data source here replaces the default one; a second explicit source throws [DG008](/errors/DG008). `remount()` keeps chained modules. |
| `module(factoryOrDef)` | API or `null` | Typed access to a module's API: `grid.module(stateSave)`. `null` when the module is not attached. |
| `destroy()` | `void` | Aborts requests, destroys modules (in reverse order), fires `destroy` and restores the table exactly as it was (`<thead>`, `<tbody>` rows, attributes, position). Idempotent. |
| `remount(table?)` | `DatagridApi` | `destroy()` + a new grid with the same constructor options, on the same or another table (for DOM morphing frameworks). Modules attached later with `use()` come along. |

## Properties

| Property | Type | Description |
|---|---|---|
| `root` | `HTMLElement` | The `.dg` wrapper around the table. |
| `table` | `HTMLTableElement` | Your table (same element, enhanced in place). |
| `name` | `string \| undefined` | The `name` option. |
| `messages` | `Messages` | The merged UI strings. |
| `locale` | `string` | Resolved locale. |
| `mode` | `"client" \| "server"` | From the data source. |
| `maxPageSize` | `number` | Resolved limit. |

## Module APIs

Each module installs its API on the grid under its module name. In TypeScript, `grid.module(factory)`
returns the typed API.

| Module | Property | API |
|---|---|---|
| [`stateSave()`](/modules/state-save) | `grid.state` | `key` (storage key), `save()`, `read()` → stored payload or `null`, `clear()`, `reset()` → `Promise<void>` (initial view + reload) |
| [`colVis()`](/modules/colvis) | `grid.colVis` | `open()`, `close()`, `toggle()`, `reset()`, `count()` → `{ visible, total }` |
| [`colReorder()`](/modules/col-reorder) | `grid.colReorder` | `order()` → keys, `move(key, to)`, `reset()`, `movable()` → columns, `messages` |
| [`columnFilters()`](/modules/column-filters) | `grid.columnFilters` | `open(key)`, `current` (key of the open filter or `null`) |
| [`filterPanel()`](/modules/filter-panel) | `grid.filterPanel` | `values()`, `raw()`, `set(patch, { reload? })`, `reset()`, `apply()` |
| [`urlSync()`](/modules/url-sync) | `grid.urlSync` | `link()` → shareable URL of the current view |
| [`softDeletes()`](/modules/soft-deletes) | `grid.softDeletes` | `active()`, `toggle(on?)` |
| [`actions()`](/modules/actions) | `grid.actions` | `run(id, key)`, `open(key)` (row menu), `items(key)` → resolved items with disabled reasons |
| [`selection()`](/modules/selection) | `grid.selection` | `get()`, `keys()`, `payload()`, `count()`, `isAll()`, `isSelected(key)`, `select(keys)`, `deselect(keys)`, `toggle(key)`, `clear()`, `selectPage()`, `deselectPage()`, `selectAllMatching()` |
| [`excel()`](/modules/export) | `grid.excel` | `download()`, `blob()` |
| [`csv()`](/modules/export) | `grid.csv` | `download()`, `text()` |
| [`print()`](/modules/export) | `grid.print` | `open()` |
| [`responsive()`](/modules/responsive) | `grid.responsive` | `collapsed()` → keys of collapsed columns, `refit()`, `toggle(rowKey, open?)` (detail row) |
| [`lazyColumns()`](/modules/lazy-columns) | `grid.lazyColumns` | `requested()` → lazy keys sent with the last request, `visible()` → lazy keys visible now, `param` (the request parameter name) |
| `stickyHeader()` | `grid.stickyHeader` | `stuck()`, `refresh()` |
| [`keyboardGrid()`](/modules/keyboard-grid) | `grid.keyboardGrid` | `position()`, `focus(row, col)` |
| [`rowReorder()`](/modules/row-reorder) | `grid.rowReorder` | `enabled()`, `move(key, to)` → `Promise<boolean>` |
| [`multiSort()`](/modules/multi-sort) | `grid.multiSort` | `toggle(key)` |
| [`autoRefresh()`](/modules/auto-refresh) | `grid.autoRefresh` | `running()`, `start()`, `stop()`, `tick()` |
| [`filterPresets()`](/modules/filter-presets) | `grid.filterPresets` | `active()` → id of the matching preset or `null`, `apply(id, { reload? })` |
| [`metaBind()`](/modules/meta-bind) | `grid.metaBind` | `refresh()` |
| [`footer()`](/modules/footer) | `grid.footer` | `values()`, `refresh()` |
| [`button.reload()`](/modules/buttons) | `grid.reloadButton` | `el` (the button) |
| [`button.resetState()`](/modules/buttons) | `grid.resetStateButton` | `el` |
| [`button.custom()` / `button.group()`](/modules/buttons) | `grid[name]` | `el`; `name` defaults to `button<N>` / `buttonGroup<N>` |

A module attached with `can: false` still answers on its property: every call is a no-op.

## Gotchas

- **`reload()` keeps local edits**: on array and DOM sources it re-runs search, sort and paging over
  the current rows (including `setData()` / `addRows()` / `removeRow()` changes). Only `fetchAll`
  fetches again.
- **`batch()` loads nothing**: follow it with `reload()`.
- **`grid.module(button.custom)` returns `null`**: custom buttons and groups are registered under their
  `name`; read them as `grid[name]`.
- **`addRows()` and `setData()` are for client mode**; `addRows()` is ignored on a server source. Change
  the data on the server and `reload({ keepPage: true })`.

## Related

- [Grid options](/reference/options) · [Events](/reference/events) · [Static API](/reference/static)
- [Writing a module](/reference/modules) · [Lifecycle](/guide/lifecycle)
