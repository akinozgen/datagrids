---
title: filterPresets
type: module
description: Named filter presets as a chip group in the toolbar — one click sets several filter values in one load, and the active chip follows the filters.
since: 0.1.0
---

# filterPresets

A row of named chips — "Open", "Waiting", "R.P.D. open" — each setting several filter values at
once, in one load. The pressed chip always reflects the current filters, whoever changed them.

<Demo id="mod-filter-presets" />

## When to use it

Use it when a few filter combinations cover most visits ("my open items", "overdue this week").
The chips are a shortcut on top of the real filters, so people can still fine-tune with the
[filter panel](/modules/filter-panel) or [column filters](/modules/column-filters).

## Usage

With [filterPanel](/modules/filter-panel) attached, presets write the panel's controls (and the
controls follow); values are raw control values:

```js
import { Datagrid, serverSide, yajra, filterPanel, filterPresets } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    filterPanel({ fields: { unit: "#unit", status: "#status", mine: "#mine" } }),
    filterPresets({
      presets: [
        { id: "all", label: "All", values: {}, default: true },
        { id: "open", label: "Open", values: { status: "open" } },
        { id: "mine", label: "My open items", values: { status: "open", mine: true } },
      ],
    }),
  ],
});
```

- Applying a preset sets its values and **clears every other key** any preset uses — so "All"
  with `values: {}` resets them all.
- A checkbox takes `true` (checked) or nothing (unchecked); a multi-select takes an array.
- The **default** preset is applied at init only when nothing else (the URL via
  [urlSync](/modules/url-sync), saved state) has set those filters.
- After every load the chip whose values match the current filters is pressed; none is pressed
  when no preset matches.

Without filterPanel (or with `target: "grid"`), presets write `grid.filters()` directly — plain
values, arrays or typed `{ op, value }` filters:

```js
filterPresets({
  target: "grid",
  presets: [
    { id: "big", label: "Over 10,000", values: { amount: { op: "gt", value: 10000 } } },
    { id: "lost", label: "Cancelled", values: { status: ["cancelled"] } },
  ],
});
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `presets` | `FilterPreset[]` | — (required) | `{ id, label, values, default? }`. |
| `target` | `"panel" \| "grid"` | `"panel"` when filterPanel is attached, else `"grid"` | Where values are written. |
| `label` | `string \| false` | "Presets" | Visible group label; `false` hides it (the group keeps its accessible name). |
| `messages` | `{ label, applied(label) }` | locale (`en` / `tr`) | Group name and the announcement. |
| `slot` / `order` | | `"filters"` / `-20` | Toolbar position. |
| `can` | `boolean` | `true` | Permission flag: `false` → no chips. |

## API added to the grid

Available as `grid.filterPresets` (typed: `grid.module(filterPresets)`).

| Member | Returns | Description |
|---|---|---|
| `active()` | `string \| null` | Id of the preset the current filters match. |
| `apply(id, { reload? })` | `void` | Applies a preset; one load unless `reload: false`. |

## Events

None of its own. Applying a preset goes through the normal reload (`beforeLoad`, `load`).

## Accessibility

- The chips are a labelled `role="group"` of `<button aria-pressed>` with a permanent radio-style
  dot (a ring when off, filled when on) — the state never depends on hover or color alone.
- Applying a preset is announced: "Preset applied: Open".

## Replaces in DataTables

No direct equivalent in 1.10, 2.x or 3.x. It replaces hand-made "quick filter" buttons that set
form fields and called `table.ajax.reload()`. (SearchPanes is a different, facet-style feature.)

## Gotchas

- **No chip is pressed after I changed a select.** The filters no longer match any preset —
  that is the point; the chip comes back when they do.
- **The console says target "panel" needs the filterPanel module.** `target: "panel"` was set
  without filterPanel; the module falls back to `grid.filters()`.
- **The default preset didn't apply.** The URL or saved state already set those filters; they
  win over the default.
- **A preset value for a checkbox doesn't stick.** Use `true` for checked, leave the key out (or
  `null`) for unchecked.

## Related

- [filterPanel](/modules/filter-panel) · [urlSync](/modules/url-sync) · [stateSave](/modules/state-save)
