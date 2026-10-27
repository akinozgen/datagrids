// Client-side sources and the in-memory engine (search, sort, paging).
import type { ColumnDef, DataSource, LoadResult, Query, ResolvedColumn, Row } from "../core/types";
import { collator, fold, parseNumber } from "../core/collate";
import { getPath, setPath } from "../core/util";

/** Rows given as an array (`data: []`). */
export function makeArraySource(rows: Row[] = []): DataSource & { readonly rows: Row[] } {
  return {
    name: "array",
    mode: "client",
    local: true,
    cells: "text",
    rows,
    load: async () => ({ rows: rows.slice(), total: rows.length, filtered: rows.length }),
  };
}

const slug = (s: string, i: number) =>
  fold(s, "tr")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || `c${i}`;

/**
 * Progressive enhancement of a server-rendered <tbody>: rows are read from the
 * DOM and the original <tr> nodes are adopted (cell HTML and widgets survive).
 */
export function makeDomSource(): DataSource {
  const nodes = new WeakMap<Row, HTMLTableRowElement>();
  let rows: Row[] | null = null;
  let keys: string[] = [];
  let trs: HTMLTableRowElement[] = [];
  return {
    name: "dom",
    mode: "client",
    local: true,
    cells: "html",
    prepare(table) {
      trs = Array.from(table.tBodies[0]?.rows ?? []).filter((tr) => !tr.classList.contains("dg-state-row"));
    },
    columns(table) {
      const ths = table.tHead?.rows[0]?.cells ?? [];
      keys = [];
      return Array.from(ths, (th, i) => {
        const title = (th.textContent ?? "").trim();
        let key = th.dataset.dgKey || slug(title, i);
        // two headers with the same title ("Tutar", "Tutar") still get two columns
        if (keys.includes(key)) key = `${key}_${i}`;
        keys.push(key);
        const def: ColumnDef = { key, title, data: key };
        const d = th.dataset;
        if (d.dgType) {
          def.type = d.dgType as ColumnDef["type"];
          if (def.type === "number" || def.type === "money") {
            def.align ??= "end";
            def.compare = (a, b) => (parseNumber(a) ?? -Infinity) - (parseNumber(b) ?? -Infinity);
          }
        }
        if (d.dgSortable === "false") def.sortable = false;
        if (d.dgSearchable === "false") def.searchable = false;
        if (d.dgVisible === "false") def.visible = false;
        if (d.dgHideable === "false") def.hideable = false;
        if (d.dgExport === "false") def.exportable = false;
        if (d.dgAlign) def.align = d.dgAlign as ColumnDef["align"];
        return def;
      });
    },
    async load(q) {
      if (!rows) {
        rows = [];
        // explicit column definitions: host cells map to them by their definition position (`can: false` included)
        const named: string[] = keys.slice();
        if (!keys.length) for (const c of q.columns) named[c.hostIndex ?? c.index] = c.data ?? c.key;
        for (const tr of trs) {
          const row: Row = {};
          Array.from(tr.cells).forEach((td, i) => {
            const k = named[i] ?? `c${i}`;
            setPath(row, k, td.dataset.order ?? (td.textContent ?? "").trim());
          });
          if (tr.id) row.DT_RowId = tr.id;
          nodes.set(row, tr);
          rows.push(row);
        }
      }
      return { rows: rows.slice(), total: rows.length, filtered: rows.length };
    },
    nodeFor: (row) => nodes.get(row),
  };
}

/** Plain-text value of a cell for search. */
export function cellSearchText(col: ResolvedColumn, row: Row): string {
  const v = col.value ? col.value(row) : getPath(row, col.data ?? col.key);
  if (col.searchText) return col.searchText(v, row);
  return v == null ? "" : String(v);
}

export function cellValue(col: ColumnDef, row: Row): unknown {
  return col.value ? col.value(row) : getPath(row, col.data ?? col.key);
}

/** Search + filter + sort + page entirely in memory. */
export function runClient(all: Row[], q: Query, locale: string, cache: WeakMap<Row, string>): LoadResult & { view: Row[] } {
  let rows = all;
  const term = q.search.trim();
  if (term) {
    const words = fold(term, locale).split(/\s+/).filter(Boolean);
    const cols = q.columns.filter((c) => c.searchable && !c.col);
    rows = rows.filter((r) => {
      let hay = cache.get(r);
      if (hay === undefined) {
        hay = fold(cols.map((c) => cellSearchText(c, r)).join(" \u0001 "), locale);
        cache.set(r, hay);
      }
      return words.every((w) => hay!.includes(w));
    });
  }
  const filterKeys = Object.keys(q.filters);
  if (filterKeys.length) {
    rows = rows.filter((r) =>
      filterKeys.every((k) => {
        const f = q.filters[k];
        if (f == null || f === "" || (Array.isArray(f) && !f.length)) return true;
        const col = q.columns.find((c) => c.key === k);
        const v = col ? cellValue(col, r) : getPath(r, k);
        if (typeof f === "function") return (f as (v: unknown, r: Row) => boolean)(v, r);
        if (Array.isArray(f)) return f.map(String).includes(String(v));
        if (typeof f === "object" && "op" in (f as object)) return matchOp(f as { op: string; value: unknown }, v, locale);
        return String(v) === String(f);
      }),
    );
  }
  if (q.sort.length) {
    const coll = collator(locale);
    const specs = q.sort
      .map((s) => ({ s, col: q.columns.find((c) => c.key === s.key) }))
      .filter((x): x is { s: (typeof q.sort)[number]; col: ResolvedColumn } => !!x.col);
    if (specs.length) {
      rows = rows
        .map((r, i) => ({ r, i }))
        .sort((a, b) => {
          for (const { s, col } of specs) {
            const key = col.sortKey ?? col.data ?? col.key;
            const va = col.sortKey ? getPath(a.r, key) : cellValue(col, a.r);
            const vb = col.sortKey ? getPath(b.r, key) : cellValue(col, b.r);
            let d: number;
            if (col.compare) d = col.compare(va, vb);
            else if (va == null || va === "") d = vb == null || vb === "" ? 0 : -1;
            else if (vb == null || vb === "") d = 1;
            else d = coll.compare(String(va), String(vb));
            if (d) return s.dir === "desc" ? -d : d;
          }
          return a.i - b.i;
        })
        .map((x) => x.r);
    }
  }
  const filtered = rows.length;
  const view = q.pageSize > 0 ? rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize) : rows;
  return { rows: view, view, total: all.length, filtered };
}

const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DT = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const DMY = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?: (\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
const ISO = /^\d{4}-\d{2}-\d{2}T/;
const NUMERIC = /^(?:\p{Sc}\s*)?[+-]?[\d.,\s]*\d[\d.,\s]*(?:\s*(?:\p{Sc}|%))?$/u;

/** Number, or a timestamp for date-like strings (date-only and "Y-m-d H:i:s" read as local time). */
function comparable(x: unknown): number {
  if (typeof x === "number") return x;
  if (x instanceof Date) return x.getTime();
  const s = String(x ?? "").trim();
  if (s === "") return NaN;
  let m = s.match(LOCAL_DT);
  if (m) return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)).getTime();
  m = s.match(DMY);
  if (m) return new Date(+m[3]!, +m[2]! - 1, +m[1]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)).getTime();
  if (ISO.test(s)) return Date.parse(s);
  // numbers in either convention, with a currency sign ("1.234,56 ₺", "$1,234.56"); other text is not comparable
  return NUMERIC.test(s) ? parseNumber(s) ?? NaN : NaN;
}

/** A date-only bound covers its whole day on the upper side. */
const upper = (t: unknown) => comparable(t) + (typeof t === "string" && DAY_ONLY.test(t.trim()) ? 86_399_999 : 0);

function sameDay(v: unknown, t: string): boolean {
  const a = new Date(comparable(v));
  const b = new Date(comparable(t));
  return !Number.isNaN(a.getTime()) && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function matchOp(f: { op: string; value: unknown }, v: unknown, locale: string): boolean {
  const s = v == null ? "" : String(v);
  const t = f.value;
  const n = comparable;
  const day = typeof t === "string" && DAY_ONLY.test(t.trim()) && !DAY_ONLY.test(s);
  switch (f.op) {
    case "eq": return day ? sameDay(v, t as string) : s === String(t);
    case "ne": return day ? !sameDay(v, t as string) : s !== String(t);
    case "in": return Array.isArray(t) && t.map(String).includes(s);
    case "notIn": return Array.isArray(t) && !t.map(String).includes(s);
    case "contains": return fold(s, locale).includes(fold(String(t), locale));
    case "notContains": return !fold(s, locale).includes(fold(String(t), locale));
    case "starts": return fold(s, locale).startsWith(fold(String(t), locale));
    case "ends": return fold(s, locale).endsWith(fold(String(t), locale));
    case "gt": return n(v) > upper(t);
    case "gte": return n(v) >= n(t);
    case "lt": return n(v) < n(t);
    case "lte": return n(v) <= upper(t);
    case "between": return Array.isArray(t) && n(v) >= n(t[0]) && n(v) <= upper(t[1]);
    case "empty": return s === "";
    case "notEmpty": return s !== "";
    default: return true;
  }
}
