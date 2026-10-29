---
title: Grid options
type: reference
description: Every option of new Datagrid(table, options) with its type, default and effect, including the defaults that come from configure().
---

# Grid options

```ts
new Datagrid(table: HTMLTableElement | string, options?: DatagridOptions)
```

`table` is a `<table>` element or a selector that matches exactly one table ([DG005](/errors/DG005)
otherwise). Calling the constructor again on a table that already has a grid returns the existing
grid. All options are optional; most grids need `label`, `columns` and either `data` or a source in
`use`.

```js
import { Datagrid, column, serverSide, yajra, stateSave } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns: [
    column.text("name", { title: "Name" }),
    column.date("date", { title: "Date" }),
  ],
  sort: [["date", "desc"]],
  pageSize: 50,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    stateSave(),
  ],
});
```

Defaults marked *global* come from [`configure()`](/reference/static#configure) and can be changed
host-wide there; the option on a grid always wins.

## Structure

| Option | Type | Default | Description |
|---|---|---|---|
| `columns` | `ColumnDef[]` | read from the table | Column definitions in wire order. When omitted, the DOM source reads `<thead>` (`data-dg-*` header attributes); otherwise `<thead>` cells become plain columns. See [Column options](/reference/columns). |
| `use` | `ModuleInput[]` | `[]` | [Modules](/modules/) to attach: one data source plus any feature modules. Arrays nest, so a [preset](/reference/static#preset) is an array. |
| `data` | `Row[]` | — | Shorthand for `use: [arraySource(rows)]` (client mode). Ignored when `use` already contains a source. |
| `name` | `string` | — | Registry name for [`find(name)` and `reload(name)`](/reference/static#find). Also the default storage key of `stateSave`, the `urlSync` namespace and the export file name prefix. Must be unique on the page. |
| `label` | `string` | — | Accessible name of the grid (rendered visually hidden). Give every grid one; without any name the grid warns [DG002](/errors/DG002). |
| `labelledBy` | `string` | — | Id of a visible element that names the grid. Wins over `label` and `title`. |

When none of `label`, `labelledBy` and `title` is set, a `<caption>` in the table names the grid.

## Data & paging

| Option | Type | Default | Description |
|---|---|---|---|
| `pageSize` | `number` | `25` *global* | Rows per page. A value above `maxPageSize` is clamped at construction too ([DG013](/errors/DG013)). |
| `pageSizes` | `number[]` | `[10, 25, 50, 100]` *global* | Choices in the page-size menu. `-1` is shown as "All" and is accepted only when the protocol allows it (`ssp({ allowAll: true })`). The current `pageSize` is added when it is missing. |
| `maxPageSize` | `number` | `1000` *global* | Upper limit for `grid.pageSize(n)` (larger values are clamped with [DG013](/errors/DG013)) and the row limit of a server-side `exportRows("all")`. |
| `paging` | `boolean` | `true` | `false` shows every row on one page: no pager, no page-size menu (`grid.pageSize()` returns `0`). |
| `rowKey` | `string \| (row) => string` | `row.id ?? row.DT_RowId` | Row identity: a dotted path or a function. Keys drive selection, `refreshRow`, `removeRow`, row actions and focus keeping. Missing keys fall back to the position with [DG003](/errors/DG003). |

## Search & sort

| Option | Type | Default | Description |
|---|---|---|---|
| `search` | `boolean \| { delay?, minLength?, placeholder? }` | `true` | The toolbar search box. `false` removes the box (`grid.search(text)` still works). |
| `search.delay` | `number` (ms) | `400` server · `200` client | Typing debounce. Enter searches at once; Escape clears. |
| `search.minLength` | `number` | `0` | Shorter input searches for `""`. |
| `search.placeholder` | `string` | `messages.search` | Placeholder text. |
| `sort` | `Array<[key, "asc" \| "desc"] \| { key, dir }>` | none | Initial sort. Sorting is single-column in the UI; `grid.sort()` accepts several keys (client mode sorts by each in turn). On an SSP server source an empty sort sends the first column ascending (the classic server default), also after the sort was cleared at runtime; only an explicit `sort: []` here sends no order at all. |

## Loading

| Option | Type | Default | Description |
|---|---|---|---|
| `load` | `"eager" \| "visible" \| "manual"` | `"eager"` | `eager` loads right after construction. `visible` waits until the grid is within 200 px of the viewport (IntersectionObserver), for tabs and collapsed panels. `manual` shows a "Load" state until `grid.load()` or `grid.reload()` is called. |
| `errorMode` | `"inline" \| "silent" \| "throw"` | `"inline"` *global* | `inline` shows the error state (or a banner when rows are already on screen) with a Retry button. `silent` keeps the last view and shows nothing. `throw` rejects the `load()` / `reload()` promise. The `error` event fires in every mode. |
| `virtual` | `boolean \| number` | automatic at 300 rows | Virtual rows render only the visible window. They switch on when the rendered view has at least 300 rows (a number sets another threshold); `false` turns them off. `true` behaves like the default. The scroll area is then limited to `maxHeight` (default `70vh`). |
| `maxHeight` | `string` (CSS length) | — | Limits the scroll area's height and makes the header row sticky (`data-dg-sticky-head`), e.g. `"60vh"`. |

## Appearance

| Option | Type | Default | Description |
|---|---|---|---|
| `surface` | `"plain" \| "card"` | `"plain"` | `card` draws the grid on a raised surface with a header for `title` / `description`. |
| `title` | `string` | — | Card heading. With `surface: "card"` it is also the grid's accessible name. |
| `description` | `string` | — | Muted line under the card heading (card surface only). |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Font and control size (13 px body at `md`). |
| `density` | `"compact" \| "normal" \| "comfortable"` | `"normal"` | Row height and cell padding, independent of `size`. |
| `theme` | `"light" \| "dark" \| "system"` | inherited | Forces a color scheme. By default the grid follows the host's `color-scheme`. |
| `head` | `"caps" \| "sentence"` | `"caps"` | Header style: small uppercase or sentence case. Caps needs `<html lang>` ([DG011](/errors/DG011)). |
| `striped` | `boolean` | `false` | Zebra rows. |
| `wrap` | `boolean` | `true` | `false` keeps every cell on one line (`white-space: nowrap`). |
| `count` | `boolean` | `false` | Shows "N records" in the toolbar's `end` slot (in the card header with `surface: "card"`). |

The options map to root attributes (`data-size`, `data-density`, `data-dg-theme`, …) listed in
[CSS tokens](/reference/css#root-attributes).

## Rows

| Option | Type | Default | Description |
|---|---|---|---|
| `rowTone` | `(row) => Tone \| null` | — | Tints a row: `"ok"`, `"warn"`, `"bad"`, `"info"` or `"muted"` (written as `data-tone` on the `<tr>`). |
| `rowClass` | `(row) => string \| null` | — | Extra classes for the `<tr>` (space-separated). |
| `rowAttrs` | `(row) => Record<string, string> \| null` | — | Extra attributes for the `<tr>`. |
| `rowClick` | `(row, event: MouseEvent) => void` | — | Makes rows clickable: adds a trailing chevron column and `data-clickable`. Clicks on links, buttons, form controls, menu items and the select/actions cells are ignored. Keep a real link in the row for keyboard users. |

## Localization

| Option | Type | Default | Description |
|---|---|---|---|
| `locale` | `string` (BCP 47) | `configure({ locale })`, else `<html lang>`, else the browser's language, else `"en"` | Number formatting in the footer and pager, search folding and client sorting. Locales starting with `tr` get the Turkish message pack, all others English. Column formats are separate: see [Column options](/reference/columns#formatting-locale). |
| `messages` | `Partial<Messages>` | — | Overrides individual UI strings, merged over the pack and `configure({ messages })`. See [Messages](/reference/messages). |

## Host adapters

| Option | Type | Default | Description |
|---|---|---|---|
| `host` | `HostAdapters` | from `configure()` | Per-grid override of the global host adapters: `confirm`, `notify`, `csrf`, `laravel`, `timeout`, `onSessionExpired`, `fetch`, `isError`. Keys are explained under [configure()](/reference/static#configure). |

## Unknown options

Any other key is ignored and reported once with [DG001](/errors/DG001). Well-known legacy option names
get a hint that names the replacement:

| Key (any case) | Use instead |
|---|---|
| `serverSide` | `use: [serverSide({ url, protocol: yajra() })]` |
| `ajax` | `use: [serverSide({ url, … })]` |
| `dom` | toolbar slots `start`, `end`, `filters` |
| `buttons` | button modules: `button.reload()`, `excel()`… |
| `language` | `messages` |
| `stateSave` | `use: [stateSave()]` |
| `lengthMenu` | `pageSizes` |
| `pageLength` | `pageSize` |
| `order` | `sort: [["key", "desc"]]` |
| `deferLoading` | `load: "manual"` |
| `columnDefs` | options on each column definition |

Other near-misses get a suggestion (`pagesize` → "Did you mean `pageSize`?").

## Gotchas

- **`title` without `surface: "card"` leaves the grid unnamed**: the heading is not rendered, so the
  name it would provide is missing (and no DG002 warning appears). Use `label` unless the grid is a card.
- **`data` plus a source in `use`**: the source wins and `data` is dropped silently.
- **A huge initial `pageSize`** is clamped to `maxPageSize` like a later `pageSize(n)` call
  ([DG013](/errors/DG013)); raise `maxPageSize` for a bigger page.
- **`locale` falls back to the browser's language** (then English) when neither the option,
  `configure({ locale })` nor `<html lang>` holds a valid tag; invalid tags warn ([DG015](/errors/DG015)).

## Related

- [Column options](/reference/columns) · [Instance methods](/reference/methods) · [Events](/reference/events)
- [Static API & configure()](/reference/static) · [Concepts](/guide/concepts)
