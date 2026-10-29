import { describe, expect, it } from "vitest";
import $ from "jquery";
import { encodeForm, formBody } from "../../src/data/form-encode";
import { ssp, yajra, dgp, laravelPaginator, sspParams } from "../../src/data/server";
import { httpError, bodyError, fetchError } from "../../src/data/errors";
import { tr } from "../../src/core/i18n";
import { column } from "../../src/index";
import type { Query, ResolvedColumn, WireRequest } from "../../src/index";

describe("encodeForm === jQuery 3 $.param (golden)", () => {
  const corpus: Record<string, unknown>[] = [
    { a: 1, b: "x y", c: true, d: false },
    { n: null, u: undefined, e: "" },
    { empty: [], obj: {}, kept: 0 },
    { list: [1, "x", null] },
    { "k[]": ["a", "b"] },
    { nested: { a: { b: 1, c: [2, 3] } } },
    { objs: [{ x: 1 }, { y: "ş" }] },
    { fn: () => "computed", f2: () => null },
    { tr: "Işık Kulesi & Şemsiye A.Ş.", sym: "!'()*~@#$%^" },
    { date: "01-09-2026 - 30-09-2026", f_bayi: [3, 5] },
    { columns: [{ data: "id", name: "", searchable: true, orderable: false, search: { value: "", regex: false } }] },
  ];
  for (const [i, c] of corpus.entries()) {
    it(`case ${i}`, () => {
      expect(encodeForm(c)).toBe($.param(c));
    });
  }
  it("form body turns %20 into + like jQuery.ajax", () => {
    expect(formBody({ q: "a b" })).toBe("q=a+b");
  });
});

const resolved = (defs: ReturnType<typeof column.text>[]): ResolvedColumn[] =>
  defs.map((d, index) => ({ index, title: d.title ?? d.key, sortable: d.sortable ?? !d.col, searchable: d.searchable ?? !d.col, visible: true, hideable: true, exportable: true, ...d }) as ResolvedColumn);

const cols = resolved([column.index(), column.text("ad", { name: "users.name" }), column.money("tutar"), column.text("gizli", { visible: false })]);
const q = (over: Partial<Query> = {}): Query => ({ page: 2, pageSize: 25, sort: [{ key: "tutar", dir: "desc" }], search: "jill", filters: {}, columns: cols, ...over });
const req = (over: Partial<WireRequest> = {}): WireRequest => ({ url: "/x", method: "POST", headers: {}, query: q(), params: {}, ...over });

describe("ssp / yajra wire compatibility", () => {
  it("sends the full parameter set in DataTables order, hidden columns included", () => {
    const d = sspParams(q(), 3, { _token: "t", durum: "" });
    expect(Object.keys(d)).toEqual(["draw", "columns", "order", "start", "length", "search", "_token", "durum"]);
    expect(d.start).toBe(25);
    expect(d.length).toBe(25);
    expect(d.order).toEqual([{ column: 2, dir: "desc" }]);
    expect((d.columns as unknown[]).length).toBe(4);
    const enc = encodeForm(d);
    expect(enc).toContain("columns%5B0%5D%5Bdata%5D=&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=false&columns%5B0%5D%5Borderable%5D=false");
    expect(enc).toContain("columns%5B1%5D%5Bname%5D=users.name");
    expect(enc).toContain("search%5Bvalue%5D=jill&search%5Bregex%5D=false");
    expect(enc).toContain("columns%5B3%5D%5Bdata%5D=gizli");
  });
  it("default order [[0,'asc']] only when no sort was configured; order:[] sends nothing", () => {
    expect(sspParams(q({ sort: [], sortDefault: true }), 1, {}).order).toEqual([{ column: 0, dir: "asc" }]);
    expect(sspParams(q({ sort: [], sortDefault: false }), 1, {}).order).toBeUndefined();
  });
  it("paging off → length -1", () => {
    expect(sspParams(q({ pageSize: 0 }), 1, {}).length).toBe(-1);
  });
  it("ajax.data: mutate, return replacement, static deep merge", () => {
    const mut = ssp({ data: (d) => void (d.durum = "acik") }).encode(req(), q());
    expect(String(mut.init.body)).toContain("durum=acik");
    const ret = ssp({ data: () => ({ only: 1 }) }).encode(req(), q());
    expect(String(ret.init.body)).toBe("only=1");
    const stat = ssp({ data: { search: { value: "override" } } }).encode(req(), q());
    expect(String(stat.init.body)).toContain("search%5Bvalue%5D=override&search%5Bregex%5D=false");
  });
  it("POST form body + jQuery Accept; GET adds _= cache buster", () => {
    const p = yajra().encode(req(), q());
    expect(p.init.method).toBe("POST");
    expect((p.init.headers as Record<string, string>)["Content-Type"]).toMatch(/x-www-form-urlencoded/);
    expect((p.init.headers as Record<string, string>).Accept).toBe("application/json, text/javascript, */*; q=0.01");
    const g = ssp().encode(req({ method: "GET" }), q());
    expect(g.url).toMatch(/^\/x\?draw=1&.*&_=\d+$/);
  });
  it("decode: numbers normalized, draw ignored, extras in meta", () => {
    const r = yajra().decode({ draw: "7", recordsTotal: "120", recordsFiltered: 87, data: [{ id: 1 }], summary: { t: 1 }, disableOrdering: false }, q());
    expect(r.total).toBe(120);
    expect(r.filtered).toBe(87);
    expect(r.meta).toEqual({ summary: { t: 1 } });
    expect(yajra().cells).toBe("html");
    expect(ssp().cells).toBe("text");
  });
  it("dataSrc string/function", () => {
    expect(ssp({ dataSrc: "payload.items" }).decode({ payload: { items: [{ id: 1 }] } }, q()).rows).toEqual([{ id: 1 }]);
    expect(ssp({ dataSrc: (j) => j.rows }).decode({ rows: [{ id: 2 }] }, q()).rows).toEqual([{ id: 2 }]);
  });
});

const res = (body: unknown, status = 200, type = "application/json") => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": type } });

describe("error matrix (8 Laravel error shapes → DatagridError)", () => {
  it("500 JSON: generic message, server text only in detail", async () => {
    const e = await httpError(res({ message: "SQLSTATE secret" }, 500), tr);
    expect(e).toMatchObject({ kind: "http", status: 500, retryable: true, detail: "SQLSTATE secret" });
    expect(e!.message).not.toContain("SQLSTATE");
  });
  it("419 / 401 → session", async () => {
    expect((await httpError(res({ success: false, message: "x" }, 419), tr))!.kind).toBe("session");
    expect((await httpError(res({ success: false }, 401), tr))!.kind).toBe("session");
  });
  it("302 to HTML → forbidden (login → session)", async () => {
    const r = res("<html>", 200, "text/html");
    Object.defineProperty(r, "redirected", { value: true });
    Object.defineProperty(r, "url", { value: "http://x/yetkisiz_sayfasi" });
    expect((await httpError(r, tr))!.kind).toBe("forbidden");
    const r2 = res("<html>", 200, "text/html");
    Object.defineProperty(r2, "redirected", { value: true });
    Object.defineProperty(r2, "url", { value: "http://x/login" });
    expect((await httpError(r2, tr))!.kind).toBe("session");
  });
  it("422 Laravel and RFC 9457", async () => {
    expect(await httpError(res({ message: "Tarih geçersiz.", errors: { tarih: ["Tarih geçersiz."] } }, 422), tr)).toMatchObject({ kind: "validation", message: "Tarih geçersiz.", retryable: false });
    expect(await httpError(res({ title: "Geçersiz filtre", detail: "x", status: 422 }, 422, "application/problem+json"), tr)).toMatchObject({ kind: "validation", message: "Geçersiz filtre" });
  });
  it("403 / 410 / 429", async () => {
    expect((await httpError(res({ error: true, message: "Yetki yok" }, 403), tr))!.message).toBe("Yetki yok");
    expect((await httpError(res({ ok: false, mesaj: "Plan süresi doldu" }, 410), tr))!.message).toBe("Plan süresi doldu");
    expect((await httpError(res({}, 429), tr))!.retryable).toBe(true);
  });
  it("200 + error / status:error", () => {
    expect(bodyError({ error: "Exception Message:\n\nSQL" }, tr)).toMatchObject({ kind: "server", detail: "Exception Message:\n\nSQL" });
    expect(bodyError({ error: true }, tr)!.kind).toBe("server");
    expect(bodyError({ status: "error", message: "Olo yanıt vermedi" }, tr)!.message).toBe("Olo yanıt vermedi");
    expect(bodyError({ data: [] }, tr)).toBeNull();
  });
  it("network / timeout", () => {
    expect(fetchError(new TypeError("Failed to fetch"), tr).kind).toBe("network");
    expect(fetchError(new DOMException("t", "TimeoutError"), tr).kind).toBe("timeout");
  });
});

describe("dgp v1", () => {
  it("POST JSON with key sort, typed filters, fields", () => {
    const e = dgp().encode(req({ query: q({ filters: { durum: ["acik"], tutar: { op: "gte", value: 5 }, ad: "jill" } }) }), q({ filters: { durum: ["acik"], tutar: { op: "gte", value: 5 }, ad: "jill" } }));
    const b = JSON.parse(String(e.init.body));
    expect(b).toMatchObject({ v: 1, page: { size: 25, number: 2 }, sort: [{ key: "tutar", dir: "desc" }], q: "jill", count: "exact" });
    expect(b.filters).toEqual({ durum: { op: "in", value: ["acik"] }, tutar: { op: "gte", value: 5 }, ad: { op: "eq", value: "jill" } });
    expect(b.fields).toEqual(["ad", "tutar", "gizli"]);
  });
  it("GET flat encoding", () => {
    const e = dgp({ method: "GET" }).encode(req({ method: "GET" }), q({ filters: { durum: ["a", "b"] } }));
    expect(decodeURIComponent(e.url)).toContain("sort=-tutar");
    expect(decodeURIComponent(e.url)).toContain("filter[durum][in]=a,b");
  });
  it("count none → unknown totals", () => {
    const r = dgp().decode({ v: 1, rows: [{ id: "1" }], page: { hasMore: true }, count: { mode: "none" } }, q());
    expect(r).toMatchObject({ total: null, filtered: null, hasMore: true });
  });
});

describe("laravelPaginator", () => {
  it("paginate(), simplePaginate(), JsonResource", () => {
    const p = laravelPaginator();
    expect(p.decode({ data: [{ id: 1 }], total: 40, current_page: 1, last_page: 4 }, q())).toMatchObject({ total: 40, hasMore: true });
    expect(p.decode({ data: [{ id: 1 }], next_page_url: "/x?page=2" }, q())).toMatchObject({ total: null, filtered: null, hasMore: true });
    expect(p.decode({ data: [], meta: { total: 3, current_page: 1, last_page: 1 }, links: {} }, q())).toMatchObject({ total: 3, hasMore: false });
    const e = p.encode(req({ method: "GET" }), q());
    expect(e.url).toBe("/x?page=2&per_page=25&sort=-tutar&search=jill");
  });
});

describe("ssp ColumnControl (yajra 12.7) + page filters", () => {
  it("typed column filters become columnControl, page filters plain params", () => {
    const qq = q({ filters: { tutar: { op: "gte", value: 15000 }, ad: { op: "in", value: ["Jill"] }, durum: "acik", gizli: { op: "between", value: [1, 2] } } });
    const d = sspParams(qq, 1, {}) as { columns: Array<Record<string, unknown>>; durum?: string };
    expect(d.columns[2]!.columnControl).toEqual({ search: { value: "15000", logic: "greaterOrEqual", type: "num" } });
    expect(d.columns[1]!.columnControl).toEqual({ list: ["Jill"] });
    expect(d.columns[3]!.columnControl).toBeUndefined(); // between has no ColumnControl equivalent
    expect(d.durum).toBe("acik");
    expect(encodeForm(d)).toContain("columns%5B2%5D%5BcolumnControl%5D%5Bsearch%5D%5Blogic%5D=greaterOrEqual");
  });
});

describe("yajra escaped text", () => {
  it("column.text shows and exports `&` for the server's `&amp;`; ssp keeps the literal", async () => {
    const { Datagrid, column, serverSide, yajra, ssp, configure } = await import("../../src/index");
    const { buildSheet } = await import("../../src/modules/export/values");
    const body = { draw: 1, recordsTotal: 1, recordsFiltered: 1, data: [{ id: 1, ad: "Şemsiye &amp; Ortakları", rozet: "<b>A&amp;B</b>" }] };
    configure({ fetch: (async (_u: RequestInfo | URL, init?: RequestInit) => {
      const draw = new URLSearchParams(String(init?.body ?? "")).get("draw");
      return new Response(JSON.stringify({ ...body, draw: Number(draw) }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch });
    try {
      for (const [protocol, shown] of [[yajra(), "Şemsiye & Ortakları"], [ssp(), "Şemsiye &amp; Ortakları"]] as const) {
        document.body.innerHTML = "<table id='t'></table>";
        const g = new Datagrid("#t", { columns: [column.text("ad"), { key: "rozet" }], use: [serverSide({ url: "/x", protocol })] });
        await new Promise((r) => setTimeout(r, 5));
        expect(g.root.querySelector("td[data-key=ad]")!.textContent).toBe(shown);
        if (protocol.name === "yajra") {
          expect(g.root.querySelector("td[data-key=rozet] b")!.textContent).toBe("A&B");
          const sheet = buildSheet(g.columns(), g.viewRows(), null, true);
          expect(sheet.rows[0]).toEqual(["Şemsiye & Ortakları", "A&B"]);
        }
        g.destroy();
      }
    } finally {
      configure({ fetch: undefined });
    }
  });
});

describe("ssp plain column filters", () => {
  it("a scalar goes to columns[i][search][value]; an array to an escaped regex OR; non-searchable columns send nothing", async () => {
    const { sspParams } = await import("../../src/data/server");
    const col = (key: string, searchable = true) => ({ key, title: key, index: 0, sortable: true, searchable, visible: true, hideable: true, exportable: true, defaultVisible: true });
    const q = {
      page: 1, pageSize: 10, search: "", sort: [], sortDefault: false,
      columns: [col("birim"), col("durum"), col("gizli", false)],
      filters: { birim: "R.P.D.", durum: ["acik", "a.b"], gizli: "x", sayfa: "1" },
    } as never;
    const p = sspParams(q, 1, {}) as { columns: Array<{ search: { value: string; regex: boolean } }>; sayfa?: string };
    expect(p.columns[0]!.search).toEqual({ value: "^R\\.P\\.D\\.$", regex: true });
    expect(p.columns[1]!.search).toEqual({ value: "^acik$|^a\\.b$", regex: true });
    expect(p.columns[2]!.search).toEqual({ value: "", regex: false });
    expect(p.sayfa).toBe("1");
  });
});

describe("dgp wire details", () => {
  it("paging off sends maxPageSize, GET keeps empty/notEmpty with an empty value", async () => {
    const { dgp } = await import("../../src/data/server");
    const q = { page: 3, pageSize: 0, search: "", sort: [], columns: [], filters: { silindi: { op: "empty" }, ad: { op: "notEmpty" } } } as never;
    const req = { url: "/x", method: "POST", headers: {}, query: q, params: {} } as never;
    const post = dgp().encode(req, q, { maxPageSize: 500 } as never);
    expect(JSON.parse(String(post.init.body)).page).toEqual({ size: 500, number: 1 });
    const get = dgp({ method: "GET" }).encode({ ...(req as object), method: "GET" } as never, q, { maxPageSize: 500 } as never);
    expect(get.url).toContain("filter%5Bsilindi%5D%5Bempty%5D=");
    expect(get.url).toContain("filter%5Bad%5D%5BnotEmpty%5D=");
  });
});

describe("emulator dgp GET form", () => {
  it("reads sort, fields and filter[key][op] from the query string", async () => {
    const { createEmulator } = await import("../fixtures/server/emulator");
    const emu = createEmulator({ rows: () => [
      { id: 1, ad: "Jill Valentine", birim: "S.T.A.R.S. Alfa", tutar: 10 },
      { id: 2, ad: "Chris Redfield", birim: "S.T.A.R.S. Alfa", tutar: 30 },
      { id: 3, ad: "Ada Wong", birim: "Bağımsız", tutar: 20 },
    ] as never });
    const res = await emu.handle("/api/dgp/x?page%5Bsize%5D=10&page%5Bnumber%5D=1&sort=-tutar&fields=ad,tutar&filter%5Bbirim%5D%5Bin%5D=S.T.A.R.S.%20Alfa", { method: "GET" });
    const body = await res.json();
    expect(body.rows.map((r: { ad: string }) => r.ad)).toEqual(["Chris Redfield", "Jill Valentine"]);
    expect(Object.keys(body.rows[0])).toEqual(["id", "ad", "tutar"]);
  });
});

describe("yajra escaped values in typed columns", () => {
  it("badge labels and links see the decoded text", async () => {
    const { Datagrid, column, serverSide, yajra, configure } = await import("../../src/index");
    configure({ fetch: (async (_u: RequestInfo | URL, init?: RequestInit) => {
      const draw = new URLSearchParams(String(init?.body ?? "")).get("draw");
      return new Response(JSON.stringify({ draw: Number(draw), recordsTotal: 1, recordsFiltered: 1, data: [{ id: 1, birim: "R&amp;D", ad: "Ada &amp; Leon" }] }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch });
    try {
      document.body.innerHTML = "<table id='t'></table>";
      const g = new Datagrid("#t", { columns: [column.badge("birim", { labels: { "R&D": "Ar-Ge" } }), column.link("ad", { href: "/p/{id}" })], use: [serverSide({ url: "/x", protocol: yajra() })] });
      await new Promise((r) => setTimeout(r, 5));
      expect(g.root.querySelector("td[data-key=birim]")!.textContent).toBe("Ar-Ge");
      expect(g.root.querySelector("td[data-key=ad] a")!.textContent).toBe("Ada & Leon");
      g.destroy();
    } finally {
      configure({ fetch: undefined });
    }
  });
});

describe("ctx.text: other fields of an escaped row", () => {
  it("decodes entities and strips markup on yajra, leaves client rows alone, and never mutates the row", async () => {
    const { Datagrid, column, serverSide, yajra, arraySource, config } = await import("../../src/index");
    config.fetch = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      const draw = new URLSearchParams(String(init?.body ?? "")).get("draw");
      return new Response(JSON.stringify({ draw: Number(draw), recordsTotal: 1, recordsFiltered: 1, data: [{ id: 1, ad: "Ada &amp; Leon", birim: "<b>R&amp;D</b>" }] }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    try {
      const seen: unknown[] = [];
      const summary = column.text("ozet", {
        render: (_v, row: Record<string, unknown>, ctx) => {
          seen.push(row.ad);
          return `${ctx.text(row, "ad")} · ${ctx.text(row, "birim")} · ${ctx.text(row, "yok")}`;
        },
      });
      document.body.innerHTML = "<table id='t'></table>";
      const g = new Datagrid("#t", { columns: [column.text("ad"), summary], use: [serverSide({ url: "/x", protocol: yajra() })] });
      await new Promise((r) => setTimeout(r, 5));
      expect(g.root.querySelector("td[data-key=ozet]")!.textContent).toBe("Ada & Leon · R&D · ");
      expect(seen).toEqual(["Ada &amp; Leon"]);
      g.destroy();
      document.body.innerHTML = "<table id='t'></table>";
      const c = new Datagrid("#t", { columns: [column.text("ad"), summary], use: [arraySource([{ id: 1, ad: "Tom &amp; Jerry", birim: "<b>x</b>" }])] });
      await new Promise((r) => setTimeout(r, 5));
      // a client source stores text as is: nothing to decode
      expect(c.root.querySelector("td[data-key=ozet]")!.textContent).toBe("Tom &amp; Jerry · <b>x</b> · ");
      c.destroy();
    } finally {
      config.fetch = undefined;
    }
  });
});

describe("order after clearing the sort", () => {
  it("clearing at runtime keeps the default order on the wire; only an explicit sort:[] drops it", async () => {
    const { Datagrid, column, serverSide, yajra, configure } = await import("../../src/index");
    const bodies: URLSearchParams[] = [];
    configure({ fetch: (async (_u: RequestInfo | URL, init?: RequestInit) => {
      const b = new URLSearchParams(String(init?.body ?? ""));
      bodies.push(b);
      return new Response(JSON.stringify({ draw: Number(b.get("draw")), recordsTotal: 0, recordsFiltered: 0, data: [] }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch });
    try {
      document.body.innerHTML = "<table id='t'></table>";
      const g = new Datagrid("#t", { columns: [column.text("ad"), column.text("birim")], use: [serverSide({ url: "/x", protocol: yajra() })] });
      await new Promise((r) => setTimeout(r, 5));
      g.sort([["birim", "desc"]]);
      await new Promise((r) => setTimeout(r, 5));
      g.sort([]);
      await new Promise((r) => setTimeout(r, 5));
      expect(bodies.map((b) => b.get("order[0][column]"))).toEqual(["0", "1", "0"]);
      g.destroy();
      bodies.length = 0;
      document.body.innerHTML = "<table id='t'></table>";
      const g2 = new Datagrid("#t", { columns: [column.text("ad")], sort: [], use: [serverSide({ url: "/x", protocol: yajra() })] });
      await new Promise((r) => setTimeout(r, 5));
      expect(bodies[0]!.has("order[0][column]")).toBe(false);
      g2.destroy();
    } finally {
      configure({ fetch: undefined });
    }
  });
});

describe("seed", () => {
  it("answers a pristine first load; a restored page or sort makes a real request", async () => {
    const { Datagrid, column, serverSide, yajra, configure } = await import("../../src/index");
    const bodies: URLSearchParams[] = [];
    configure({ fetch: (async (_u: RequestInfo | URL, init?: RequestInit) => {
      const b = new URLSearchParams(String(init?.body ?? ""));
      bodies.push(b);
      return new Response(JSON.stringify({ draw: Number(b.get("draw")), recordsTotal: 30, recordsFiltered: 30, data: [{ id: 99, ad: "fetched" }] }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch });
    const seed = { draw: 0, recordsTotal: 30, recordsFiltered: 30, data: [{ id: 1, ad: "seeded" }] };
    try {
      document.body.innerHTML = "<table id='t'></table>";
      const g = new Datagrid("#t", { columns: [column.text("ad")], pageSize: 10, use: [serverSide({ url: "/x", protocol: yajra(), seed })] });
      await new Promise((r) => setTimeout(r, 5));
      expect(bodies.length).toBe(0);
      expect(g.viewRows()[0]!.ad).toBe("seeded");
      g.destroy();
      document.body.innerHTML = "<table id='t'></table>";
      const g2 = new Datagrid("#t", { columns: [column.text("ad")], pageSize: 10, load: "manual", use: [serverSide({ url: "/x", protocol: yajra(), seed })] });
      g2.page(3);
      await g2.load();
      expect(bodies.length).toBe(1);
      expect(bodies[0]!.get("start")).toBe("20");
      expect(g2.viewRows()[0]!.ad).toBe("fetched");
      g2.destroy();
    } finally {
      configure({ fetch: undefined });
    }
  });
});

describe("actions over yajra-escaped rows", () => {
  it("confirm text and subject show the text once", async () => {
    const { Datagrid, column, serverSide, yajra, configure, actions } = await import("../../src/index");
    const asked: Array<[string, string | undefined]> = [];
    configure({
      confirm: async (msg: string, o: { subject?: string }) => (asked.push([msg, o.subject]), false),
      fetch: (async (_u: RequestInfo | URL, init?: RequestInit) => {
        const draw = new URLSearchParams(String(init?.body ?? "")).get("draw");
        return new Response(JSON.stringify({ draw: Number(draw), recordsTotal: 1, recordsFiltered: 1, data: [{ id: 1, ad: "Şemsiye A.Ş. &amp; O&#039;Brien" }] }), { headers: { "Content-Type": "application/json" } });
      }) as typeof fetch,
    } as never);
    try {
      document.body.innerHTML = "<table id='t'></table>";
      const g = new Datagrid("#t", {
        columns: [column.text("ad"), column.actions()],
        use: [serverSide({ url: "/x", protocol: yajra() }), actions({ items: [{ id: "sil", label: "Sil", tone: "danger", confirm: "{ad} silinsin mi?", request: { url: "/sil/{id}", method: "DELETE" } }] } as never)],
      });
      await new Promise((r) => setTimeout(r, 5));
      await (g as unknown as { actions: { run(id: string, key: string): Promise<unknown> } }).actions.run("sil", "1");
      expect(asked[0]).toEqual(["Şemsiye A.Ş. & O'Brien silinsin mi?", "Şemsiye A.Ş. & O'Brien"]);
      g.destroy();
    } finally {
      configure({ confirm: undefined, fetch: undefined } as never);
    }
  });
});
