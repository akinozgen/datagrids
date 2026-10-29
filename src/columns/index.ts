// Typed column factories. Exported as an ES module namespace: `column.money(...)`.
import type { ColumnDef, Row, Tone } from "../core/types";
import { frag, getPath, h, htmlToText } from "../core/util";
import { icons } from "../dom/icons";
import { parseNumber, readNumber } from "../core/collate";
import { resolveLocale } from "../core/i18n";

type Opts<R = Row> = Partial<Omit<ColumnDef<R>, "key">>;

const numCompare = (a: unknown, b: unknown) => {
  const x = parseNumber(a);
  const y = parseNumber(b);
  if (x == null && y == null) return 0;
  if (x == null) return -1;
  if (y == null) return 1;
  return x - y;
};

/** Plain text column; values are always written as text. */
export function text<R = Row>(key: string, o: Opts<R> = {}): ColumnDef<R> {
  return { type: "text", text: true, ...o, key };
}

/** Raw HTML column: explicit opt-in (thesis §3.7). */
export function html<R = Row>(key: string, o: Opts<R> = {}): ColumnDef<R> {
  return {
    type: "html",
    html: true,
    searchText: (v) => (v == null ? "" : htmlToText(String(v))),
    exportValue: (row) => {
      const v = getPath(row, o.data ?? key);
      return v == null ? "" : htmlToText(String(v));
    },
    ...o,
    key,
  };
}

export interface NumberOpts<R> extends Opts<R> {
  decimals?: number;
  locale?: string;
  /** "number" (default): data values, machine strings read as JS numbers ("0.125", "1.500" = 1.5) · "tr": formatted text ("1.234,5") */
  source?: "number" | "tr";
}

/** One Intl formatter per locale (columns follow the grid's locale unless given their own). */
function perLocale<F>(make: (locale: string) => F): (locale: string) => F {
  const cache = new Map<string, F>();
  return (l) => {
    let f = cache.get(l);
    if (!f) cache.set(l, (f = make(l)));
    return f;
  };
}

export function number<R = Row>(key: string, o: NumberOpts<R> = {}): ColumnDef<R> {
  const { decimals, locale, source = "number", ...rest } = o;
  const read = (v: unknown) => readNumber(v, source);
  const fmt = perLocale((l) => new Intl.NumberFormat(l, { minimumFractionDigits: decimals ?? 0, maximumFractionDigits: decimals ?? 2 }));
  return {
    type: "number",
    align: "end",
    compare: (a, b) => numCompare(read(a), read(b)),
    exportType: "number",
    exportFormat: decimals ? `#,##0.${"0".repeat(decimals)}` : "#,##0",
    exportValue: (row) => read(getPath(row, rest.data ?? key)),
    render: (v, _row, ctx) => {
      const n = read(v);
      if (n == null) return null;
      const s = fmt(locale ?? ctx?.locale ?? "tr-TR").format(n);
      return h("span", { class: "dg-num", "data-sign": n < 0 ? "neg" : null }, s);
    },
    ...rest,
    key,
  };
}

export interface MoneyOpts<R> extends Opts<R> {
  currency?: string;
  decimals?: number;
  /** where the value comes from: a number, a TR formatted string, or server HTML (trlira) */
  source?: "number" | "tr" | "html";
  locale?: string;
}

const CUR: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };

export function money<R = Row>(key: string, o: MoneyOpts<R> = {}): ColumnDef<R> {
  const { currency = "TRY", decimals = 2, source = "number", locale, ...rest } = o;
  const read = (v: unknown) => (source === "html" && typeof v === "string" ? parseNumber(htmlToText(v)) : readNumber(v, source === "tr" ? "tr" : "number"));
  const fmt = perLocale((l) => new Intl.NumberFormat(l, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  return {
    type: "money",
    align: "end",
    compare: (a, b) => numCompare(read(a), read(b)),
    exportType: "money",
    exportFormat: `#,##0.${"0".repeat(decimals)} "${CUR[currency] ?? currency}"`,
    exportValue: (row) => read(getPath(row, rest.data ?? key)),
    searchText: (v) => {
      const n = read(v);
      return n == null ? "" : n.toFixed(decimals).replace(".", ",");
    },
    render: (v, _row, ctx) => {
      const n = read(v);
      if (n == null) return null;
      const s = fmt(locale ?? ctx?.locale ?? "tr-TR").format(n);
      return h("span", { class: "dg-money", "data-sign": n < 0 ? "neg" : null }, s, h("span", { class: "dg-money-cur" }, CUR[currency] ?? currency));
    },
    ...rest,
    key,
  };
}

export interface DateOpts<R> extends Opts<R> {
  /** iso: ISO-8601 (UTC aware) · local: "Y-m-d H:i:s" in local time · dmy: "dd.mm.yyyy[ hh:mm]" */
  source?: "iso" | "local" | "dmy";
  time?: boolean;
  timeZone?: string;
  locale?: string;
}

export function parseDate(v: unknown, source: "iso" | "local" | "dmy" = "iso"): Date | null {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (source === "dmy") {
    const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    return new Date(+m[3]!, +m[2]! - 1, +m[1]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }
  if (source === "local") {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (!m) return null;
    return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function date<R = Row>(key: string, o: DateOpts<R> = {}): ColumnDef<R> {
  const { source = "iso", time = false, timeZone, locale, ...rest } = o;
  const dateFmt = perLocale((l) => new Intl.DateTimeFormat(l, { day: "2-digit", month: "2-digit", year: "numeric", timeZone }));
  const timeFmt = perLocale((l) => new Intl.DateTimeFormat(l, { hour: "2-digit", minute: "2-digit", timeZone }));
  // search text follows the locale the cells were last drawn with
  let seen = locale ?? "tr-TR";
  return {
    type: "date",
    compare: (a, b) => (parseDate(a, source)?.getTime() ?? -Infinity) - (parseDate(b, source)?.getTime() ?? -Infinity),
    exportType: "date",
    exportFormat: time ? "dd.mm.yyyy hh:mm" : "dd.mm.yyyy",
    exportValue: (row) => parseDate(getPath(row, rest.data ?? key), source),
    searchText: (v) => {
      const d = parseDate(v, source);
      return d ? dateFmt(seen).format(d) : "";
    },
    render: (v, _row, ctx) => {
      const d = parseDate(v, source);
      if (!d) return null;
      seen = locale ?? ctx?.locale ?? seen;
      return h("span", { class: "dg-date" }, dateFmt(seen).format(d), time ? h("span", { class: "dg-date-time" }, timeFmt(seen).format(d)) : null);
    },
    ...rest,
    key,
  };
}

export interface BadgeOpts<R> extends Opts<R> {
  tones?: Record<string, Tone>;
  labels?: Record<string, string>;
}

export function badge<R = Row>(key: string, o: BadgeOpts<R> = {}): ColumnDef<R> {
  const { tones = {}, labels = {}, ...rest } = o;
  const label = (v: unknown) => (v == null ? "" : labels[String(v)] ?? String(v));
  return {
    type: "badge",
    labels,
    searchText: (v) => label(v),
    exportValue: (row) => label(getPath(row, rest.data ?? key)),
    compare: (a, b) => label(a).localeCompare(label(b), "tr"),
    render: (v) => (v == null || v === "" ? null : h("span", { class: "dg-chip", "data-tone": tones[String(v)] ?? null }, label(v))),
    ...rest,
    key,
  };
}

export interface LinkOpts<R> extends Opts<R> {
  /** "/personel/{id}" template or function */
  href: string | ((row: R) => string);
  target?: string;
}

const fill = (tpl: string, row: unknown) =>
  tpl.replace(/\{([\w.]+)\}/g, (_, p: string) => encodeURIComponent(String(getPath(row, p) ?? "")));

export function link<R = Row>(key: string, o: LinkOpts<R>): ColumnDef<R> {
  const { href, target, ...rest } = o;
  return {
    type: "link",
    render: (v, row) => {
      if (v == null || v === "") return null;
      const url = typeof href === "function" ? href(row) : fill(href, row);
      if (!/^(https?:|\/|\.|#|mailto:|tel:)/i.test(url)) return String(v);
      return h("a", { class: "dg-link", href: url, target: target ?? null, rel: target === "_blank" ? "noopener" : null }, String(v));
    },
    ...rest,
    key,
  };
}

/** Row number (offset aware). */
export function index<R = Row>(o: Opts<R> = {}): ColumnDef<R> {
  return {
    type: "index",
    title: "#",
    col: "rownum",
    sortable: false,
    searchable: false,
    exportType: "number",
    render: (_v, _r, ctx) => String(ctx.position + 1),
    ...o,
    key: o.title === undefined ? "__index" : "__index",
  };
}

/** Placeholder for the actions module (sticky end column). */
export function actions<R = Row>(o: Opts<R> = {}): ColumnDef<R> {
  return {
    type: "actions",
    col: "actions",
    sortable: false,
    searchable: false,
    exportable: false,
    hideable: false,
    align: "end",
    sticky: "end",
    ...o,
    key: "__actions",
  };
}

/** Placeholder for the selection module (checkbox column). */
export function select<R = Row>(o: Opts<R> = {}): ColumnDef<R> {
  return {
    type: "select",
    col: "select",
    title: "",
    sortable: false,
    searchable: false,
    exportable: false,
    hideable: false,
    ...o,
    key: "__select",
  };
}

export interface PhoneOpts<R> extends Opts<R> {
  /** country code for tel:/WhatsApp links (default 90) */
  country?: string;
  whatsapp?: boolean;
}

/** Phone number: tel: link (+ optional WhatsApp link); digits normalized for the href. */
export function phone<R = Row>(key: string, o: PhoneOpts<R> = {}): ColumnDef<R> {
  const { country = "90", whatsapp = false, ...rest } = o;
  const digits = (v: unknown) => {
    let d = String(v ?? "").replace(/\D/g, "");
    if (d.startsWith("0")) d = d.slice(1);
    if (!d.startsWith(country)) d = country + d;
    return d;
  };
  return {
    type: "text",
    render: (v) => {
      if (v == null || v === "") return null;
      const box = h("span", { class: "dg-phone" }, h("a", { class: "dg-link", href: `tel:+${digits(v)}` }, String(v)));
      if (whatsapp) box.append(" ", h("a", { class: "dg-link dg-phone-wa", href: `https://wa.me/${digits(v)}`, target: "_blank", rel: "noopener", "aria-label": `WA (WhatsApp) ${v}`, "data-dg-tip": "WhatsApp" }, "WA"));
      return box;
    },
    ...rest,
    key,
  };
}

export interface BooleanOpts<R> extends Opts<R> {
  /** `{ true: "Aktif", false: "Pasif" }` (default by page language: Evet/Hayır or Yes/No) */
  labels?: { true?: string; false?: string };
  /** show the false state too (default true); false → empty cell */
  showFalse?: boolean;
}

/** Reads 1/0, "1"/"0", true/false, "true"/"false", "on"/"off", "evet"/"hayır", "yes"/"no". */
export function parseBool(v: unknown): boolean | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v).trim().toLocaleLowerCase("tr");
  if (["1", "true", "on", "evet", "yes", "e", "y"].includes(s)) return true;
  if (["0", "false", "off", "hayır", "hayir", "no", "h", "n"].includes(s)) return false;
  return null;
}

/** Yes/no with a permanent icon + text (colour is never the only signal). */
export function boolean<R = Row>(key: string, o: BooleanOpts<R> = {}): ColumnDef<R> {
  const { labels, showFalse = true, ...rest } = o;
  const tr = () => resolveLocale([document.documentElement.lang], true).startsWith("tr");
  const label = (b: boolean) => labels?.[b ? "true" : "false"] ?? (tr() ? (b ? "Evet" : "Hayır") : b ? "Yes" : "No");
  return {
    type: "boolean",
    align: "center",
    compare: (a, b) => Number(parseBool(a) ?? -1) - Number(parseBool(b) ?? -1),
    searchText: (v) => {
      const b = parseBool(v);
      return b == null ? "" : label(b);
    },
    exportValue: (row) => {
      const b = parseBool(getPath(row, rest.data ?? key));
      return b == null ? "" : label(b);
    },
    render: (v) => {
      const b = parseBool(v);
      if (b == null || (!b && !showFalse)) return null;
      const box = h("span", { class: "dg-bool", "data-value": String(b) });
      box.append(frag(b ? icons.check : icons.x), h("span", { class: "dg-bool-text" }, label(b)));
      return box;
    },
    ...rest,
    key,
  };
}
