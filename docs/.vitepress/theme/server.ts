// In-browser demo server: the shared protocol emulator (tests/fixtures/server) behind a fetch stub.
// Requests to /api/* never leave the page. Each demo gets its own fetch so its Request/Response tabs
// show exactly what its grid sent and received.
import { createEmulator, parsePhp, type EmuRow, type Faults } from "../../../tests/fixtures/server/emulator";
import { agents } from "./data";

export interface LogEntry {
  n: number;
  method: string;
  url: string;
  headers: Record<string, string>;
  /** decoded request body (form → nested object, JSON → object) or query parameters */
  body: unknown;
  raw: string;
  status: number | null;
  response: unknown;
  error?: string;
  ms?: number;
}

/** Every 17th record is soft-deleted (shown only with `_deleted=1`). */
const base: EmuRow[] = agents(1000, 21).map((r, i) => {
  const row: EmuRow = i % 17 === 9 ? { ...r, deleted_at: "2026-10-20T08:00:00.000Z" } : { ...r };
  // aliases the emulator reads (summary totals, soft deletes); non-enumerable → never serialized
  Object.defineProperty(row, "tutar", { get: () => row.amount, enumerable: false });
  Object.defineProperty(row, "deleted", { get: () => !!row.deleted_at, enumerable: false });
  return row;
});

const PROTOCOL = new Set(["draw", "columns", "order", "start", "length", "search", "_token", "_deleted", "_", "page", "per_page", "sort"]);
const fields = new Set(Object.keys(base[0] ?? {}));
const fold = (s: string) => s.toLocaleLowerCase("en").normalize("NFD").replace(/\p{M}/gu, "");
/** fields a controller would compare exactly; everything else (name, task…) is a "contains" match */
const ENUM = new Set(["unit", "status", "place", "id", "ref"]);
const enumLike = (k: string) => ENUM.has(k);

/** Page filters a controller would apply (`->when($request->unit, …)`): enum fields match exactly, text contains. */
function pageFiltered(params: Record<string, unknown>): EmuRow[] {
  const active = Object.entries(params).filter(([k, v]) => !PROTOCOL.has(k) && fields.has(k) && v !== "" && v != null && !(Array.isArray(v) && !v.length));
  if (!active.length) return base;
  return base.filter((r) =>
    active.every(([k, v]) => {
      const list = (Array.isArray(v) ? v : [v]).map(String);
      return enumLike(k) ? list.includes(String(r[k])) : list.some((x) => fold(String(r[k] ?? "")).includes(fold(x)));
    }),
  );
}

/** Server-rendered HTML columns (yajra `addColumn` / `rawColumns`): only the SSP endpoints send them. */
const LABEL: Record<string, string> = { open: "Open", done: "Done", pending: "Pending", cancelled: "Cancelled", draft: "Draft" };
const TONE: Record<string, string> = { open: "info", done: "ok", pending: "warn", cancelled: "bad", draft: "neutral" };
const SERVER_HTML: Record<string, (r: EmuRow) => string> = {
  status_html: (r) => `<span class="dg-chip" data-tone="${TONE[String(r.status)]}">${LABEL[String(r.status)]}</span>`,
};

/** Shared switches (fault injection, count mode); a fault is consumed by the next request. */
export const faults: Faults = { next: null, latency: 220, countMode: "exact", simple: false };

// Response text fix-ups: the shared emulator answers like a Turkish-locale app; docs show English.
const TEXT: Array<[RegExp, string]> = [
  [/Sunucu hatası/g, "Server error"],
  [/Geçersiz filtre/g, "Invalid filter"],
  [/Tarih aralığı geçersiz\./g, "The date range is invalid."],
  [/'birimm'/g, "'unitt'"],
  [/Kayıt bulunamadı\./g, "Record not found."],
  [/Kayıt silindi\./g, "Record deleted."],
  [/Kayıt güncellendi\./g, "Record updated."],
  [/Yetkisiz/g, "Log in"],
  [/"toplam":/g, '"total":'],
  [/"tutar":/g, '"amount":'],
  [/"tarih"/g, '"date"'],
  [/"filters\.tarih"/g, '"filters.date"'],
  [/select \* from gorevler where tc = \?/g, "select * from agents where id = ?"],
  [/"12345678901"/g, '"1001"'],
];

function decodeBody(method: string, url: URL, headers: Record<string, string>, raw: string): unknown {
  if (method === "GET") return parsePhp(url.search.slice(1));
  if ((headers["content-type"] ?? "").includes("json")) {
    try {
      return JSON.parse(raw || "{}");
    } catch {
      return raw;
    }
  }
  return parsePhp(raw);
}

let seq = 0;

async function serve(input: RequestInfo | URL, init: RequestInit = {}, log?: (e: LogEntry) => void): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  const method = (init.method ?? "GET").toUpperCase();
  const headers = Object.fromEntries(new Headers(init.headers).entries());
  const raw = typeof init.body === "string" ? init.body : "";
  const body = decodeBody(method, url, headers, raw);
  const params = (body && typeof body === "object" ? ((body as { params?: unknown }).params ?? body) : {}) as Record<string, unknown>;
  const entry: LogEntry = { n: ++seq, method, url: url.pathname + url.search, headers, body, raw, status: null, response: null };
  const t0 = performance.now();
  log?.({ ...entry });

  // bulk actions (no emulator route): POST /api/action/<resource>/bulk/<verb> with a selection payload
  const bulk = url.pathname.match(/^\/api\/action\/[\w-]+\/bulk\/(\w+)$/);
  if (bulk) return bulkAction(bulk[1]!, headers, params, entry, t0, init.signal, log);

  // one emulator per request: page filters are per request, faults are shared and consumed once
  const emu = createEmulator({ rows: () => pageFiltered(params), html: SERVER_HTML });
  Object.assign(emu.faults, faults);
  faults.next = null;
  let res: Response;
  try {
    res = await emu.handle(input, init);
  } catch (e) {
    entry.error = (e as Error)?.name === "AbortError" ? "aborted (a newer request won)" : String((e as Error)?.message ?? e);
    entry.ms = Math.round(performance.now() - t0);
    log?.({ ...entry });
    throw e;
  }
  // POST /api/action/agents/{id}/approve → the record is done
  const m = url.pathname.match(/^\/api\/action\/[\w-]+\/(\d+)\/(\w+)$/);
  if (m && res.ok && method !== "DELETE") {
    const row = base.find((r) => String(r.id) === m[1]);
    if (row && m[2] === "approve") row.status = "done";
  }
  let text = await res.text();
  for (const [re, to] of TEXT) text = text.replace(re, to);
  const fixed = new Response(text, { status: res.status, headers: res.headers });
  if (res.redirected) {
    Object.defineProperty(fixed, "redirected", { value: true });
    // the emulator's redirect stands for "the session is gone, Laravel sent the login page"
    Object.defineProperty(fixed, "url", { value: res.url.replace("yetkisiz", "login") });
  }
  let preview: unknown = text;
  try {
    preview = JSON.parse(text);
  } catch {
    /* HTML (redirect to a login/forbidden page) */
  }
  entry.status = res.status;
  entry.response = preview;
  entry.ms = Math.round(performance.now() - t0);
  log?.({ ...entry });
  return fixed;
}

async function bulkAction(
  verb: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  entry: LogEntry,
  t0: number,
  signal: AbortSignal | null | undefined,
  log?: (e: LogEntry) => void,
): Promise<Response> {
  await new Promise((r) => setTimeout(r, faults.latency ?? 0));
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  let status = 200;
  let out: Record<string, unknown>;
  if (faults.next) {
    faults.next = null;
    status = 500;
    out = { message: "Server Error" };
  } else if (!headers["x-csrf-token"]) {
    status = 419;
    out = { message: "CSRF token mismatch." };
  } else {
    // { all: false, keys } or { all: true, except, query }
    const all = body.all === true || body.all === "true";
    const keys = Array.isArray(body.keys) ? body.keys : [];
    const except = Array.isArray(body.except) ? body.except.length : 0;
    const n = all ? Math.max(0, base.filter((r) => !r.deleted).length - except) : keys.length;
    out = { message: `${verb}: ${n} record${n === 1 ? "" : "s"} updated.`, count: n };
  }
  const text = JSON.stringify(out);
  entry.status = status;
  entry.response = out;
  entry.ms = Math.round(performance.now() - t0);
  log?.({ ...entry });
  return new Response(text, { status, headers: { "content-type": "application/json" } });
}

const isApi = (input: RequestInfo | URL) => {
  const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return new URL(u, location.href).pathname.startsWith("/api/");
};

/** A fetch for one demo: /api/* is served (and logged) in the page, anything else goes to the network. */
export function fetchFor(log: (e: LogEntry) => void): typeof fetch {
  return (input, init) => (isApi(input) ? serve(input, init, log) : realFetch(input, init));
}

let realFetch: typeof fetch = (...a) => globalThis.fetch(...a);
let installed = false;

/** Installs the page-wide stub once (grids created outside a demo run still reach the demo server). */
export function install(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  realFetch = original;
  window.fetch = (input, init) => (isApi(input) ? serve(input, init) : original(input, init));
}

export const records = base;
