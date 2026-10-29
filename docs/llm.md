---
title: LLM cheat sheet
description: The complete datagrids API in one page for AI coding agents — options, columns, modules, methods, events, protocols, tokens, recipes and gotchas.
outline: [2, 2]
---

# datagrids — AI agent cheat sheet

<!-- Hand-maintained against src/ (types: src/core/types.ts). Shipped in the npm package as docs/llm.md. -->

## What it is

Framework-agnostic, zero-dependency, accessible data grid that enhances a plain `<table>`. A small core
(search, sort, paging, pager, states, toolbar slots) plus **typed columns** and **independent modules**
attached with `use`. Server protocols: classic SSP wire (`ssp()`, `yajra()` preset), Laravel paginator JSON
(`laravelPaginator()`), datagrids protocol v1 (`dgp()`). Styles are scoped under `--dg-*` tokens.
npm: `@akinozgen17/datagrids`. Types (`dist/index.d.ts`) are the source of truth.

## Install

```sh
npm i @akinozgen17/datagrids
```

```js
import { Datagrid, column, serverSide, yajra } from "@akinozgen17/datagrids";
import "@akinozgen17/datagrids/css";          // REQUIRED (tokens + core + module styles)
// "@akinozgen17/datagrids/css/tokens" = tokens only
```

No bundler: `dist/datagrids.css` + `dist/datagrids.global.js` → everything on `window.Datagrids`
(`Datagrids.Datagrid`, `Datagrids.column`, `Datagrids.configure`, …).

## Mental model

- **Grid** = one `<table>` + `columns`. `new Datagrid(tableOrSelector, options)`. Never a giant config.
- **Columns** = typed factories `column.text/number/money/date/badge/link/phone/boolean/html/index/select/actions`.
- **Modules** = immutable definitions from factories (`stateSave()`), attached with `use: [ ... ]`; arrays nest
  (a preset is an array). Module API appears on the grid under the module's name (`grid.state`).
- **Pipelines** modules plug into: request middleware, row mutators, toolbar slots, state contributions,
  export values, lifecycle. **Events** (`grid.on`) are for reacting.

## Quick start — the ONE canonical way

```js
import { Datagrid, column, serverSide, yajra, colVis, stateSave, button, excel, print, configure } from "@akinozgen17/datagrids";
import "@akinozgen17/datagrids/css";

configure({ csrf: true });                       // optional global defaults (only affects grids created later)

const grid = new Datagrid("#agents", {
  label: "Agents",                               // accessible name (or labelledBy / <caption>)
  columns: [
    { key: "name", title: "Name", name: "agents.name" },  // yajra: strings arrive escaped → untyped (HTML) column
    column.badge("status", { title: "Status", labels: { open: "Open", done: "Done" }, tones: { open: "info", done: "ok" } }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("created_at", { title: "Created", time: true }),
    { key: "actions_html", title: "", sortable: false, searchable: false }, // untyped → yajra default: HTML
  ],
  sort: [["created_at", "desc"]],
  use: [
    serverSide({ url: "/agents/data", protocol: yajra(), params: () => ({ unit: unitSelect.value }) }),
    colVis(), button.reload(), stateSave(), excel(), print(),
  ],
});
unitSelect.addEventListener("change", () => grid.reload());
```

Put the data source in `use: [...]` (or chain `.use(source)`: it replaces the default source; a second explicit source throws DG008).

## Grid options (complete)

| Option | Type | Default | Notes |
|---|---|---|---|
| `columns` | `ColumnDef[]` | from source / `<thead>` | |
| `use` | `ModuleInput[]` | `[]` | modules and nested arrays (presets) |
| `data` | `Row[]` | — | shorthand for `arraySource(rows)` |
| `name` | `string` | — | registry name for `find()` / `reload(name)`; stateSave key |
| `label` / `labelledBy` | `string` | caption | accessible name; missing → DG002 |
| `title`, `description` | `string` | — | shown in the card header (`surface: "card"`) |
| `pageSize` | `number` | 25 | `configure` default |
| `pageSizes` | `number[]` | `[10,25,50,100]` | `-1` = "All" (only if the protocol `allowAll`) |
| `maxPageSize` | `number` | 1000 | clamps page sizes (DG013) |
| `paging` | `boolean` | `true` | `false` = one view with every row |
| `sort` | `[["key","asc"\|"desc"]]` or `[{key,dir}]` | none | `[]` = no sort (ssp otherwise sends `[[0,'asc']]`) |
| `search` | `boolean \| { delay, minLength, placeholder }` | on; delay 400 ms server / 200 ms client | Enter = now, Esc = clear |
| `load` | `"eager" \| "visible" \| "manual"` | `"eager"` | visible = IntersectionObserver |
| `rowKey` | `string \| (row) => string` | `id` → `DT_RowId` → index (DG003) | |
| `virtual` | `boolean \| number` | auto at ≥300 rows in view | `false` disables |
| `maxHeight` | CSS length | — | body scrolls, sticky header |
| `errorMode` | `"inline" \| "silent" \| "throw"` | `"inline"` | |
| `messages` | `Partial<Messages>` | locale pack | |
| `locale` | `string` | `configure` → `<html lang>` → `navigator.language` → `"en"` (invalid tags skipped, DG015) | `tr*` → Turkish pack, else English |
| `host` | `HostAdapters` | from `configure` | per-grid confirm/notify/csrf/laravel/timeout/fetch |
| `surface` | `"plain" \| "card"` | plain | |
| `size` | `"sm" \| "md" \| "lg"` | md | |
| `density` | `"compact" \| "normal" \| "comfortable"` | normal | rows 28/36/44 px |
| `theme` | `"light" \| "dark" \| "system"` | inherit page `color-scheme` | |
| `head` | `"caps" \| "sentence"` | caps | caps needs `<html lang>` (DG011) |
| `striped`, `wrap`, `count` | `boolean` | false, true, false | `count` shows "N records" |
| `rowTone` | `(row) => "ok"\|"warn"\|"bad"\|"info"\|"muted"\|…` | — | `tr[data-tone]` |
| `rowClass`, `rowAttrs` | `(row) => string` / `(row) => Record<string,string>` | — | |
| `rowClick` | `(row, event) => void` | — | adds a permanent `›` column |

Unknown options warn (DG001) with hints for legacy names (`ajax`, `serverSide`, `dom`, `buttons`, `language`,
`stateSave`, `lengthMenu`, `pageLength`, `order`, `deferLoading`, `columnDefs`).

## Columns (complete)

ColumnDef: `key` (required), `data` (dotted path, default key), `name` (server column name), `title`,
`type`, `sortable`, `sortKey` (client sort field), `searchable`, `visible`, `hideable`, `exportable`,
`align` (`start|end|center`), `className`, `defaultContent`, `can` (false → column does not exist anywhere),
`html` / `text` (render mode), `sticky` (`start|end`), `render(value,row,ctx)` → `Node|string|number|null` (`ctx`: `row, key, index, position, td, locale, text(row, path)`; `value` is text already, `ctx.text` decodes other fields of escaped yajra rows),
`lazy` (server-computed on demand, see `lazyColumns`), `value(row)`, `compare(a,b)`, `searchText(value,row)`, `exportValue(row)`, `exportType`
(`string|number|money|date|boolean`), `exportFormat`, `labels`.

| Factory | Extra options | Behaviour |
|---|---|---|
| `column.text(key)` | — | always text |
| `column.html(key)` | — | raw HTML (opt-in); search/export strip tags |
| `column.number(key)` | `decimals`, `locale`, `source: "number"\|"tr"` | end-aligned, numeric sort, exports number; `number` (default) reads `"1.500"` as 1.5, `tr` as 1500 |
| `column.money(key)` | `currency` (TRY), `decimals` (2), `locale`, `source: "number"\|"tr"\|"html"` | `.dg-money` |
| `column.date(key)` | `time`, `timeZone`, `locale`, `source: "iso"\|"local"\|"dmy"` | exports real date |
| `column.badge(key)` | `labels`, `tones` | `.dg-chip[data-tone]` |
| `column.link(key)` | `href: "/x/{id}" \| (row) => url`, `target` | values URL-encoded; safe schemes only |
| `column.phone(key)` | `country` ("90"), `whatsapp` | `tel:` link (+ WhatsApp link), digits normalized |
| `column.boolean(key)` | `labels: { true, false }`, `showFalse` (true) | ✓/✕ icon + text; reads 1/0, true/false, evet/hayır, yes/no, on/off |
| `column.index()` | — | row number (page offset aware) |
| `column.select()` | — | required by `selection()` |
| `column.actions()` | — | required by `actions()`; sticky end |

**Cells are text by default; HTML is an explicit opt-in.** Untyped columns follow the source: array, fetchAll,
ssp, dgp, laravelPaginator → text; `yajra()` → HTML (server escapes); DOM source adopts existing cells.
number/money/date format with the grid `locale` (money in `TRY`) unless the column gets `locale`/`currency`. Widths: CSS only
(`#t th[data-key="ref"]{inline-size:7rem}`), never inline.

## Data sources

| Factory | Mode | Options |
|---|---|---|
| `arraySource(rows)` / `data: rows` | client | — |
| `domSource()` (automatic when `<tbody>` has rows) | client | `<th data-dg-key data-dg-type="number\|money" data-dg-sortable="false" data-dg-searchable data-dg-visible data-dg-hideable data-dg-export data-dg-align>`; `td[data-order]` |
| `fetchAll({ url, method, dataSrc, csrf, body })` | client | one request |
| `serverSide({ url, protocol, method, params, headers, csrf, timeout, fetch, seed })` | server | `.params(fn)` derives a new def |
| `customSource({ mode, load(query, { signal, grid, middlewares, host }) })` | either | return `{ rows, total, filtered, hasMore?, meta? }` |

Protocols: `ssp({ data, dataSrc, cells:"text", method:"GET", allowAll:false })`, `yajra(same)` (= ssp with
`cells:"html"`, `method:"POST"`), `laravelPaginator({ query:{page,perPage,sort,search,cursor}, sortFormat:"-key"|"key:dir" })`,
`dgp({ method:"POST", count:"exact"|"estimate"|"none" })`. Custom protocol: `{ name, cells, method?, allowAll?,
encode(req, query, grid) → { url, init, params? }, decode(body, query, grid) → LoadResult }` (`params` = page params that reached the wire, for `lastRequestParams()`).

Transport adds `X-Requested-With: XMLHttpRequest` (unless `laravel:false`), CSRF (`X-CSRF-TOKEN` from
`meta[name=csrf-token]` + `_token` in non-GET form bodies) when `csrf`, timeout 30 s, abort (latest wins,
matched by sequence, never by `draw`), `credentials:"same-origin"`, strips `queries`/`input` debug keys.

## Modules (complete)

| Factory | Grid API | Requires | Options |
|---|---|---|---|
| `stateSave()` | `grid.state`: `key`, `save()`, `read()`, `clear()`, `reset()` | — | `key`, `version` (1), `ttl` (90 days, 0 = never), `include: ["search","filters","page"]` (default none), `storage`, `delay` (250) |
| `colVis()` | `grid.colVis`: `open/close/toggle/reset()`, `count()` | — | `messages`, `searchAbove` (12), `slot` ("start"), `order` (10) |
| `colReorder()` | `grid.colReorder`: `order()`, `move(key,to)`, `reset()`, `movable()` | — | `drag` (true), `messages` — display order only, wire keeps definition order |
| `responsive()` | `grid.responsive`: `collapsed()`, `refit()`, `toggle(rowKey, open?)` | — | `priority` ({key: n}, lower = kept longer; default last column collapses first), `keep` (keys), `details` (true: expandable detail rows), `messages`; fires `collapse` `{ columns }` |
| `lazyColumns()` | `grid.lazyColumns`: `requested()`, `visible()` | — (server mode) | `keys` (+ columns with `lazy: true`), `param` ("lazy") — only visible lazy columns are requested; showing one reloads in place |
| `stickyHeader()` | `grid.stickyHeader`: `stuck()`, `refresh()` | — | `offset` (px or `() => px`, for fixed app bars) — page-level header copy (aria-hidden) for horizontally scrolling tables |
| `keyboardGrid()` | `grid.keyboardGrid`: `position()`, `focus(row, col)` | — | opt-in APG grid: `role="grid"`, one tab stop, arrows/Home/End/Ctrl+Home/End/PageUp/PageDown, Enter/F2 into a cell |
| `rowReorder({ onEnd })` | `grid.rowReorder` | (`column` from `reorderColumn()` optional) | `onEnd(e)` saves (`e: { row, key, from, to, offset, prevKey, nextKey, rows }`; reject → revert), `handle` (column key), `orderKey`, `label(row)`, `messages`; events `beforeReorder` (cancelable), `reorder`, `reordererror` |
| `autoRefresh()` | `grid.autoRefresh`: `running()`, `start()`, `stop()`, `tick()` | — | `every` (30000 ms, min 5000), `initial` (true), `toggle` (true: toolbar switch), `slot`, `order`, `messages` — silent reload keeping the page; skips hidden tabs, running loads, open panels, typing |
| `filterPresets({ presets })` | `grid.filterPresets` | — | `presets: [{ id, label, values, default? }]`, `target` ("panel" \| "grid"), `label`, `slot`, `order`, `messages` — named filter sets |
| `multiSort()` | `grid.multiSort`: `toggle(key)` | — | `max` (3), `messages` — Shift+click / Shift+Enter adds a sort key, again flips, third time removes; rank badges; `laravelPaginator()` sends only the first key |
| `columnFilters()` | — | — | `columns` (keys), `options` ({key:[{value,label}]}), `messages` |
| `filterPanel({ fields })` | `grid.filterPanel`: `values()`, `raw()`, `set(patch,{reload})`, `reset()`, `apply()` | — | `fields: { param: "#sel" \| el \| { el, value, unchecked, format(v,el), subscribe(el,notify) } }`, `auto` (true), `debounce` (250) |
| `urlSync()` | `grid.urlSync`: `link()` | — | `keys`, `namespace` (string \| true), `mode` ("replace" \| "push") — `?q= &sort=-date &page= &f.<key>=` |
| `softDeletes()` | `grid.softDeletes`: `active()`, `toggle(on?)` | — | `param` ("_deleted"), `value` (1), `field` (`deleted`/`deleted_at`), `label`, `initial`, `slot` ("end"), `order` (-10) |
| `selection()` | `grid.selection`: `get()`, `keys()`, `payload()`, `count()`, `isAll()`, `isSelected(k)`, `select(k)`, `deselect(k)`, `toggle(k)`, `clear()`, `selectPage()`, `deselectPage()`, `selectAllMatching()` | `column.select()` | `mode` ("multi"\|"single"), `acrossPages` (true), `selectAllMatching` (true), `label(row)`, `bulk: false \| { actions: [{ id, label, icon, tone, can, onClick(payload, grid, selection) }] }`, `messages` |
| `actions({ items })` | `grid.actions`: `run(id,key)`, `open(key)`, `items(key)` | `column.actions()` | `items`, `inline` (2), `buttonGroup` (true: joined group, aligned rows), `sticky` ("end"\|false), `field` (server permission map), `reasons`, `rowLabel(row)`, `messages`; enabled `href` items are real `<a>` (plain click → confirm/beforeAction, modified/middle click native) |
| `excel()` | `grid.excel`: `download()`, `blob()` | — | `filename`, `sheetName`, + export options |
| `csv()` | `grid.csv`: `download()`, `text()` | — | `filename`, `delimiter` (";" for tr, else ","), `bom` (true), + export options |
| `print()` | `grid.print`: `open()` | — | `title`, + export options |
| `footer({ cols })` | `grid.footer`: `values()`, `refresh()` | — | `cols: { key: "sum"\|"avg"\|"count"\|(rows, raw, grid) => v }`, `label`, `scope` ("page"\|"response"), `messages` |
| `metaBind(bindings, opts)` | `grid.metaBind`: `refresh()` | — | bindings `{ "#sel": "summary.total" \| (raw, grid) => v \| { value, format } }`; opts `format` ("text"\|"money"\|"number"\|fn), `currency`, `decimals`, `empty` ("—"), `root` |
| `button.reload()` | `grid.reloadButton.el` | — | `label`, `silent`, `slot`, `order` (20) |
| `button.resetState()` | `grid.resetStateButton.el` | `stateSave()` | `label`, `slot`, `order` (30) |
| `button.custom({ label, onClick })` | `grid[name].el` | — | `name` (API key, default `button<N>`), `icon`, `iconOnly`, `variant` ("primary"\|"ghost"), `slot`, `order` (50), `disabled(rawResponse)` re-evaluated after each server response (not before the first one; never on array/DOM grids) |
| `button.group({ label, items })` | `grid[name].el` | — | toolbar menu; `items: [{ id, label, icon, can, onClick(grid) }]`, `name`, `icon`, `slot`, `order` |

Export options (excel/csv/print): `scope: "page"|"all"` (default: client all, server page; server "all" = one
request ≤ maxPageSize + truncation notice), `footer` (include `<tfoot>`), `label`, `messages`. All export modules
share one "Export" menu. No PDF: print view + the browser's "Save as PDF".

`actions` item: `{ id, label, icon?, tone?: "danger"|"warning"|"success", group?, primary?, can?: boolean | (row) => boolean,
disabled?: (row) => boolean | reason string, href?: "/a/{id}", target?, request?: { url: "/a/{id}", method, body },
handler?: (row, { grid, key }) => void, confirm?: string | { title, message, confirmLabel, cancelLabel },
success?: string | false, reload?: false | { keepPage } }` — exactly one of href/request/handler; `{field}` is URL-encoded;
≤ `inline` actions render as buttons, more → primary + `⋯` menu. `can` is UX only; endpoints authorize.

Every module accepts `can: false` (attached, contributes nothing). Wiring errors throw: missing `requires` DG007,
two sources / single slot DG008, same module twice DG009, name clashes with a core member DG010.

## Writing a module

```js
const countBadge = () => Object.freeze({
  name: "countBadge", kind: "toolbar",
  setup(ctx) {
    const el = document.createElement("span");
    ctx.toolbar({ slot: "end", order: 5, el });
    const off = ctx.on("load", ({ result }) => (el.textContent = `${result.filtered ?? result.rows.length}`));
    ctx.request((req, next) => { req.headers["X-Grid"] = "agents"; return next(req); }, "pre");
    return { api: { el }, destroy() { off(); el.remove(); } };
  },
});
```

ModuleDef: `name`, `kind` ("source"|"feature"|"toolbar"|"export"), `slot?`, `requires?`, `enforce?` ("pre"|"post"),
`can?`, `source?`, `setup(ctx)` → `{ api?, destroy? }`. ctx: `grid`, `root`, `table`, `messages`, `host`, `locale`,
`signal`, `on`, `toolbar({slot,order,el})`, `row((tr,row,key)=>…)`, `request(mw, "pre"|"post")`,
`state({key,save,load})`, `above(el)`, `layer(el)`, `announce(msg)`, `requestRender()`, `ready(fn)`.
Request middleware order: built-ins (X-Requested-With, CSRF) → `pre` → registration order → `post`; call `next(req)` once.

## Instance methods (complete)

| Method | Notes |
|---|---|
| `load()` | loads (used with `load:"manual"`) |
| `reload({ keepPage?, silent? })` | default page 1; silent = no busy card |
| `search(v?)`, `page(n?)`, `pageSize(n?)`, `sort(spec?)` | getters/setters; setters load |
| `filters(patch?)` | `{ key: value \| [any of] \| { op, value } \| (v,row)=>bool \| null }`; non-column keys = page params (server) |
| `query()` | `{ page, pageSize, sort, search, filters, columns, sortDefault, pristine }` |
| `columns()`, `setColumns(defs)`, `setColumnVisible(key, bool)` | |
| `columnOrder(keys?)` | display order (get/set); requests keep definition order |
| `rows()`, `viewRows()`, `keyOf(row)`, `rowByKey(key)` | |
| `setData(rows)`, `addRows(rows, {keepPage})`, `removeRow(key)`, `refreshRow(key, row?)` | client mode (refreshRow/removeRow also server; addRows is ignored in server mode); `reload()` keeps these edits on array/DOM sources |
| `lastResponse()` | raw JSON of the last response |
| `lastRequestParams()` | page params of the request behind the rows on screen, as sent: filter panel, toggles, `params`, non-column filters and (ssp/yajra) `data` additions; protocol fields and `_token` excluded |
| `exportRows("page"\|"all")` | |
| `status()` | `{ status: "idle"\|"loading"\|"reloading"\|"ready"\|"error", loaded, total, filtered, hasMore, error }` |
| `on(type, fn)` → unsubscribe; `emit(type, detail)` | DOM `dg:<type>` CustomEvents on `grid.root` too |
| `delegate(type, selector, (e, { row, key, tr, td, column }) => …)` → unsubscribe | row-aware DOM events |
| `action(url, { method:"POST", body, confirm, success, reload, headers, isError })` | confirm → CSRF fetch → notify → `reload({keepPage:true})`; same-origin, method allow-list; a redirect to a non-login page = success, to a login page = `sessionexpired`; a 2xx body fails only via `isError(body, res)` (truthy, string = message) |
| `notify(kind, msg)`, `confirm(msg, opts)` | host adapters, else live region / native `<dialog>` |
| `batch(fn)` | several changes, no intermediate loads |
| `use(module)`, `module(factory)` | typed module API access |
| `destroy()`, `remount(table?)` | destroy restores the original table; remount keeps options + modules chained with `use()` |
| `root`, `table`, `name`, `messages`, `locale`, `mode`, `maxPageSize` | properties |

## Static API

`Datagrid.get(el | selector)` → grid or **null** (never creates) · `get` · `find(name)` · `reload(name, opts)` → bool (DG006) ·
`configure(GlobalConfig)` · `upgrade(root?)` (idempotent, `table[data-datagrid]`, attrs `data-dg-name/label/load/page-size/sort="key:desc"/theme/size/density`) ·
`preset(name, (table) => modules)` · `en`, `tr` message packs · `VERSION`.

`configure` keys: `confirm(msg, opts) → Promise<bool>`, `notify(kind, msg)`, `csrf` (false), `laravel` (true), `timeout`
(30000), `onSessionExpired(err)`, `fetch`, `isError(body, res)` (action 2xx failure rule), `messages`, `locale`, `pageSize` (25), `pageSizes`, `maxPageSize` (1000),
`warnings` (true), `errorMode` ("inline"). Read at grid creation, except `errorMode`, `maxPageSize`, `warnings` (read when needed, so they reach existing grids too).

## Events (complete)

| Event | Payload | Cancelable |
|---|---|---|
| `init` | `{ grid }` | |
| `beforeLoad` | `{ query, cancel() }` | ✓ |
| `response` | `{ raw, result }` (server/fetch responses) | |
| `load` | `{ result, query }` | |
| `render` | `{ keys, rows }` (after every body render) | |
| `loadingchange` | `{ loading }` | |
| `error` | `{ error: DatagridError }` | |
| `sessionexpired` | `{ error }` | |
| `beforeSort` / `sort` | `{ sort, cancel() }` / `{ sort }` | ✓ / |
| `beforePage` / `page` | `{ page, cancel() }` / `{ page }` | ✓ / |
| `pagesize` | `{ pageSize }` | |
| `search` | `{ search }` | |
| `columnchange` | `{ columns }` | |
| `headrender` | `{ tr }` | |
| `selectionchange` | `{ count, keys, all }` | |
| `collapse` | `{ columns }` (responsive module) | |
| `beforeReorder` / `reorder` / `reordererror` | rowReorder end event `{ row, key, from, to, … }` (+ `error`) | ✓ / / |
| `beforeAction` / `action` / `actionerror` | `{ id, key, row, cancel() }` / `{ id, key, row }` / `+ error` | ✓ / / |
| `beforePrint` | `{ document, window, cancel() }` | ✓ |
| `destroy` | `{}` | |

DatagridError: `{ kind: network|timeout|abort|http|server|session|forbidden|validation|parse|protocol, status, message, detail?, retryable, raw? }`.
419/401/redirect-to-login → `session` (+ `sessionexpired` + `onSessionExpired`); 403 or another redirect → forbidden (but `action()` treats a non-login redirect as success); 422 → validation; 5xx/429 retryable; 200 + `error` → server (banner).

## Server protocols (wire summary)

**ssp / yajra:** every request sends the full set `draw, start, length, search[value|regex], order[i][column|dir],
columns[i][data|name|searchable|orderable|search][value|regex]`, encoded exactly like jQuery `$.param` (booleans as
"true"/"false", empty arrays omitted). `columns[]` in definition order incl. hidden. No sort + no `sort: []` → `[[0,'asc']]`.
Clearing the sort at runtime still sends `[[0,'asc']]`; only `sort: []` at construction drops it.
Page filters (`params`, non-column `filters()` keys) = top-level params. Plain value on a column key → anchored escaped regex
`columns[i][search][value]=^v$` + `regex=true` (arrays `^a$|^b$`). Typed column filters → `columns[i][columnControl]` (no `between`/`notIn`).
Both only on searchable columns. Response: `data` (`aaData`), `recordsTotal`, `recordsFiltered` (numeric strings ok),
`error`, `DT_RowId`, `DT_RowClass`; other keys → `lastResponse()` / `response` event / metaBind.
**laravelPaginator:** GET `?page=&per_page=&sort=-date&search=`; detects `paginate` (total), `simplePaginate`
(no total → "total unknown", next from `next_page_url`), `cursorPaginate` (`next_cursor` → `?cursor=`, pages reached
in order) and API resources (`data`/`meta`/`links`).
**dgp v1:** POST JSON `{ v:1, page:{size,number}, sort:[{key,dir}], q, filters:{key:{op,value}}, fields, count, requestId, params }` →
`{ v:1, rows, page:{size,number,hasMore}, count:{mode,total?,filtered?}, meta }`; errors RFC 9457 + `code`, `retryable`, `errors`.
Ops: `eq ne gt gte lt lte between in notIn contains notContains starts ends empty notEmpty` (AND only).

## CSS & DOM (summary)

Input tokens (inherit from any ancestor): `--dg-accent` (default #3d63dd), `--dg-rem` (1rem). Other tokens live on `.dg`
(override with `.app .dg { --dg-row-h: 2rem }`): `--dg-bg --dg-fg --dg-muted --dg-muted-fg --dg-border --dg-head-bg
--dg-head-fg --dg-tone-{neutral,info,ok,warn,bad} --dg-accent-{solid,fg,ink,weak} --dg-ring --dg-line --dg-row-alt
--dg-space-{1..8} --dg-radius-{xs,sm,md,panel,surface,full} --dg-font-size-{xs,sm,md,lg} --dg-head-{font-size,weight,transform,tracking}
--dg-row-h --dg-cell-pad-{x,y} --dg-control-h --dg-dur-{1,2,3}`. `--dg-_*` = private.
Root: `.dg[data-state="loading|ready|empty|error|idle"][data-size][data-density][data-dg-theme][data-dg-head][data-dg-surface][data-dg-striped][data-dg-virtual][data-bp]`.
Toolbar `.dg-toolbar > .dg-slot[data-slot="start|end|filters"]`; table `table.dg-table` (your element); header
`th[data-key][aria-sort] > button.dg-sort`; rows `tr[data-key][data-selected][data-tone]`; cells `td[data-key][data-align][data-col]`;
pager `nav.dg-pager`; info `.dg-info`; busy `.dg-frame[data-busy]` + `table[aria-busy]`; never `dt-*` classes.

## Recipes

```js
// page filter form → server params (+ shareable URL)
use: [serverSide({ url, protocol: yajra(), csrf: true }), filterPanel({ fields: { status: "#status", unit: "#unit" } }), urlSync()]

// client filters
grid.filters({ status: ["open", "pending"], amount: { op: "gte", value: 1000 } });

// row action → POST with confirm, keeps the page
grid.delegate("click", ".approve", (e, { row }) => grid.action(`/agents/${row.id}/approve`, { confirm: "Approve?" }));

// bulk action with "select all matching"
selection({ bulk: { actions: [{ id: "archive", label: "Archive", onClick: (payload, grid) =>
  grid.action("/agents/bulk-archive", { body: payload }) }] } })   // payload {all:false,keys} | {all:true,except,query}

// grid in a tab / modal
new Datagrid("#t", { columns, load: "visible", use: [source] });

// reload another grid by name
reload("agents", { keepPage: true });

// Livewire / SPA: wire:ignore around the table, or destroy before morph and remount after
Datagrid.get("#t")?.destroy();

// declarative
preset("list", (t) => [serverSide({ url: t.dataset.url, protocol: yajra(), csrf: true }), colVis()]);
upgrade();  // <table data-datagrid="list" data-url="/agents/data" data-dg-label="Agents">

// server-side export of the current query
location.href = "/agents/export?" + new URLSearchParams({ q: JSON.stringify(grid.query()) });
```

## DataTables → datagrids (most used)

| DataTables 1.10 / 2.x / 3.x | datagrids |
|---|---|
| `$('#t').DataTable({...})` / `new DataTable('#t', {...})` | `new Datagrid('#t', { columns, use: [...] })` |
| `$('#t').DataTable()` (accessor) | `Datagrid.get('#t')` (null if none — never creates) |
| `serverSide: true, ajax: { url, type:'POST', data }` | `serverSide({ url, protocol: yajra() /* or ssp({ data }) */, params })` |
| `ajax.data: function (d) { d.x = … }` | `params: () => ({ x: … })` or `ssp({ data: (d) => { d.x = … } })` |
| `ajax.dataSrc` | `ssp({ dataSrc })` |
| `data: [...]` | `data: [...]` |
| `columns[].data / name / title / visible / searchable / className / defaultContent` | same names on the column |
| `columns[].orderable` | `sortable` |
| `columns[].render` | `render(value, row, ctx)` or a typed `column.*` |
| `order: [[3,'desc']]` | `sort: [["key","desc"]]` (by key) |
| `pageLength`, `lengthMenu` | `pageSize`, `pageSizes` |
| `paging: false` / `searching: false` | `paging: false` / `search: false` |
| `searchDelay` | `search: { delay }` |
| `dom` / `layout` / `buttons` | toolbar slots + modules (`colVis()`, `excel()`, `button.reload()`) |
| `stateSave` + `stateSaveParams` | `stateSave()` (search/page not saved by default) |
| `stateDuration` | `stateSave({ ttl })` |
| `deferLoading` | `load: "manual"` / `"visible"` |
| `createdRow` / `rowCallback` | `rowClass`, `rowAttrs`, `rowTone`, or a module `ctx.row` |
| `drawCallback` / `initComplete` | `on("render")` / `on("init")` |
| `footerCallback` | `footer({ cols })` |
| `select` extension | `selection()` + `column.select()` |
| `colReorder` | `colReorder()` |
| `responsive` | `responsive()` (detail rows, `collapse` event) |
| `fixedHeader` | `stickyHeader()` (or `maxHeight` + CSS sticky) |
| `keys` (KeyTable) | `keyboardGrid()` |
| `rowReorder` / `row-reorder.dt` | `rowReorder({ onEnd })` / `reorder` event |
| `buttons: [{ text, action }]` / `extend: 'collection'` | `button.custom({ label, onClick })` / `button.group({ label, items })` |
| `language` | `messages` + `en` / `tr` packs |
| `$.fn.dataTable.defaults` | `configure()` + presets |
| `$.fn.dataTable.ext.errMode` / `error.dt` | per grid `errorMode` + `on("error")` |
| `xhr.dt` / `preXhr.dt` | `on("response")` / request middleware, `on("beforeLoad")` |
| `.ajax.reload(null, false)` | `grid.reload({ keepPage: true })` |
| `.ajax.json()` / `.ajax.params()` | `grid.lastResponse()` / `grid.lastRequestParams()` (page params sent) + `grid.query()` (neutral query) |
| `.column(i).visible(b)` | `grid.setColumnVisible(key, b)` |
| `.rows.add(a).draw()` / `.clear()` / `.row(x).remove()` | `addRows(a)` / `setData([])` / `removeRow(key)` |
| `.state.clear()` | `grid.state.reset()` |
| `$(document).on('click', '.x', …)` + `.row(tr).data()` | `grid.delegate("click", ".x", (e, { row }) => …)` |
| `buttons: ['pdf']` | `print()` + browser "Save as PDF" |

Not in v1: RowGroup, SearchPanes, SearchBuilder, Scroller, FixedColumns, child rows, header filter rows,
copy, PDF, 1.9 server protocol (`sEcho`, `iDisplayStart`).

## Gotchas

- Without `@akinozgen17/datagrids/css` the grid has no layout.
- Give every grid `label` (or `labelledBy` / `<caption>`), else DG002.
- `Datagrid.get()` returns `null` before init; it never creates a grid.
- One data source per grid: a chained `grid.use(source)` replaces the default one; a second explicit source throws DG008.
- `remount()` re-creates the grid from its options plus every module chained later with `grid.use()`.
- Plain strings render as text. HTML needs `column.html()`, `html: true`, or untyped columns with `yajra()`.
- `column.text()` forces text even under `yajra()` and would show the server's entities (`&amp;`): with `yajra()`
  write string columns as plain `{ key, title }`; typed money/date/badge columns are fine.
- number/money/date format with the grid `locale` (money in TRY): pass `locale`/`currency` per column to differ.
- number/money read data strings as machine numbers (`"1.500"` = 1.5); pass `source: "tr"` for formatted Turkish text.
- `reload()` on array/DOM sources keeps `setData`/`addRows`/`removeRow` edits; `addRows` is ignored in server mode.
- SSP endpoints receive `columns[]` in definition order, hidden included, even after reordering.
- Inside tabs/modals use `load: "visible"`; there is no `columns.adjust()` (ResizeObserver handles it).
- `selection()` needs `column.select()`; `actions()` needs `column.actions()`; `button.resetState()` needs `stateSave()`.
- Session expiry fires `sessionexpired`; handle it once with `configure({ onSessionExpired })`.
- Module definitions are immutable: create once, use on many grids; `serverSide(...).params(fn)` returns a new one.
- `configure()`: most keys apply to grids created afterwards; `errorMode`, `maxPageSize`, `warnings` also reach existing grids.
- ≥300 rows in one view switch to virtual rows (screen readers see rendered rows only); `virtual: false` opts out.

## Version & compatibility

Pre-1.0 (`0.x`): breaking changes are still possible between minors. Browsers: Baseline 2024 (Popover API,
`light-dark()`, relative color syntax) with a static light fallback. TypeScript ≥ 5.0 for consumers.
Docs: https://akinozgen.github.io/datagrids/ · Warning codes: https://akinozgen.github.io/datagrids/errors/
