---
title: Anatomy (DOM contract)
type: reference
description: The public DOM contract — stable classes, attributes and state selectors you can target from CSS and tests, and what is covered by semantic versioning.
---

# Anatomy (DOM contract)

The markup below is a **public contract**: the classes (`.dg-*`), attributes (`data-*`,
`data-dg-*`, ARIA) and their values are covered by semantic versioning. Target them from your CSS and
end-to-end tests. Internal custom properties (`--dg-_*`) and undocumented elements are not.

```html
<div class="dg" data-state="loading|ready|empty|error|idle"
     data-size="sm|md|lg"                     <!-- absent = md -->
     data-density="compact|normal|comfortable"
     data-dg-theme="light|dark|system"        <!-- absent = inherit the page's color-scheme -->
     data-dg-head="sentence"                  <!-- absent = caps -->
     data-dg-surface="card"                   <!-- absent = plain -->
     data-dg-striped
     data-dg-nowrap                           <!-- wrap: false -->
     data-dg-sticky-head                      <!-- maxHeight set -->
     data-dg-virtual                          <!-- virtual rows active -->
     data-bp="xs|sm|md|lg">                   <!-- root width bucket, written by the grid -->

  <div class="dg-head">…</div>                <!-- card surface only: .dg-title, .dg-desc, .dg-count -->

  <div class="dg-toolbar">
    <div class="dg-slot" data-slot="start">   <!-- search, column menu, reload, export, your buttons -->
      <label class="dg-search" data-has-value>
        <svg/><input class="dg-search-input" type="search" aria-label="Search">
        <button type="button" class="dg-search-clear" aria-label="Clear"><svg/></button>
      </label>
      <button class="dg-btn" aria-haspopup="dialog" aria-expanded="false">… <svg class="dg-btn-caret"/></button>
    </div>
    <div class="dg-slot" data-slot="end">…</div>      <!-- record count (plain surface), your widgets -->
    <div class="dg-slot" data-slot="filters">…</div>  <!-- full-width row: filter chips, your filter widgets -->
  </div>

  <div class="dg-banner" data-tone="bad|warn|info" role="alert">…</div>   <!-- non-blocking errors -->
  <div class="dg-bulk" data-active>…</div>                              <!-- selection module bar -->

  <a class="dg-skip" href="#…-after">Skip table</a>                     <!-- visible on focus -->
  <div class="dg-frame" data-overflow="start end" data-busy="visible">
    <div class="dg-scroll" role="region" aria-labelledby="…" tabindex="0">  <!-- tabindex only while it overflows -->
      <table class="dg-table" aria-busy="true">    <!-- YOUR table, same element -->
        <caption>…</caption>                        <!-- yours, kept -->
        <thead>
          <tr>
            <th scope="col" data-key="amount" data-align="end" aria-sort="descending">
              <button type="button" class="dg-sort"><span class="dg-sort-label">Amount</span><svg class="dg-sort-icon"/></button>
              <button type="button" class="dg-colfilter" aria-label="Filter: Amount" aria-haspopup="dialog" data-active><svg/></button>
            </th>
            <th data-col="select"><span class="dg-check">…</span></th>
            <th data-col="actions" data-sticky="end">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr data-key="1001" data-selected data-tone="ok|warn|bad|info|muted" aria-busy="true" data-clickable>
            <td data-key="amount" data-align="end"><span class="dg-money">12,450.00<span class="dg-money-cur">$</span></span></td>
            <td data-col="actions" data-sticky="end"><span class="dg-actions" data-group>…</span></td>  <!-- data-group: buttonGroup (default) -->
          </tr>
          <tr class="dg-state-row"><td colspan="N"><div class="dg-state" data-kind="loading|empty|error|manual">…</div></td></tr>
        </tbody>
        <tfoot>…</tfoot>                            <!-- footer module, or yours -->
      </table>
    </div>
  </div>
  <span id="…-after" tabindex="-1"></span>

  <div class="dg-footer">
    <div class="dg-info"><strong>51–75</strong> / 340 records (total 1,234)</div>
    <div class="dg-footer-end">
      <label class="dg-label">Per page <select class="dg-select dg-pagesize">…</select></label>
      <nav class="dg-pager" aria-label="Pagination">
        <button class="dg-pager-btn" data-go="first|prev|next|last" aria-label="…"><svg/></button>
        <span class="dg-pager-jump">Page <input class="dg-pager-input" inputmode="numeric" aria-label="Page"> <span class="dg-pager-total">of 14</span></span>
      </nav>
    </div>
  </div>

  <div class="dg-live dg-offscreen" role="status" aria-live="polite" aria-atomic="true"></div>
  <div class="dg-panel" popover="manual" role="menu|dialog">…</div>   <!-- top-layer panels live inside the root -->
  <div class="dg-tip" popover="manual" aria-hidden="true">…</div>    <!-- the one tooltip of the grid's controls -->
  <dialog class="dg-dialog">…</dialog>                               <!-- confirm dialog -->
</div>
```

## Rules

1. **State is an attribute, never a class.** Root: `data-state`. Rows: `data-selected`, `data-tone`,
   `aria-busy`. Headers: `aria-sort`. Controls: `aria-expanded`, `aria-disabled`, `aria-pressed`,
   `aria-current`. Toolbars and bars: `data-active`, `data-has-value`.
2. **`data-state` values:** `loading` (first load, no rows), `ready` (rows shown), `empty` (no rows,
   or no match), `error` (blocking error), `idle` (`load: "manual"`, not loaded yet). Reloads don't
   change it; the reload signal is `.dg-frame[data-busy]` plus `table[aria-busy]`.
3. **Toolbar slots** are `start`, `end` and `filters`. Items are ordered by their `order`, then by
   registration.
4. **Your table stays your table.** The root wraps it and adds the `dg-table` class; `<thead>` is
   regenerated (the original is kept and restored); with the DOM source the original `<tr>`s are
   adopted. `destroy()` undoes all of it.
5. **Cells** are styled through `.dg-table > :is(thead, tbody, tfoot) > tr > :is(td, th)`
   (specificity (0,1,3)). The grid never sets font size or weight on cells — they inherit from the
   table, so your typography applies evenly. Row separators are painted backgrounds, not borders.
6. **Alignment** is `data-align="end|center"` on cells — never `:nth-child`. Special columns carry
   `data-col="select|actions|rownum|go|label"`.
7. **Column identity** is `data-key` on `th`/`td`; **row identity** is `data-key` on `tr` (the row key).
8. **RTL:** text cells get `dir="auto"`; number, money and date blocks are isolated LTR.
9. **Virtual rows** (≥ 300 rows in view): the root gets `data-dg-virtual`, `.dg-scroll` scrolls
   vertically (`max-block-size: var(--dg-max-h, 70vh)`), the header is sticky, off-screen rows are
   replaced by two `tr.dg-spacer` rows and the table carries `aria-rowcount` / rows `aria-rowindex`.
10. **Width lock:** while virtual rows are on, measured widths are written to
    `<colgroup class="dg-cols"><col style="inline-size:…">` with `table-layout: fixed` — the only inline
    widths the grid ever writes. They are removed when the mode ends.
11. **Skip link:** `a.dg-skip` sits before the scroll container, is visible only on focus and jumps to
    the `[tabindex="-1"]` anchor after the table.
12. **Loading:** the first load shows `.dg-state[data-kind="loading"]` in the body; reloads show a
    floating `.dg-loading` card after 300 ms (`.dg-frame[data-busy="visible"]`), centered in the
    visible area of wide tables; silent reloads only set `aria-busy`.
13. **Panels** (column menu, column filter, row action menu, reason notes) are children of the root,
    opened in the top layer with `popover="manual"` and positioned by script — no z-index fights.
14. **Affordance:** every clickable thing has a permanent indicator (icon, checkbox or chevron), a
    hover background and `cursor: pointer`. Sortable headers show their ↕ icon even when unsorted.
15. **Tooltips:** the grid's own controls never carry a native `title`. Their tooltip text is in
    `data-dg-tip` and shows in the single `.dg-tip` element (top layer) on hover after 500 ms or at
    once on keyboard focus; it hides on pointer leave, click, scroll, blur and `Escape`. A page-wide
    `[title]` tooltip plugin therefore finds nothing in the grid to take over, and nothing is left
    behind when a control under the pointer re-renders or turns disabled. The accessible name stays in
    `aria-label`; where the tooltip adds information it is also the `aria-description`.
16. **Never emitted:** `dataTable` or `dt-*` classes and events, inline widths (except rule 10),
    `@layer`, `!important` (except for reduced motion), tokens on `:root`, `title` on grid controls.

## Safe customization examples

```css
/* a column width (widths live in CSS) */
#agents th[data-key="ref"] { inline-size: 7rem; }

/* highlight failed rows */
.dg-table > tbody > tr[data-tone="bad"] { font-weight: 600; }

/* dim the toolbar while the grid reloads */
.dg:has(.dg-table[aria-busy="true"]) .dg-toolbar { opacity: .6; }
```

In end-to-end tests wait for state, not for time, and prefer `data-state`, `aria-sort`,
`data-selected` and `data-key` over visible text:

```js
// Playwright
const grid = page.locator(".dg", { has: page.locator("#agents") });
await expect(grid).toHaveAttribute("data-state", "ready");
await expect(page.locator('#agents th[data-key="amount"]')).toHaveAttribute("aria-sort", "descending");
```

## Related

- [Theming](/guide/theming) · [CSS tokens](/reference/css)
- [Accessibility](/guide/accessibility)
