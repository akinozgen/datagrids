// Server mode: transport + protocol adapters.
import { notice } from "../core/warn";
import type {
  AnyModule, DataSource, DatagridApi, LoadContext, LoadResult, Query, RequestMiddleware, Row, WireRequest,
} from "../core/types";
import { getPath } from "../core/util";
import { bodyError, fetchError, httpError } from "./errors";
import { encodeForm, formBody } from "./form-encode";
import { sourceModule } from "./sources";
import { toColumnControl, type ColumnFilterValue } from "../modules/column-filters";

export interface Protocol {
  readonly name: string;
  /** default render mode for untyped columns */
  readonly cells: "text" | "html";
  /** allows pageSize -1 ("All") — DataTables compat opt-in */
  readonly allowAll?: boolean;
  readonly method?: "GET" | "POST";
  /** column filter operators the wire can carry (omitted: all); the filter UI offers only these */
  readonly filterOps?: readonly string[];
  /** `grid` is the grid the request belongs to (per-grid protocol state, e.g. cursor maps) */
  encode(req: WireRequest, q: Query, grid?: DatagridApi): { url: string; init: RequestInit };
  decode(body: unknown, q: Query, grid?: DatagridApi): LoadResult;
}

export interface ServerSideOptions {
  url: string | ((q: Query) => string);
  protocol: Protocol;
  method?: "GET" | "POST";
  timeout?: number;
  headers?: Record<string, string>;
  /** CSRF: meta[name=csrf-token] → X-CSRF-TOKEN header (+ `_token` in form bodies) */
  csrf?: boolean;
  /** extra request parameters, static or computed per request */
  params?: Record<string, unknown> | ((q: Query) => Record<string, unknown>);
  fetch?: typeof fetch;
  /** first response body rendered without a request (gelişmiş arama "ilkSayfa") */
  seed?: unknown;
}

export type ServerSideModule = AnyModule & {
  /** derives a new definition with an extra params function (definitions are immutable) */
  params(fn: (q: Query) => Record<string, unknown>): ServerSideModule;
};

const csrfToken = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? "";

function timeoutSignal(parent: AbortSignal, ms: number): AbortSignal {
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (anyFn && typeof AbortSignal.timeout === "function") return anyFn([parent, AbortSignal.timeout(ms)]);
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(new DOMException("timeout", "TimeoutError")), ms);
  parent.addEventListener("abort", () => {
    clearTimeout(t);
    ac.abort(parent.reason);
  });
  return ac.signal;
}

/** Remote source: transport (fetch, abort, timeout, CSRF, Laravel headers) + a protocol. */
export function serverSide(o: ServerSideOptions): ServerSideModule {
  let seeded = o.seed === undefined;
  const source: DataSource & { protocol: Protocol } = {
    name: o.protocol.name,
    mode: "server",
    cells: o.protocol.cells,
    allowAll: o.protocol.allowAll,
    protocol: o.protocol,
    async load(query: Query, ctx: LoadContext): Promise<LoadResult> {
      const m = ctx.grid.messages;
      // the embedded first page answers only the first load, and only the query it was rendered for
      // (a page, sort or filter restored from the URL or saved state needs a real request)
      if (!seeded) {
        seeded = true;
        if (query.pristine !== false) {
          const r = o.protocol.decode(o.seed, query, ctx.grid);
          return { ...r, raw: o.seed };
        }
      }
      const statics = typeof o.params === "function" ? o.params(query) : o.params ?? {};
      const req: WireRequest = {
        url: typeof o.url === "function" ? o.url(query) : o.url,
        method: o.method ?? o.protocol.method ?? "GET",
        headers: { ...(o.headers ?? {}) },
        query,
        params: { ...statics },
      };
      const builtins: RequestMiddleware[] = [];
      if (ctx.host.laravel !== false) {
        builtins.push((r, next) => {
          r.headers["X-Requested-With"] ??= "XMLHttpRequest";
          return next(r);
        });
      }
      if (o.csrf ?? ctx.host.csrf) {
        builtins.push((r, next) => {
          const t = csrfToken();
          if (t) {
            r.headers["X-CSRF-TOKEN"] = t;
            if (r.method !== "GET" && !("_token" in r.params)) r.params._token = t;
          }
          return next(r);
        });
      }
      const chain = [...builtins, ...ctx.middlewares];
      const timeout = o.timeout ?? ctx.host.timeout ?? 30000;
      const doFetch = o.fetch ?? ctx.host.fetch ?? ((...a: Parameters<typeof fetch>) => globalThis.fetch(...a));
      let sent: Record<string, unknown> = {};
      const final = (r: WireRequest) => {
        sent = { ...r.params };
        delete sent._token;
        const { url, init } = o.protocol.encode(r, query, ctx.grid);
        return doFetch(url, { ...init, signal: timeoutSignal(ctx.signal, timeout), credentials: "same-origin" });
      };
      const dispatch = (i: number, r: WireRequest): Promise<Response> => {
        const mw = chain[i];
        if (!mw) return final(r);
        let called = false;
        return mw(r, (next) => {
          if (called) throw new Error("datagrids: next() called multiple times");
          called = true;
          return dispatch(i + 1, next);
        });
      };
      let res: Response;
      try {
        res = await dispatch(0, req);
      } catch (e) {
        throw fetchError(e, m);
      }
      const err = await httpError(res, m);
      if (err) throw err;
      let body: unknown;
      try {
        body = await res.json();
      } catch (e) {
        // a timeout or abort while the body streams in is not a malformed body
        if ((e as Error)?.name === "AbortError" || (e as Error)?.name === "TimeoutError") throw fetchError(e, m);
        throw { kind: "parse", status: res.status, message: m.errParse, retryable: false };
      }
      if (body && typeof body === "object") {
        // APP_DEBUG leakage (SQL + PII) never reaches any hook
        delete (body as Record<string, unknown>).queries;
        delete (body as Record<string, unknown>).input;
      }
      const result = o.protocol.decode(body, query, ctx.grid);
      const soft = body && typeof body === "object" ? bodyError(body as Record<string, unknown>, m) : null;
      return { ...result, raw: body, error: soft ?? result.error ?? null, params: sent };
    },
  };
  const def = sourceModule(source) as ServerSideModule;
  return Object.freeze({
    ...def,
    params(fn: (q: Query) => Record<string, unknown>) {
      const prev = o.params;
      return serverSide({
        ...o,
        params: (q) => ({ ...(typeof prev === "function" ? prev(q) : prev ?? {}), ...fn(q) }),
      });
    },
  });
}

/* ============================== ssp / yajra ============================== */

export interface SspOptions {
  /** DataTables `ajax.data`: static object (deep-merged) or function (mutate `d`, or return a replacement) */
  data?: Record<string, unknown> | ((d: Record<string, unknown>) => unknown);
  /** DataTables `ajax.dataSrc`: path or function returning rows */
  dataSrc?: string | ((json: any) => Row[]);
  cells?: "text" | "html";
  method?: "GET" | "POST";
  /** allow length=-1 ("All"); off by default (maxPageSize protection) */
  allowAll?: boolean;
}

const KNOWN = new Set(["data", "aaData", "draw", "recordsTotal", "recordsFiltered", "iTotalRecords", "iTotalDisplayRecords", "error", "sError", "disableOrdering"]);

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  for (const k in b) {
    const v = b[k];
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k]))
      deepMerge(a[k] as Record<string, unknown>, v as Record<string, unknown>);
    else a[k] = Array.isArray(v) ? v.slice() : v && typeof v === "object" ? deepMerge({}, v as Record<string, unknown>) : v;
  }
  return a;
}

const toInt = (v: unknown): number | null => {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
};

/** Builds the DataTables 1.10 server-side parameter object (wire order kept). */
export function sspParams(q: Query, draw: number, params: Record<string, unknown>): Record<string, unknown> {
  const cols = q.columns;
  const d: Record<string, unknown> = { draw };
  const extra: Record<string, unknown> = {};
  for (const k in q.filters) {
    const f = q.filters[k];
    if (f == null || f === "" || typeof f === "function") continue;
    if (!cols.some((c) => c.key === k)) extra[k] = f; // page filters travel as plain params
  }
  d.columns = cols.map((c) => {
    const col: Record<string, unknown> = {
      data: c.data ?? (c.col ? "" : c.key),
      name: c.name ?? "",
      searchable: c.searchable,
      orderable: c.sortable,
      search: { value: "", regex: false },
    };
    const f = q.filters[c.key];
    // a plain value on a column key → the protocol's own per-column search (arrays as an escaped regex OR)
    if (f != null && f !== "" && typeof f !== "function" && (typeof f !== "object" || Array.isArray(f))) {
      // equality like every other source: an anchored, escaped regex (a plain value would be LIKE %v% on yajra)
      const list = (Array.isArray(f) ? f : [f]).map((v) => `^${String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
      if (!c.searchable) notice("ssp", `filter on "${c.key}" is not sent: the column is not searchable.`);
      else if (list.length) col.search = { value: list.join("|"), regex: true };
    }
    // typed column filter → DataTables ColumnControl (yajra 12.7); only on searchable columns (yajra treats "false" as truthy)
    if (f && typeof f === "object" && "op" in (f as object) && c.searchable) {
      const cc = toColumnControl(c, f as ColumnFilterValue);
      if (cc) col.columnControl = cc;
    }
    return col;
  });
  const sort = q.sort.length ? q.sort : q.sortDefault ? [{ key: cols[0]?.key ?? "", dir: "asc" as const }] : [];
  const order = sort
    .map((s) => ({ column: cols.findIndex((c) => c.key === s.key), dir: s.dir }))
    .filter((o) => o.column >= 0);
  if (order.length) d.order = order;
  d.start = q.pageSize > 0 ? (q.page - 1) * q.pageSize : 0;
  d.length = q.pageSize > 0 ? q.pageSize : -1;
  d.search = { value: q.search, regex: false };
  return Object.assign(d, extra, params);
}

/** The classic `draw/start/length/columns[]` protocol; cells default to text (safe for any server). */
export function ssp(o: SspOptions = {}): Protocol {
  let draw = 0;
  return {
    name: "ssp",
    cells: o.cells ?? "text",
    // ColumnControl has no range or "none of": between / notIn are not offered
    filterOps: ["eq", "ne", "gt", "gte", "lt", "lte", "contains", "notContains", "starts", "ends", "empty", "notEmpty", "in"],
    allowAll: o.allowAll ?? false,
    method: o.method,
    encode(req, q) {
      let d: unknown = sspParams(q, ++draw, req.params);
      if (o.data) {
        if (typeof o.data === "function") {
          const ret = o.data(d as Record<string, unknown>);
          if (ret) d = ret;
        } else d = deepMerge(d as Record<string, unknown>, o.data);
      }
      const headers: Record<string, string> = { Accept: "application/json, text/javascript, */*; q=0.01", ...req.headers };
      if (req.method.toUpperCase() === "GET") {
        const qs = typeof d === "string" ? d : encodeForm(d);
        const sep = req.url.includes("?") ? "&" : "?";
        return { url: `${req.url}${sep}${qs}${qs ? "&" : ""}_=${Date.now()}`, init: { method: "GET", headers } };
      }
      headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
      return { url: req.url, init: { method: req.method.toUpperCase(), headers, body: typeof d === "string" ? d : formBody(d) } };
    },
    decode(body) {
      const json = (body ?? {}) as Record<string, unknown>;
      const rows = (typeof o.dataSrc === "function"
        ? o.dataSrc(json)
        : o.dataSrc !== undefined
          ? o.dataSrc === ""
            ? json
            : getPath(json, o.dataSrc)
          : json.data ?? json.aaData ?? []) as Row[];
      const total = toInt(json.recordsTotal ?? json.iTotalRecords);
      const filtered = toInt(json.recordsFiltered ?? json.iTotalDisplayRecords);
      const meta: Record<string, unknown> = {};
      for (const k in json) if (!KNOWN.has(k)) meta[k] = json[k];
      return { rows: Array.isArray(rows) ? rows : [], total: total ?? (Array.isArray(rows) ? rows.length : 0), filtered: filtered ?? total, meta };
    },
  };
}

/** Laravel yajra/laravel-datatables preset: same wire, cells default to HTML (yajra escapes on the server). */
export function yajra(o: SspOptions = {}): Protocol {
  return { ...ssp({ cells: "html", method: "POST", ...o }), name: "yajra" };
}

/* ============================== dgp (datagrids protocol v1) ============================== */

export interface DgpOptions {
  method?: "GET" | "POST";
  count?: "exact" | "estimate" | "none";
}

function dgpFilters(filters: Record<string, unknown>): Record<string, { op: string; value?: unknown }> {
  const out: Record<string, { op: string; value?: unknown }> = {};
  for (const k in filters) {
    const f = filters[k];
    if (f == null || f === "" || typeof f === "function") continue;
    if (typeof f === "object" && !Array.isArray(f) && "op" in (f as object)) out[k] = f as { op: string; value?: unknown };
    else if (Array.isArray(f)) out[k] = { op: "in", value: f };
    else out[k] = { op: "eq", value: f };
  }
  return out;
}

/** datagrids protocol v1: typed filters, key-based sort, optional counting, RFC 9457 errors. */
export function dgp(o: DgpOptions = {}): Protocol {
  let seq = 0;
  return {
    name: "dgp",
    cells: "text",
    method: o.method ?? "POST",
    encode(req, q, grid) {
      const fields = q.columns.filter((c) => !c.col).map((c) => c.data ?? c.key);
      const body = {
        v: 1,
        // paging off: one page of maxPageSize (spec §3.3), never size 0
        page: { size: q.pageSize > 0 ? q.pageSize : grid?.maxPageSize ?? 1000, number: q.pageSize > 0 ? q.page : 1 },
        sort: q.sort.map((s) => ({ key: s.key, dir: s.dir })),
        ...(q.search ? { q: q.search } : {}),
        filters: dgpFilters(q.filters),
        fields,
        count: o.count ?? "exact",
        requestId: `r-${++seq}`,
        ...(Object.keys(req.params).length ? { params: req.params } : {}),
      };
      const headers: Record<string, string> = { Accept: "application/json, application/problem+json", ...req.headers };
      if (req.method.toUpperCase() === "GET") {
        const flat: Record<string, unknown> = {
          "page[size]": body.page.size,
          "page[number]": body.page.number,
          sort: body.sort.map((s) => (s.dir === "desc" ? "-" : "") + s.key).join(",") || undefined,
          q: body.q,
          fields: fields.join(","),
          count: body.count,
          ...req.params,
        };
        // empty / notEmpty carry an empty value (`filter[deleted_at][empty]=`)
        for (const [k, f] of Object.entries(body.filters)) flat[`filter[${k}][${f.op}]`] = Array.isArray(f.value) ? f.value.join(",") : f.value ?? "";
        const qs = encodeForm(Object.fromEntries(Object.entries(flat).filter(([, v]) => v !== undefined)));
        return { url: `${req.url}${req.url.includes("?") ? "&" : "?"}${qs}`, init: { method: "GET", headers } };
      }
      headers["Content-Type"] = "application/json";
      return { url: req.url, init: { method: "POST", headers, body: JSON.stringify(body) } };
    },
    decode(raw) {
      const b = (raw ?? {}) as { rows?: Row[]; page?: { hasMore?: boolean }; count?: { mode?: string; total?: number; filtered?: number }; meta?: Record<string, unknown> };
      const mode = b.count?.mode ?? "exact";
      const known = mode !== "none";
      return {
        rows: Array.isArray(b.rows) ? b.rows : [],
        total: known ? b.count?.total ?? null : null,
        filtered: known ? b.count?.filtered ?? b.count?.total ?? null : null,
        hasMore: b.page?.hasMore ?? null,
        meta: { ...(b.meta ?? {}), countMode: mode },
      };
    },
  };
}

/* ============================== Laravel paginator ============================== */

export interface PaginatorOptions {
  /** query parameter names; `cursor` is Laravel's `cursorName` (default "cursor") */
  query?: { page?: string; perPage?: string; sort?: string; search?: string; cursor?: string };
  sortFormat?: "-key" | "key:dir";
}

/** Cursors of one query (url + sort + search + filters + params + per_page): page → cursor; page 1 has none. */
interface CursorPages {
  cursors: Map<number, string>;
  /** row count, known once the last page was seen */
  end: number | null;
}
interface CursorState {
  /** the endpoint answered with `cursorPaginate()` JSON */
  on: boolean;
  /** query of the grid's last page load */
  sig: string;
  pages: Map<string, CursorPages>;
  bound: boolean;
}

/**
 * Laravel `paginate()` / `simplePaginate()` / `cursorPaginate()` / `JsonResource::collection` JSON (auto-detected).
 *
 * Cursor mode: the total is unknown (`hasMore` pager). The cursor of page N+1 is learned from page N's
 * `next_cursor`, so pages are reached in order; a jump past the furthest known page lands on that page.
 * Once the last page was seen the row count is known and the pager shows it (and enables "last").
 */
export function laravelPaginator(o: PaginatorOptions = {}): Protocol {
  const n = { page: "page", perPage: "per_page", sort: "sort", search: "search", cursor: "cursor", ...(o.query ?? {}) };
  // state per grid: one definition may serve several grids
  const states = new WeakMap<object, CursorState>();
  const sent = new WeakMap<Query, { sig: string; at: number }>();
  const own = {};
  const stateOf = (grid?: DatagridApi): CursorState => {
    const k = grid ?? own;
    let s = states.get(k);
    if (!s) states.set(k, (s = { on: false, sig: "", pages: new Map(), bound: false }));
    return s;
  };
  const pagesOf = (st: CursorState, sig: string): CursorPages => {
    let p = st.pages.get(sig);
    if (!p) {
      st.pages.set(sig, (p = { cursors: new Map(), end: null }));
      if (st.pages.size > 20) st.pages.delete(st.pages.keys().next().value!);
    }
    return p;
  };
  const furthest = (p: CursorPages) => Math.max(1, ...p.cursors.keys());
  const guard = (grid: DatagridApi, st: CursorState) => {
    if (st.bound) return;
    st.bound = true;
    grid.on("beforePage", (e) => {
      const p = st.on ? st.pages.get(st.sig) : undefined;
      if (!p) return;
      const max = furthest(p);
      if (e.page <= max) return;
      e.cancel();
      if (grid.page() !== max) grid.page(max);
    });
  };

  return {
    name: "laravelPaginator",
    // filters travel by value only (no operator on the wire): offer the operators that mean "equals"
    filterOps: ["eq", "in"],
    cells: "text",
    method: "GET",
    encode(req, q, grid) {
      const p: Record<string, unknown> = { [n.perPage]: q.pageSize };
      const s = q.sort[0];
      if (s) p[n.sort] = o.sortFormat === "key:dir" ? `${s.key}:${s.dir}` : (s.dir === "desc" ? "-" : "") + s.key;
      if (q.search) p[n.search] = q.search;
      for (const k in q.filters) {
        const f = q.filters[k];
        if (f != null && f !== "" && typeof f !== "function") p[k] = typeof f === "object" && !Array.isArray(f) && "value" in (f as object) ? (f as { value: unknown }).value : f;
      }
      Object.assign(p, req.params);
      const sig = `${req.url}?${encodeForm(p)}`;
      const st = stateOf(grid);
      // a `seed` response was decoded without a request: its cursors belong to the grid's first query
      const seeded = st.sig === "" ? st.pages.get("") : undefined;
      if (seeded && (!grid || q.pageSize === grid.pageSize())) {
        st.pages.delete("");
        if (!st.pages.has(sig)) st.pages.set(sig, seeded);
      }
      let wire: Record<string, unknown>;
      let at = q.page;
      if (st.on) {
        const c = q.page > 1 ? pagesOf(st, sig).cursors.get(q.page) : undefined;
        // no cursor for this page (restored page, changed query): the first page is served
        if (c === undefined) at = 1;
        wire = c === undefined ? p : { [n.cursor]: c, ...p };
      } else wire = { [n.page]: q.page, ...p };
      sent.set(q, { sig, at });
      return {
        url: `${req.url}${req.url.includes("?") ? "&" : "?"}${encodeForm(wire)}`,
        init: { method: "GET", headers: { Accept: "application/json", ...req.headers } },
      };
    },
    decode(raw, q, grid) {
      const b = (raw ?? {}) as Record<string, any>;
      const meta = (b.meta ?? b) as Record<string, any>;
      const rows: Row[] = Array.isArray(b.data) ? b.data : [];
      const st = stateOf(grid);
      if ("next_cursor" in meta || "prev_cursor" in meta) {
        const s = sent.get(q);
        // a request sent before cursor mode was known carried no cursor: it got the first page
        const at = st.on && s ? s.at : 1;
        st.on = true;
        if (grid) guard(grid, st);
        const pages = pagesOf(st, s?.sig ?? "");
        const next = meta.next_cursor;
        const hasMore = next != null && next !== "";
        if (hasMore) pages.cursors.set(at + 1, String(next));
        if (!hasMore) pages.end = (at - 1) * q.pageSize + rows.length;
        else if (pages.end != null && at * q.pageSize >= pages.end) pages.end = null; // the list grew
        // the grid's own page loads (exports ask for maxPageSize rows from page 1)
        const own = !grid || q.pageSize === grid.pageSize();
        if (own) st.sig = s?.sig ?? "";
        const info = b.meta
          ? { ...b.meta, links: b.links }
          : { path: b.path, per_page: b.per_page, next_cursor: b.next_cursor ?? null, prev_cursor: b.prev_cursor ?? null, next_page_url: b.next_page_url ?? null, prev_page_url: b.prev_page_url ?? null };
        // served page ≠ requested (no cursor known for it): the core shows the page it really got
        return { rows, total: null, filtered: pages.end, hasMore, meta: info, ...(own && at !== q.page ? { page: at } : {}) };
      }
      st.on = false;
      const total = typeof meta.total === "number" ? meta.total : null;
      const hasMore = total != null ? meta.current_page < meta.last_page : !!(b.next_page_url ?? b.links?.next ?? meta.next_page_url);
      return { rows, total, filtered: total, hasMore, meta: b.meta ? { ...b.meta, links: b.links } : {} };
    },
  };
}

export type { DatagridApi };
