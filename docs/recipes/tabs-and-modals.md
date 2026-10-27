---
title: Grids in tabs & modals
type: how-to
description: Delay a grid's first request until its tab or dialog is shown with load "visible" or load "manual", without any column re-alignment calls.
---

# Grids in tabs & modals

**Goal:** a page with several tabs or a dialog that contains a grid. Hidden grids must not fire
requests on page load, and when they appear their columns must line up — without "redraw" or
"adjust" calls in your tab code.

<Demo id="rcp-tabs" />

Open the **Request** tab first: nothing was sent. Switch to **Agents**: the first request goes out
the moment the panel becomes visible. **Open dialog…** loads the second grid on demand.

## Steps

### 1. A grid in a tab: `load: "visible"`

```js
new Datagrid("#agents", {
  label: "Agents",
  columns,
  load: "visible",
  use: [serverSide({ url: "/agents/data", protocol: yajra(), csrf: true })],
});
```

The grid watches itself with an `IntersectionObserver` and sends its first request when it comes
within 200 px of the viewport — when its tab is shown, its accordion opens or the user scrolls down
to it. Your tab code only toggles visibility (`hidden`, a CSS class, Bootstrap's tab plugin…); it
never talks to the grid. After the first load the grid behaves normally: reloads, filters and
paging go out immediately.

`load: "visible"` also pays off for grids far below the fold on long pages.

### 2. A grid in a dialog: `load: "manual"`

```js
const pending = new Datagrid("#pending", {
  labelledBy: "pending-title",
  columns,
  load: "manual",
  use: [serverSide({ url: "/agents/data", protocol: yajra(), csrf: true, params: { status: "pending" } })],
});

openButton.addEventListener("click", () => {
  dialog.showModal();
  if (!pending.status().loaded) pending.load();
});
```

With `load: "manual"` the grid renders its frame in the idle state and waits for `grid.load()`.
Choose it when *you* know the moment better than visibility does — typically when the request
depends on what the user clicked:

```js
let agentId = null;
const history = new Datagrid("#history", {
  label: "Assignment history",
  columns,
  load: "manual",
  use: [serverSide({ url: "/agents/history", protocol: yajra(), csrf: true, params: () => ({ agent_id: agentId }) })],
});

function openHistory(id) {
  agentId = id;
  dialog.showModal();
  history.reload(); // first call loads; later calls refresh page 1 for the new record
}
```

`load: "visible"` works in a dialog too (it becomes visible when opened); it just can't wait for
data you set while opening.

### 3. Nothing to do when it appears

Column widths come from CSS, not from measurements taken while the table was hidden, so a grid
that was `display: none` lays out correctly the moment it is shown. A `ResizeObserver` keeps the
rest in step with the container: the narrow layout of the pager and the horizontal-scroll shadows.
Resizing the dialog or the window needs no call either.

## Notes

- **Narrow dialogs:** add [responsive](/modules/responsive) to collapse the least important columns
  into an expandable detail row instead of scrolling sideways.
- **Name the grid after the dialog title** with `labelledBy`, as the demo does, so screen readers
  hear one consistent name.
- **Keep the grid when the dialog closes.** Closing only hides it; the next open shows the same
  state instantly. Destroy it only if your page throws the dialog's markup away — see
  [Destroy, re-init & Livewire](/recipes/destroy-and-reinit).
- **Reload a grid in another tab** after an action with `reload("agents")` — by grid `name`, no
  reference needed.
- The demo's dialog grid is in the idle state (`data-state="idle"`) until opened; style or test
  against that attribute rather than against timing.

## Related

- [Lifecycle](/guide/lifecycle) — `load`, `reload`, `destroy`
- [States & errors](/guide/states-and-errors)
- [Destroy, re-init & Livewire](/recipes/destroy-and-reinit)
