---
title: Accessibility
type: explanation
description: Accessibility statement — native table semantics, sortable header buttons with aria-sort, skip link, live announcements, keyboard support, focus handling, contrast, reduced motion, forced colors and known limitations.
---

# Accessibility

**Target:** the grid component conforms to WCAG 2.2 level AA when it is given an accessible name and
used with the default stylesheet. Your page around it is your part of the bargain.

## The pattern: a real table

datagrids keeps a native `<table>` with `<thead>`, `<th scope="col">` and `<tbody>` — the structure
every screen reader already knows how to navigate (table navigation keys, header announcements). It
does **not** turn the table into an ARIA `grid` by default, so screen-reader table commands keep
working and Tab moves through the interactive things (sort buttons, links, checkboxes, action
buttons) as it does on any page. Spreadsheet-style navigation is opt-in: the
[keyboardGrid](/modules/keyboard-grid) module applies the APG grid pattern (`role="grid"`, one tab
stop, arrow keys between cells).

| Feature | How |
|---|---|
| Accessible name | `label`, `labelledBy`, `title` or the table's `<caption>` names the scroll region (`role="region"`); missing → [DG002](/errors/DG002) |
| Sorting | each sortable header holds a real `<button>`; the active column carries `aria-sort="ascending\|descending"`; the ↕ icon is always visible |
| Skip link | "Skip table" before the table, visible on focus, jumps past the rows to the pager |
| Announcements | one polite live region per grid: result counts after a search, "Page 3 of 14", sort changes, selection counts, export results |
| Loading | `aria-busy="true"` on the table while loading; the loading card is hidden from assistive tech |
| Errors | blocking error state and error banners use `role="alert"` and offer **Retry** as a button |
| Scroll container | focusable (`tabindex="0"`) only while it actually overflows, so keyboard users can scroll it |
| Hidden columns | real `hidden` cells — not announced, not focusable |
| Row states | selection is a checkbox per row with a name like "Select: Jill Valentine"; muted/deleted rows keep their text |

## Keyboard

| Where | Keys |
|---|---|
| Search | type to search (debounced), <kbd>Enter</kbd> searches now, <kbd>Esc</kbd> clears |
| Sort header | <kbd>Enter</kbd> / <kbd>Space</kbd> toggles ascending / descending |
| Pager | buttons for first / previous / next / last; the page field accepts a number + <kbd>Enter</kbd>; on narrow screens a native select |
| Menus (Columns, Export, row Actions) | <kbd>Enter</kbd> / <kbd>Space</kbd> / <kbd>↓</kbd> opens on the first item, <kbd>↑</kbd> on the last; <kbd>↑</kbd> <kbd>↓</kbd> <kbd>Home</kbd> <kbd>End</kbd> move; typing a letter jumps (row actions); <kbd>Esc</kbd> closes and returns focus to the button |
| Column menu | a `fieldset` of native checkboxes (<kbd>Space</kbd> toggles), a search field above 12 columns, locked columns are disabled with a reason |
| Selection | <kbd>Space</kbd> on a row checkbox; the header checkbox selects the page (mixed state when partial); <kbd>Shift</kbd>+click selects a range |
| Confirm dialog | native `<dialog>`: focus is trapped, <kbd>Esc</kbd> cancels; for destructive actions focus starts on **Cancel** |
| [keyboardGrid](/modules/keyboard-grid) (opt-in) | one tab stop; arrow keys between cells (mirrored in RTL), <kbd>Home</kbd> / <kbd>End</kbd> in the row, <kbd>Ctrl</kbd>+<kbd>Home</kbd> / <kbd>End</kbd> to the corners, <kbd>PageUp</kbd> / <kbd>PageDown</kbd> change the page, <kbd>Enter</kbd> / <kbd>F2</kbd> into a cell with several controls, <kbd>Esc</kbd> back |
| [rowReorder](/modules/row-reorder) handle | <kbd>Space</kbd> / <kbd>Enter</kbd> picks the row up, arrow keys move it, <kbd>Space</kbd> / <kbd>Enter</kbd> drops, <kbd>Esc</kbd> cancels; every step is announced |

Focus survives re-renders: the pager keeps focus on the same control after a page change, a closed
menu returns focus to its trigger, and the row action trigger shows a busy state while its request
runs (`aria-busy` on the row).

## Visual

- **Contrast:** text tokens meet 4.5:1, checkbox borders and the neutral sort icon 3:1; accent text is
  clamped to stay ≥ 4.5:1 whatever `--dg-accent` you choose ([Theming](/guide/theming)).
- **No hover-only affordances:** every clickable element has a permanent icon, checkbox or chevron;
  focus rings use `:focus-visible` and the accent ring.
- **Target size:** on touch screens (`pointer: coarse`) controls grow to 44 px.
- **Reduced motion:** animations stop under `prefers-reduced-motion: reduce`.
- **Forced colors:** Windows High Contrast keeps structure with real borders and system colors.
- **Zoom and text size:** all sizes derive from `rem` (`--dg-rem`), and a wide table scrolls inside
  its own region instead of widening the page.

## Known limitations

- **Virtual rows.** When a single view holds 300 rows or more (for example a page size of 500, or a
  client grid without paging), only the rows in and near the viewport are in the DOM. Screen readers
  then navigate the rendered rows only; `aria-rowcount` and `aria-rowindex` tell them the real size and
  position. If that matters for your users, keep page sizes below 300 or set `virtual: false` (see
  [Performance](/guide/performance#virtual-rows)).
- **Sticky header copy:** [stickyHeader](/modules/sticky-header) shows a visual, `aria-hidden` copy of
  the header; assistive technology and keyboard users keep using the real header.
- **Server-rendered HTML** (`column.html()`, the yajra preset) is inserted as is — its accessibility is
  the server's responsibility.

## How it is tested

- Automated: every end-to-end test page is scanned with axe-core (Playwright, Chromium) and must be
  free of violations; tests assert on ARIA states (`aria-sort`, `aria-busy`, `aria-expanded`), not on
  timing.
- Manual screen-reader passes (NVDA, JAWS, VoiceOver on macOS and iOS, TalkBack) are part of the 1.0
  release checklist; results will be published here with versions and dates.

## Feedback

Found a barrier? Please open an issue on [GitHub](https://github.com/akinozgen/datagrids/issues) with
the browser, assistive technology and steps — accessibility bugs are treated as release blockers.
