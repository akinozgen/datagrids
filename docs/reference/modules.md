---
title: Writing a module
type: reference
description: The ModuleDef shape, every ModuleContext member, the request middleware model and the wiring errors, with a complete toolbar module and request middleware example.
---

# Writing a module

A module is an immutable definition object with a `setup(ctx)` function. The grid calls `setup` once
per grid with a context that lets the module contribute to the grid's
[pipelines](/guide/concepts#pipelines): toolbar slots, row mutators, request middleware, saved state.
The built-in modules use exactly this API.

<Demo id="ref-module" />

Open the **Request** tab: every request carries `client: "docs"`, added by the `clientTag`
middleware (the `X-Client` header travels too).

## Rules

- **A factory returns a frozen definition.** Options live in the factory's closure; `setup` runs per
  grid, so one definition can be shared by several grids.
- **Everything a module adds, it removes** in `destroy()`. Use `ctx.signal` for DOM listeners and
  the functions returned by `ctx.on()`.
- **The API is installed on the grid under `name`** (`grid.rowBadge.el`). Pick a name that is not a
  grid member ([DG010](/errors/DG010)) and set `factory.moduleName = name` so
  `grid.module(factory)` keeps working after your bundler renames functions.
- **Don't patch the grid.** Contribute through the context; react through events.

## ModuleDef

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Unique per grid ([DG009](/errors/DG009)); also the property the API is installed under. |
| `kind` | `"source" \| "feature" \| "toolbar" \| "export"` | `"source"` marks a data source module (it must carry `source`). The other kinds describe the module; they don't change how it is wired. |
| `slot` | `string` | Single-slot claim. `"source"` is the only single slot today: a second claimant throws [DG008](/errors/DG008). |
| `requires` | `string[]` | Names of modules that must be attached too, e.g. `["state"]` ([DG007](/errors/DG007)). |
| `enforce` | `"pre" \| "post"` | Default position for this module's request middleware. |
| `can` | `boolean` | Permission flag. `false` attaches the module without calling `setup`; its API is a no-op stand-in. |
| `source` | `DataSource` | Data source modules only: `{ mode, cells?, load(query, ctx), … }`. Wrap one with `sourceModule()` or `customSource()`. |
| `setup(ctx)` | `(ctx) => { api?, destroy? } \| void` | Called when the module is attached. Return the API object and a teardown function. |

TypeScript: `ModuleDef<"rowBadge", { el: HTMLElement }>` types `grid.module(rowBadge)`.

## When setup runs

Modules in `use: [...]` are set up inside the constructor, **before** the columns are resolved and
the header is built. So in `setup`:

- `ctx.grid.columns()` is still empty: read columns in `ctx.ready(fn)`.
- The header doesn't exist yet: decorate header cells in a `headrender` listener (it fires on every
  header rebuild).
- `ctx.toolbar()`, `ctx.row()`, `ctx.request()`, `ctx.state()` and `ctx.on()` can all be called.

Modules attached later with `grid.use()` are set up immediately; their `ready` callbacks run at once.

## ModuleContext

| Member | Type | Description |
|---|---|---|
| `grid` | `DatagridApi` | The grid ([instance methods](/reference/methods)). |
| `root` | `HTMLElement` | The `.dg` wrapper. |
| `table` | `HTMLTableElement` | The host table. |
| `messages` | `Messages` | The grid's merged UI strings. Modules keep their own strings in a `messages` option. |
| `host` | `HostAdapters` | Resolved host adapters (`confirm`, `notify`, `csrf`, `laravel`, `timeout`, `onSessionExpired`, `fetch`, `isError`). |
| `locale` | `string` | The grid's locale (`ctx.locale.startsWith("tr")` picks a language pack). |
| `signal` | `AbortSignal` | Aborted when the grid is destroyed: `el.addEventListener("click", fn, { signal: ctx.signal })`. |
| `on(type, fn)` | `() => void` | `grid.on`; returns the unsubscribe function. |
| `toolbar({ slot, order?, el })` | `void` | Places `el` in the toolbar slot `"start"`, `"end"` or `"filters"`, sorted by `order` (default `0`; equal orders keep registration order). |
| `row(fn)` | `void` | Row mutator `fn(tr, row, key)`: runs after a row is built and again when a kept row is re-rendered, so make it idempotent. |
| `request(mw, enforce?)` | `void` | Adds request middleware, see [below](#request-middleware). |
| `state({ key, save, load, part? })` | `void` | State contribution: `save()` returns a JSON-safe value, `load(value)` restores it. [stateSave](/modules/state-save) stores it under `key`. With `part: "filters" \| "search" \| "page"` it belongs to that opt-in part and is saved only when stateSave's `include` lists it. |
| `above(el)` | `void` | Mounts `el` between the toolbar and the table (bulk bars, banners). |
| `layer(el)` | `void` | Mounts `el` inside the root, for panels and dialogs (popovers render in the top layer). |
| `announce(message)` | `void` | Polite live-region announcement. |
| `requestRender()` | `void` | Re-renders the body from the current rows without loading. |
| `ready(fn)` | `void` | Runs `fn` once the columns are resolved, before the first load (restore state here; it won't trigger extra requests). |

Built-in toolbar orders, to place your item between them:

| Slot | Order | Item |
|---|---|---|
| `start` | `0` | search box |
| `start` | `10` | column menu (`colVis`) |
| `start` | `20` | reload button |
| `start` | `30` | reset button |
| `start` | `40` | export menu (`excel`, `csv`, `print`) |
| `start` | `50` / `60` | `button.custom()` / `button.group()` |
| `end` | `-20` | auto-refresh toggle (`autoRefresh`) |
| `end` | `-10` | soft-deletes toggle |
| `end` | `0` | record count (`count: true`) |
| `filters` | `-20` | filter preset chips (`filterPresets`) |
| `filters` | `100` | active column filter chips |

## Request middleware

```ts
type RequestMiddleware = (req: WireRequest, next: (req: WireRequest) => Promise<Response>) => Promise<Response>;
```

Each server request passes through a chain of middleware before the protocol encodes it. A
middleware changes the neutral request and calls `next(req)` **once** (twice throws), or returns a
`Response` itself to short-circuit (cache, mock).

| `WireRequest` field | Type | Description |
|---|---|---|
| `url` | `string` | Endpoint. |
| `method` | `string` | `GET` or `POST`. |
| `headers` | `Record<string, string>` | Request headers. |
| `query` | `Query` | The neutral query (page, sort, search, filters, columns). Read it; change state through the grid. |
| `params` | `Record<string, unknown>` | Extra parameters the protocol adds to the wire (form fields, JSON `params`, query string). |

Order, fixed and without numeric priorities:

1. built-ins: `X-Requested-With` (`laravel`), then CSRF (`csrf`)
2. middleware registered with `"pre"`
3. middleware without `enforce`, in registration order
4. middleware registered with `"post"`
5. protocol `encode` → `fetch`

`enforce` comes from the `ctx.request(mw, enforce)` argument, else from the definition's `enforce`.
Middleware runs for `serverSide` sources (including the one-off request of `exportRows("all")`);
`fetchAll` and array sources don't run it.

```js
ctx.request(async (req, next) => {
  req.headers["X-Tenant"] = tenant.id;
  const res = await next(req);
  if (res.status === 409) ctx.grid.notify("info", "The list changed, reloading…");
  return res;
}, "post");
```

## Wiring errors

Wiring mistakes throw instead of half-working:

| Code | Thrown when |
|---|---|
| [DG007](/errors/DG007) | A name in `requires` is not attached (checked after the constructor's `use`, or in a microtask after `grid.use()`). |
| [DG008](/errors/DG008) | A second module claims the `source` slot after a source was given explicitly (in `use` or with `data`), also through `grid.use()`. Without one, a chained `.use(serverSide(…))` replaces the default source (the table's rows or an empty array) instead of throwing. |
| [DG009](/errors/DG009) | The same module name is attached twice. |
| [DG010](/errors/DG010) | `name` is a core grid member (`reload`, `columns`, `status`, …) or another existing grid property. |

## A data source module

A data source is a module with `kind: "source"` and a `source`. `customSource()` builds one:

```js
import { customSource } from "@akinozgen17/datagrids";

const fromIndexedDb = customSource({
  mode: "client",
  async load(query, ctx) {
    const rows = await db.getAll("agents");
    return { rows, total: rows.length, filtered: rows.length };
  },
});
```

`mode: "server"` sources receive the full `query` and return one page; they get the middleware
chain as `ctx.middlewares`. See [Data sources](/guide/data-sources#custom-sources).

## Related

- [Concepts](/guide/concepts) · [Events](/reference/events) · [Instance methods](/reference/methods)
- [Recipe: custom toolbar](/recipes/custom-toolbar)
