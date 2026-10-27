---
title: Row actions with confirm
type: how-to
description: A per-row action menu with links, server requests, confirmation, permission flags and disabled reasons — plus your own confirm and toast libraries.
---

# Row actions with confirm

**Goal:** every row gets the same, predictable set of actions — open, approve, delete — with
confirmation for destructive ones, permission-aware visibility, and a reason when an action is not
available for that row.

<Demo id="rcp-row-actions" />

Open the **⋯** menu on a cancelled row: **Approve** is visible but inactive and says why. Approve a
pending row, or delete one: the request goes out with the CSRF header, the result is reported, and
the grid reloads on the same page.

## Steps

### 1. Place the column

```js
columns: [/* … */, column.actions({ title: "Actions" })],
```

`column.actions()` is a placeholder the module fills. It is sticky at the end of a wide table, not
sortable, not exported and never hidden by the column menu.

### 2. Describe the actions once

Each item has **one** behavior:

| Behavior | Item | What happens |
|---|---|---|
| link | `href: "/agents/{id}"` | navigates (`target: "_blank"` opens a new tab); `{field}` values are URL-encoded |
| request | `request: { url: "/agents/{id}/approve", method: "POST" }` | runs [`grid.action()`](/reference/methods): confirm → request with CSRF → notify → reload on the same page |
| handler | `handler: (row, { grid, key }) => openDrawer(row)` | your function; a returned promise keeps the row busy |

With two actions or fewer they render as buttons in the cell. With more, the item marked `primary`
stays a button and the rest move into a **⋯** menu (without a `primary`, one **Actions** menu button
holds them all). `tone: "danger"` items always sink to the end, behind a separator.

### 3. Pass permissions from Blade

```blade
@php($can = [
    'approve' => auth()->user()->can('approve', App\Models\Agent::class),
    'delete' => auth()->user()->can('delete', App\Models\Agent::class),
])
<table id="agents" data-url="{{ route('agents.data') }}" data-can='@json($can)'></table>
```

```js
const can = JSON.parse(table.dataset.can);
// …
{ id: "delete", label: "Delete", can: can.delete, /* … */ }
```

`@json` escapes quotes and `<`, so the attribute is safe. If your page script is inline in the Blade
view, write the boolean directly: `can: @json(auth()->user()->can('delete', App\Models\Agent::class))`.
`can` also takes a function of the row: `can: (row) => row.owner_id === userId`.

### 4. Explain row-state restrictions with `disabled`

```js
disabled: (row) => (row.status === "cancelled" ? "Cancelled records can't be approved." : false),
```

`can: false` removes an action. `disabled` keeps it in place but inactive, with the reason next to
it (and in its accessible name). Return `true` for "inactive, no reason".

### 5. Authorize on the server

`can` is UX only: it hides what the user can't do. The endpoint must authorize every request.

```php
// routes/web.php
Route::post('/agents/{agent}/approve', [AgentController::class, 'approve'])->can('approve', 'agent');
Route::delete('/agents/{agent}', [AgentController::class, 'destroy'])->can('delete', 'agent');
```

```php
public function approve(Agent $agent)
{
    abort_if($agent->status === 'cancelled', 422, "Cancelled records can't be approved.");
    $agent->update(['status' => 'done']);

    return response()->json(['message' => "{$agent->name} approved."]);
}

public function destroy(Agent $agent)
{
    $agent->delete();

    return response()->json(['message' => 'Agent deleted.']);
}
```

The JSON `message` becomes the success notification. A `403` or `422` becomes an error notification
with the server's `message` (a `5xx` with a generic text), and the row stays as it was.

## Host confirm and notify adapters

Without adapters the grid uses its own `<dialog>` for confirmation and announces results to screen
readers (errors also get a banner). To use your page's dialog and toast libraries everywhere,
register them once, before any grid is created:

```js
// resources/js/app.js
import Swal from "sweetalert2";
import toastr from "toastr";
import { configure } from "@akinozgen17/datagrids";

configure({
  confirm: async (message, o) => {
    const result = await Swal.fire({
      title: o.title ?? "Are you sure?",
      text: message, // text, not html
      icon: o.tone === "danger" ? "warning" : "question",
      showCancelButton: true,
      confirmButtonText: o.confirmLabel ?? "OK",
      cancelButtonText: o.cancelLabel ?? "Cancel",
    });
    return result.isConfirmed;
  },
  notify: (kind, message) => toastr[kind](message), // kind: "success" | "error" | "info"
});
```

`confirm` receives the message and `{ title, tone, confirmLabel, cancelLabel, subject }`; a danger
action passes `tone: "danger"` and its own label (**Delete**) as `confirmLabel`. Row actions, bulk
actions and `grid.confirm()` / `grid.notify()` all go through these adapters. The demo sets `notify`
per grid with the `host` option only to print messages on this page.

## Item reference

| Option | Type | Description |
|---|---|---|
| `id` | `string` | unique per grid; `data-action` on the button |
| `label` | `string` | visible text and accessible name |
| `icon` | built-in icon name | e.g. `eye`, `check`, `edit`, `trash`, `send`, `copy` |
| `tone` | `"danger" \| "warning" \| "success"` | `danger`: red, last in the menu, danger confirm |
| `group` | `string` | menu section heading |
| `primary` | `boolean` | stays a button when the rest collapse into the menu |
| `can` | `boolean \| (row) => boolean` | permission; `false` removes the action |
| `disabled` | `(row) => boolean \| string` | inactive for this row; a string is the reason shown |
| `href` / `target` | `string` | link template (`{field}`, URL-encoded) |
| `request` | `{ url, method?, body? }` | `grid.action()` call; `body` may be a function of the row |
| `handler` | `(row, { grid, key }) => unknown` | custom behavior |
| `confirm` | `string \| { title?, message, confirmLabel?, cancelLabel? }` | `{field}` placeholders allowed |
| `success` | `string \| false` | overrides the server's `message`; `false` = silent |
| `reload` | `false \| { keepPage? }` | after a request; default reloads on the same page |

Module options (`inline`, `sticky`, `field` for a per-row permission map from the server, `reasons`,
`rowLabel`) are on the [actions module](/modules/actions) page.

## Notes

- **Events:** `beforeAction` (cancelable), `action` after success, `actionerror` with the error.
- **Busy rows:** while a request runs, the row is `aria-busy` and its action buttons are disabled,
  so a double click can't send twice.
- **Same origin only:** `grid.action()` refuses URLs on another origin.
- **Redirects:** a redirect to a page that is not a login page (a controller answering with
  `return back()`) counts as success; a redirect to the login page is a session error.
- **Session expiry** during an action: see [CSRF & session expiry](/recipes/csrf-and-session).

## Related

- [actions module](/modules/actions)
- [Selection + bulk action](/recipes/bulk-actions)
- [Instance methods: action, confirm, notify](/reference/methods)
