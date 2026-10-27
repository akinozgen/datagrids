---
title: multiSort
type: module
description: Sort by several columns — Shift+click (or Shift+Enter) adds a header as the next sort key, with its rank shown in the header.
since: 0.1.0
---

# multiSort

A plain click sorts by one column, as always. **Shift+click** (Shift+Enter on the focused header)
adds that column as the next sort key; doing it again flips its direction, a third time removes it.
The rank of every key shows in its header.

## Usage

```js
import { Datagrid, arraySource, multiSort } from "@akinozgen17/datagrids";

const grid = new Datagrid("#agents", {
  label: "Agents",
  columns,
  sort: [["unit", "asc"]],
  use: [arraySource(rows), multiSort({ max: 3 })],
});

grid.sort([["unit", "asc"], ["amount", "desc"]]); // the same from code
grid.multiSort.toggle("date"); // like a Shift+click
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `max` | `number` | `3` | Most keys at once; adding one more drops the oldest. |
| `messages` | `Partial<MultiSortMessages>` | locale | `hint` (header tooltip), `rank(n, dir)` (screen-reader text), `announce(cols)`. |
| `can` | `boolean` | `true` | Permission flag: `false` attaches nothing. |

## API added to the grid

`grid.multiSort.toggle(key)` adds, flips or removes a key exactly like a Shift+click.

## Wire

The classic wire (and yajra) carries every key as `order[0..n]`, [dgp](/protocol/v1/) as
`sort: [{ key, dir }, …]` (`sort=-date,name` with GET). Client mode sorts by all keys in order.

The [Laravel paginator](/protocol/laravel-paginator) sends **only the first key**
(`sort=-date`); the other keys show in the headers but don't reach the server.

## Accessibility

`aria-sort` stays on the primary column only (ARIA allows one). Secondary keys show their rank
and direction visually and in the sort button's accessible name ("…, sort key 2, descending");
every change is announced in the grid's live region.

## Related

- [Sorting in the guide](/guide/concepts)
- [stateSave](/modules/state-save) and [urlSync](/modules/url-sync) keep all keys.
