# datagrids

Zero-dependency, accessible data grid for plain HTML tables — typed columns, small composable
modules, server protocols, and a design your page's CSS can't break.

[Documentation](https://akinozgen.github.io/datagrids/) ·
[Getting started](https://akinozgen.github.io/datagrids/guide/getting-started) ·
[Concepts](https://akinozgen.github.io/datagrids/guide/concepts) ·
[Modules](https://akinozgen.github.io/datagrids/modules/)

- **Zero dependencies.** Vanilla TypeScript; ESM, CJS and one IIFE (`window.Datagrids`) for script tags.
- **A design host CSS can't break.** Component-scoped `--dg-*` tokens, a low-specificity reset, state in
  attributes. One `--dg-accent` line rebrands it; dark mode follows your page's `color-scheme`.
- **Accessible by default.** A real `<table>`, sort buttons with `aria-sort`, a skip link, polite live
  announcements, keyboard menus; checked with axe.
- **Composition, not configuration.** A grid is a table plus typed columns. Saved state, column menu,
  selection, row actions and export are modules attached with `use` — only what you import is bundled.
- **Your server, as it is.** The classic `draw/start/length/columns[]` wire (yajra on Laravel), Laravel's
  `paginate()` JSON, and the typed [datagrids protocol v1](https://akinozgen.github.io/datagrids/protocol/v1/).
- **Real Excel files, no library.** A built-in XLSX writer exports real numbers, money and dates; CSV and a
  light print view too.
- **Laravel conveniences.** `csrf: true`, session-expiry events, Laravel error shapes normalized into one
  error state with Retry, soft-delete toggles, URL-synced filters.
- **Progressive enhancement.** Enhance a server-rendered table in place; `destroy()` restores it exactly.

## Install

```sh
npm i @akinozgen17/datagrids
```

```js
import { Datagrid, column, serverSide, yajra, colVis, stateSave, excel } from "@akinozgen17/datagrids";
import "@akinozgen17/datagrids/css";

new Datagrid("#agents", {
  label: "Agents",
  columns: [
    { key: "name", title: "Name" }, // yajra escapes strings on the server: plain columns render them as HTML
    column.badge("status", { title: "Status", labels: { open: "Open", done: "Done" }, tones: { open: "info", done: "ok" } }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("created_at", { title: "Created" }),
  ],
  sort: [["created_at", "desc"]],
  use: [
    serverSide({ url: "/agents/data", protocol: yajra(), csrf: true }),
    colVis(),
    stateSave(),
    excel(),
  ],
});
```

Without a bundler:

```html
<link rel="stylesheet" href="https://unpkg.com/@akinozgen17/datagrids/dist/datagrids.css">
<script src="https://unpkg.com/@akinozgen17/datagrids/dist/datagrids.global.js"></script>
<script>
  const { Datagrid, column } = Datagrids;
  new Datagrid("#agents", { label: "Agents", columns: [column.text("name", { title: "Name" })], data: rows });
</script>
```

The stylesheet is required (`@akinozgen17/datagrids/css`); `@akinozgen17/datagrids/css/tokens` ships the
tokens alone.

## Modules

| Module | Does |
|---|---|
| `serverSide({ url, protocol })` + `ssp()` · `yajra()` · `laravelPaginator()` · `dgp()` | server paging, sorting, search |
| `fetchAll({ url })`, `arraySource(rows)`, `customSource({ mode, load })` | client-side sources (the DOM source is automatic) |
| `stateSave()` | remembers sort, page size, visible columns (localStorage, versioned, 90-day TTL) |
| `colVis()` · `colReorder()` · `responsive()` | column menu · column reordering · collapse columns into detail rows |
| `lazyColumns()` | expensive server columns requested only while visible |
| `stickyHeader()` · `keyboardGrid()` · `rowReorder({ onEnd })` | page-level sticky header · opt-in arrow-key grid navigation · drag/keyboard row ordering |
| `filterPresets({ presets })` · `autoRefresh()` · `multiSort()` | named filter sets · silent periodic reload · Shift+click multi-column sort |
| `columnFilters()` · `filterPanel({ fields })` · `urlSync()` | typed header filters · external filter forms · shareable URLs |
| `selection()` | persistent selection, "select all matching", bulk bar |
| `actions({ items })` | row actions: inline buttons or a menu, permissions, confirm dialog |
| `excel()` · `csv()` · `print()` | export menu |
| `footer({ cols })` · `metaBind(bindings)` | totals row · response fields bound to page elements |
| `softDeletes()` · `button.reload()` · `button.resetState()` · `button.custom()` · `button.group()` | "show deleted" toggle · toolbar buttons and menus |

## For AI agents

- Cheat sheet with the complete API: [`docs/llm.md`](docs/llm.md) (also shipped in the npm package and at
  <https://akinozgen.github.io/datagrids/llm.md>).
- Site index for LLMs: <https://akinozgen.github.io/datagrids/llms.txt> · everything in one file:
  <https://akinozgen.github.io/datagrids/llms-full.txt>.
- Types are the source of truth: `dist/index.d.ts`.

## Migrating

Coming from another grid library? The [migration guide](https://akinozgen.github.io/datagrids/migration/) maps options and server protocols to modules.

## Browser support

Evergreen browsers (Baseline 2024: Popover API, `light-dark()`, relative colors). Older engines get a
static light palette.

## License

MIT © Akın Özgen
