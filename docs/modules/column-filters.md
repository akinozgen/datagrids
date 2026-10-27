---
title: columnFilters
type: module
description: A filter button in each column header with operators that fit the column type, active-filter chips, and wire encoding for yajra (ColumnControl) and the datagrids protocol.
since: 0.1.0
---

# columnFilters

Adds a filter button to each header. Its panel offers operators that fit the column type, and
every active filter shows up as a removable chip above the table.

<Demo id="mod-column-filters-yajra" />

The same module on a grid that speaks the [datagrids protocol](/protocol/v1/): filters travel as
typed `{ op, value }` objects. Open the **Request** tab after applying one.

<Demo id="mod-column-filters-dgp" />

## When to use it

Use it when people filter by one column at a time ("amount at least 5,000", "status is Open or
Pending") and the filter belongs to the column, not to the page. For a page-level form that
filters by things that are not columns (a date range, "my records only"), use
[filterPanel](/modules/filter-panel); both can be attached together.

## Usage

```js
import { Datagrid, column, serverSide, yajra, columnFilters } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns: [
    { key: "name", title: "Name" },
    column.badge("status", { title: "Status", labels: statusLabels }),
    column.money("amount", { title: "Amount" }),
  ],
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }), columnFilters()],
});
```

Every searchable, non-special column gets a filter button. Limit it to some columns:

```js
columnFilters({ columns: ["status", "amount"] });
```

Give an `is any of` list to a badge column that has no `labels`:

```js
columnFilters({
  options: { unit: [{ value: "rpd", label: "R.P.D." }, { value: "bsaa", label: "B.S.A.A." }] },
});
```

Set or clear a filter from code — it is ordinary filter state:

```js
grid.filters({ amount: { op: "gte", value: 5000 } });
grid.filters({ amount: null });
```

### Operators per column type

| Column type | Operators (first one is the default) |
|---|---|
| `number`, `money` | equals, not equal, greater than, at least, less than, at most, between, is empty, is not empty |
| `date` | equals, greater than, less than, between, is empty, is not empty |
| `badge` | is any of, is none of |
| everything else (`text`, `link`, `html`, …) | contains, does not contain, starts with, ends with, equals, not equal, is empty, is not empty |

The stored value is `{ op, value }` with `op` one of `eq`, `ne`, `gt`, `gte`, `lt`, `lte`,
`between`, `in`, `notIn`, `contains`, `notContains`, `starts`, `ends`, `empty`, `notEmpty`.
`between` takes `[from, to]`, `in` / `notIn` take an array.

The panel offers only the operators the grid's protocol can carry:

| Grid | Operators offered |
|---|---|
| Client grids, [datagrids protocol](/protocol/v1/) | All of the above |
| [yajra / ssp](/protocol/ssp) | All except `between` and `is none of` (ColumnControl has no equivalent); a badge column offers only `is any of` |
| [Laravel paginator](/protocol/laravel-paginator) | Only `equals` and `is any of` (the wire has no operator) |

### On the wire

| Grid | How a filter travels |
|---|---|
| Client (array, DOM, fetchAll) | Applied in the browser |
| [yajra / ssp](/protocol/ssp) | DataTables ColumnControl: `columns[i][columnControl][search][value\|logic\|type]`, or `columns[i][columnControl][list][]` for "is any of" (yajra/laravel-datatables 12.7+) |
| [datagrids protocol](/protocol/v1/) | `filters: { amount: { op: "between", value: [5000, 10000] } }` (POST JSON) or `filter[amount][between]=5000,10000` (GET) |
| [Laravel paginator](/protocol/laravel-paginator) | The value alone: `amount=5000` for "equals", `status[]=open&status[]=pending` for "is any of" |

A plain value on a column key — not `{ op, value }`, for example `grid.filters({ unit: "R.P.D." })`,
a [filterPresets](/modules/filter-presets) value with `target: "grid"` or a [urlSync](/modules/url-sync)
key — travels on yajra / ssp as the column's own search, as an exact match: an anchored, escaped
regex (`columns[i][search][value]=^R\.P\.D\.$`, `columns[i][search][regex]=true`); an array joins
its values with `|`. On a column with `searchable: false` it is not sent, and the console says so.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `columns` | `string[]` | every searchable, non-special column | Column keys that get a filter button. |
| `options` | `Record<string, Array<{ value, label }>>` | badge `labels`, else up to 50 distinct values of the loaded rows | Choices for `is any of` / `is none of`. |
| `messages` | `Partial<…>` | locale (`en` / `tr`) | `filter(col)`, `apply`, `clear`, `clearAll`, `value`, `and`, `active(n)`, `ops` (a full operator → label map). |
| `can` | `boolean` | `true` | Permission flag: `false` → no filter buttons. |

## API added to the grid

Available as `grid.columnFilters`.

| Member | Returns | Description |
|---|---|---|
| `open(key)` | `void` | Opens the filter panel of a column. |
| `current` | `string \| null` | Key of the column whose panel was opened last. |

Read and write the filters themselves with the core `grid.filters()`.

## Events

None of its own. Applying or clearing a filter changes the grid's filter state, which reloads a
server grid (`beforeLoad` / `load`) or re-filters a client grid (`load`).

## Pipelines it plugs into

- **Header**: a filter button in each enabled `<th>` (re-added after every header render).
- **Filters**: writes `grid.filters({ [key]: { op, value } })`; the [protocol](/guide/server-protocols)
  encodes it as shown above.
- **Toolbar**: the `filters` slot (order `100`) holds one chip per active filter and, with two or
  more, a "Clear filters" button.

## Works with

- **Enhances** server grids on every protocol and client grids.
- **With [stateSave](/modules/state-save)**: `stateSave({ include: ["filters"] })` keeps them.
- **With [filterPanel](/modules/filter-panel)**: independent; panel values are request parameters
  (server) or other filter keys (client).
- **With [urlSync](/modules/url-sync)**: typed filters are not written to the URL (only plain
  values are).

## Accessibility

- The header button is named "Filter: Amount", has `aria-haspopup="dialog"` and a visible active
  state (`data-active`) — never hover-only.
- The panel is a `role="dialog"` labelled by its title; the first value field gets focus.
  `Enter` applies, `Esc` closes and returns focus to the button.
- "Is any of" lists are a `<fieldset>` of native checkboxes. Each chip's remove button is named
  "Clear: Amount".

## Replaces in DataTables

| DataTables | datagrids |
|---|---|
| Your own inputs in a second header row + `column().search()` (1.10) | `columnFilters()` |
| ColumnControl `searchDropdown` / `searchList` (2.x / 3.x) | `columnFilters()`; yajra receives the same `columnControl` parameters |
| `orderCellsTop: true` | Not needed |

## Gotchas

- **There is no "between" on a yajra grid.** ColumnControl has no `between` or `is none of`, so
  the panel does not offer them; a `between` / `notIn` filter set from code is not sent. Send a
  range as request parameters with [filterPanel](/modules/filter-panel), or use the datagrids
  protocol.
- **A Laravel paginator grid offers only "equals".** Its wire carries a value without an
  operator; ranges and text matching need request parameters (filterPanel) your controller reads.
- **"Is any of" offers only a few values on a server grid.** Without `labels` or `options` the
  list is built from the rows of the current page; pass `options`.
- **The filter button is missing on a column.** It is not searchable (`searchable: false`), it is
  a special column, or it is not in `columns`.

## Related

- [filterPanel](/modules/filter-panel) · [Server protocols](/guide/server-protocols) · [Datagrids protocol v1](/protocol/v1/)
