---
title: Performance
type: explanation
description: How datagrids renders, automatic virtual rows from 300 rows, measured numbers with their method, bundle size, and practical advice for large lists.
---

# Performance

## How rendering works

- **No virtual DOM.** Rows are built once per data change from DOM APIs (text by default), keyed by
  row key; changing a column's visibility toggles `hidden` on existing cells instead of re-rendering.
- **Regional updates.** A sort or page change replaces the body; the toolbar, header and pager are
  patched separately. `refreshRow(key)` re-renders a single row.
- **Server mode keeps one page** in memory; the latest request wins and older ones are aborted, so
  fast typing never renders stale pages.
- **Client mode caches** the folded search text per row and uses a cached `Intl.Collator`.
- **Layout is the real cost.** Measured on wide rows, script time is a fraction of a 1000-row render;
  the rest is the browser's layout and paint. Fewer DOM nodes per row (e.g. not rendering hidden
  menus per row — the actions module builds its menu once per grid, on demand) matter more than the
  rendering technique.

## Virtual rows

When the current view holds **300 rows or more**, the grid switches to virtual rows automatically:

- only the rows in and near the visible part of the body are in the DOM (plus two spacer rows);
- the body scrolls inside the grid (`max-block-size` 70 vh, or your `maxHeight`) with a sticky header;
- row heights are measured, so rows don't need a fixed height;
- column widths are measured once and locked in a `<colgroup>` so columns don't jump while scrolling;
- `aria-rowcount` / `aria-rowindex` keep the real size and positions available to assistive tech;
- printing renders every row (the window is switched off for `beforeprint`).

<Demo id="guide-virtual" />

| `virtual` | Effect |
|---|---|
| (default) | automatic at ≥ 300 rows in view |
| `false` | never — render every row of the view |
| a number, e.g. `150` | your own threshold |

Below the threshold (any normal page size) rendering is plain and complete. See
[Accessibility → known limitations](/guide/accessibility#known-limitations) for the screen-reader
trade-off.

## Measurements

Numbers from the rendering prototype the v1 renderer is based on — not marketing numbers; they will
be re-measured for each release with the method below.

**Method:** headless Brave 155 (Chromium) via Playwright on an Intel i5-12400F, plus a 4× CPU
slowdown run through the DevTools protocol. Data: 1000 rows × 12 columns of server-rendered cells
(avatar, badge, key-value block, phone link, formatted money, clamped note and a hidden 10-item
action menu per row) — about 79 DOM nodes per row, sticky header. Metric: time until the next frame
(`requestAnimationFrame` + `setTimeout`), median of 7 runs.

| Scenario | 1× CPU | 4× CPU |
|---|---|---|
| 1000 rows, first frame (template clone / `innerHTML` / `createElement`) | 346 / 388 / 407 ms | ~1.74 s |
| same 1000 rows, a jQuery-based grid (DataTables 1.10.24), client init | 599 ms | 2.84 s |
| 1000 rows without the per-row hidden menu (47 nodes/row) | 277 ms | 1.28 s |
| 50 rows (the size of a virtual window) | 25 ms | 89 ms |
| `refreshRow` (one row) | 24 ms | 83 ms |
| hide a column (cell `hidden`) | 56 ms | 291 ms |
| sort 10,000 rows in memory (cached `Intl.Collator`) | 25 ms | 89 ms |
| accent-folding search over 10,000 rows | 5 ms | 23 ms |
| scroll frame time p50 / p95 after render | 16.7 / 17.3 ms | 17 / 50 ms |

Takeaways: the renderer is not the bottleneck (±15 % between techniques), node count is; and the
same 1000-row page renders roughly 35–40 % faster than the jQuery-based grid it was compared with.

## Bundle size

Measured on the first working build (min + gzip), before release tuning:

| Part | Size |
|---|---|
| core (grid, columns, sources, protocols) | 18.6 KB |
| core + a typical list setup (server source, state, column menu, buttons, export) + row actions | 33.6 KB |
| everything (IIFE build) | 41.1 KB |
| CSS (tokens + core + all module styles) | 9.8 KB |

Modules you don't import are tree-shaken away from ESM builds. The IIFE build always contains
everything.

## Advice for large lists

- **Page on the server** above a few thousand rows ([serverSide](/guide/server-protocols)); client mode
  is comfortable up to ~10,000 rows for sorting and search.
- **Keep page sizes under 300** unless users need to scroll huge pages; then virtual rows take over.
- **"All" is guarded**: `maxPageSize` (default 1000) caps page sizes, including `pageSize(-1)` unless a
  protocol explicitly allows it (`ssp({ allowAll: true })`).
- **Fewer nodes per row**: prefer typed columns over heavy server-rendered markup; use the
  [actions](/modules/actions) module instead of rendering a dropdown in every row.
- **Silent polling**: [autoRefresh](/modules/auto-refresh) reloads silently and keeps the page (or call
  `reload({ silent: true, keepPage: true })` yourself).

## Related

- [Accessibility](/guide/accessibility)
- [Data sources](/guide/data-sources)
