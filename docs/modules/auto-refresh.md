---
title: autoRefresh
type: module
description: Reload a grid silently on an interval, keeping the page, and skip ticks while the tab is hidden, a load runs, a menu is open or the user is typing.
since: 0.1.0
---

# autoRefresh

Reloads the grid on an interval — silently, on the same page — with a toolbar toggle to pause
it. Open the **Request** tab: a new request arrives every 5 seconds.

<Demo id="mod-auto-refresh" />

## When to use it

Use it for monitoring lists that change on their own: queues, live orders, device status. Skip
it for lists people edit or select in for long stretches; reload after their own actions instead
(`grid.reload({ keepPage: true })` or [actions](/modules/actions), which reload for you).

## Usage

```js
import { Datagrid, serverSide, yajra, autoRefresh } from "@akinozgen17/datagrids";

new Datagrid("#queue", {
  label: "Dispatch queue",
  columns,
  use: [serverSide({ url: "/api/queue", protocol: yajra(), csrf: true }), autoRefresh({ every: 15000 })],
});
```

A tick is **skipped** while the tab is hidden (one catch-up reload runs when it becomes visible
again), while a load is running, while a menu, panel or dialog of the grid is open, and while
focus is in a text field, select or textarea inside the grid. A `sessionexpired` event stops the
timer for good.

Start paused, without the toolbar toggle, and control it from code:

```js
autoRefresh({ initial: false, toggle: false });
grid.autoRefresh.start();
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `every` | `number` (ms) | `30000` | Interval; values below `5000` are raised to `5000`. |
| `initial` | `boolean` | `true` | Start running. |
| `toggle` | `boolean` | `true` | Toolbar toggle "Auto refresh (30s)" with a permanent on/off box. |
| `slot` / `order` | | `"end"` / `-20` | Toolbar position of the toggle. |
| `messages` | `{ label(seconds) }` | locale (`en` / `tr`) | Toggle text. |
| `can` | `boolean` | `true` | Permission flag: `false` → no timer, no toggle. |

## API added to the grid

Available as `grid.autoRefresh` (typed: `grid.module(autoRefresh)`).

| Member | Returns | Description |
|---|---|---|
| `running()` | `boolean` | `true` while the timer runs. |
| `start()` / `stop()` | `void` | Start or stop the timer (the toggle follows). |
| `tick()` | `void` | Reload now (same skip rules) and restart the countdown. |

## Events

None of its own. Each tick is a silent `grid.reload({ keepPage: true, silent: true })`
(`beforeLoad`, `load`).

## Accessibility

- The toggle is a real `<button aria-pressed>` with a visible checkbox indicator, so the state is
  readable without hovering.
- Ticks are silent: no busy card, no announcement — the table is only `aria-busy` while the
  request runs. Ticks pause while the user is typing or has a menu open, so focus and input are
  never lost.

## Replaces in DataTables

| DataTables (1.10 / 2.x / 3.x) | datagrids |
|---|---|
| `setInterval(() => table.ajax.reload(null, false), 30000)` | `autoRefresh()` |

## Gotchas

- **It refreshes every 5 s although I set 1 s.** The minimum interval is 5 seconds.
- **It stopped on its own.** The session expired (`sessionexpired`); the timer stays off until
  `start()`.
- **A tick didn't happen while I used the column menu.** By design: ticks skip while a menu,
  panel or dialog of the grid is open.

## Related

- [Toolbar buttons → button.reload](/modules/buttons#button-reload) · [Lifecycle](/guide/lifecycle) · [States and errors](/guide/states-and-errors)
