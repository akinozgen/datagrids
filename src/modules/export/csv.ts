// csv(): RFC 4180 CSV export with BOM, locale delimiter and formula-injection guard.
import type { ModuleDef } from "../../core/types";
import { addMenuItem, collect, exportIcons, exportMessages, runExport, type ExportOptions } from "./menu";
import { decimalsOf, fileName, formatDate, hasTime, saveBlob, type Cell, type Sheet, type SheetColumn } from "./values";

export interface CsvOptions extends ExportOptions {
  filename?: string | (() => string);
  /** default `;` for Turkish locales, `,` otherwise */
  delimiter?: string;
  /** UTF-8 byte order mark so spreadsheets detect the encoding (default true) */
  bom?: boolean;
}

export interface CsvApi {
  download(): Promise<void>;
  /** CSV text (without BOM) */
  text(): Promise<string>;
}

export interface CsvFormat {
  delimiter: string;
  /** decimal separator for numbers */
  decimal: string;
  locale: string;
  yes: string;
  no: string;
  bom?: boolean;
}

// text cells starting with these are prefixed with ' (spreadsheet formula injection)
const FORMULA = /^[=+\-@\t\r]/;

function field(v: Cell, col: SheetColumn | undefined, f: CsvFormat): string {
  let s: string;
  if (v == null) return "";
  if (typeof v === "number") {
    const dec = col && (col.type === "number" || col.type === "money") ? decimalsOf(col.format) : undefined;
    s = (dec !== undefined ? v.toFixed(dec) : String(v)).replace(".", f.decimal);
  } else if (typeof v === "boolean") s = v ? f.yes : f.no;
  else if (v instanceof Date) s = formatDate(v, hasTime(col?.format, v), f.locale);
  else s = FORMULA.test(v) ? `'${v}` : v;
  return s.includes(f.delimiter) || /["\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Serialises a sheet as CSV (CRLF line endings). */
export function toCsv(sheet: Sheet, f: CsvFormat): string {
  const line = (cells: ReadonlyArray<Cell>) => sheet.columns.map((c, i) => field(cells[i] ?? null, c, f)).join(f.delimiter);
  const lines = [sheet.columns.map((c) => field(c.title, undefined, f)).join(f.delimiter)];
  for (const r of sheet.rows) lines.push(line(r));
  for (const r of sheet.footer ?? []) lines.push(line(r));
  return (f.bom ? "﻿" : "") + lines.join("\r\n") + "\r\n";
}

export function csv(opts: CsvOptions = {}): ModuleDef<"csv", CsvApi> {
  return Object.freeze({
    name: "csv",
    kind: "export",
    can: opts.can,
    setup(ctx) {
      const m = exportMessages(ctx.locale, opts.messages);
      const tr = ctx.locale.startsWith("tr");
      const fmt = (bom: boolean): CsvFormat => ({
        delimiter: opts.delimiter ?? (tr ? ";" : ","),
        decimal: tr ? "," : ".",
        locale: ctx.locale,
        yes: m.yes,
        no: m.no,
        bom,
      });
      const text = async () => toCsv((await collect(ctx, opts, m)).sheet, fmt(false));
      const download = () =>
        runExport(ctx, m, async () => {
          const { sheet, rows } = await collect(ctx, opts, m);
          const body = toCsv(sheet, fmt(opts.bom !== false));
          saveBlob(new Blob([body], { type: "text/csv;charset=utf-8" }), fileName(opts.filename, ctx.grid, "csv"));
          return rows.length;
        });
      const remove = addMenuItem(ctx, m, { id: "csv", order: 20, label: opts.label ?? m.csv, icon: exportIcons.file, run: download }, opts);
      return { api: { download, text }, destroy: remove };
    },
  } as ModuleDef<"csv", CsvApi>);
}
// stable lookup name for grid.module(csv) (survives minification)
csv.moduleName = "csv";
