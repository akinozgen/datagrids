---
title: Destroy, re-init & Livewire
type: how-to
description: Tear a grid down to the original table, re-create it safely, initialize tables declaratively with upgrade() and presets, and coexist with Livewire morphing and Turbo navigation.
---

# Destroy, re-init & Livewire

**Goal:** pages that replace or re-render their markup — Livewire components, Turbo navigation,
fragments loaded with `fetch` — must be able to remove a grid without leaks, get the original
table back, and build the grid again without double initialization.

<Demo id="rcp-reinit" />

Press **destroy()**: the wrapper, toolbar and pager disappear and the table is exactly the markup
you see in the **HTML** tab (sorted back to its original row order). **Datagrid.get()** now returns
`null`. **upgrade()** builds the grid again from the table's attributes; pressing it twice creates
nothing the second time.

## Steps

### 1. `destroy()` gives the table back

```js
grid.destroy();
```

- The original `<table>` element is moved back to where it was, with its original classes,
  attributes, `<thead>`, `<tbody>` rows (the same `<tr>` nodes for a server-rendered table) and
  `<tfoot>`.
- The request in flight is aborted, observers and listeners are removed, every module cleans up
  after itself, and the `destroy` event fires.
- Calling it twice is harmless.

### 2. `Datagrid.get()` finds, never creates

```js
Datagrid.get("#agents");        // the grid, or null
Datagrid.get(someCellElement);  // any element inside the table works
find("agents");                 // by grid `name`
```

`get()` never initializes anything as a side effect, so `Datagrid.get(table)?.destroy()` is always
safe. The constructor is idempotent too: `new Datagrid(table, …)` on a table that already has a
grid returns **that** grid and ignores the new options. To change options, destroy first.

### 3. Re-create: `remount()` or destroy + new

```js
grid = grid.remount();            // destroy, then new Datagrid(sameTable, sameOptions)
grid = grid.remount(newTable);    // same options on a different <table> (the old node was replaced)
```

`remount()` returns the **new** instance: keep the returned reference. It also works on a grid you
already destroyed, so you can destroy before your markup changes and remount after.

`remount()` re-creates the grid from its constructor options plus every module attached later with
a chained `.use(…)` (module definitions are immutable, so they are reused as they are).

Saved view state ([stateSave](/modules/state-save)) lives in storage and comes back after a
re-init; in-memory state such as the current selection does not.

### 4. Declarative init: `upgrade()` + presets {#declarative-init-with-upgrade}

Register what a kind of list needs once, mark tables with `data-datagrid`, and call `upgrade()`:

```js
import { preset, upgrade, serverSide, yajra, colVis, stateSave, button } from "@akinozgen17/datagrids";

preset("agents", (table) => [
  serverSide({ url: table.dataset.url, protocol: yajra(), csrf: true }),
  colVis(),
  button.reload(),
  stateSave(),
]);

upgrade(); // every table[data-datagrid] in the document; pass a root element to limit the scan
```

```blade
<table data-datagrid="agents" data-url="{{ route('agents.data') }}"
       data-dg-name="agents" data-dg-label="Field agents" data-dg-sort="date:desc">
  <thead>
    <tr>
      <th data-dg-key="ref">Ref</th>
      <th data-dg-key="name">Name</th>
      <th data-dg-key="amount" data-dg-type="money">Amount</th>
      <th data-dg-key="date" data-dg-type="date">Date</th>
      <th data-dg-key="notes" data-dg-sortable="false" data-dg-visible="false">Notes</th>
    </tr>
  </thead>
</table>
```

`upgrade(root)` skips tables that already have a grid, so it is safe to call after every partial
page update. It returns the grids it created. The preset factory receives the table, so per-table
values (the URL above) come from its own attributes.

Only these grid options can be written as attributes — anything else belongs in the preset:

| Attribute on `<table>` | Option |
|---|---|
| `data-datagrid="agents"` | the preset to apply (its modules become `use`) |
| `data-dg-name` | `name` |
| `data-dg-label` | `label` |
| `data-dg-load` | `load` (`eager`, `visible`, `manual`) |
| `data-dg-page-size` | `pageSize` |
| `data-dg-sort="date:desc"` | `sort` (one column) |
| `data-dg-theme`, `data-dg-size`, `data-dg-density` | `theme`, `size`, `density` |

Columns come from the `<th>` attributes:

| Attribute on `<th>` | Meaning |
|---|---|
| `data-dg-key` | column key — always set it (the fallback is a slug of the header text, or `c0`, `c1`… for server tables) |
| `data-dg-type` | `text`, `number`, `money`, `date` or `html` |
| `data-dg-sortable="false"`, `data-dg-searchable="false"` | not sortable / not searchable |
| `data-dg-visible="false"` | hidden at start (the column menu can show it) |
| `data-dg-hideable="false"` | always visible |
| `data-dg-export="false"` | left out of exports |
| `data-dg-align` | `start`, `end`, `center` — tables whose rows are already in `<tbody>` |
| `data-dg-sort-key` | sort by another field — tables loaded from a server |

Cells are text by default; HTML is an explicit opt-in (`data-dg-type="html"`). Rows that are
already in a server-rendered `<tbody>` keep their own HTML — see
[Data sources → DOM](/guide/data-sources#dom-progressive-enhancement).

## Livewire

**Default: keep Livewire's hands off the grid.** The grid wraps your table in its own markup, which
Livewire's DOM morphing would try to "fix" on the next render. Put the table in a `wire:ignore`
wrapper and talk to the grid through events:

```blade
<div wire:ignore>
  <table id="agents" data-datagrid="agents" data-dg-name="agents" data-url="{{ route('agents.data') }}">
    …
  </table>
</div>
```

```php
// in the component, after something changed the list
$this->dispatch('agents-changed');
```

```js
import { reload } from "@akinozgen17/datagrids";

document.addEventListener("livewire:init", () => {
  Livewire.on("agents-changed", () => reload("agents", { keepPage: true }));
});
```

**When the component must re-render the table itself** (its columns depend on component state),
destroy the grid before the morph and remount it afterwards. Illustrative — check the hook names
and payloads against your Livewire version:

```blade
<div id="agents-wrap">
  <table id="agents">{{-- columns rendered from component state --}}</table>
</div>
```

```js
import { Datagrid } from "@akinozgen17/datagrids";

let grid = new Datagrid("#agents", { label: "Field agents", use: [/* every module here */] });

document.addEventListener("livewire:init", () => {
  Livewire.hook("morph.updating", ({ el }) => {
    if (el.id === "agents-wrap") grid.destroy(); // Livewire now sees the plain table
  });
  Livewire.hook("morph.updated", ({ el }) => {
    if (el.id === "agents-wrap") grid = grid.remount(el.querySelector("table"));
  });
});
```

## Turbo and other SPA navigation

Destroy before the page is cached and upgrade after each visit, so a cached snapshot holds plain
tables instead of a dead grid:

```js
document.addEventListener("turbo:before-cache", () => {
  document.querySelectorAll("table[data-datagrid]").forEach((t) => Datagrid.get(t)?.destroy());
});
document.addEventListener("turbo:load", () => upgrade());
```

In component frameworks, create the grid when the component mounts and call `destroy()` in its
unmount hook (`onBeforeUnmount`, an effect cleanup, `disconnectedCallback`).

## Related

- [Lifecycle](/guide/lifecycle)
- [Static API & configure()](/reference/static) — `get`, `find`, `reload`, `preset`, `upgrade`
- [Grids in tabs & modals](/recipes/tabs-and-modals)
