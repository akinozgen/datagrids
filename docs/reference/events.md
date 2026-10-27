---
title: Events
type: reference
description: Every grid event with its payload, whether it can be cancelled and exactly when it fires, plus the dg:* DOM events and delegate().
---

# Events

```js
const off = grid.on("load", ({ result }) => console.log(result.total));
grid.on("beforeSort", (e) => { if (busy) e.cancel(); });
off(); // unsubscribe
```

- `grid.on(name, fn)` returns an unsubscribe function. Listeners are removed on `destroy()`.
- Events whose name starts with `before` are **cancelable**: call `e.cancel()` in a listener.
- A listener that throws is logged with `console.error`; the grid and the other listeners carry on.
- Use events to react. To change what is requested or rendered, use a
  [pipeline](/guide/concepts#pipelines) (request middleware, row mutator) instead.

## Core events

| Event | Payload | Cancelable | Fires when |
|---|---|---|---|
| `init` | `{ grid }` | — | Once, in a microtask after the constructor returns (an eager grid has already started its first load). |
| `beforeLoad` | `{ query, cancel() }` | yes | Before every `load()`: the first load, `reload()`, `search()`, `sort()`, `page()`, `pageSize()` and server-side filter changes. Cancelling leaves everything as it is. |
| `loadingchange` | `{ loading }` | — | On every status change: `true` when a load starts, `false` when the grid becomes ready, empty, idle or errored. The value can repeat (client-side recomputes report `false` only). |
| `render` | `{ keys, rows }` | — | After the body was rendered with new data: every successful load and every client-side recompute. `keys` and `rows` are the rendered view (empty arrays for an empty result). Not fired for the loading and error states. |
| `response` | `{ raw, result }` | — | After the data source answered, right before `load`. `raw` is the parsed response body (extra server keys such as `summary` live here); `undefined` for array and DOM sources. Not fired for client-side recomputes. |
| `load` | `{ result, query }` | — | After data arrived and was rendered. In client mode also after every local recompute: search, sort, page, filters, `setData()`, `addRows()`, `removeRow()`. `result` is `{ rows, total, filtered, hasMore?, meta?, raw?, error? }`. |
| `error` | `{ error }` | — | A load failed (in every `errorMode`), or the server returned rows together with an error message. `error` is `{ kind, status, message, detail?, retryable, raw? }`. Aborted requests are not errors. |
| `sessionexpired` | `{ error }` | — | A load, a server-side export or `grid.action()` got 401 or 419, or was redirected to a login page. The `onSessionExpired` host adapter is called too. |
| `beforeSort` | `{ sort, cancel() }` | yes | Before a sort change (header click or `sort()`). |
| `sort` | `{ sort }` | — | After the sort changed, before the data loads. |
| `beforePage` | `{ page, cancel() }` | yes | Before a page change (pager or `page(n)`). Not fired when search, sort or filters reset to page 1. |
| `page` | `{ page }` | — | After the page changed, before the data loads. |
| `pagesize` | `{ pageSize }` | — | After the page size changed (menu or `pageSize(n)`). |
| `search` | `{ search }` | — | After the search text changed (debounced typing, Enter, Escape, clear button or `search()`). |
| `columnchange` | `{ columns }` | — | After `setColumns()`, `setColumnVisible()` or a display-order change (`columnOrder()`, column menu, drag). `columns` is in display order. |
| `headrender` | `{ tr }` | — | After the header row was built: at construction, on `setColumns()`, `columnOrder()` and `use()`. Modules decorate header cells here. |
| `destroy` | `{}` | — | During `destroy()`, after the modules were torn down and before the table is restored. |

## Module events

| Event | Module | Payload | Cancelable | Fires when |
|---|---|---|---|---|
| `selectionchange` | [selection](/modules/selection) | `{ count, keys, all }` | — | After the selection changed (checkbox, page checkbox, "select all matching", API calls, clearing on a query change). `all` is `true` while every matching row is selected. |
| `beforeAction` | [actions](/modules/actions) | `{ id, key, row, cancel() }` | yes | A row action was chosen, before its confirm dialog. |
| `action` | [actions](/modules/actions) | `{ id, key, row }` | — | The action's request or handler finished without an error (not for `href` actions, which navigate). |
| `actionerror` | [actions](/modules/actions) | `{ id, key, row, error }` | — | The action's request or handler threw. Request errors were already shown through `notify`. |
| `beforeReorder` | [rowReorder](/modules/row-reorder) | `{ row, key, from, to, offset, prevKey, nextKey, rows, cancel() }` | yes | A row was dropped (drag or keyboard), before `onEnd` runs. Cancelling puts the row back. |
| `reorder` | [rowReorder](/modules/row-reorder) | `{ row, key, from, to, offset, prevKey, nextKey, rows }` | — | `onEnd` resolved; the new order stays. `from` / `to` are page-local; `offset + index` is the absolute position. |
| `reordererror` | [rowReorder](/modules/row-reorder) | the same + `error` | — | `onEnd` rejected; the row went back to its place. |
| `collapse` | [responsive](/modules/responsive) | `{ columns }` | — | The set of collapsed columns changed (after a resize or a column change). `columns` are their keys. |
| `window` | core | `{}` | — | Virtual mode only: a new window of rows was drawn while scrolling (rows are re-inserted, so focus inside them is lost). |
| `beforePrint` | [print](/modules/export) | `{ document, window, cancel() }` | yes | The print document is ready in a hidden frame, before the browser's print dialog. Decorate `document`, or cancel to skip the dialog. |

## Order of a load

An eager client grid:

```text
beforeLoad → loadingchange(true) → init → loadingchange(false) → render → response → load
```

A later server load (`reload()`, a sort, a page change):

```text
beforeSort → sort → beforeLoad → loadingchange(true) → … request … → loadingchange(false) → render → response → load
```

On failure the tail is `error` → (`sessionexpired` for 401/419) → `loadingchange(false)` instead of
`loadingchange(false) → render → response → load`.

## DOM events

Every event is also dispatched on `grid.root` as a `CustomEvent` named `dg:<event>` whose `detail`
is the payload, after the `on()` listeners ran:

```js
grid.root.addEventListener("dg:selectionchange", (e) => {
  bulkBar.hidden = e.detail.count === 0;
});
```

The DOM events do **not bubble**. To listen higher up the tree (for grids created later), use the
capture phase:

```js
document.addEventListener("dg:load", (e) => console.log(e.target, e.detail.result), true);
```

To cancel a `before…` event from a DOM listener, call `e.detail.cancel()`; `preventDefault()` has
no effect.

## delegate()

```ts
grid.delegate(type: string, selector: string, fn: (event, ctx: RowContext) => void): () => void
```

Listens for DOM events on the grid root and calls `fn` only when the target matches `selector`
inside one of this grid's rows. Rows are re-rendered freely, so attach row behaviour here instead of
binding listeners to cells.

| `ctx` field | Type | Description |
|---|---|---|
| `row` | `Row` | The row's data object. |
| `key` | `string` | The row key. |
| `tr` | `HTMLTableRowElement` | The row element. |
| `td` | `HTMLTableCellElement \| null` | The cell the event happened in. |
| `column` | `ResolvedColumn \| null` | That cell's column. |

```js
grid.delegate("click", ".open-agent", (e, { row }) => openAgent(row.id));
```

Returns the remover. Events from the toolbar, header and footer don't reach `fn`.

## Related

- [Instance methods](/reference/methods) · [Writing a module](/reference/modules)
- [Concepts: events or pipelines?](/guide/concepts#events-or-pipelines)
