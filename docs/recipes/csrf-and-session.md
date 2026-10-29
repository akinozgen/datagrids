---
title: CSRF & session expiry
type: how-to
description: Send Laravel's CSRF token with every grid request and handle an expired session (419, 401, redirect to login) in one place.
---

# CSRF & session expiry

**Goal:** every grid request passes Laravel's CSRF check, and when the session is gone the user is
told once and sent to the login page — no silent empty tables, no `alert()`.

<Demo id="rcp-session" faults="419,302,500" />

Press the **Simulate** buttons and watch the log under the grid:

- **419** → an `error` event with `kind: "session"`, then a `sessionexpired` event. The banner has
  no **Retry**: retrying with a dead token can only fail again.
- **302** → the request is redirected to the login page (an HTML response, as Laravel's auth
  middleware does for expired sessions). That is reported as `kind: "session"` and fires
  `sessionexpired` too; a redirect to any other HTML page would be `forbidden` (see the table below).
- **HTTP 500** → `kind: "http"`, retryable: the banner offers **Retry**.

Rows already on screen stay visible and the error appears as a banner above them; when the very
first load fails, the table body shows the error state instead.

## Steps

### 1. Put the token in the page

```blade
{{-- layouts/app.blade.php, inside <head> --}}
<meta name="csrf-token" content="{{ csrf_token() }}">
```

The grid reads this tag on every request, so a token you refresh in the tag is picked up without
re-creating any grid.

### 2. Turn CSRF on once, for every grid

```js
// resources/js/app.js — runs before any grid is created
import { configure } from "@akinozgen17/datagrids";

configure({
  csrf: true,
  onSessionExpired: () => location.assign("/login?expired=1"),
});
```

`configure()` affects grids created **after** the call, so run it in your entry script. A single
source can still opt in or out on its own: `serverSide({ url, protocol: yajra(), csrf: true })`
(as in the demo) or `csrf: false`. The per-source value wins.

### 3. Optional: react per grid

```js
grid.on("sessionexpired", ({ error }) => {
  // error.status: 419, 401 or the redirect's status
  showLoginDialog();
});
```

Use the event when one page needs something different from the global `onSessionExpired` adapter
(a login modal instead of a redirect, for example). Both run.

## What is sent

| With `csrf: true` | Value |
|---|---|
| `X-CSRF-TOKEN` header | the `content` of `<meta name="csrf-token">`, on every request |
| `_token` parameter | added to the parameters of non-`GET` requests (the yajra/ssp form body), unless you already set `_token` |

| Always (unless `laravel: false`) | Value |
|---|---|
| `X-Requested-With` | `XMLHttpRequest` |

Each protocol also sends a JSON `Accept` header (`application/json` first). Together with
`X-Requested-With` this makes Laravel's `$request->expectsJson()` true, so an unauthenticated
request gets a `401` JSON response and a failed validation a `422` JSON response — instead of a
redirect to an HTML page the grid can't use.

Turn the Laravel header off for non-Laravel back ends with `configure({ laravel: false })` (or
per grid: `host: { laravel: false }`).

[`grid.action()`](/recipes/row-actions) — row and bulk actions — sends `X-CSRF-TOKEN` (when the meta
tag exists), `X-Requested-With` and `Accept: application/json` on its own; no `csrf` flag needed.

## How failures are classified

| Response | `error.kind` | `sessionexpired` | Retry |
|---|---|---|---|
| `419` (CSRF token mismatch, session gone) | `session` | yes | no |
| `401` | `session` | yes | no |
| redirect to a page whose URL contains `login`, `signin` or `giris` | `session` | yes | no |
| any other redirect to an HTML page | `forbidden` (grid loads); success for `grid.action()` | no | no |
| `403` | `forbidden` | no | no |
| `422` | `validation` | no | no |
| `5xx`, network failure, timeout | `http` / `network` / `timeout` | no | yes |

Every failure fires the grid's `error` event first. See [States & errors](/guide/states-and-errors)
for the error states and `errorMode`.

## Notes

- **After a re-login in another tab**, this page still holds the old token: every request returns
  `419` until the page reloads. That is why the usual `onSessionExpired` reloads or redirects.
- **Row actions:** on an expired session `grid.action()` emits `sessionexpired` on the grid, calls
  the `onSessionExpired` adapter and reports the error through `notify`. A redirect to any other
  page (a classic controller answering with `return back()`) counts as success, like the jQuery
  call it replaces; grid loads still treat it as `forbidden`.
- **Failures inside a 200:** controllers that answer `200 { status: false, error: "…" }` need a rule,
  or the action counts as done: `configure({ isError: (b) => b?.status === false && (b.error ?? true) })`.
- **Don't exclude grid routes from CSRF verification** to make a list work: send the token instead
  and keep the endpoints protected.

## Related

- [Laravel + yajra list](/recipes/laravel-yajra)
- [Row actions with confirm](/recipes/row-actions) — the confirm and notify host adapters
- [Static API & configure()](/reference/static)
- [Events](/reference/events)
