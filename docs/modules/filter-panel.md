---
title: filterPanel
type: module
description: Bind your own filter form to a grid — its values become request parameters on server grids and filter state on client grids, with auto-reload, debounce and a small API.
since: 0.1.0
---

# filterPanel

Connects a filter form you already have — selects, inputs, checkboxes, third-party widgets — to
the grid. On a server grid the values travel as request parameters; on a client grid they filter
in the browser.

<Demo id="mod-filter-panel-server" />

On a client grid the same module writes the values into the grid's filter state instead.
A `format` function can turn a raw value into a typed filter (`{ op, value }`) or `null`:

<Demo id="mod-filter-panel-client" />

## When to use it

Use it for page-level filters that live outside the table: a unit select, a date range, "only my
records". It replaces the hand-written "read the form in `ajax.data`, reload on change" glue.
For a filter attached to one column header, use [columnFilters](/modules/column-filters).

## Usage

Map each request parameter (server) or filter key (client) to a control. A selector string is
resolved on every read, so controls that your framework re-renders keep working.

```js
import { Datagrid, serverSide, yajra, filterPanel } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    filterPanel({
      fields: {
        unit: "#unit",                   // <select>
        status: "#status",               // <select multiple> → an array
        name: "#name",                   // text input, debounced
        mine: { el: "#mine", value: "1", unchecked: null }, // checkbox: "1" or left out
      },
    }),
  ],
});
```

The server receives `unit=R.P.D.&status[]=open&status[]=pending&name=wong&mine=1` next to the
protocol parameters.

### Field spec

A field is a selector, an element, or a `FilterField` object:

| Property | Type | Description |
|---|---|---|
| `el` | `string \| Element` | The control, or a container of it. Selectors are resolved on every read. |
| `value` | `string` | Checkbox: the value while checked. Default `"1"`. |
| `unchecked` | `string \| null` | Checkbox: the value while unchecked. Default `"0"` on server grids, no filter on client grids; `null` leaves the parameter out. |
| `format` | `(v, el) => unknown` | Maps the raw value to what is sent / filtered. `null` or `undefined` leaves it out. |
| `subscribe` | `(el, notify) => void \| (() => void)` | For widgets that don't fire native `change` events: call `notify()` when the value changed; return a cleanup function. |

Controls are read like jQuery's `.val()`: a `<select>` gives its value (an array when
`multiple`), a checkbox gives `value` / `unchecked`, a radio gives the checked value of its group,
anything else gives its `value` string.

```js
filterPanel({
  fields: {
    // "2026-10-01 - 2026-10-31" from a date-range widget → two parameters' worth of data
    period: {
      el: "#period",
      format: (v) => (v ? { from: v.split(" - ")[0], to: v.split(" - ")[1] } : null),
      subscribe: (el, notify) => {
        el.addEventListener("apply.range", notify);
        return () => el.removeEventListener("apply.range", notify);
      },
    },
  },
});
```

A "Filter" button instead of instant reloads:

```js
const grid = new Datagrid("#agents", {
  label: "Field agents",
  columns,
  use: [source, filterPanel({ fields, auto: false })],
});
document.querySelector("#apply").addEventListener("click", () => grid.filterPanel.apply());
```

### Client grids

On a client grid each value becomes a filter in `grid.filters()`:

| Value | Matches when |
|---|---|
| a string | the column value (or row field) equals it |
| an array | the value is any of them |
| `{ op, value }` | the typed operator matches (same operators as [columnFilters](/modules/column-filters#operators-per-column-type)) |
| a function `(value, row) => boolean` | it returns `true` |

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `fields` | `Record<string, string \| Element \| FilterField>` | — (required) | Parameter / filter key → control. |
| `auto` | `boolean` | `true` | Reload (server) or re-filter (client) when a control changes. |
| `debounce` | `number` (ms) | `250` | Typing delay for text-like inputs; selects and checkboxes apply at once. |
| `can` | `boolean` | `true` | Permission flag: `false` → the form is ignored. |

## API added to the grid

Available as `grid.filterPanel` (typed: `grid.module(filterPanel)`).

| Member | Returns | Description |
|---|---|---|
| `values()` | `Record<string, unknown>` | Values as they are sent (`format` applied, empty ones left out). |
| `raw()` | `Record<string, string \| string[] \| null>` | Control values before `format`. |
| `set(patch, { reload? })` | `void` | Writes control values (raw form), fires `change` on them so widgets follow, then reloads unless `reload: false`. |
| `reset()` | `void` | Restores the values the controls had when the grid was created, and reloads. |
| `apply()` | `void` | Applies the current values now (use with `auto: false`). |

## Events

None of its own. A change reloads a server grid (`beforeLoad`, `load`) or re-filters a client
grid (`load`).

## Pipelines it plugs into

- **Request middleware** (server grids): values are read when each request is built — the same
  moment DataTables ran `ajax.data` — and merged into the request parameters. ssp/yajra sends them
  as top-level form fields, the datagrids protocol under `params` (POST) or in the query string (GET),
  the Laravel paginator as query parameters.
- **Filters** (client grids): values are written to the grid's filter state; the first load
  already uses them.
- **Lifecycle**: one delegated `change` / `input` listener pair on the document, removed on
  `destroy()`.

## Works with

- **Enhanced by** [urlSync](/modules/url-sync): the panel's fields are written to the URL as
  `f.<key>` and restored from it.
- **With [columnFilters](/modules/column-filters) and [softDeletes](/modules/soft-deletes)**:
  independent; all of them apply together.
- **With [stateSave](/modules/state-save)**: `stateSave({ include: ["filters"] })` saves the
  controls' raw values and sets them back (without an extra load) on the next visit; without
  `"filters"` in `include` they are not saved. Use urlSync for shareable filters.

## Accessibility

The form is your markup: give every control a visible `<label>`. Results update in place; the
pager summary shows the new count, and `aria-busy` is set on the table while a request runs.
Don't put the controls in a `<form>` that submits on `Enter`, or use `auto: false` with your own
submit handler.

## Replaces in DataTables

| DataTables (1.10 / 2.x / 3.x) | datagrids |
|---|---|
| `ajax.data: (d) => { d.unit = $("#unit").val(); }` | `filterPanel({ fields: { unit: "#unit" } })` |
| `$("#unit").on("change", () => table.ajax.reload())` | Automatic (`auto: true`) |
| `$.fn.dataTable.ext.search.push(fn)` (client) | Client grids: the same `fields`, or a `format` returning a predicate |

## Gotchas

- **Nothing happens when a date-range widget changes.** The widget fires its own event, not
  `change`; add `subscribe`.
- **An unchecked checkbox still sends `0`.** That is the server default (it mirrors `.val()`
  code that always sent the field); set `unchecked: null` to leave it out.
- **The console says `filterPanel: no element for "unit"`.** The selector matched nothing when the
  grid was created; it is still read on every request, so a control added later works.
- **The page reloads on `Enter`.** The controls are inside a `<form>` that submits; prevent the
  submit or use a plain container.
- **A text filter on a client grid matches only exact values.** Plain strings compare with
  equality; return `{ op: "contains", value: v }` from `format` for a substring match.

## Related

- [columnFilters](/modules/column-filters) · [urlSync](/modules/url-sync) · [Recipe: filter panel](/recipes/filter-panel)
