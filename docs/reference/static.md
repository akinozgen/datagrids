---
title: Static API & configure()
type: reference
description: Package-level exports — Datagrid.get, get, find, reload, configure() with every global key and default, upgrade() and its data attributes, preset(), VERSION, message packs and config.
---

# Static API & configure()

Everything is a named export of the package. The IIFE build exposes the same names on
`window.Datagrids`:

::: code-group

```js [ESM]
import { Datagrid, column, configure, find, reload, upgrade } from "@akinozgen17/datagrids";
```

```html [IIFE]
<script src="https://unpkg.com/@akinozgen17/datagrids/dist/datagrids.global.js"></script>
<script>
  const { Datagrid, column, configure } = Datagrids;
  Datagrids.reload("agents");
</script>
```

:::

## Exports

| Export | Kind | See |
|---|---|---|
| `Datagrid` | class (`new Datagrid(table, options)`, `Datagrid.get()`) | [Grid options](/reference/options), [Instance methods](/reference/methods) |
| `column` | namespace: `text`, `html`, `number`, `money`, `date`, `badge`, `link`, `phone`, `boolean`, `index`, `actions`, `select`; helpers `parseDate`, `parseBool` | [Column options](/reference/columns) |
| `arraySource`, `domSource`, `fetchAll`, `customSource`, `sourceModule` | data source modules | [Data sources](/guide/data-sources) |
| `serverSide`, `ssp`, `yajra`, `dgp`, `laravelPaginator` | server source and protocols | [Server protocols](/guide/server-protocols) |
| `stateSave`, `colVis`, `colReorder`, `columnFilters`, `filterPanel`, `filterPresets`, `urlSync`, `softDeletes`, `actions`, `selection`, `excel`, `csv`, `print`, `footer`, `metaBind`, `responsive`, `lazyColumns`, `stickyHeader`, `keyboardGrid`, `rowReorder`, `multiSort`, `autoRefresh` | feature modules | [Modules](/modules/) |
| `reorderColumn`, `REORDER_KEY` | the drag-handle column for `rowReorder()` and its key (`"__reorder"`) | [rowReorder](/modules/row-reorder) |
| `button` | namespace: `reload`, `resetState`, `custom`, `group` | [Buttons](/modules/buttons) |
| `configure`, `config` | global defaults | [below](#configure) |
| `get`, `find`, `reload` | grid lookup | [below](#get) |
| `upgrade`, `preset` | declarative init | [below](#upgrade) |
| `en`, `tr` | message packs | [Messages](/reference/messages) |
| `VERSION` | `string` | the package version |
| `SelectionModel` | class | the selection state model used by `selection()` |

All TypeScript types (`DatagridOptions`, `ColumnDef`, `ModuleDef`, `Query`, `Messages`, …) are
exported too.

## get()

```ts
Datagrid.get(target: Element | string | null): Datagrid | null
get(target: Element | string | null): Datagrid | null
```

Returns the grid of a table, or `null`. `target` is the table, any element inside it, or a
selector. It **never creates** a grid, so `get()` is safe to call anywhere.

## find()

```ts
find(name: string): Datagrid | null
```

Returns the live grid created with `name`, or `null`. Names are registered at construction and
removed on `destroy()`.

## reload()

```ts
reload(name: string, options?: { keepPage?: boolean; silent?: boolean }): boolean
```

Reloads the grid called `name` (for example after a dialog in another tab saved a record). Returns
`false` and warns [DG006](/errors/DG006) when there is no such grid.

## configure()

```ts
configure(patch: GlobalConfig): GlobalConfig
```

Sets host-wide defaults and returns the resulting config. Keys you leave out (or pass as
`undefined`) keep their value. A grid's own options always win over these.

| Key | Default | Description |
|---|---|---|
| `confirm` | built-in `<dialog>` | `(message, options) => Promise<boolean>`. Confirmation adapter for `grid.confirm()`, row actions and `grid.action({ confirm })`. `options`: `title`, `tone`, `confirmLabel`, `cancelLabel`, `subject`. |
| `notify` | live region + error banner | `(kind, message) => void`. Toast adapter for `grid.notify()`, action results and export failures; `kind` is `success`, `error` or `info`. |
| `csrf` | `false` | Server sources and `fetchAll` send `X-CSRF-TOKEN` from `<meta name="csrf-token">`; non-GET server requests also carry a `_token` parameter. `grid.action()` always sends the token when the meta tag exists. |
| `laravel` | `true` | Sends `X-Requested-With: XMLHttpRequest` with server requests, `fetchAll` and `grid.action()`, so Laravel answers with JSON. |
| `timeout` | `30000` | Server request timeout in ms; `serverSide({ timeout })` overrides it. |
| `onSessionExpired` | — | `(error) => void`. Called when a load gets 401, 419 or a redirect to a login page; the `sessionexpired` event fires as well. |
| `fetch` | `globalThis.fetch` | Replaces `fetch` for server sources, `fetchAll` and `grid.action()` (tests, auth wrappers). |
| `messages` | — | `Partial<Messages>`: UI string overrides for every grid, merged over the language pack. |
| `locale` | `<html lang>`, else `"tr"` | Default locale of every grid. |
| `pageSize` | `25` | Default rows per page. |
| `pageSizes` | `[10, 25, 50, 100]` | Default page-size menu. |
| `maxPageSize` | `1000` | Default page size limit and server "export all" row limit. |
| `warnings` | `true` | Development messages: coded console warnings, module warnings and the server error "Details" disclosure. Turn off in production. |
| `errorMode` | `"inline"` | `"inline"`, `"silent"` or `"throw"`; see [Grid options](/reference/options#loading). |

**When a grid reads them:** the host adapters (`confirm`, `notify`, `csrf`, `laravel`, `timeout`,
`onSessionExpired`, `fetch`), `messages`, `locale`, `pageSize` and `pageSizes` are read when a grid is
created, so call `configure()` before creating grids. `errorMode`, `maxPageSize` and `warnings` are
read when they are needed and also affect existing grids.

```js
import { configure } from "@akinozgen17/datagrids";

configure({
  csrf: true,
  notify: (kind, message) => toast[kind](message),
  confirm: (message, o) => dialogs.ask({ message, title: o.title, danger: o.tone === "danger" }),
  onSessionExpired: () => location.assign("/login"),
  warnings: import.meta.env.DEV,
});
```

## config

The live global config object that `configure()` writes to. Read it for the current defaults; don't
assign to it directly (warnings are only switched through `configure()`).

## upgrade()

```ts
upgrade(root?: ParentNode): Datagrid[]
```

Creates a grid for every `table[data-datagrid]` under `root` (default `document`) that doesn't have
one yet and returns the new grids. Calling it again (after injecting HTML) is safe: existing grids
are skipped.

| Table attribute | Becomes |
|---|---|
| `data-datagrid` | Marker. Its value is a [preset](#preset) name whose modules are attached; empty for none. |
| `data-dg-name` | `name` |
| `data-dg-label` | `label` |
| `data-dg-load` | `load` (`eager`, `visible`, `manual`) |
| `data-dg-page-size` | `pageSize` |
| `data-dg-sort` | `sort`, as `key:dir` (`date:desc`; any other dir is ascending) |
| `data-dg-theme` | `theme` |
| `data-dg-size` | `size` |
| `data-dg-density` | `density` |

Only these attributes are read; there is no JSON configuration attribute. Columns come from the
`<thead>` [header attributes](/reference/columns#header-attributes-dom-source), rows from the
existing `<tbody>`, and everything else from the preset.

```html
<table data-datagrid="list" data-dg-name="agents" data-dg-label="Agents" data-dg-sort="date:desc"
       data-url="/agents/data">
  <thead><tr><th data-dg-key="name">Name</th><th data-dg-key="date" data-dg-type="date">Date</th></tr></thead>
</table>
```

## preset()

```ts
preset(name: string, factory: (table: HTMLTableElement) => ModuleInput[]): void
```

Registers modules for `upgrade()`. The factory runs once per table and receives it, so it can read
the table's own attributes:

```js
import { preset, upgrade, serverSide, yajra, stateSave, colVis, excel } from "@akinozgen17/datagrids";

preset("list", (table) => [
  serverSide({ url: table.dataset.url, protocol: yajra(), csrf: true }),
  stateSave(),
  colVis(),
  excel(),
]);
upgrade();
```

A preset is just an array of modules: the same array works in `use: [...]`. An unknown preset name
attaches nothing and does not warn.

## VERSION

`VERSION: string`, the library version, e.g. for bug reports.

## en, tr

The English and Turkish [message packs](/reference/messages) (`Messages` objects). Spread one to
start a new language:

```js
import { en } from "@akinozgen17/datagrids";

const de = { ...en, search: "Suchen…", searchLabel: "Suchen", retry: "Erneut versuchen" };
new Datagrid("#agents", { label: "Agenten", locale: "de", messages: de, columns });
```

## Related

- [Concepts: global defaults](/guide/concepts#global-defaults) · [Lifecycle](/guide/lifecycle)
- [Grid options](/reference/options) · [Messages](/reference/messages)
