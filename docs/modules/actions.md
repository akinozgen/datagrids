---
title: actions
type: module
description: Row actions defined once in the frontend — inline buttons or a primary button plus a ⋯ menu, links, requests or handlers, confirm dialogs, permissions with reasons.
since: 0.1.0
---

# actions

Defines a row's actions once and renders them the same way on every row: up to two inline
buttons, or a primary button plus a `⋯` menu. Each action is a link, a request or a handler, with
an optional confirm dialog and per-row permissions.

<Demo id="mod-actions-menu" />

With two actions or fewer, they render inline. Here a per-row permission map from the server
narrows them (drafts can only be edited, cancelled records can't be deleted — with the reason):

<Demo id="mod-actions-inline" />

## When to use it

Use it for anything a user does to one row: view, edit, approve, delete, send. The definitions
live in one place, so every row looks and behaves the same, and destructive actions always ask
first. For actions on many rows at once use [selection](/modules/selection) and its bulk bar.

## Usage

Add `column.actions()` where the buttons go (a sticky end column by default) and describe the
items. Every item does **one** thing: `href`, `request` or `handler`.

```js
import { Datagrid, column, serverSide, yajra, actions } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns: [
    { key: "name", title: "Name" },
    column.actions({ title: "Actions" }),
  ],
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    actions({
      items: [
        { id: "edit", label: "Edit", icon: "edit", href: "/agents/{id}/edit" },
        {
          id: "delete", label: "Delete", icon: "trash", tone: "danger",
          confirm: "Delete {name}?",
          request: { url: "/agents/{id}", method: "DELETE" },
        },
      ],
    }),
  ],
});
```

`{field}` placeholders read the row (dotted paths work). In `href` and `request.url` the values
are URL-encoded; in `confirm` and `success` texts they are inserted as plain text.

- **`href`** navigates (`target: "_blank"` opens a new tab with `noopener`). An enabled `href`
  action is a real `<a href>`, inline and in the menu, so middle-click, Ctrl/⌘-click, "Copy link"
  and the status-bar URL work as on any link. A plain click still goes through `confirm` and
  `beforeAction`; a modified or middle click opens the link directly, without them. A disabled
  `href` action stays a button that explains why.
- **`request`** runs [`grid.action()`](/reference/methods): same-origin only, `X-CSRF-TOKEN` from
  `<meta name="csrf-token">`, JSON body, then a success notice and a reload that keeps the page.
- **`handler(row, { grid, key })`** runs your code; return a promise to keep the row busy until it
  settles.

### Layout: inline or menu

| Visible actions for the row | Rendered as |
|---|---|
| ≤ `inline` (default 2) | Labelled inline buttons |
| more, one has `primary: true` | The primary as a labelled button + an icon-only `⋯` menu with the rest |
| more, no primary | One "Actions ▾" menu button |

In the menu, `group` adds a heading, danger actions sink to the end of their group behind a
separator, and items with `confirm` end with "…".

### Permissions and reasons

```js
actions({
  field: "permissions",                       // optional per-row map from the server
  reasons: { archived: "Archived records are read-only." },
  items: [
    { id: "edit", label: "Edit", can: user.canEdit },                            // hide for everyone
    { id: "approve", label: "Approve", can: (row) => row.status !== "done" },    // hide per row
    { id: "send", label: "Send", disabled: (row) => !row.email && "No e-mail address" }, // show, but inactive
  ],
});
```

- `can: false` (or a function returning `false`) hides the action.
- `disabled` keeps it visible but inactive; a string becomes the reason, shown in a small note when
  the button is pressed and under the label in the menu.
- `field` names a row field holding a permission map. It can only narrow: `["edit"]` allows just
  those ids; `{ delete: false }` hides one; `{ delete: { disabled: "archived" } }` disables one
  with the reason `reasons.archived` (or the code itself); ids not in the map stay allowed.

::: warning `can` is UX only
Hiding a button is not authorization. The endpoint behind every `request` must check
permissions itself.
:::

### Confirm and notifications

`confirm` opens the grid's built-in modal `<dialog>` (title, message, the row's label as the
subject; danger actions get a red confirm button labelled with the action and start focused on
"Cancel"). Plug in your own dialog and toasts once for every grid:

```js
import { configure } from "@akinozgen17/datagrids";

configure({
  confirm: (message, o) => myDialog.ask({ title: o.title, text: message, danger: o.tone === "danger" }),
  notify: (kind, message) => myToasts.show(kind, message),
});
```

Without a `notify` adapter, success messages go to the grid's live region and errors also show a
banner above the table.

## Options

### `actions(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `items` | `ActionItem[]` | — (required) | The actions, in display order. |
| `inline` | `number` | `2` | Up to this many visible actions render inline; more switch to primary + menu. |
| `sticky` | `"end" \| false` | `"end"` | `false` lets the actions column scroll with the others. |
| `field` | `string` | none | Row field with a permission map (array of ids or `{ id: true \| false \| { disabled: code } }`). |
| `reasons` | `Record<string, string>` | `{}` | Reason codes from the map → text. |
| `rowLabel` | `(row) => string` | first visible column's value | Row name used in accessible names and as the confirm subject. |
| `messages` | `{ actions, more, forRow(label) }` | locale (`en` / `tr`) | "Actions", "More actions", "Actions: {row}". |
| `can` | `boolean` | `true` | Permission flag: `false` → no action buttons at all. |

### `ActionItem`

| Property | Type | Description |
|---|---|---|
| `id` | `string` | Unique id (events, permission maps, `grid.actions.run()`). |
| `label` | `string` | Visible text and accessible name. |
| `icon` | icon name | Built-in icon: `edit`, `trash`, `eye`, `send`, `check`, `copy`, `download`, `print`, `more`, … |
| `tone` | `"danger" \| "warning" \| "success"` | `danger` is styled red, sorted last and confirmed with a red button. |
| `group` | `string` | Menu group heading. |
| `primary` | `boolean` | The labelled button next to `⋯` when the actions don't fit inline. |
| `can` | `boolean \| (row) => boolean` | Hides the action. |
| `disabled` | `(row) => boolean \| string \| null` | Visible but inactive; a string is the reason. |
| `href` | `string` | URL template; rendered as a real link (see above). |
| `target` | `string` | Window target for `href`. |
| `request` | `{ url, method?, body? }` | `method` defaults to `POST`; `body` is an object or `(row) => object`. |
| `handler` | `(row, { grid, key }) => unknown` | Your code; may return a promise. |
| `confirm` | `string \| { title?, message, confirmLabel?, cancelLabel? }` | Ask first. |
| `success` | `string \| false` | `request` only: success text (template), or `false` for none. Default: the response's `message`, else "Done." |
| `reload` | `false \| { keepPage? }` | `request` only: reload after success (default `{ keepPage: true }`). |

## API added to the grid

Available as `grid.actions`.

| Member | Returns | Description |
|---|---|---|
| `run(id, key)` | `Promise<void>` | Runs an action on a row (with its confirm, permissions and events). |
| `open(key)` | `void` | Opens a row's menu (rows with a menu only). |
| `items(key)` | `Array<{ item, reason }>` | The actions visible on a row after permissions; `reason` is `null` when active. |

## Events

| Event | Payload | When |
|---|---|---|
| `beforeAction` | `{ id, key, row, cancel() }` | Before the confirm dialog. `cancel()` stops the action. |
| `action` | `{ id, key, row }` | After a `request` or `handler` finished successfully (not for `href`). |
| `actionerror` | `{ id, key, row, error }` | The request failed or the handler threw. The user already saw the error notice. |

## Pipelines it plugs into

- **Row mutator**: fills the `column.actions()` cell of every rendered row; the cell is
  re-rendered after an action finishes.
- **Lifecycle**: one shared menu and one note popover per grid, removed on `destroy()`.

## Works with

- **Requires** `column.actions()` in the columns (a console warning tells you when it is missing).
- **With [softDeletes](/modules/soft-deletes)**: a "Restore" item with `can: (row) => !!row.deleted_at`.
- **With [selection](/modules/selection)**: row actions for one record, the bulk bar for many.

## Accessibility

- Every button is a native `<button>`; icon-only ones (`⋯`) have an accessible name with the row:
  "More actions: Jill Valentine".
- The menu follows the APG menu-button pattern: `aria-haspopup="menu"`, arrows / `Home` / `End`
  and type-ahead move between items, `Enter` / `Space` run one, `Esc` closes, `Tab` leaves.
- Disabled actions use `aria-disabled` (they stay focusable) and carry the reason in their
  description or name.
- While an action runs, its row is `aria-busy` and its buttons are disabled; a second click is
  ignored.
- The confirm dialog is a modal `<dialog>` with a labelled title and message; destructive actions
  focus "Cancel" first.

## Replaces in DataTables

| DataTables (1.10 / 2.x / 3.x) | datagrids |
|---|---|
| `columns.render` returning button HTML | `column.actions()` + `items` |
| `$("#t").on("click", ".btn-delete", …)` + `table.row(tr).data()` | `handler(row)` / `request` |
| `confirm()` + `$.ajax` + `table.ajax.reload(null, false)` | `confirm` + `request` (reload keeps the page) |
| Hand-made permission checks in `render` | `can`, `disabled`, `field` + `reasons` |

## Gotchas

- **"Edit" leaves the page.** `href` navigates; add `target: "_blank"` or use a `handler`.
- **The row didn't change after a `handler`.** Only `request` reloads; call `grid.reload({ keepPage: true })`
  or `grid.refreshRow(key, row)` in your handler.
- **"action URL must be same-origin".** `request` only talks to your own origin; use a `handler`
  with your own `fetch` for anything else.
- **A `{field}` in the URL came out as `%20`.** URL templates encode values; that is intended.

## Related

- [selection](/modules/selection) · [Recipe: row actions](/recipes/row-actions) · [Methods → action()](/reference/methods)
