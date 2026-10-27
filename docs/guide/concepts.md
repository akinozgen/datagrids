---
title: "Concepts: grid, columns, modules, pipelines"
type: explanation
description: The mental model behind datagrids — a small grid core, typed columns, and independent modules that plug into well-defined pipelines.
---

# Concepts: grid, columns, modules, pipelines

datagrids has no giant options object. A grid is **a table plus columns**. Everything else — where
the rows come from, buttons, saved state, selection, export — is a **module** you create on its own
and attach with `use`. Modules plug into a handful of **pipelines** whose order is documented.

<Demo id="guide-concepts" />

## The grid

```js
const grid = new Datagrid("#agents", { label: "Agents", columns, use: [/* modules */] });
```

- **One instance per `<table>`.** The constructor wraps the table you pass (by element or by a
  selector that matches exactly one table) and keeps its identity: your event listeners and
  references stay valid. Constructing again on the same table returns the existing grid.
- **`Datagrid.get(table)` returns the instance or `null`.** It never creates a grid as a side effect.
  Grids with a `name` can also be found with `find(name)` and reloaded with `reload(name)`.
- **Loading is explicit:** `load: "eager"` (default), `"visible"` (first request when the grid scrolls
  into view or its tab opens) or `"manual"` (a "Load" button / `grid.load()`). See [Lifecycle](/guide/lifecycle).
- **Methods work immediately.** There is no async init: `grid.search("jill")` right after the
  constructor is fine.
- **`destroy()` restores the original table** — classes, attributes, `<thead>`, rows — so you can
  re-initialize safely.

The grid core owns searching, sorting, paging, the pager, the loading/empty/error states, the live
region and the toolbar slots. Everything else is a module.

## Columns

```js
const columns = [
  column.text("name", { title: "Name" }),
  column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  column.date("date", { title: "Date", time: true }),
  column.html("notes", { title: "Notes", sortable: false }), // explicit HTML opt-in
];
```

Typed factories (`column.text`, `number`, `money`, `date`, `badge`, `link`, `phone`, `html`, `index`,
`select`, `actions`) know how to render, align, sort, search and export their value. A money column sorts
numerically, right-aligns, renders `1,234.50 $` and exports a real number to Excel.

**Cells are text by default; HTML is an explicit opt-in** (`column.html()` or `html: true`). The one
exception is a protocol whose server already escapes values — see [Columns](/guide/columns#text-and-html).

## Modules

```js
import { serverSide, yajra, stateSave, colVis, excel } from "@akinozgen17/datagrids";

const source = serverSide({ url: "/agents/data", protocol: yajra(), csrf: true });

new Datagrid("#agents", {
  label: "Agents",
  columns,
  use: [source, stateSave(), colVis(), excel()],
});
```

- **A module is an immutable definition** created by a factory (`stateSave({ ttl })`). It carries its
  own options and is set up per grid, so one definition can serve many grids.
- **Attach modules with `use: [...]`** in the options. Arrays nest, so a **preset** is just an array:
  `use: [listPage("/agents/data"), selection()]`. You can also attach later with `grid.use(module)`
  (a data source attached this way replaces the default one; see [Gotchas](#gotchas)).
- **What a module adds appears on the grid** under its name: `grid.state.reset()`,
  `grid.selection.payload()`, `grid.excel.download()`. In TypeScript use `grid.module(stateSave)` for a
  typed handle.
- **Modules you don't import are not in your bundle.** The core does not know about any module.
- **Wiring mistakes throw.** A module that `requires` another one that is missing
  ([DG007](/errors/DG007)), two data sources ([DG008](/errors/DG008)) or the same module twice
  ([DG009](/errors/DG009)) throw an `Error` instead of half-working.
- **`can: false`** on any module is the permission flag: the module is attached but contributes
  nothing (no button, no menu item). It only manages visibility — your endpoints still authorize.

See the [module catalog](/modules/).

### Data sources are modules too

Exactly one module fills the `source` slot. When you attach none, the grid picks one for you: an
array source when you pass `data: [...]`, a DOM source when the `<tbody>` already has rows,
otherwise an empty array.

| Source | Mode | Use it for |
|---|---|---|
| `data: [...]` / `arraySource(rows)` | client | rows you already have |
| `domSource()` (automatic) | client | enhancing a server-rendered table |
| `fetchAll({ url })` | client | one JSON request, then search/sort/page locally |
| `serverSide({ url, protocol })` | server | paging, sorting and searching on the server |
| `customSource({ mode, load })` | either | anything else (GraphQL, IndexedDB, …) |

## Pipelines

Modules don't patch the grid. They contribute to named pipelines through the context they receive
in `setup(ctx)`:

```text
user action ─► state change ─► beforeLoad (cancelable)
   ─► request middleware chain ─► protocol encode ─► fetch
   ─► protocol decode ─► response / load events
   ─► render rows ─► row mutators ─► render event
```

| Pipeline | Runs | Contributed with | Used by |
|---|---|---|---|
| request | before every server request | `ctx.request((req, next) => next(req), "pre" \| "post")` | CSRF, Laravel headers, filterPanel, softDeletes |
| row | after a row is rendered | `ctx.row((tr, row, key) => …)` | selection, actions, softDeletes; grid options `rowClass`, `rowAttrs`, `rowTone` |
| toolbar | at setup | `ctx.toolbar({ slot: "start" \| "end" \| "filters", order, el })` | colVis, export menu, buttons, column filter chips |
| state | on save and restore | `ctx.state({ key, save, load })` | stateSave collects every contribution |
| export | while exporting | column `exportValue`, `exportType`, `exportFormat` | excel, csv, print, footer |
| lifecycle | setup, first load, destroy | `setup()` → `{ api, destroy }`, `ctx.ready(fn)` | every module |

**Request middleware order** is fixed: the built-ins (`X-Requested-With`, then CSRF) run first,
then middleware registered with `"pre"`, then the rest in registration order, then `"post"`. There
are no numeric priorities. Each middleware receives a neutral request (`url`, `method`, `headers`,
`query`, `params`) and calls `next(req)` once; the protocol turns it into the wire format at the end.

See [Writing a module](/reference/modules) for the full context API.

## Events or pipelines?

**Use a pipeline to change what happens. Use an event to react to what happened.**

```js
grid.on("load", ({ result }) => console.log(result.total));       // react
grid.on("beforeSort", (e) => { if (busy) e.cancel(); });           // veto
grid.delegate("click", ".open", (e, { row }) => open(row.id));     // row-aware DOM events
```

`on()` returns an unsubscribe function. Events whose name starts with `before` are cancelable. Every
event is also dispatched on the grid root as a DOM `CustomEvent` named `dg:<event>`. The full list is
in the [events reference](/reference/events).

## Global defaults

`configure({ ... })` (on the IIFE build: `Datagrids.configure`) sets host-wide defaults — CSRF, a
confirm dialog adapter, a toast adapter, messages, page sizes. It is the only global switch. Most
keys are read when a grid is created, so call it first; `errorMode`, `maxPageSize` and `warnings` are
read when needed and also reach existing grids that don't set their own
([details](/reference/static#configure)).

```js
import { configure } from "@akinozgen17/datagrids";

configure({
  csrf: true,
  notify: (kind, message) => toast[kind](message),
  confirm: (message, o) => myDialog.ask(message, o), // returns Promise<boolean>
});
```

## Gotchas

- A data source chained with `grid.use(serverSide(...))` replaces the default source the grid
  picked; a second explicit source throws [DG008](/errors/DG008).
- `remount()` re-creates the grid from its options plus every module attached later with
  `grid.use()`.
- Without the stylesheet the grid has no layout: import `@akinozgen17/datagrids/css`.

## Coming from DataTables?

The [migration guide](/migration/from-datatables) maps each DataTables (1.10 / 2.x / 3.x) option,
event and API call to its module or method here.
