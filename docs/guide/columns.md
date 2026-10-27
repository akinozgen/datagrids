---
title: Columns
type: explanation
description: Typed column factories, render functions, the text-by-default rule, export values, widths in CSS and per-column permissions.
---

# Columns

A column says **what** to show (`key`, or a dotted `data` path) and **how**: render, alignment,
sorting, searching and export. The typed factories under the `column` namespace set all of that for
common value types; any option can still be overridden.

<Demo id="guide-columns" />

## Factories

```js
import { column } from "@akinozgen17/datagrids";
```

| Factory | Renders | Sorts | Exports as | Notes |
|---|---|---|---|---|
| `column.text(key)` | text, always | locale collation | string | forces text even when the source defaults to HTML — don't use it for yajra strings (see [below](#text-and-html)) |
| `column.number(key, { decimals, locale, source })` | `.dg-num`, end-aligned, negative in red | numerically | number (`#,##0`) | `source: "number"` (default) reads data strings as machine numbers (`"0.125"`, `"1.500"` from a DECIMAL column = 1.5); `source: "tr"` for formatted text (`"1.234,5"`, `"1.500"` = 1500) |
| `column.money(key, { currency, decimals, locale, source })` | `.dg-money` + currency suffix | numerically | number with currency format | `source: "number" \| "tr" \| "html"` reads numbers, formatted strings or server HTML |
| `column.date(key, { time, timeZone, locale, source })` | `.dg-date` (+ time) | chronologically | real date | `source: "iso" \| "local" \| "dmy"` |
| `column.badge(key, { labels, tones })` | `.dg-chip` with a tone dot | by label | label text | tones: `ok`, `warn`, `bad`, `info`, `neutral`, `muted`, `accent` |
| `column.link(key, { href, target })` | `a.dg-link` | as text | text | `href: "/agents/{id}"` (values URL-encoded) or a function; only http(s), relative, `#`, `mailto:` and `tel:` URLs render as links |
| `column.html(key)` | raw HTML (opt-in) | as text | text with tags stripped | search ignores markup |
| `column.phone(key, { country, whatsapp })` | `tel:` link (+ optional WhatsApp link) | as text | text | digits normalized for the link; `country` defaults to `"90"` |
| `column.boolean(key, { labels, showFalse })` | `.dg-bool`: ✓/✕ icon + text | false before true | label text | reads `1/0`, `true/false`, `"evet"/"hayır"`, `"yes"/"no"`, `"on"/"off"`; `labels: { true: "Active", false: "Passive" }` (default by page language); `showFalse: false` leaves false cells empty |
| `column.index()` | row number (page offset aware) | — | number | not sortable or searchable |
| `column.select()` | checkbox column | — | — | placeholder for the [selection](/modules/selection) module |
| `column.actions()` | action buttons / menu, sticky end | — | — | placeholder for the [actions](/modules/actions) module |

::: tip Formatting locale
`number`, `money` and `date` format with the grid's `locale` unless the column gets its own, and
`money` uses `TRY` unless you pass `currency`:
`column.money("amount", { currency: "USD", locale: "en-US" })`.
:::

Every factory takes the [column options](/reference/columns) as its second argument:

```js
column.text("name", {
  title: "Agent",
  name: "agents.name",       // server-side column name (sent as columns[i][name])
  data: "agent.full_name",   // dotted path into the row; defaults to the key
  sortable: true,
  searchable: true,
  visible: true,
  hideable: true,            // false: always visible, locked in the column menu
  exportable: true,
  align: "start",            // "start" | "end" | "center"
  className: "col-name",
  defaultContent: "n/a",     // shown for null / "" (default: a muted dash)
});
```

## Render functions

```js
column.text("name", {
  render: (value, row, ctx) => `${value} (${row.unit})`, // string → written as text
});
```

`render(value, row, ctx)` may return a **string or number** (written as text unless the column is
HTML), a **DOM Node** (appended as is — build it with DOM APIs), or `null`/`""` (shows
`defaultContent` or a muted dash). `ctx` has `row`, `key`, `index` (in the current view),
`position` (absolute, page offset included) and the cell `td`.

Rendering does not change sorting, searching or export. Override those separately:

| Option | Purpose |
|---|---|
| `value(row)` | compute the cell value instead of reading `data` |
| `compare(a, b)` | client-side sort comparator |
| `sortKey` | sort by another row field (client mode) |
| `searchText(value, row)` | text the search matches against |
| `exportValue(row)`, `exportType`, `exportFormat` | what Excel/CSV/print receive |
| `labels` | value → label map (badges; used by filters and export) |

## Text and HTML

**Cells are text by default; HTML is an explicit opt-in.** A string value or a string returned from
`render` is written with `textContent`, so `<b>` shows up as `<b>`.

To render HTML, opt in per column:

```js
column.html("notes")                          // raw HTML from the row
column.text("notes", { html: true, render })  // a render function that returns markup
```

The default for **untyped** columns (plain `{ key }` objects) comes from the data source:

| Source | Untyped columns render | Why |
|---|---|---|
| `data` / `arraySource`, `fetchAll`, `ssp()`, `dgp()`, `laravelPaginator()` | text | the values are data |
| `yajra()` | HTML | yajra/laravel-datatables escapes every non-raw column on the server and sends `rawColumns` as markup |
| DOM source (enhanced `<tbody>`) | the existing cells are adopted untouched | they are already markup |

`column.text()` always forces text. That is what you want for raw data — and exactly what you
**don't** want for a yajra endpoint, whose strings arrive already escaped (`O&#039;Brien`): written as
text, the entities would show. With `yajra()`, leave string columns untyped (`{ key: "name", title:
"Name" }`) and use typed factories for numbers, money, dates and badges, which parse the value
instead of printing it.

## Widths live in CSS

The grid never writes inline widths (one exception: while [virtual rows](/guide/performance#virtual-rows)
are on, measured widths are locked in a `<colgroup>`). Size columns with CSS, keyed by `data-key`:

```css
#agents th[data-key="ref"] { inline-size: 7rem; }
#agents :is(th, td)[data-key="task"] { min-inline-size: 18rem; }
```

Long text wraps by default (`top`-aligned rows); typed values (numbers, money, dates, chips) never
wrap. `wrap: false` on the grid keeps every cell on one line; `.dg-clamp` clamps a block to two
lines (`--dg-clamp` changes it).

## Cell primitives

The stylesheet ships small, themeable building blocks you can return from `render`:

| Class | Use |
|---|---|
| `.dg-id` | monospace identifier pill |
| `.dg-link` | link with a permanent underline hint |
| `.dg-chip[data-tone]` | status badge (`column.badge` uses it) |
| `.dg-user` › `.dg-avatar` + `.dg-user-body` › `.dg-user-name` + `.dg-sub` | person cell |
| `.dg-num`, `.dg-money` › `.dg-money-cur`, `.dg-date` › `.dg-date-time` | typed values (bidi-isolated) |
| `.dg-phone` | phone number, never wraps |
| `.dg-clamp` | clamp to `--dg-clamp` lines |
| `.dg-sub` | secondary line |
| `.dg-empty-value` | the muted dash for empty cells |

## Permissions and visibility

- `can: false` — the column **does not exist**: it is not rendered, not in the column menu, not
  exported, not saved in state and not sent to the server. Use it for role-based columns
  (`can: user.isAdmin`).
- `visible: false` — the column exists but starts hidden; users can show it from the
  [column menu](/modules/colvis). Hidden columns are still sent to the server (in definition order).
- `hideable: false` — always visible.

## Changing columns at runtime

`grid.setColumns(defs)` swaps the column set without destroying the grid: the header is rebuilt,
sorts on removed columns are dropped, `columnchange` fires and the data reloads.
`grid.setColumnVisible(key, bool)` toggles one column.

## Related

- [Column options reference](/reference/columns)
- [Export](/modules/export) — how typed columns become real Excel numbers and dates
- [Server protocols](/guide/server-protocols) — how columns are sent to the server
