---
title: States & errors
type: explanation
description: The loading, empty, no-match, error and manual states, the busy indicator on reloads, error banners, retry, errorMode and the data-state attribute.
---

# States & errors

A grid is always in exactly one state, shown in the table body and mirrored on the root as
`data-state`. You never write "Processing…" markup or call `alert()`.

<Demo id="guide-states" />

| `data-state` | When | What the user sees |
|---|---|---|
| `loading` | first load, no rows yet | a centered "Loading…" card in the body |
| `ready` | rows are shown | the rows |
| `empty` | loaded, nothing to show | "No records" — or "No matching records" + **Clear search** when a search or filter is active |
| `error` | a load failed and there are no rows to keep | the error message + **Retry** (when retryable) and, while warnings are on, a collapsed **Details** block |
| `idle` | `load: "manual"` before the first load | "List not loaded yet" + **Load** |

**Reloading does not change `data-state`.** The rows stay, `aria-busy="true"` goes on the table and,
after 300 ms (so fast responses don't flash), the frame gets `data-busy="visible"`: the rows dim and a
floating "Loading…" card appears in the visible part of the body. `reload({ silent: true })` skips the
visual part and only sets `aria-busy`.

## Errors

Any failure — network, timeout, HTTP status, an `error` key in a 200 response, unreadable JSON,
or a custom source that throws — is normalized into one shape:

```ts
interface DatagridError {
  kind: "network" | "timeout" | "abort" | "http" | "server" | "session" | "forbidden" | "validation" | "parse" | "protocol";
  status: number | null;
  message: string;   // safe to show
  detail?: string;   // server internals: console + Details block only
  retryable: boolean;
  raw?: unknown;     // the response body
}
```

<Demo id="guide-errors" faults="500,419,302,error200,timeout" />

- **No rows on screen:** the body shows the error state with **Retry**.
- **Rows already on screen** (a reload or page change failed): the rows stay and a dismissible banner
  (`role="alert"`) appears above the table with **Retry**.
- **Every error** fires `error` on the grid. Session errors (419, 401, redirect to a login page) also
  fire `sessionexpired` and call `configure({ onSessionExpired })`.
- **Server details** (`detail`: an exception message, SQL) are printed once to the console as
  [DG012](/errors/DG012) and shown in the collapsed Details block only while warnings are enabled.
  Turn them off in production with `configure({ warnings: false })` — wire it to your app's debug flag.

The timeout fault above needs the default 30-second timeout to elapse; pass
`serverSide({ timeout: 5000 })` to try it faster.

### `errorMode`

| `errorMode` | Behaviour |
|---|---|
| `"inline"` (default) | the error state / banner described above |
| `"silent"` | no UI; listen to `error` yourself (the grid returns to `ready`) |
| `"throw"` | the error is thrown from the load (as an `Error` with the `DatagridError` fields) |

Set it per grid (`errorMode`) or globally (`configure({ errorMode })`). The global value is read when
an error happens, so it also applies to existing grids that don't set their own.

## Status in code

```js
grid.status();
// { status: "idle" | "loading" | "reloading" | "ready" | "error",
//   loaded, total, filtered, hasMore, error }

grid.on("loadingchange", ({ loading }) => spinner.hidden = !loading);
```

## Styling states

States are attributes, so host CSS can target them without fighting class names:

```css
.dg[data-state="error"] { outline: 1px solid var(--dg-tone-bad); }
.dg-table[aria-busy="true"] { cursor: progress; }
```

Messages come from the [message pack](/reference/messages) (`loading`, `empty`, `noMatch`, `error`,
`retry`, `errSession`, …) and can be overridden per grid or globally.

## Related

- [Server protocols → errors](/guide/server-protocols#errors-and-session-expiry)
- [CSRF & session expiry recipe](/recipes/csrf-and-session)
- [Accessibility](/guide/accessibility) — how states are announced
