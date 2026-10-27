---
title: Toolbar buttons
type: module
description: Ready-made toolbar buttons — reload and reset view — plus your own buttons and dropdowns, each attached as a module.
since: 0.1.0
---

# Toolbar buttons

The `button` namespace holds small toolbar modules: **reload**, **reset view**, and factories for
your own buttons and dropdowns.

<Demo id="mod-buttons" />

`button.custom()` and `button.group()` add your own actions to the same toolbar:

<Demo id="mod-buttons-custom" />

## When to use it

Use `button.reload()` on lists whose data changes while the page is open, `button.resetState()`
next to [stateSave](/modules/state-save) so people can undo their customizations, and
`button.custom()` / `button.group()` for page actions that belong to the list ("New agent",
"Import…"). Row-level actions belong in [actions](/modules/actions), multi-row actions in the
[selection](/modules/selection) bulk bar.

## Usage

### `button.reload`

```js
import { Datagrid, button } from "@akinozgen17/datagrids";

new Datagrid("#agents", { label: "Field agents", columns, use: [source, button.reload()] });
```

An icon-only button that reloads and **keeps the current page**; the icon spins while the grid
loads. With `silent: true` the reload skips the busy card, for lists that refresh often:

```js
button.reload({ silent: true });
```

### `button.resetState`

```js
use: [source, stateSave(), colVis(), button.resetState()];
```

Clears the stored state and restores the initial view — columns, sort, page size — with a single
reload, without reloading the page. It **requires** [stateSave](/modules/state-save): without it
the grid throws [DG007](/errors/DG007).

### `button.custom`

```js
button.custom({
  name: "newButton",
  label: "New agent",
  icon: "edit",
  variant: "primary",
  onClick: (grid) => openAgentForm({ onSaved: () => grid.reload({ keepPage: true }) }),
});
```

Enable or disable it from the last response — re-evaluated after every load:

```js
button.custom({
  name: "payButton",
  label: "Pay all",
  disabled: (raw) => !raw?.summary?.payable,
  onClick: (grid) => grid.action("/agents/pay", { confirm: "Pay every open item?" }),
});
```

`disabled` is not called before the first server response — the button stays enabled until then —
and never on array or DOM grids, which have no response (`grid.lastResponse()` is `null`).

`onClick` may return a promise; the button is `aria-busy` until it settles.

### `button.group`

```js
button.group({
  name: "moreButton",
  label: "More",
  icon: "more",
  items: [
    { id: "import", label: "Import…", onClick: (grid) => openImport(grid) },
    { id: "archive", label: "Archive old records", can: user.isAdmin, onClick: archiveOld },
  ],
});
```

## Options

### Reload

| Option | Type | Default | Description |
|---|---|---|---|
| `silent` | `boolean` | `false` | Reload without the busy card. |
| `label` | `string` | "Reload" | Accessible name and tooltip (the button shows only the icon). |
| `messages` | `{ reload, resetState, resetStateTitle }` | locale (`en` / `tr`) | Translations. |
| `slot` | `"start" \| "end"` | `"start"` | Toolbar slot. |
| `order` | `number` | `20` | Position inside the slot. |
| `can` | `boolean` | `true` | Permission flag. |

### Reset

| Option | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | "Reset" | Visible text and accessible name. The tooltip reads "Reset the view to its defaults". |
| `messages` | `{ reload, resetState, resetStateTitle }` | locale (`en` / `tr`) | Translations. |
| `slot` | `"start" \| "end"` | `"start"` | Toolbar slot. |
| `order` | `number` | `30` | Position inside the slot. |
| `can` | `boolean` | `true` | Permission flag. |

### Custom

| Option | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | — (required) | Text and accessible name. |
| `onClick` | `(grid) => unknown` | — (required) | Runs on click; a returned promise keeps the button busy. |
| `name` | `string` | `button1`, `button2`, … | Module name and API key (`grid[name]`); unique per grid. |
| `icon` | icon name | none | Built-in icon (`edit`, `download`, `send`, `copy`, `trash`, …). |
| `iconOnly` | `boolean` | `false` | Hide the text (it stays the accessible name). |
| `variant` | `"primary" \| "ghost"` | default style | Visual weight. |
| `disabled` | `(raw) => boolean` | none | Disabled state from the last response, re-evaluated after each load; not called while there is no response (enabled until the first one; array / DOM grids). |
| `slot` / `order` | | `"start"` / `50` | Toolbar position. |
| `can` | `boolean` | `true` | Permission flag. |

### Group

| Option | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | — (required) | Menu button text and the menu's name. |
| `items` | `Array<{ id, label, icon?, can?, onClick(grid) }>` | — (required) | Menu items; `can: false` removes one. |
| `name` | `string` | `buttonGroup1`, … | Module name and API key. |
| `icon` | icon name | none | Icon before the label. |
| `slot` / `order` | | `"start"` / `60` | Toolbar position. |
| `can` | `boolean` | `true` | Permission flag. |

## API added to the grid

| Member | Returns | Description |
|---|---|---|
| `grid.reloadButton.el` | `HTMLButtonElement` | The reload button. |
| `grid.resetStateButton.el` | `HTMLButtonElement` | The reset button. |
| `grid[name].el` | `HTMLButtonElement` | A custom button or a group's menu button (give it a `name` to know the key). |

## Events

None of their own. Reload and reset trigger the grid's `beforeLoad` / `load`; the reload icon
follows `loadingchange`.

## Pipelines it plugs into

- **Toolbar**: `start` slot by default — reload `20`, reset `30`, custom `50`, group `60` (after
  colVis `10` and before / around the Export menu `40`). See
  [toolbar order](/modules/#toolbar-order).
- **Response** (custom): `disabled(raw)` runs after every load.

## Works with

- `button.resetState()` **requires** [stateSave](/modules/state-save) and also resets what other
  modules saved (for example the column order from [colReorder](/modules/col-reorder)).
- `button.reload()` pairs with the [error state](/guide/states-and-errors): the "Retry" button in
  the table does the same.

## Accessibility

- All of them are native `<button>`s. The icon-only reload button has an accessible name and a
  tooltip ("Reload"); the reset button keeps its name when a narrow grid hides button text.
- While a reload runs, the reload button carries `data-loading` and its icon spins (a slow pulse
  instead with `prefers-reduced-motion`); the table itself is `aria-busy`.
- `button.group()` follows the APG menu-button pattern: `↓` / `↑` open on the first / last item,
  arrows move, `Esc` closes, `Tab` leaves the menu.

## Replaces in DataTables

| DataTables (Buttons, 1.10 / 2.x / 3.x) | datagrids |
|---|---|
| `{ text: "Reload", action: (e, dt) => dt.ajax.reload(null, false) }` | `button.reload()` |
| `dt.state.clear(); location.reload()` in a button | `button.resetState()` |
| `buttons: [{ text, action }]` | `button.custom({ label, onClick })` |
| `dt.button(i).enable()` / `.disable()` after `xhr.dt` | `disabled: (raw) => …` |
| `{ extend: "collection", buttons: [...] }` | `button.group({ items })` |

## Gotchas

- **`Module resetStateButton requires state` (DG007).** Add `stateSave()` to `use`.
- **`grid.button1` is undefined.** Automatic names count across all grids on the page; pass
  `name` and use that key.
- **`Module … is attached twice` (DG009).** Two custom buttons or groups were given the same
  `name`.

## Related

- [stateSave](/modules/state-save) · [Modules → toolbar order](/modules/#toolbar-order) · [Recipe: custom toolbar](/recipes/custom-toolbar)
