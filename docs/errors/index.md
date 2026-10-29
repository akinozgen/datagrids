---
title: Warning codes
type: reference
description: Every coded datagrids console warning and thrown error (DG001–DG015) with its message, cause and fix, plus the uncoded module messages.
---

# Warning codes

datagrids reports mistakes with a code in the message, `[datagrids DG0xx] …`. Each code has its own
page (`/errors/DG008`); this page lists them all.

| Kind | How it surfaces | Codes |
|---|---|---|
| Console warning | `console.warn`, printed **once per distinct message** | DG001, DG002, DG003, DG004, DG006, DG011, DG012, DG013, DG014, DG015 |
| Thrown error | `throw new Error(message)` — wiring mistakes never half-work | DG005, DG007, DG008, DG009, DG010 |

Warnings are on by default. `configure({ warnings: false })` silences every coded warning (and the
module messages below that respect it); thrown errors are never silenced.

```js
import { configure } from "@akinozgen17/datagrids";

configure({ warnings: import.meta.env.DEV }); // keep them in development only
```

## DG001

**Unknown grid option** · console warning

```text
[datagrids DG001] Unknown option `{name}`.{hint}
```

**When:** the options object passed to `new Datagrid()` has a key that is not a grid option. The key
is ignored. The message adds a hint: for a well-known legacy option name (compared
case-insensitively) it names the replacement; for anything within two typing edits of a real option
it suggests that option (`pagesize` → ``Did you mean `pageSize`?``).

**Fix:** rename or remove the key. The [grid options](/reference/options) are the only accepted keys;
every other capability is a column option or a [module](/modules/) in `use: [...]`.

| Key you passed | Hint printed |
|---|---|
| `serverSide` | Server mode is a module: use `serverSide({ url, protocol: yajra() })`. |
| `ajax` | Use the `serverSide({ url, … })` module. |
| `dom` | Use toolbar slots (`start`, `end`, `filters`). |
| `buttons` | Attach button modules (`button.reload()`, `excel()`…). |
| `language` | Use `messages`. |
| `stateSave` | Use the `stateSave()` module. |
| `lengthMenu` | Use `pageSizes`. |
| `pageLength` | Use `pageSize`. |
| `order` | Use `sort: [['key', 'desc']]`. |
| `deferLoading` | Use `load: 'manual'`. |
| `columnDefs` | Put options on the column definitions. |

The [migration guide](/migration/from-datatables) maps every legacy option.

## DG002

**Grid has no accessible name** · console warning

```text
[datagrids DG002] Grid has no accessible name; pass `label` or `labelledBy`.
```

**When:** the grid was created without `label`, `labelledBy` or `title`, and the table has no
`<caption>`. Assistive technology then announces the scroll region with the generic
`messages.regionLabel` ("Data table"), the same name for every grid on the page.

**Fix:** name every grid after what it lists: `new Datagrid("#agents", { label: "Field agents", columns })`.
Or point at a visible heading with `labelledBy: "agents-heading"`, or keep a `<caption>`. `title`
names the grid only together with `surface: "card"`; `label` works everywhere.

## DG003

**Rows have no key** · console warning

```text
[datagrids DG003] No row key found (rowKey/id/DT_RowId); falling back to index. Selection and focus keeping are disabled.
```

**When:** a row has no key: `rowKey` is not set and the row has neither `id` nor `DT_RowId`, or the
`rowKey` path or function returned `null` or `""`. The grid falls back to the row's position
(`__i0`, `__i1`, …).

**Fix:** tell the grid which field identifies a row — a path (`rowKey: "uuid"`) or a function
(``rowKey: (row) => `${row.unit}-${row.ref}` ``). Position keys change whenever the data changes, so
selection, `refreshRow(key)`, `removeRow(key)`, row actions and focus restoration cannot follow a row
across pages or reloads.

## DG004

**Unknown column key** · console warning

```text
[datagrids DG004] Unknown column key `{name}`.
```

**When:** reserved for calls that name a column key the grid does not have. **The current version
does not print DG004**: `setColumnVisible()` and `columnOrder()` ignore unknown keys silently, and
the footer module prints its own message (see [below](#other-console-messages)).

**Fix:** check the key against `grid.columns().map((c) => c.key)`. A column with `can: false` does
not exist at all, so its key is unknown too.

## DG005

**Selector must match exactly one table** · thrown error

```text
[datagrids DG005] `{name}` needs a selector that matches exactly one <table>; matched {count}.
```

**When:** `new Datagrid(selector)` or `grid.remount(selector)` got a CSS selector that matched no
element, more than one element, or a single element that is not a `<table>` (reported as
"matched 0"). Thrown synchronously by the constructor.

**Fix:** use a unique selector (`"#agents"`) or pass the `HTMLTableElement` itself, and create the
grid after the table is in the document (for example after a tab or modal has rendered its
content). `Datagrid.get()` and `get()` never throw; they return `null`.

## DG006

**No grid with that name** · console warning

```text
[datagrids DG006] Datagrids.reload(`{name}`): no grid with that name.
```

**When:** `reload(name)` found no live grid registered under `name`; it returns `false` and does
nothing. A grid registers its `name` option when it is created and unregisters on `destroy()`.

**Fix:** give the grid a `name` (`{ name: "agents", … }`) and make sure it exists when you reload
it. Use `find(name)` to check for a grid without a warning.

## DG007

**Required module is missing** · thrown error

```text
[datagrids DG007] Module `{name}` requires `{dep}`, which is not attached.
```

**When:** a module declares `requires: ["…"]` and no module with that name is attached. The check
runs after all modules from the constructor's `use` are attached (thrown by the constructor) and,
for `grid.use()`, in a microtask afterwards (an uncaught error in the console). Built-in case:
`button.resetState()` requires `state`, the module name of `stateSave()`.

**Fix:** attach the dependency in the same `use` array; the order inside the array does not matter:
`use: [stateSave(), button.resetState()]`.

## DG008

**Two modules claim one slot** · thrown error

```text
[datagrids DG008] Two modules claim the single `{slot}` slot (`{a}` and `{b}`).
```

**When:** two modules claim the `source` slot, the only single slot. Every data source occupies it:
`serverSide`, `arraySource`, `domSource`, `fetchAll`, `customSource`. Thrown when `use` contains two
sources, or when a source is attached with `grid.use()` after construction: by then the grid has
already picked its default source (array, DOM or empty). `{a}` is the source in place, `{b}` the one
being attached.

**Fix:** attach exactly one source, in `use: [...]` at construction:

```js
new Datagrid("#agents", {
  label: "Agents",
  columns,
  use: [serverSide({ url: "/api/agents", protocol: yajra() })],
});
```

To switch sources, `destroy()` the grid and create a new one. Note that `data: [...]` is ignored,
without an error, when `use` already contains a source.

## DG009

**Module attached twice** · thrown error

```text
[datagrids DG009] Module `{name}` is attached twice.
```

**When:** a module name is attached a second time: the same factory twice (`colVis()` in a preset
and again on the page) or two modules with the same `name`, such as two
`button.custom({ name: "approve", … })`.

**Fix:** attach each module once per grid. When a [preset](/reference/static#preset) already
contains a module, don't repeat it; give custom buttons distinct names, or leave `name` out to get an
automatic one.

## DG010

**Module name collides with a grid member** · thrown error

```text
[datagrids DG010] Module name `{name}` collides with a core grid member.
```

**When:** a module's `name` is a core grid member (`reload`, `columns`, `search`, `status`, …) or
another property the grid instance already has. A module's API is installed on the grid under its
name, so the name must be free. Data source modules are exempt.

**Fix:** rename the module, for example `name: "reloadButton"` instead of `"reload"`. The built-in
modules already use free names (`state`, `colVis`, `selection`, …). See
[Writing a module](/reference/modules).

## DG011

**Document has no language** · console warning

```text
[datagrids DG011] <html lang> is missing; uppercase headers may render Turkish i wrong (TARIH).
```

**When:** the page's `<html>` element has no `lang` attribute while the grid uses uppercase headers
(the default `head: "caps"`). Uppercasing in CSS depends on the language: in Turkish `i` becomes
`İ`, elsewhere `I`, so a header can come out wrong. Without `lang`, and without a `locale` option or
`configure({ locale })`, the grid also takes the browser's language (English when that is unusable).

**Fix:** declare the page language: `<html lang="en">`. Or switch to sentence-case headers with
`head: "sentence"`. Set `locale` when a grid's language differs from the page's.

## DG012

**Server error details** · console warning

```text
[datagrids DG012] Server error: {detail}
```

**When:** a load failed and the error carries a `detail` the grid keeps out of the visible message:
the exception message of an HTTP error response (JSON `message` / `error`, or up to 500 characters
of a text body), the `error` string of an HTTP 200 SSP response (debug output), or the browser's
message for a network failure. The grid shows a generic message; the detail goes to the console.

**Fix:** fix the server-side problem the detail describes. While `warnings` is on (the default) the
error state also shows the detail in a "Details" disclosure. In production turn both off with
`configure({ warnings: false })`. The full error object is on the `error` event:
`grid.on("error", ({ error }) => report(error.kind, error.status, error.detail))`. See
[States & errors](/guide/states-and-errors).

## DG013

**Page size above maxPageSize** · console warning

```text
[datagrids DG013] Page size {size} exceeds maxPageSize {max}; clamped.
```

**When:** `grid.pageSize(n)` (also used by the page-size menu) got a value above `maxPageSize`
(default 1000) or a negative value; the size is clamped to `maxPageSize`. `-1` ("All") is accepted
only when the protocol allows it (`ssp({ allowAll: true })`). The initial `pageSize` option is not
checked.

**Fix:** keep `pageSizes` within `maxPageSize`, or raise the limit for this grid with
`maxPageSize: 5000`. For lists that must show everything, prefer client mode (`fetchAll`) and a
server-side export.

## DG014

**Grid state could not be saved** · console warning

```text
[datagrids DG014] Could not write grid state to storage ({reason}).
```

**When:** reserved for state storage write failures (blocked storage, a full quota, some private
browsing modes). **The current version prints an uncoded message instead**:
`[datagrids] stateSave: storage is not writable (…); state is not persisted.`, once per page.

**Fix:** nothing breaks: the grid works, the view is just not remembered. Pass another `Storage`
(`stateSave({ storage: sessionStorage })`) or `storage: null` to turn persistence off deliberately.

## DG015

**Invalid locale** · console warning

```text
[datagrids DG015] `{tag}` is not a valid locale; it is ignored.
```

**When:** the `locale` option, `configure({ locale })` or `<html lang>` holds a value the `Intl` APIs
reject (`<html lang="1">`, `locale: "tr_TR"`). Number and date formatting would throw on it, so the
grid skips it and takes the next candidate: the browser's language, then `"en"`.

**Fix:** use a BCP 47 tag (`tr`, `tr-TR`, `en-GB`). When the value comes from user settings,
validate it on the server before writing it into the page.

## Other console messages

Modules print a few messages without a code. All start with `[datagrids]`.

| Message | When | Fix | Silenced by `warnings: false` |
|---|---|---|---|
| ``actions(): add `column.actions()` to the columns to place the action column.`` | [`actions()`](/modules/actions) is attached but the columns have no `column.actions()`. | Add `column.actions()` to `columns`. | no |
| ``selection(): add `column.select()` to the columns to place the checkbox column.`` | [`selection()`](/modules/selection) is attached without `column.select()`. | Add `column.select()` (usually first). | yes |
| `selection(): rows have no key (rowKey / id / DT_RowId); selections will not survive paging.` | Rows fall back to position keys (see [DG003](#dg003)). | Set `rowKey`. | yes |
| `filterPanel: no element for "<key>".` | A [`filterPanel`](/modules/filter-panel) field's selector matched nothing at setup. | Fix the selector, or create the grid after the form exists. | yes |
| `footer: unknown column "<key>".` | A [`footer`](/modules/footer) `cols` key is not a column of the grid (or has `can: false`). | Use an existing column key. | yes |
| `urlSync: URL keys "<ns>" are taken; using namespace "<name>".` | A second [`urlSync`](/modules/url-sync) on the page would reuse the same URL keys. | Give each grid its own `namespace`. | yes |
| `lazyColumns: the data source is not in server mode; every column is already loaded.` | [`lazyColumns()`](/modules/lazy-columns) is attached to a client-mode grid. | Remove it, or use a `serverSide` source. | yes |
| `stateSave: storage is not writable (<reason>); state is not persisted.` | Writing to storage threw (see [DG014](#dg014)). | Pass another `storage`, or `storage: null`. | yes |

Errors are logged with `console.error`, never swallowed silently:

| Logged | When |
|---|---|
| the listener's exception | An event listener added with `grid.on()` threw. The grid keeps running and the remaining listeners still run. |
| `[datagrids] export failed` + the error | An excel / csv / print export failed. The user also gets the export's failure message (`notify` adapter and live region). |
| the callback's exception | A custom footer aggregate, a `metaBind` value function or a module's state `save`/`load` threw; that one value is skipped. |

A few calls throw plain errors (no code) for invalid input:

| Error | When |
|---|---|
| `datagrids: method <M> is not allowed` | `grid.action(url, { method })` with a method other than GET, POST, PUT, PATCH, DELETE. |
| `datagrids: action URL must be same-origin` | `grid.action()` with a URL on another origin or a non-http(s) scheme. |
| `datagrids: next() called multiple times` | A request middleware called `next()` more than once. |
