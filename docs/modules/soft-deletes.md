---
title: softDeletes
type: module
description: A "Show deleted" toolbar toggle that sends _deleted=1 to the server (or filters in the browser) and mutes deleted rows.
since: 0.1.0
---

# softDeletes

Adds a **Show deleted** toggle to the toolbar. While it is on, server requests carry `_deleted=1`
and deleted rows are shown muted; while it is off, they are hidden.

<Demo id="mod-soft-deletes" />

## When to use it

Use it on lists backed by soft-deleted records (Laravel's `SoftDeletes`) where admins sometimes
need to see — and restore — what was deleted. Skip it when deleted records have their own page.

## Usage

```js
import { Datagrid, serverSide, yajra, softDeletes } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns,
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }), softDeletes()],
});
```

The controller decides what `_deleted=1` means:

```php
$query = Agent::query()->when($request->boolean('_deleted'), fn ($q) => $q->withTrashed());
```

Start switched on when the page was opened with `?deleted=1`, and only for admins:

```js
softDeletes({
  initial: new URLSearchParams(location.search).has("deleted"),
  can: user.isAdmin,
});
```

On a client grid (array, DOM, fetchAll) the toggle filters in the browser: deleted rows are hidden
until it is switched on.

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `param` | `string` | `"_deleted"` | Request parameter sent while on (server grids). On client grids, the filter key. |
| `value` | `unknown` | `1` | Its value. |
| `field` | `string` | `deleted`, then `deleted_at` | Row field (dotted path allowed) that marks a deleted row; any truthy value counts. |
| `label` | `string` | "Show deleted" | Button text and accessible name. |
| `initial` | `boolean` | `false` | Start switched on. |
| `messages` | `{ label }` | locale (`en` / `tr`) | Translations. |
| `slot` | `"start" \| "end"` | `"end"` | Toolbar slot. |
| `order` | `number` | `-10` | Position inside the slot (before the record count). |
| `can` | `boolean` | `true` | Permission flag: `false` → no button, no parameter. |

## API added to the grid

Available as `grid.softDeletes` (typed: `grid.module(softDeletes)`).

| Member | Returns | Description |
|---|---|---|
| `active()` | `boolean` | `true` while deleted rows are shown. |
| `toggle(on?)` | `void` | Switches (or sets) the mode and reloads (server) or re-filters (client). |

## Events

None of its own. Toggling reloads a server grid (`beforeLoad`, `load`).

## Pipelines it plugs into

- **Request middleware**: adds `param=value` while on.
- **Filters** (client grids): a row predicate under the `param` key; functions never reach the
  wire.
- **Row mutator**: sets `data-tone="muted"` on deleted rows.
- **Toolbar**: `end` slot, order `-10`.

## Works with

- **Enhances** [actions](/modules/actions): show a "Restore" action only on deleted rows with
  `can: (row) => !!row.deleted_at`.
- **With [filterPanel](/modules/filter-panel)**: independent; both add their parameters.
- The toggle is not saved by [stateSave](/modules/state-save) or written by
  [urlSync](/modules/url-sync); use `initial` to restore it.

## Accessibility

The toggle is a real `<button aria-pressed>` with a permanent checkbox indicator, so its state is
visible without hovering and announced as "Show deleted, toggle button, pressed". The muted row
tone is visual only; add a visible "Deleted" column or badge (as in the demo) so the state does
not rely on color alone.

## Replaces in DataTables

No direct equivalent in 1.10, 2.x or 3.x. It replaces a hand-made toggle that set a flag read in
`ajax.data`, called `table.ajax.reload()`, and marked rows in `createdRow`.

## Gotchas

- **Deleted rows are not muted.** The rows have no `deleted` / `deleted_at` field; set `field`.
- **The toggle changes nothing on a server grid.** The endpoint must read `_deleted` (or your
  `param`).
- **On a client grid deleted rows are gone at first.** By design; pass `initial: true` to show
  them from the start.

## Related

- [actions](/modules/actions) · [filterPanel](/modules/filter-panel) · [Recipe: Laravel + yajra](/recipes/laravel-yajra)
