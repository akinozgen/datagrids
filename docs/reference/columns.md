---
title: Column options
type: reference
description: Every ColumnDef field, every column factory (column.text … column.select, column.boolean) with its extra options and defaults, and the cell render-mode rules.
---

# Column options

A column is a plain `ColumnDef` object. The `column.*` factories build one with sensible typed
defaults; whatever you pass in the options object is spread over those defaults, so any field below
can be overridden (`column.money("amount", { align: "start" })`).

Cells are text by default; HTML is an explicit opt-in.

<Demo id="ref-columns" />

## ColumnDef fields

| Field | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | required | Column identity: used by `sort`, `filters`, `setColumnVisible`, state and export. Unique per grid. |
| `data` | `string` | `key` | Dotted path to the value in the row (`"unit.name"`). Sent as `columns[i][data]` on the SSP wire. |
| `name` | `string` | `""` | Server-side column name, sent as `columns[i][name]` (SSP wire only). |
| `title` | `string` | `key` | Header text; also used in the column menu, export headers and announcements. |
| `type` | `ColumnType` | set by the factory | `text`, `number`, `money`, `date`, `badge`, `link`, `html`, `boolean`, `index`, `actions`, `select`. Drives export typing and the operators of [column filters](/modules/column-filters). |
| `sortable` | `boolean` | `true` (`false` for special columns) | Header becomes a sort button with a permanent sort icon. |
| `sortKey` | `string` | — | Client mode: sort by this row path instead of the cell value. Server protocols sort by the column itself. |
| `searchable` | `boolean` | `true` (`false` for special columns) | Included in the toolbar search. |
| `visible` | `boolean` | `true` | Initial visibility (also the "reset" target of the column menu). |
| `hideable` | `boolean` | `true` (`false` for special columns) | Offered in the [column menu](/modules/colvis); `setColumnVisible(key, false)` is refused otherwise. |
| `exportable` | `boolean` | `true` (`false` for special columns) | Included in Excel, CSV and print exports. |
| `align` | `"start" \| "end" \| "center"` | `start` (`end` for number and money) | Written as `data-align` on the `<th>` and `<td>`. |
| `className` | `string` | — | Class for the column's `<th>` and `<td>` cells. |
| `defaultContent` | `string` | — | Text for an empty value. Without it an empty cell shows a muted dash (`—`). |
| `can` | `boolean` | `true` | Permission flag: `false` removes the column everywhere — render, column menu, export, state and the request. |
| `lazy` | `boolean` | `false` | Server-computed on demand: with the [lazyColumns](/modules/lazy-columns) module the column is requested only while it is visible. |
| `html` | `boolean` | — | `true` writes the value (or a string returned by `render`) as HTML. |
| `text` | `boolean` | — | `true` forces text even when the source defaults to HTML. |
| `sticky` | `"start" \| "end"` | — | Pins the column to an edge while the table scrolls horizontally. |
| `render` | `(value, row, ctx) => Node \| string \| number \| null` | — | Cell content. A `Node` is appended as is; a string or number is written as text unless the column has `html: true`; `null`, `undefined` or `""` falls back to `defaultContent`. `ctx` is `{ row, key, index, position, td, locale }`: `key` is the column key, `index` the position in the view, `position` = page offset + index, `locale` the grid's locale. |
| `value` | `(row) => unknown` | — | Computed value; replaces the `data` lookup for render, search, client sort and client filters. |
| `compare` | `(a, b) => number` | collation of `locale` | Client sort comparator for two values. |
| `searchText` | `(value, row) => string` | `String(value)` | Text the client search matches against. |
| `exportValue` | `(row) => unknown` | — | Value written to exports instead of the cell value. |
| `exportType` | `"string" \| "number" \| "money" \| "date" \| "boolean"` | from `type`, else inferred | Cell type in Excel; numbers and dates stay real numbers and dates. |
| `exportFormat` | `string` | by type | Excel number format, e.g. `"#,##0.00"`, `"dd.mm.yyyy"`. |
| `labels` | `Record<string, string>` | — | Value → label map. Used by badge columns, column filters and export. |
| `col` | `"select" \| "actions" \| "rownum" \| "go" \| "handle"` | — | Marks a special column filled by the core or a module. Set by `column.select()`, `column.actions()`, `column.index()`, `reorderColumn()` and the `rowClick` option; don't set it yourself. |

Special columns (with `col`) are not sortable, searchable, hideable or exportable unless you say
otherwise, keep their position when columns are reordered, and are left out of exports.

## Render mode

Every cell is either written with `textContent` (text) or `innerHTML` (HTML). The rules, in order:

1. `render` returns a `Node` → appended as is (all typed factories do this).
2. `html: true` (or `column.html()`) → HTML, for the raw value and for strings returned by `render`.
3. `text: true` (or `column.text()`) → text.
4. A `render` function that returns a string → text.
5. Otherwise the data source decides:

| Source | Untyped cells |
|---|---|
| `data: [...]` / `arraySource`, `fetchAll` | text |
| `serverSide` with `ssp()`, `dgp()`, `laravelPaginator()` | text |
| `serverSide` with `yajra()` | HTML — yajra escapes non-raw columns on the server, so text would show `&amp;` |
| DOM source (existing `<tbody>`) | HTML — the original rows are adopted, cell markup survives |
| `customSource` | its `cells` setting, default text |

On a yajra endpoint leave escaped string columns untyped. Use `column.text()` only for a column the
endpoint sends **unescaped** (listed in `rawColumns`) that must still be shown as plain text.

## Formatting locale

`number`, `money` and `date` format with the **grid's `locale`** unless you pass `locale` on the
column; money uses **TRY** unless you pass `currency`.

```js
column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" });
column.date("date", { title: "Date", locale: "en-US" });
```

## column.text(key, options?)

Plain text, always written with `textContent`.

| Sets | Value |
|---|---|
| `type` | `"text"` |
| `text` | `true` |

## column.html(key, options?)

Raw HTML from the row value: the explicit opt-in. Only use it for markup your server produced and
escaped.

| Sets | Value |
|---|---|
| `type` | `"html"` |
| `html` | `true` |
| `searchText` | the value with tags stripped |
| `exportValue` | the value with tags stripped |

## column.number(key, options?)

| Extra option | Type | Default | Description |
|---|---|---|---|
| `decimals` | `number` | — | Fixed fraction digits. Without it: 0 to 2 digits as needed. |
| `locale` | `string` | grid locale | `Intl.NumberFormat` locale. |
| `source` | `"number" \| "tr"` | `"number"` | How strings are read. `number`: machine numbers as a database sends them (`"0.125"`, `"1.500"` = 1.5); other strings are read leniently. `tr`: formatted text (`"1.234,5"`, `"1.500"` = 1500). |

| Sets | Value |
|---|---|
| `type` / `align` | `"number"` / `"end"` |
| `compare` | numeric; empty values first |
| `exportType` / `exportFormat` | `"number"` / `"#,##0"` (`"#,##0.00"` with `decimals: 2`) |
| `exportValue` | the parsed number |
| render | `<span class="dg-num">`; negative values get `data-sign="neg"` |

## column.money(key, options?)

| Extra option | Type | Default | Description |
|---|---|---|---|
| `currency` | `string` (ISO 4217) | `"TRY"` | Symbol shown after the amount: `₺`, `$`, `€`, otherwise the code itself. |
| `decimals` | `number` | `2` | Fraction digits (display and export format). |
| `locale` | `string` | grid locale | `Intl.NumberFormat` locale. |
| `source` | `"number" \| "tr" \| "html"` | `"number"` | How the value is read. `number`: machine numbers (`"1234.50"`, `"1.500"` = 1.5), other strings leniently (`1.234,50`, `1,234.50`). `tr`: formatted text (`"1.500"` = 1500). `html` strips tags first (server-rendered amounts). |

| Sets | Value |
|---|---|
| `type` / `align` | `"money"` / `"end"` |
| `compare` | numeric on the parsed value |
| `exportType` / `exportFormat` | `"money"` / `#,##0.00 "₺"` (symbol of `currency`) |
| `exportValue` | the parsed number |
| `searchText` | the amount with a decimal comma (`1234,50`) |
| render | `<span class="dg-money">` + `<span class="dg-money-cur">`; negative values get `data-sign="neg"` |

## column.date(key, options?)

| Extra option | Type | Default | Description |
|---|---|---|---|
| `source` | `"iso" \| "local" \| "dmy"` | `"iso"` | Input format. `iso`: anything `new Date()` parses (offset-aware ISO 8601). `local`: `YYYY-MM-DD[ HH:MM[:SS]]` in the browser's time zone. `dmy`: `DD.MM.YYYY[ HH:MM[:SS]]` (`.`, `/` or `-`). `Date` objects are used as they are. |
| `time` | `boolean` | `false` | Adds the time (`HH:MM`) in a second span. |
| `timeZone` | `string` (IANA) | browser zone | Zone used for display, e.g. `"Europe/Istanbul"`. |
| `locale` | `string` | grid locale | `Intl.DateTimeFormat` locale (day, month, year as 2-digit/2-digit/numeric). |

| Sets | Value |
|---|---|
| `type` | `"date"` |
| `compare` | by time; unparseable values first |
| `exportType` / `exportFormat` | `"date"` / `"dd.mm.yyyy"` (`"dd.mm.yyyy hh:mm"` with `time`) |
| `exportValue` | a `Date` |
| `searchText` | the formatted date |
| render | `<span class="dg-date">` (+ `<span class="dg-date-time">`) |

## column.badge(key, options?)

| Extra option | Type | Default | Description |
|---|---|---|---|
| `labels` | `Record<string, string>` | `{}` | Value → label. Unlisted values show as they are. |
| `tones` | `Record<string, Tone>` | `{}` | Value → chip tone: `info`, `ok`, `warn`, `bad`, `accent`; `neutral`, `muted` or no tone draw a neutral chip. |

| Sets | Value |
|---|---|
| `type` | `"badge"` |
| `labels` | the map (column filters offer it as choices) |
| `compare` | by label |
| `searchText` / `exportValue` | the label |
| render | `<span class="dg-chip" data-tone="…">` |

## column.link(key, options)

| Extra option | Type | Default | Description |
|---|---|---|---|
| `href` | `string \| (row) => string` | required | URL template with `{path}` placeholders (`"/agents/{id}"`, `"/units/{unit.id}/staff"`); each value is URL-encoded. A function's result is used as is. |
| `target` | `string` | — | Link target; `"_blank"` adds `rel="noopener"`. |

The URL must start with `http:`, `https:`, `mailto:`, `tel:`, `/`, `.` or `#`. Anything else
(`javascript:`, `data:`, a bare `agents/1`) renders the text without a link.

| Sets | Value |
|---|---|
| `type` | `"link"` |
| render | `<a class="dg-link">` with the cell value as text |

## column.phone(key, options?)

| Extra option | Type | Default | Description |
|---|---|---|---|
| `country` | `string` | `"90"` | Country calling code added when the number lacks it (a leading `0` is dropped). |
| `whatsapp` | `boolean` | `false` | Adds a second "WA" link to `https://wa.me/<digits>`. |

Renders the value as a `tel:` link (`type: "text"`).

## column.boolean(key, options?)

Yes / no with a permanent icon and text (colour is never the only signal).

| Extra option | Type | Default | Description |
|---|---|---|---|
| `labels` | `{ true?: string, false?: string }` | `Evet` / `Hayır` or `Yes` / `No` | Texts; the default follows the page language (`<html lang>`). |
| `showFalse` | `boolean` | `true` | `false` leaves false cells empty. |

Values are read as booleans: `1` / `0`, `true` / `false`, `"on"` / `"off"`, `"evet"` / `"hayır"`,
`"yes"` / `"no"`; anything else is empty.

| Sets | Value |
|---|---|
| `type` / `align` | `"boolean"` / `"center"` |
| `compare` | false before true; empty values first |
| `searchText` / `exportValue` | the label |
| render | `<span class="dg-bool" data-value="true\|false">` with an icon and `.dg-bool-text` |

## column.parseDate(), column.parseBool()

The readers behind `column.date()` and `column.boolean()`, exported for your own `render`, `value`
or `compare` functions:

```js
column.parseDate("05.01.2026 14:30", "dmy"); // Date (local time) or null
column.parseBool("evet");                     // true, false or null
```

## column.index(options?)

Row number that continues across pages (page offset + position).

| Sets | Value |
|---|---|
| `key` / `col` | `"__index"` / `"rownum"` |
| `title` | `"#"` |
| `sortable` / `searchable` | `false` |

## column.actions(options?)

Placeholder for the [actions](/modules/actions) module, which fills it with the row menu.

| Sets | Value |
|---|---|
| `key` / `col` | `"__actions"` / `"actions"` |
| `align` / `sticky` | `"end"` / `"end"` |
| `sortable`, `searchable`, `exportable`, `hideable` | `false` |

## column.select(options?)

Placeholder for the [selection](/modules/selection) module, which fills it with checkboxes.

| Sets | Value |
|---|---|
| `key` / `col` | `"__select"` / `"select"` |
| `title` | `""` |
| `sortable`, `searchable`, `exportable`, `hideable` | `false` |

## Header attributes (DOM source)

When a server-rendered table is enhanced without `columns`, these attributes on the `<thead>` cells
define the columns. See [Data sources](/guide/data-sources#dom-progressive-enhancement).

| Attribute | Effect |
|---|---|
| `data-dg-key` | Column key (default: a slug of the header text). |
| `data-dg-type` | Column type; `number` and `money` also right-align and sort numerically. Cells keep their server markup. |
| `data-dg-align` | `start`, `end` or `center`. |
| `data-dg-sortable="false"` | Not sortable. |
| `data-dg-searchable="false"` | Not searchable. |
| `data-dg-visible="false"` | Hidden initially. |
| `data-dg-hideable="false"` | Not offered in the column menu. |
| `data-dg-export="false"` | Left out of exports. |

A `data-order` attribute on a `<td>` is used as that cell's value for sorting and search instead of
its text.

## Gotchas

- **A string from `render` shows tags literally**: strings are text unless the column has
  `html: true`. Return a `Node`, or opt in with `html: true`.
- **`"1.250"` became 1.25 (or 1250)**: with the default `source: "number"` a machine-style string is
  read as a JS number (`"1.250"` = 1.25, as a DECIMAL column sends it). For formatted Turkish text
  (`"1.250"` meaning one thousand two hundred fifty) pass `source: "tr"`. Send numbers as JSON numbers
  when you can.
- **A date-only ISO string shows the previous day** in time zones west of UTC: `new Date("2026-01-05")`
  is UTC midnight. Use `source: "local"` for `YYYY-MM-DD` values.
- **The money symbol follows the amount** in every locale (`1,234.50 $`).
- **`column.index()` is never exported**; add a regular column if the export needs a number.

## Related

- [Columns guide](/guide/columns) · [Grid options](/reference/options) · [Export](/modules/export)
