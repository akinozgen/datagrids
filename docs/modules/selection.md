---
title: selection
type: module
description: Checkbox row selection that survives paging and filtering, "select all N matching" for server grids, a persistent bulk-action bar and a payload your endpoint can act on.
since: 0.1.0
---

# selection

Adds a checkbox to every row, keeps the selection across pages, offers **Select all N matching**
once a page is fully selected, and shows a bulk-action bar above the table.

<Demo id="mod-selection-bulk" />

Single mode — one row at a time, no bulk bar:

<Demo id="mod-selection-single" />

## When to use it

Use it when people act on many records at once: approve, export, assign, delete. For one record
at a time, [row actions](/modules/actions) are simpler. Single mode fits "pick one" flows
(assign to an agent, choose a template).

## Usage

Add `column.select()` where the checkboxes go and attach the module:

```js
import { Datagrid, column, serverSide, yajra, selection } from "@akinozgen17/datagrids";

const grid = new Datagrid("#agents", {
  label: "Field agents",
  columns: [column.select(), { key: "name", title: "Name" }],
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    selection({
      bulk: {
        actions: [
          {
            id: "approve", label: "Approve", icon: "check",
            onClick: (payload) =>
              grid.action("/agents/bulk-approve", { method: "POST", body: payload }),
          },
        ],
      },
    }),
  ],
});
```

Returning a promise from `onClick` keeps the bar's buttons disabled until it settles.
[`grid.action()`](/reference/methods) adds the CSRF header, shows the result and reloads.

### The payload

Bulk actions receive what the selection stands for, never a huge list of loaded rows:

```js
{ all: false, keys: ["12", "15", "31"] }                       // picked rows
{ all: true, except: ["15"], query: { search, sort, filters, params } } // "select all N matching", minus unticked rows
```

`query.params` holds the page parameters of the request behind the rows on screen when "all
matching" was chosen (the same as `grid.lastRequestParams()`): [filterPanel](/modules/filter-panel)
values, the [softDeletes](/modules/soft-deletes) flag, the source's `params` and, with `ssp` /
`yajra`, non-column filters and the additions of a `data` function. The CSRF token and the
[lazyColumns](/modules/lazy-columns) parameter are left out. A change of any of them clears an "all
matching" selection.

With `all: true`, the endpoint re-runs the query and skips `except`:

```php
$ids = $request->boolean('all')
    ? $this->agentQuery($request->input('query'))->whereNotIn('id', $request->input('except', []))->pluck('id')
    : $request->input('keys', []);
```

### Selecting

- Click a checkbox, or anywhere in its cell. **Shift-click** another row to apply the same state
  to the whole range.
- The header checkbox selects or clears the current page (indeterminate when partly selected).
- Once the page is fully selected and more rows match, the bar offers **Select all N matching**.
- Changing the search, filters or page parameters (or a different matching count) clears an "all
  matching" selection and announces it; picked keys survive paging and filtering.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `"multi" \| "single"` | `"multi"` | `single`: one row at a time, no header checkbox, no "select all". |
| `acrossPages` | `boolean` | `true` | Keep selections when the page changes; `false` drops off-page keys. |
| `selectAllMatching` | `boolean` | `true` | Offer "Select all N matching" (multi mode with `acrossPages`). |
| `label` | `(row) => string` | the first text column's value | Row name in the checkbox's accessible name ("Select: Jill Valentine"). |
| `bulk` | `false \| { actions?: BulkAction[] }` | a bar without actions | The persistent bar above the table; `false` removes it. |
| `messages` | `Partial<SelectionMessages>` | locale (`en` / `tr`) | Bar texts, checkbox names and announcements. |
| `can` | `boolean` | `true` | Permission flag: `false` → no checkboxes, no bar. |

### `BulkAction`

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique id (`data-action` on the button). |
| `label` | `string` | Button text and accessible name. |
| `icon` | icon name or SVG string | Built-in icon (`check`, `trash`, `download`, `send`, …) or a trusted inline SVG. |
| `tone` | `"danger"` | Red once something is selected. |
| `can` | `boolean` | `false` → the button does not exist. |
| `onClick` | `(payload, grid, selection) => void \| Promise` | Runs with the current payload. |

## API added to the grid

Available as `grid.selection` (typed: `grid.module(selection)`).

| Member | Returns | Description |
|---|---|---|
| `payload()` | `SelectionPayload` | What a bulk action should send (see above). |
| `count()` | `number` | Selected rows (in "all" mode: matching count minus exceptions). |
| `get()` | `Row[]` | Selected rows the grid knows (rows from other pages are kept as copies; on client grids "all" returns every matching row). |
| `keys()` | `string[]` | Selected keys (in "all" mode only the loaded ones — use `payload()`). |
| `isAll()` | `boolean` | `true` while "all matching" is selected. |
| `isSelected(key)` | `boolean` | One row's state. |
| `select(keys)` / `deselect(keys)` / `toggle(key)` | `void` | Change rows by key. |
| `selectPage()` / `deselectPage()` | `void` | The current page. |
| `selectAllMatching()` | `void` | Same as the bar's button. |
| `clear()` | `void` | Clears everything. |

## Events

| Event | Payload | When |
|---|---|---|
| `selectionchange` | `{ count, keys, all }` | After every change (clicks, API calls, an "all" selection cleared by a new query). |

## Pipelines it plugs into

- **Row mutator**: a checkbox in each `column.select()` cell; `data-selected` on selected rows.
- **Header**: the page checkbox (multi mode).
- **Above the table**: the bulk bar.
- **Lifecycle**: checks before each load and after each render whether an "all" selection still
  stands for the same query; on client grids it drops keys of rows that no longer exist.

## Works with

- **Requires** `column.select()` in the columns (a console warning tells you when it is missing)
  and a row key: `rowKey`, `id` or `DT_RowId`.
- **With [actions](/modules/actions)**: row actions for one record, the bar for many.
- **With [filterPanel](/modules/filter-panel)** on server grids: panel values are request
  parameters; an `all: true` payload carries them in `query.params`, as they were when "all
  matching" was chosen (a later change clears that selection).

## Accessibility

- Native checkboxes with names: "Select: Jill Valentine" per row, "Select all on this page" in
  the header (with the indeterminate state).
- The bar is a labelled group ("Selection") and stays in place even with nothing selected, so the
  layout never jumps; its actions are disabled until something is selected.
- Changes are announced politely: "3 rows selected", "All 941 matching rows selected",
  "Selection cleared".
- When a bar button is replaced (select all ↔ clear), focus moves to its neighbour instead of
  getting lost.

## Replaces in DataTables

| DataTables | datagrids |
|---|---|
| Select extension, `select: { style: "multi" }` (1.10 / 2.x / 3.x) | `selection()` |
| `select: { style: "single" }` | `selection({ mode: "single" })` |
| `DataTable.render.select()` checkbox column (2.x / 3.x) | `column.select()` |
| `table.rows({ selected: true }).data()` | `grid.selection.get()` / `payload()` |
| `select` / `deselect` events | `selectionchange` |
| Hand-made id arrays that reset on every draw | Keys kept across pages; "select all N matching" with `except` |

## Gotchas

- **Selections vanish when the page changes.** The rows have no key (a console warning says so);
  set `rowKey`. Or `acrossPages: false` is set.
- **"Select all N matching" never shows up.** It appears only when the whole page is selected and
  more rows match than are on the page, in multi mode.
- **The "all" selection was cleared after typing a search.** By design: it stood for a different
  set of rows. Picked keys are kept.
- **`keys()` returns only 10 keys in "all" mode.** Only the loaded rows are known; send
  `payload()` to the server.

## Related

- [actions](/modules/actions) · [Recipe: bulk actions](/recipes/bulk-actions) · [Events](/reference/events)
