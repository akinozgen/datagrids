// In-memory server emulator shared by the demo and the tests.
// Speaks yajra/DataTables SSP (form-encoded), dgp v1 (JSON, RFC 9457 errors) and Laravel paginator JSON
// (`/paginator/`: paginate / simplePaginate, `/cursor/`: cursorPaginate).
// Synthetic data only.

export interface EmuRow {
  id: number;
  [k: string]: unknown;
}

export interface EmuLogEntry {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: unknown;
  status: number;
  response: unknown;
}

export interface EmuOptions {
  rows: () => EmuRow[];
  /** server-side HTML rendering per column (yajra addColumn/editColumn) */
  html?: Record<string, (row: EmuRow) => string>;
  latency?: number;
  onLog?: (e: EmuLogEntry) => void;
}

/** Parses `a[b][0][c]=1&k[]=x` into nested objects (PHP semantics). */
export function parsePhp(qs: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const part of qs.split("&")) {
    if (!part) continue;
    const [rk, rv = ""] = part.split("=");
    const key = decodeURIComponent(rk!.replace(/\+/g, " "));
    const val = decodeURIComponent(rv.replace(/\+/g, " "));
    const path = key.replace(/\]/g, "").split("[");
    let cur: Record<string, unknown> = out;
    path.forEach((seg, i) => {
      const last = i === path.length - 1;
      if (seg === "") {
        // push into array
        const arr = cur as unknown as unknown[];
        if (last) arr.push(val);
        return;
      }
      if (last) {
        cur[seg] = val;
        return;
      }
      const nextIsArray = path[i + 1] === "" || /^\d+$/.test(path[i + 1] ?? "");
      if (cur[seg] == null) cur[seg] = nextIsArray ? [] : {};
      cur = cur[seg] as Record<string, unknown>;
    });
  }
  return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const fold = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replace(/ı/g, "i");

const json = (body: unknown, status = 200, type = "application/json") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": type } });

function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), "tr", { numeric: true });
}

function matchOp(v: unknown, f: { op: string; value?: unknown }): boolean {
  const s = v == null ? "" : String(v);
  const t = f.value;
  const n = (x: unknown) => Number(x);
  switch (f.op) {
    case "eq": return s === String(t);
    case "ne": return s !== String(t);
    case "in": return Array.isArray(t) && t.map(String).includes(s);
    case "notIn": return Array.isArray(t) && !t.map(String).includes(s);
    case "contains": return fold(s).includes(fold(String(t)));
    case "notContains": return !fold(s).includes(fold(String(t)));
    case "starts": return fold(s).startsWith(fold(String(t)));
    case "ends": return fold(s).endsWith(fold(String(t)));
    case "gt": return n(v) > n(t);
    case "gte": return n(v) >= n(t);
    case "lt": return n(v) < n(t);
    case "lte": return n(v) <= n(t);
    case "between": return Array.isArray(t) && n(v) >= n(t[0]) && n(v) <= n(t[1]);
    case "empty": return s === "";
    case "notEmpty": return s !== "";
    default: return true;
  }
}

export interface Faults {
  /** next response for each endpoint: "500" | "419" | "302" | "error200" | "422" | "timeout" */
  next?: string | null;
  latency?: number;
  countMode?: "exact" | "none";
  simple?: boolean;
  /** cursor endpoint answers as `JsonResource::collection($q->cursorPaginate())` (data/links/meta) */
  resource?: boolean;
}

export function createEmulator(o: EmuOptions) {
  const faults: Faults = { next: null, latency: o.latency ?? 120, countMode: "exact", simple: false, resource: false };
  const delay = (ms: number, signal?: AbortSignal | null) =>
    new Promise<void>((res, rej) => {
      const t = setTimeout(res, ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        rej(signal.reason ?? new DOMException("aborted", "AbortError"));
      });
    });

  function yajra(params: Record<string, any>): Response {
    const rows = o.rows();
    const cols = (params.columns ?? []) as Array<{ data: string; name: string; searchable: string; orderable: string }>;
    const term = String(params.search?.value ?? "").trim();
    let list = rows;
    if (term) {
      const words = fold(term).split(/\s+/);
      const searchable = cols.filter((c) => c.searchable === "true" && (c.name || c.data) && !o.html?.[c.name || c.data]);
      list = list.filter((r) => words.every((w) => searchable.some((c) => fold(String(r[c.name || c.data] ?? "")).includes(w))));
    }
    // DataTables ColumnControl (yajra 12.7 columnControlSearch)
    const LOGIC: Record<string, string> = { equal: "eq", notEqual: "ne", greater: "gt", greaterOrEqual: "gte", less: "lt", lessOrEqual: "lte", contains: "contains", notContains: "notContains", starts: "starts", ends: "ends", empty: "empty", notEmpty: "notEmpty" };
    cols.forEach((c: any) => {
      const cc = c.columnControl;
      if (!cc || c.searchable !== "true") return;
      const k = c.name || c.data;
      if (Array.isArray(cc.list)) list = list.filter((r) => cc.list.includes(String(r[k])));
      if (cc.search?.logic) {
        const op = LOGIC[cc.search.logic] ?? "eq";
        const val = cc.search.type === "num" ? Number(cc.search.value) : cc.search.value;
        list = list.filter((r) => matchOp(r[k], { op, value: val }));
      }
    });
    // page filters (sayfaya özel ajax.data parametreleri)
    if (params.durum) list = list.filter((r) => r.durum === params.durum);
    if (params._deleted !== "1") list = list.filter((r) => !r.deleted);
    const order = (params.order ?? []) as Array<{ column: string; dir: string }>;
    if (order.length) {
      list = list.slice().sort((a, b) => {
        for (const ord of order) {
          const c = cols[Number(ord.column)];
          if (!c || c.orderable !== "true") continue;
          const k = c.name || c.data;
          const d = cmp(a[k], b[k]);
          if (d) return ord.dir === "asc" ? d : -d;
        }
        return 0;
      });
    }
    const start = parseInt(params.start ?? "0", 10);
    const length = parseInt(params.length ?? "10", 10);
    const page = length === -1 ? list.slice(start) : list.slice(start, start + length);
    const data = page.map((r) => {
      const out: Record<string, unknown> = { DT_RowId: `row_${r.id}` };
      for (const k in r) out[k] = typeof r[k] === "string" ? esc(r[k] as string) : r[k];
      for (const k in o.html ?? {}) out[k] = o.html![k]!(r);
      return out;
    });
    const body: Record<string, unknown> = { draw: parseInt(params.draw ?? "0", 10), recordsTotal: rows.length, recordsFiltered: list.length, data, disableOrdering: false };
    body.summary = { toplam: list.reduce((s, r) => s + (Number(r.tutar) || 0), 0) };
    body.queries = [{ query: "select * from gorevler where tc = ?", bindings: ["12345678901"] }]; // must be stripped by the client
    return json(body);
  }

  function dgp(req: any): Response {
    // GET form (spec §2.2): sort "-a,b", fields "a,b", filter[key][op]=value (lists comma-joined)
    if (typeof req.sort === "string") req.sort = req.sort.split(",").filter(Boolean).map((k: string) => (k.startsWith("-") ? { key: k.slice(1), dir: "desc" } : { key: k, dir: "asc" }));
    if (typeof req.fields === "string") req.fields = req.fields.split(",").filter(Boolean);
    if (req.filter && !req.filters)
      req.filters = Object.fromEntries(
        Object.entries(req.filter as Record<string, Record<string, unknown>>).map(([k, ops]) => {
          const [op, v] = Object.entries(ops)[0] ?? ["eq", ""];
          return [k, { op, value: ["in", "notIn", "between"].includes(op) ? String(v).split(",") : v }];
        }),
      );
    const rows = o.rows();
    let list = rows.filter((r) => !r.deleted);
    if (req.q) {
      const w = fold(String(req.q));
      list = list.filter((r) => Object.values(r).some((v) => typeof v === "string" && fold(v).includes(w)));
    }
    for (const [k, f] of Object.entries((req.filters ?? {}) as Record<string, { op: string; value?: unknown }>)) list = list.filter((r) => matchOp(r[k], f));
    for (const s of [...(req.sort ?? [])].reverse()) list = list.slice().sort((a, b) => (s.dir === "desc" ? -1 : 1) * cmp(a[s.key], b[s.key]));
    const size = Math.min(Number(req.page?.size ?? 25), 1000);
    const number = Number(req.page?.number ?? 1);
    const page = list.slice((number - 1) * size, number * size);
    const fields: string[] = req.fields ?? [];
    const out = page.map((r) => {
      const x: Record<string, unknown> = { id: String(r.id) };
      for (const f of fields) if (f in r) x[f] = r[f];
      return x;
    });
    const mode = faults.countMode === "none" ? "none" : req.count ?? "exact";
    return json({
      v: 1,
      rows: out,
      page: { size, number, hasMore: number * size < list.length },
      count: mode === "none" ? { mode } : { mode, total: rows.length, filtered: list.length },
      meta: { aggregates: { tutar: { sum: list.reduce((s, r) => s + (Number(r.tutar) || 0), 0) } }, facets: {}, warnings: [] },
    });
  }

  function paginator(url: URL): Response {
    const rows = o.rows().filter((r) => !r.deleted);
    let list = rows;
    const q = url.searchParams.get("search");
    if (q) list = list.filter((r) => Object.values(r).some((v) => typeof v === "string" && fold(v).includes(fold(q))));
    const sort = url.searchParams.get("sort");
    if (sort) {
      const desc = sort.startsWith("-");
      const k = sort.replace(/^-/, "");
      list = list.slice().sort((a, b) => (desc ? -1 : 1) * cmp(a[k], b[k]));
    }
    const per = Number(url.searchParams.get("per_page") ?? 15);
    const page = Number(url.searchParams.get("page") ?? 1);
    const data = list.slice((page - 1) * per, page * per);
    const base = `${url.origin}${url.pathname}`;
    if (faults.simple) {
      return json({ current_page: page, data, per_page: per, from: (page - 1) * per + 1, to: (page - 1) * per + data.length, next_page_url: page * per < list.length ? `${base}?page=${page + 1}` : null, prev_page_url: page > 1 ? `${base}?page=${page - 1}` : null, path: base });
    }
    const last = Math.max(1, Math.ceil(list.length / per));
    return json({
      data,
      links: { first: `${base}?page=1`, last: `${base}?page=${last}`, prev: page > 1 ? `${base}?page=${page - 1}` : null, next: page < last ? `${base}?page=${page + 1}` : null },
      meta: { current_page: page, from: (page - 1) * per + 1, last_page: last, path: base, per_page: per, to: (page - 1) * per + data.length, total: list.length },
    });
  }

  /** Laravel cursorPaginate(): keyset paging on (sort column, id); the cursor is base64 JSON of the edge row. */
  function cursorPaginator(url: URL): Response {
    let list = o.rows().filter((r) => !r.deleted);
    const q = url.searchParams.get("search");
    if (q) list = list.filter((r) => Object.values(r).some((v) => typeof v === "string" && fold(v).includes(fold(q))));
    const sort = url.searchParams.get("sort") ?? "id";
    const desc = sort.startsWith("-");
    const k = sort.replace(/^-/, "");
    const order = (a: Record<string, unknown>, b: Record<string, unknown>) => (desc ? -1 : 1) * (cmp(a[k], b[k]) || cmp(a.id, b.id));
    list = list.slice().sort(order);
    const per = Number(url.searchParams.get("per_page") ?? 15);
    // base64url of UTF-8 JSON (sort values may hold Turkish letters)
    const encode = (r: EmuRow, next: boolean) =>
      btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({ [k]: r[k], id: r.id, _pointsToNextItems: next }))))
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const raw = url.searchParams.get("cursor");
    let cur: Record<string, unknown> | null = null;
    if (raw) {
      try {
        const bin = atob(raw.replace(/-/g, "+").replace(/_/g, "/"));
        cur = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
      } catch {
        return json({ message: "Geçersiz cursor." }, 422);
      }
    }
    let data: EmuRow[];
    if (!cur) data = list.slice(0, per);
    else if (cur._pointsToNextItems) data = list.filter((r) => order(r, cur!) > 0).slice(0, per);
    else data = list.filter((r) => order(r, cur!) < 0).slice(-per);
    const first = data[0];
    const last = data[data.length - 1];
    const next = last && list.some((r) => order(r, last) > 0) ? encode(last, true) : null;
    const prev = cur && first && list.some((r) => order(r, first) < 0) ? encode(first, false) : null;
    const base = `${url.origin}${url.pathname}`;
    const link = (c: string | null) => (c ? `${base}?cursor=${c}` : null);
    if (faults.resource)
      return json({
        data,
        links: { first: null, last: null, prev: link(prev), next: link(next) },
        meta: { path: base, per_page: per, next_cursor: next, prev_cursor: prev },
      });
    return json({ data, path: base, per_page: per, next_cursor: next, next_page_url: link(next), prev_cursor: prev, prev_page_url: link(prev) });
  }

  function fault(kind: string, proto: "yajra" | "dgp" | "paginator" | "cursor"): Response {
    switch (kind) {
      case "500":
        return proto === "dgp"
          ? json({ type: "about:blank", title: "Sunucu hatası", status: 500, detail: "SQLSTATE[42S22]: Column not found: 'birimm'", code: "server_error", retryable: true }, 500, "application/problem+json")
          : json({ message: "Server Error" }, 500);
      case "419":
        return json({ success: false, message: "CSRF token mismatch." }, 419);
      case "422":
        return proto === "dgp"
          ? json({ type: "about:blank", title: "Geçersiz filtre", status: 422, code: "validation_failed", retryable: false, errors: { "filters.tarih": ["Tarih aralığı geçersiz."] } }, 422, "application/problem+json")
          : json({ message: "Tarih aralığı geçersiz.", errors: { tarih: ["Tarih aralığı geçersiz."] } }, 422);
      case "302": {
        const r = new Response("<!doctype html><title>Yetkisiz</title>", { status: 200, headers: { "content-type": "text/html" } });
        Object.defineProperty(r, "redirected", { value: true });
        Object.defineProperty(r, "url", { value: "http://localhost/yetkisiz" });
        return r;
      }
      case "error200":
        return json({ draw: 1, recordsTotal: 0, recordsFiltered: 0, data: [], error: "Exception Message:\n\nSQLSTATE[HY000]: General error" });
      default:
        return json({ message: "?" }, 500);
    }
  }

  async function handle(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    const method = (init.method ?? "GET").toUpperCase();
    const headers = Object.fromEntries(new Headers(init.headers).entries());
    let params: any = null;
    if (method === "POST") {
      const body = String(init.body ?? "");
      params = headers["content-type"]?.includes("json") ? JSON.parse(body || "{}") : parsePhp(body);
    } else params = parsePhp(url.search.slice(1));
    await delay(faults.latency ?? 0, init.signal);
    let res: Response;
    if (url.pathname.startsWith("/api/all/")) {
      // whole list for client-mode tables (fetchAll)
      await delay(faults.latency ?? 0, init.signal);
      const rows = o.rows().slice(0, Number(url.searchParams.get("limit") ?? 150));
      const res = json({ data: rows });
      o.onLog?.({ method, url: url.pathname + url.search, headers, params, status: 200, response: null });
      return res;
    }
    if (url.pathname.startsWith("/api/action/")) {
      // row actions: DELETE /api/action/gorevler/{id} · POST /api/action/gorevler/{id}/{verb}
      const [, , , , id, verb] = url.pathname.split("/");
      const rows = o.rows();
      const idx = rows.findIndex((r) => String(r.id) === id);
      if (faults.next) {
        const k = faults.next;
        faults.next = null;
        res = fault(k, "yajra");
      } else if (!headers["x-csrf-token"]) res = fault("419", "yajra");
      else if (idx < 0) res = json({ message: "Kayıt bulunamadı." }, 404);
      else if (method === "DELETE") {
        rows.splice(idx, 1);
        res = json({ message: `Kayıt silindi.` });
      } else {
        if (verb === "onayla") rows[idx]!.durum = "tamam";
        res = json({ message: "Kayıt güncellendi." });
      }
      o.onLog?.({ method, url: url.pathname, headers, params, status: res.status, response: null });
      return res;
    }
    const proto = url.pathname.includes("/dgp/") ? "dgp" : url.pathname.includes("/paginator/") ? "paginator" : url.pathname.includes("/cursor/") ? "cursor" : "yajra";
    if (faults.next) {
      const k = faults.next;
      faults.next = null;
      if (k === "timeout") await delay(60_000, init.signal);
      res = fault(k, proto);
    } else if (proto === "yajra" && method === "POST" && !headers["x-csrf-token"] && !params._token) {
      res = fault("419", proto);
    } else if (proto === "dgp") res = dgp(params);
    else if (proto === "paginator") res = paginator(url);
    else if (proto === "cursor") res = cursorPaginator(url);
    else res = yajra(params);
    let preview: unknown = null;
    try {
      preview = await res.clone().json();
    } catch {
      preview = "(html)";
    }
    o.onLog?.({ method, url: url.pathname + url.search, headers, params, status: res.status, response: preview });
    return res;
  }

  return { handle, faults };
}
