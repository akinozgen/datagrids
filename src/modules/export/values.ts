// Export value pipeline: exportValue → typed default → HTML cleanup → TR number parsing.
import type { DatagridApi, ExportType, ResolvedColumn, Row } from "../../core/types";
import { getPath, htmlToText } from "../../core/util";
import { parseNumber } from "../../core/collate";
import { parseDate } from "../../columns/index";

export type Cell = string | number | boolean | Date | null;

export interface SheetColumn {
  key: string;
  title: string;
  type: ExportType;
  /** spreadsheet number format (`#,##0.00 "₺"`, `dd.mm.yyyy hh:mm`) */
  format?: string;
}

export interface Sheet {
  columns: SheetColumn[];
  rows: Cell[][];
  /** summary rows (bold, outside the autoFilter range) */
  footer?: Cell[][];
}

/** XML text escape; strips characters XML 1.0 cannot carry. */
export const esc = (s: string): string =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const HTML_RE = /<[a-z!/]|&(?:#\d+|#x[\da-f]+|[a-z]+\d*);/i;

/** Columns that take part in an export: visible, exportable, not a special (select/actions/rownum) column. */
export function exportColumns(cols: ReadonlyArray<ResolvedColumn>): ResolvedColumn[] {
  return cols.filter((c) => c.visible && c.exportable && !c.col);
}

function textOf(v: unknown, col: ResolvedColumn, escaped = false): string {
  if (typeof Node !== "undefined" && v instanceof Node) {
    const box = document.createElement("div");
    box.append(v.cloneNode(true));
    return htmlToText(box.innerHTML);
  }
  const s = String(v);
  // markup is stripped only where the grid renders markup: html columns, or untyped columns of an
  // HTML-default source; plain text keeps "<…>" and "a<b" as they are on screen
  const asHtml = col.html ?? (col.text ? false : escaped);
  return asHtml || (escaped && s.includes("&")) ? htmlToText(s) : s.trim();
}

function toDate(s: string): Date | null {
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{4}/.test(s)) return parseDate(s, "dmy");
  if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/.test(s)) return parseDate(s, "local");
  return parseDate(s, "iso");
}

const TRUE_RE = /^(?:1|true|yes|evet|var|aktif|on)$/i;
const FALSE_RE = /^(?:0|false|no|hayır|hayir|yok|pasif|off)$/i;

/** Normalises any value to a spreadsheet cell for the given export type. */
export function toCell(v: unknown, type: ExportType | undefined, col: ResolvedColumn, escaped = false): Cell {
  if (v == null || v === "") return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  const s = textOf(v, col, escaped);
  if (!s) return null;
  if (type === "number" || type === "money") return parseNumber(s) ?? s;
  if (type === "date") return toDate(s) ?? s;
  if (type === "boolean") return TRUE_RE.test(s) ? true : FALSE_RE.test(s) ? false : s;
  return s;
}

/** Export type of a column: explicit `exportType`, else the column type, else inferred from the first value. */
export function columnType(col: ResolvedColumn, rows: ReadonlyArray<Row>): ExportType {
  if (col.exportType) return col.exportType;
  if (col.type === "money" || col.type === "number" || col.type === "date") return col.type;
  for (let i = 0; i < rows.length && i < 50; i++) {
    const v = rawValue(col, rows[i]!);
    if (v == null || v === "") continue;
    if (typeof v === "number") return "number";
    if (typeof v === "boolean") return "boolean";
    if (v instanceof Date) return "date";
    return "string";
  }
  return "string";
}

function rawValue(col: ResolvedColumn, row: Row): unknown {
  if (col.exportValue) return col.exportValue(row);
  return col.value ? col.value(row) : getPath(row, col.data ?? col.key);
}

/** Value of one cell: `exportValue(row)` → typed default → plain text (HTML stripped) → TR numbers. */
export function exportCell(col: ResolvedColumn, row: Row, type: ExportType = columnType(col, [row]), escaped = false): Cell {
  return toCell(rawValue(col, row), type, col, escaped);
}

const defaultFormat = (type: ExportType): string | undefined =>
  type === "money" ? "#,##0.00" : type === "date" ? "dd.mm.yyyy" : undefined;

/** Builds the neutral sheet (header + typed cells) from rows. */
/** `escaped`: the source sends server-escaped text (HTML-default protocols such as yajra). */
export function buildSheet(cols: ReadonlyArray<ResolvedColumn>, rows: ReadonlyArray<Row>, footer?: HTMLTableSectionElement | null, escaped = false): Sheet {
  const list = exportColumns(cols);
  const types = list.map((c) => columnType(c, rows));
  const columns: SheetColumn[] = list.map((c, i) => ({
    key: c.key,
    title: c.title,
    type: types[i]!,
    format: c.exportFormat ?? defaultFormat(types[i]!),
  }));
  const sheet: Sheet = { columns, rows: rows.map((r) => list.map((c, i) => exportCell(c, r, types[i], escaped))) };
  if (footer) sheet.footer = footerRows(footer, cols, list, types);
  return sheet;
}

/** Reads `<tfoot>` rows and aligns their cells with the export columns (by `data-key`, else by visible index). */
function footerRows(tfoot: HTMLTableSectionElement, all: ReadonlyArray<ResolvedColumn>, list: ResolvedColumn[], types: ExportType[]): Cell[][] {
  const visible = all.filter((c) => c.visible);
  const out: Cell[][] = [];
  for (const tr of Array.from(tfoot.rows)) {
    const cells = Array.from(tr.cells);
    const byIndex: Array<HTMLTableCellElement | undefined> = [];
    for (const td of cells) {
      byIndex.push(td);
      for (let s = 1; s < td.colSpan; s++) byIndex.push(undefined);
    }
    const row = list.map((c, i) => {
      const td = cells.find((x) => x.dataset.key === c.key) ?? byIndex[visible.indexOf(c)];
      if (!td) return null;
      const s = htmlToText(td.innerHTML);
      if (!s) return null;
      const t = types[i];
      return t === "number" || t === "money" ? parseNumber(s) ?? s : s;
    });
    if (row.some((v) => v != null)) out.push(row);
  }
  return out;
}

/** Rows for an export: explicit scope, else client → every filtered row, server → the loaded page. */
export async function exportRows(grid: DatagridApi, scope?: "page" | "all"): Promise<Row[]> {
  return grid.exportRows(scope ?? (gridMode(grid) === "client" ? "all" : "page"));
}

export function gridMode(grid: DatagridApi): "client" | "server" {
  return grid.mode;
}

/* ---------- display formatting (print, CSV dates) ---------- */

/** Decimal places of a number format (`#,##0.00 "₺"` → 2), or undefined. */
export function decimalsOf(format: string | undefined): number | undefined {
  if (!format) return undefined;
  const m = format.match(/\.(0+)/);
  return m ? m[1]!.length : /0/.test(format) ? 0 : undefined;
}

/** Literal suffix of a format (`#,##0.00 "₺"` → "₺"). */
export function suffixOf(format: string | undefined): string {
  const m = format?.match(/"([^"]*)"/);
  return m ? m[1]! : "";
}

export const hasTime = (format: string | undefined, d: Date): boolean =>
  format ? /h/i.test(format) : d.getHours() + d.getMinutes() + d.getSeconds() > 0;

const pad = (n: number) => String(n).padStart(2, "0");

/** dd.mm.yyyy[ hh:mm] (TR) or yyyy-mm-dd[ hh:mm] (other locales). */
export function formatDate(d: Date, time: boolean, locale: string): string {
  const day = locale.startsWith("tr")
    ? `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
    : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return time ? `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
}

/** Human readable text of a cell (print view). */
export function displayCell(v: Cell, col: SheetColumn, locale: string, yes: string, no: string): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? yes : no;
  if (v instanceof Date) return formatDate(v, hasTime(col.format, v), locale);
  if (typeof v === "number") {
    const dec = decimalsOf(col.format);
    const s = new Intl.NumberFormat(locale, {
      minimumFractionDigits: dec ?? 0,
      maximumFractionDigits: dec ?? 6,
      useGrouping: col.type === "number" || col.type === "money" || col.format !== undefined,
    }).format(v);
    const suf = suffixOf(col.format);
    return suf ? `${s} ${suf}` : s;
  }
  return v;
}

/** File name with extension; `/\:*?"<>|` and control characters removed. */
export function fileName(name: string | (() => string) | undefined, grid: DatagridApi, ext: string): string {
  const base = (typeof name === "function" ? name() : name) || `${grid.name ?? "export"}-${formatDate(new Date(), false, "en")}`;
  const clean = base.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").trim() || "export";
  return clean.toLowerCase().endsWith(`.${ext}`) ? clean : `${clean}.${ext}`;
}

/** Triggers a browser download for a blob. */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
