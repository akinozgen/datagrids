---
title: excel · csv · print
type: module
description: Export the grid as a dependency-free XLSX file with real numbers and dates, as CSV, or as a light print view (and PDF from the browser) — all from one Export menu.
since: 0.1.0
---

# excel · csv · print

Three export modules that share one **Export** menu in the toolbar: a real `.xlsx` workbook built
in the browser without dependencies, a spreadsheet-safe CSV, and a light print view (choose
"Save as PDF" in the print dialog for a PDF).

<Demo id="mod-export-menu" />

On a server grid, `scope: "all"` fetches every matching row in **one** request capped at
`maxPageSize` (200 here) and tells the user when the file was cut short:

<Demo id="mod-export-server" />

## When to use it

Use them whenever people take a list elsewhere: a spreadsheet for analysis (`excel`), another
system (`csv`), or paper and PDF (`print`). Attach only the ones you need — each adds one item to
the shared menu. For server exports larger than `maxPageSize`, let the server build the file (see
[Big server exports](#big-server-exports)).

## Usage

```js
import { Datagrid, excel, csv, print } from "@akinozgen17/datagrids";

new Datagrid("#agents", {
  label: "Field agents",
  columns,
  use: [source, excel(), csv(), print()],
});
```

Name the file, export every matching row of a server grid, and include the footer:

```js
excel({ filename: () => `agents-${new Date().toISOString().slice(0, 10)}`, scope: "all", footer: true });
```

Export from your own button:

```js
await grid.excel.download();
const blob = await grid.excel.blob(); // upload it instead of downloading
const text = await grid.csv.text();
```

### What ends up in the file

Exports contain the **visible**, exportable columns (not the select / actions / row-number
columns), in display order. Each cell goes through one pipeline:

1. `exportValue(row)` when the column has one, else the cell's value;
2. the column type: `money` and `number` become numbers, `date` a real date, `badge` its label;
3. HTML is stripped to text, HTML entities decoded;
4. numeric text in Turkish format (`"1.234,50"`) is parsed into a number.

Set `exportType` (`"string" | "number" | "money" | "date" | "boolean"`) and `exportFormat` (a
spreadsheet number format such as `#,##0.00 "$"` or `dd.mm.yyyy`) on a column to override, or
`exportable: false` to leave it out. See [Columns](/guide/columns).

### Excel

A dependency-free XLSX writer: one sheet, real numbers with their number format (money keeps its
currency), real dates, a bold frozen header row, an autoFilter over the data, column widths from
the content, and the footer rows in bold below the data (outside the filter range).

### CSV

UTF-8 with a byte order mark (so spreadsheets detect the encoding), CRLF line endings and RFC 4180
quoting. The delimiter and decimal mark follow the locale (`;` and `,` for Turkish, `,` and `.`
otherwise); booleans become Yes / No. Text that starts with `=`, `+`, `-`, `@`, a tab or a carriage
return is prefixed with `'` so a spreadsheet never runs it as a formula.

### Print

A hidden iframe gets a plain-text copy of the table with about 1 KB of print CSS — no site CSS and
no cell HTML, so even large lists print quickly. The header repeats on every page, numbers are
right-aligned, and a line under the title shows the record count and the date. For a PDF, choose
"Save as PDF" in the browser's print dialog.

### Big server exports

`scope: "all"` on a server grid sends **one** request for up to `maxPageSize` rows (default 1000)
and, when more rows match, says "Only the first 1,000 of 4,210 records were exported" (to the
`notify` adapter and the live region). For more, let the server build the file from the grid's
current query:

```js
button.custom({
  label: "Export all",
  icon: "download",
  onClick: (grid) => {
    const { search, sort, filters } = grid.query();
    const params = new URLSearchParams({ search, sort: JSON.stringify(sort), filters: JSON.stringify(filters) });
    location.assign(`/agents/export?${params}`);
  },
});
```

## Options

Shared by `excel()`, `csv()` and `print()`:

| Option | Type | Default | Description |
|---|---|---|---|
| `scope` | `"page" \| "all"` | client grids `"all"`, server grids `"page"` | `page` = the rows on screen; `all` = every filtered row (server: one request ≤ `maxPageSize`). |
| `footer` | `boolean` | `false` | Include the `<tfoot>` rows (for example from [footer](/modules/footer)) after the data. |
| `label` | `string` | "Excel (.xlsx)", "CSV", "Print" | Menu item text. |
| `slot`, `order` | `"start" \| "end"`, `number` | `"start"`, `40` | Where the shared Export menu sits; the first export module attached decides. |
| `messages` | `Partial<ExportMessages>` | locale (`en` / `tr`) | `menu`, `excel`, `csv`, `print`, `yes`, `no`, `records`, `done(n)`, `failed`, `truncated(n, total)`. |
| `can` | `boolean` | `true` | Permission flag: `false` → no menu item. |

`excel()` only:

| Option | Type | Default | Description |
|---|---|---|---|
| `filename` | `string \| () => string` | `{grid name}-{yyyy-mm-dd}.xlsx` (`export-…` without a name) | Extension added when missing; `/ \ : * ? " < > \|` are replaced. |
| `sheetName` | `string \| () => string` | grid name, else `Sheet1` | Worksheet name (max 31 characters). |

`csv()` only:

| Option | Type | Default | Description |
|---|---|---|---|
| `filename` | `string \| () => string` | `{grid name}-{yyyy-mm-dd}.csv` | As for Excel. |
| `delimiter` | `string` | `;` for Turkish locales, `,` otherwise | Field separator. |
| `bom` | `boolean` | `true` | Prefix the UTF-8 byte order mark. |

`print()` only:

| Option | Type | Default | Description |
|---|---|---|---|
| `title` | `string \| () => string` | the grid's label, else `document.title` | Heading and document title of the print view. |

## API added to the grid

| Member | Returns | Description |
|---|---|---|
| `grid.excel.download()` | `Promise<void>` | Builds the workbook and downloads it. |
| `grid.excel.blob()` | `Promise<Blob>` | Builds the workbook. |
| `grid.csv.download()` | `Promise<void>` | Builds and downloads the CSV (with BOM). |
| `grid.csv.text()` | `Promise<string>` | The CSV text (without BOM). |
| `grid.print.open()` | `Promise<void>` | Builds the print view and opens the print dialog. |

Typed access: `grid.module(excel)`, `grid.module(csv)`, `grid.module(print)`. The core
`grid.exportRows(scope)` returns the rows an export would use.

## Events

| Event | Payload | When |
|---|---|---|
| `beforePrint` | `{ document, window, cancel() }` | The print document is ready, before the dialog opens. Decorate `document` (a logo, a filter summary) or `cancel()` to skip the dialog. |

## Pipelines it plugs into

- **Toolbar**: one shared **Export** menu button per grid, `start` slot, order `40`; items in the
  order Excel, CSV, Print. The button shows a spinner while a file is built.
- **Export**: each column contributes its cell values through `exportValue`, `exportType` and
  `exportFormat`; [footer](/modules/footer) contributes the `<tfoot>` rows with `footer: true`.

## Works with

- **Enhanced by** [footer](/modules/footer) (`footer: true`), [colVis](/modules/colvis) (only
  visible columns are exported) and [colReorder](/modules/col-reorder) (display order).
- **Host adapters**: the truncation notice and failures go to `notify` when one is configured
  (see [actions → Confirm and notifications](/modules/actions#confirm-and-notifications)).

## Accessibility

- The Export button follows the APG menu-button pattern (`aria-haspopup="menu"`, `↓` / `↑` open
  on the first / last item, arrows move, `Esc` and `Tab` close). Its name stays "Export" when a
  narrow grid hides the text.
- While a file is built the button is `aria-busy`; the result is announced politely
  ("120 records exported", "Export failed").
- The print view is a plain, high-contrast table with real `<th scope="col">` headers.

## Replaces in DataTables

| DataTables (Buttons, 1.10 / 2.x / 3.x) | datagrids |
|---|---|
| `excelHtml5` (needs JSZip) | `excel()` — no dependency |
| `csvHtml5` | `csv()` |
| `print` | `print()` |
| `pdfHtml5` (needs pdfmake) | `print()` + "Save as PDF" |
| `exportOptions: { columns: ":visible" }` | Default |
| `exportOptions.format.body` / `orthogonal: "export"` | Column `exportValue` |
| `footer: true` | `footer: true` |
| `filename`, `title`, `sheetName` | `filename`, `title`, `sheetName` |
| `customize(xlsx)` editing the sheet XML | Column `exportType` / `exportFormat` |

## Gotchas

- **The Excel file from a server grid has only 10 rows.** Server grids export the current page by
  default; set `scope: "all"`.
- **"Only the first 1,000 of … records were exported."** `scope: "all"` is capped at
  `maxPageSize`; build bigger files on the server from `grid.query()`.
- **A column is missing from the file.** It is hidden, `exportable: false`, or a special column.
- **Numbers arrived as text.** The column is untyped and its values are not plain numbers; set
  `exportType: "number"` or return a number from `exportValue`.
- **The CSV opens as one column.** The spreadsheet expects another delimiter; set `delimiter`.
- **A cell starts with an apostrophe.** That is the formula-injection guard for text starting with
  `=`, `+`, `-` or `@`.
- **The print view has none of my styles.** By design; decorate it in `beforePrint`.

## Related

- [footer](/modules/footer) · [Columns → export values](/guide/columns) · [Recipe: export](/recipes/export)
