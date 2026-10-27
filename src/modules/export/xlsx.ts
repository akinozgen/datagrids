// Zero-dependency XLSX writer: one sheet, inline strings, real numbers,
// number/money/date formats, bold + frozen header, autoFilter, content-based widths, optional footer.
import type { Cell, Sheet, SheetColumn } from "./values";
import { decimalsOf, esc, hasTime, suffixOf } from "./values";
import { zip } from "./zip";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG = "http://schemas.openxmlformats.org/package/2006/relationships";
const CT = "application/vnd.openxmlformats-officedocument.spreadsheetml";

/** 0 → A, 25 → Z, 26 → AA */
export function colName(i: number): string {
  let s = "";
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}

const EPOCH = Date.UTC(1899, 11, 30);
/** Spreadsheet serial of a local date-time (what the user saw in the grid). */
export const serial = (d: Date): number =>
  Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()) - EPOCH) / 1000) / 86400;

const BUILTIN = new Map<string, number>([["General", 0], ["0", 1], ["0.00", 2], ["#,##0", 3], ["#,##0.00", 4]]);

/** Escapes spaces (and dots in date formats) outside quoted literals. */
function fmtCode(f: string, date: boolean): string {
  let out = "";
  let quoted = false;
  for (const ch of f) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === " " || (date && ch === ".")) && !out.endsWith("\\")) out += "\\";
    out += ch;
  }
  return out;
}

class Styles {
  private fmts = new Map<string, number>();
  private xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  private keys = new Map<string, number>([["0|0", 0]]);
  private nextFmt = 164;

  get(format: string | undefined, bold: boolean, date = false): number {
    let id = 0;
    if (format) {
      const code = fmtCode(format, date);
      const known = BUILTIN.get(format) ?? this.fmts.get(code);
      if (known === undefined) this.fmts.set(code, (id = this.nextFmt++));
      else id = known;
    }
    const key = `${id}|${bold ? 1 : 0}`;
    let x = this.keys.get(key);
    if (x === undefined) {
      x = this.xfs.length;
      this.keys.set(key, x);
      this.xfs.push(
        `<xf numFmtId="${id}" fontId="${bold ? 1 : 0}" fillId="0" borderId="0" xfId="0"${id ? ' applyNumberFormat="1"' : ""}${bold ? ' applyFont="1"' : ""}/>`,
      );
    }
    return x;
  }

  xml(): string {
    const fmts = Array.from(this.fmts, ([code, id]) => `<numFmt numFmtId="${id}" formatCode="${esc(code)}"/>`);
    return (
      `${XML}<styleSheet xmlns="${NS}">` +
      (fmts.length ? `<numFmts count="${fmts.length}">${fmts.join("")}</numFmts>` : "") +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs>` +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      "</styleSheet>"
    );
  }
}

const isNumType = (c: SheetColumn) => c.type === "number" || c.type === "money";
const DATE_FMT = "dd.mm.yyyy";
const DATETIME_FMT = "dd.mm.yyyy hh:mm";

function cellXml(ref: string, v: Cell, col: SheetColumn, st: Styles, bold: boolean): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const f = col.type === "date" && col.format ? col.format : hasTime(undefined, v) ? DATETIME_FMT : DATE_FMT;
    return `<c r="${ref}" s="${st.get(f, bold, true)}"><v>${serial(v)}</v></c>`;
  }
  if (typeof v === "number") {
    const s = st.get(isNumType(col) ? col.format : undefined, bold);
    return `<c r="${ref}"${s ? ` s="${s}"` : ""}><v>${v}</v></c>`;
  }
  if (typeof v === "boolean") {
    const s = st.get(undefined, bold);
    return `<c r="${ref}" t="b"${s ? ` s="${s}"` : ""}><v>${v ? 1 : 0}</v></c>`;
  }
  const s = st.get(undefined, bold);
  return `<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ""}><is><t xml:space="preserve">${esc(v.slice(0, 32767))}</t></is></c>`;
}

/** Approximate display width (characters) of a cell. */
function widthOf(v: Cell, col: SheetColumn): number {
  if (v == null) return 0;
  if (typeof v === "boolean") return 6;
  if (v instanceof Date) return hasTime(col.format, v) ? 16 : 10;
  if (typeof v === "number") {
    if (!isNumType(col)) return String(v).length;
    const dec = decimalsOf(col.format) ?? 0;
    const digits = String(Math.trunc(Math.abs(v))).length;
    const suf = suffixOf(col.format);
    return digits + Math.floor((digits - 1) / 3) + (dec ? dec + 1 : 0) + (v < 0 ? 1 : 0) + (suf ? suf.length + 1 : 0);
  }
  let max = 0;
  for (const line of v.split("\n")) max = Math.max(max, line.length);
  return max;
}

export interface XlsxOptions {
  sheetName?: string;
  /** false → STORE only (tests); default uses CompressionStream when available */
  compress?: boolean;
}

/** Sheet names: max 31 chars, no `[]:*?/\`, not empty. */
export const sheetName = (s: string | undefined): string => (s ?? "").replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Sheet1";

/** Builds the worksheet XML (exported for tests). */
export function sheetXml(sheet: Sheet, st: Styles = new Styles()): string {
  const { columns, rows } = sheet;
  const footer = sheet.footer ?? [];
  const n = columns.length;
  const head = st.get(undefined, true);
  const widths = columns.map((c) => c.title.length + 4);
  const sample = rows.length > 500 ? rows.slice(0, 500) : rows;
  for (const r of [...sample, ...footer]) for (let i = 0; i < n; i++) widths[i] = Math.max(widths[i]!, widthOf(r[i] ?? null, columns[i]!) + 2);

  const out: string[] = [];
  out.push(`<row r="1">${columns.map((c, i) => `<c r="${colName(i)}1" t="inlineStr" s="${head}"><is><t xml:space="preserve">${esc(c.title)}</t></is></c>`).join("")}</row>`);
  rows.forEach((r, ri) => {
    const rn = ri + 2;
    let x = `<row r="${rn}">`;
    for (let i = 0; i < n; i++) x += cellXml(colName(i) + rn, r[i] ?? null, columns[i]!, st, false);
    out.push(`${x}</row>`);
  });
  footer.forEach((r, fi) => {
    const rn = rows.length + 2 + fi;
    let x = `<row r="${rn}">`;
    for (let i = 0; i < n; i++) x += cellXml(colName(i) + rn, r[i] ?? null, columns[i]!, st, true);
    out.push(`${x}</row>`);
  });

  const cols = n
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(60, Math.max(6, w))}" customWidth="1"/>`).join("")}</cols>`
    : "";
  const filter = n ? `<autoFilter ref="A1:${colName(n - 1)}${rows.length + 1}"/>` : "";
  return (
    `${XML}<worksheet xmlns="${NS}" xmlns:r="${REL}">` +
    `<sheetViews><sheetView workbookViewId="0">${n ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ""}</sheetView></sheetViews>` +
    `${cols}<sheetData>${out.join("")}</sheetData>${filter}</worksheet>`
  );
}

/** Builds the .xlsx package bytes. */
export async function toXlsx(sheet: Sheet, o: XlsxOptions = {}): Promise<Uint8Array<ArrayBuffer>> {
  const st = new Styles();
  const name = sheetName(o.sheetName);
  const ws = sheetXml(sheet, st);
  const n = sheet.columns.length;
  const quoted = `'${name.replace(/'/g, "''")}'`;
  const defined = n
    ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">${esc(quoted)}!$A$1:$${colName(n - 1)}$${sheet.rows.length + 1}</definedName></definedNames>`
    : "";
  return zip(
    [
      [
        "[Content_Types].xml",
        `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="${CT}.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="${CT}.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="${CT}.styles+xml"/></Types>`,
      ],
      ["_rels/.rels", `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
      [
        "xl/workbook.xml",
        `${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets><sheet name="${esc(name)}" sheetId="1" r:id="rId1"/></sheets>${defined}</workbook>`,
      ],
      [
        "xl/_rels/workbook.xml.rels",
        `${XML}<Relationships xmlns="${PKG}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
      ],
      ["xl/styles.xml", st.xml()],
      ["xl/worksheets/sheet1.xml", ws],
    ],
    o.compress,
  );
}
