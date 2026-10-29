import { describe, expect, it, vi, afterEach } from "vitest";
import { Datagrid, column, arraySource, customSource, configure, config, find, reload, upgrade, preset } from "../../src/index";
import type { Row } from "../../src/index";

const flush = () => new Promise((r) => setTimeout(r, 0));
const mount = () => {
  document.body.innerHTML = '<meta name="csrf-token" content="tok"><div id="host"><table id="t"></table></div>';
  return document.getElementById("t") as HTMLTableElement;
};
const rows: Row[] = [
  { id: 1, ad: "Jill Valentine", tutar: 10 },
  { id: 2, ad: "Chris Redfield", tutar: 20 },
];

// configure() skips undefined values: reset the adapters on the object itself
afterEach(() => {
  Object.assign(config, { notify: undefined, confirm: undefined, fetch: undefined, isError: undefined, errorMode: "inline" });
});

describe("delegate + render hook", () => {
  it("passes row context to delegated handlers", async () => {
    const t = mount();
    const g = new Datagrid(t, {
      label: "x",
      columns: [column.text("ad"), column.text("islem", { render: () => { const b = document.createElement("button"); b.dataset.act = "sil"; b.textContent = "Sil"; return b; } })],
      use: [arraySource(rows)],
    });
    const seen: string[] = [];
    g.delegate("click", "[data-act=sil]", (_e, ctx) => seen.push(`${ctx.key}:${ctx.row.ad}:${ctx.column?.key}`));
    const renders: number[] = [];
    g.on("render", ({ keys }) => renders.push(keys.length));
    await flush();
    (t.querySelectorAll("[data-act=sil]")[1] as HTMLButtonElement).click();
    expect(seen).toEqual(["2:Chris Redfield:islem"]);
    expect(renders.at(-1)).toBe(2);
    g.destroy();
  });
});

describe("configure() host adapters", () => {
  it("notify and confirm adapters are used by grid.action", async () => {
    const notify = vi.fn();
    const confirm = vi.fn(async () => true);
    const fetchMock = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      expect((init!.headers as Record<string, string>)["X-CSRF-TOKEN"]).toBe("tok");
      expect((init!.headers as Record<string, string>)["X-Requested-With"]).toBe("XMLHttpRequest");
      return new Response(JSON.stringify({ message: "Silindi." }), { status: 200, headers: { "content-type": "application/json" } });
    });
    configure({ notify, confirm, fetch: fetchMock as unknown as typeof fetch });
    const t = mount();
    const g = new Datagrid(t, { label: "x", columns: [column.text("ad")], use: [arraySource(rows)] });
    await flush();
    const out = await g.action("/kayit/1", { method: "DELETE", confirm: "Silinsin mi?" });
    expect(confirm).toHaveBeenCalledWith("Silinsin mi?", { message: "Silinsin mi?" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith("success", "Silindi.");
    expect(out).toEqual({ message: "Silindi." });
    g.destroy();
  });

  it("confirm false → no request", async () => {
    const fetchMock = vi.fn();
    configure({ confirm: async () => false, fetch: fetchMock as unknown as typeof fetch });
    const t = mount();
    const g = new Datagrid(t, { label: "x", columns: [column.text("ad")], use: [arraySource(rows)] });
    expect(await g.action("/x", { confirm: "?" })).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    g.destroy();
  });

  it("isError: a 200 whose body reports a failure notifies the error, throws and does not reload", async () => {
    const notify = vi.fn();
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
    const fetchMock = vi.fn(async () => json({ status: false, error: "Grup kullanımda." }));
    configure({ notify, fetch: fetchMock as unknown as typeof fetch, isError: (b) => (b as { status?: unknown }).status === false && ((b as { error?: string }).error || true) });
    const t = mount();
    const g = new Datagrid(t, { label: "x", columns: [column.text("ad")], use: [arraySource(rows)] });
    await flush();
    const loads = vi.fn();
    g.on("load", loads);
    await expect(g.action("/grup/1", { method: "DELETE" })).rejects.toMatchObject({ kind: "server", status: 200, message: "Grup kullanımda.", raw: { status: false, error: "Grup kullanımda." } });
    expect(notify).toHaveBeenCalledWith("error", "Grup kullanımda.");
    expect(notify).not.toHaveBeenCalledWith("success", expect.anything());
    await flush();
    expect(loads).not.toHaveBeenCalled();
    // `true` uses the generic message; the per-call rule wins over the configured one
    fetchMock.mockImplementation(async () => json({ ok: 0 }));
    await expect(g.action("/x", { isError: (b) => (b as { ok: number }).ok === 0 })).rejects.toMatchObject({ message: "İşlem başarısız" });
    fetchMock.mockImplementation(async () => json({ status: true, message: "Silindi." }));
    await expect(g.action("/x")).resolves.toEqual({ status: true, message: "Silindi." });
    expect(notify).toHaveBeenLastCalledWith("success", "Silindi.");
    g.destroy();
  });

  it("without an isError rule a 200 body is a success (no built-in guessing)", async () => {
    const notify = vi.fn();
    configure({ notify, fetch: (async () => new Response(JSON.stringify({ status: false }), { status: 200, headers: { "content-type": "application/json" } })) as unknown as typeof fetch });
    const t = mount();
    const g = new Datagrid(t, { label: "x", columns: [column.text("ad")], use: [arraySource(rows)] });
    await expect(g.action("/x", { reload: false })).resolves.toEqual({ status: false });
    expect(notify).toHaveBeenCalledWith("success", "İşlem tamamlandı.");
    g.destroy();
  });

  it("rejects cross-origin and unknown methods", async () => {
    const t = mount();
    const g = new Datagrid(t, { label: "x", columns: [column.text("ad")], use: [arraySource(rows)] });
    await expect(g.action("https://evil.example/x")).rejects.toThrow(/same-origin/);
    await expect(g.action("/x", { method: "TRACE" as never })).rejects.toThrow(/not allowed/);
    g.destroy();
  });
});

describe("errorMode", () => {
  const failing = () => customSource({ mode: "server", load: async () => { throw { kind: "http", status: 500, message: "boom", retryable: true }; } });
  it("inline shows the error state", async () => {
    const t = mount();
    const g = new Datagrid(t, { label: "x", columns: [column.text("ad")], use: [failing()] });
    await flush();
    await flush();
    expect(g.root.getAttribute("data-state")).toBe("error");
    expect(g.root.querySelector(".dg-state[data-kind=error]")!.textContent).toContain("boom");
    g.destroy();
  });
  it("silent keeps the grid quiet but still emits error", async () => {
    const t = mount();
    const g = new Datagrid(t, { label: "x", errorMode: "silent", columns: [column.text("ad")], use: [failing()] });
    const errs: string[] = [];
    g.on("error", ({ error }) => errs.push(error.message));
    await flush();
    await flush();
    expect(errs).toEqual(["boom"]);
    expect(g.root.querySelector(".dg-state[data-kind=error]")).toBeNull();
    g.destroy();
  });
});

describe("registry + upgrade", () => {
  it("find/reload by name, upgrade idempotent with preset", async () => {
    document.body.innerHTML = `<table data-datagrid="p" data-dg-name="adli" data-dg-page-size="1" data-dg-sort="tutar:desc"><thead><tr><th data-dg-key="ad">Ad</th><th data-dg-key="tutar" data-dg-type="money">Tutar</th></tr></thead><tbody></tbody></table>`;
    preset("p", () => [arraySource(rows)]);
    const a = upgrade();
    const b = upgrade();
    expect(a.length).toBe(1);
    expect(b.length).toBe(0);
    await flush();
    const g = find("adli")!;
    expect(g).toBe(a[0]);
    expect(g.sort()).toEqual([{ key: "tutar", dir: "desc" }]);
    expect(g.pageSize()).toBe(1);
    expect(document.querySelector("tbody td")!.textContent).toBe("Chris Redfield");
    expect(reload("adli")).toBe(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(reload("yok")).toBe(false);
    warn.mockRestore();
    g.destroy();
    expect(find("adli")).toBeNull();
  });
});

describe("page restore and past-the-end pages", () => {
  const people = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, ad: `Kişi ${i + 1}` }));
  const server = (data: Row[], seen: number[]) =>
    customSource({
      mode: "server",
      load: async (q) => {
        seen.push(q.page);
        const start = (q.page - 1) * q.pageSize;
        return { rows: data.slice(start, start + q.pageSize), total: data.length, filtered: data.length };
      },
    });

  it("page(n) before the first load costs no extra request", async () => {
    const seen: number[] = [];
    const g = new Datagrid(mount(), { columns: [column.text("ad")], pageSize: 10, load: "manual", use: [server(people, seen)] });
    expect(g.page(3)).toBe(3);
    await g.load();
    expect(seen).toEqual([3]);
    expect(g.page()).toBe(3);
    g.destroy();
  });

  it("a server page past the end steps back to the last page once", async () => {
    const seen: number[] = [];
    const data = people.slice();
    const g = new Datagrid(mount(), { columns: [column.text("ad")], pageSize: 10, use: [server(data, seen)] });
    await flush();
    g.page(3);
    await flush();
    data.splice(20); // rows deleted elsewhere
    await g.reload({ keepPage: true });
    expect(seen).toEqual([1, 3, 3, 2]);
    expect(g.page()).toBe(2);
    expect(g.root.querySelectorAll("tbody tr").length).toBe(10);
    g.destroy();
  });
});

describe("unknown total paging", () => {
  it("on the last page of a count-less source, 'previous' goes one page back (not to page 1)", async () => {
    const seen: number[] = [];
    const g = new Datagrid(mount(), {
      columns: [column.text("ad")],
      pageSize: 10,
      use: [customSource({ mode: "server", load: async (q) => (seen.push(q.page), { rows: [{ id: q.page, ad: `p${q.page}` }], total: null as unknown as number, filtered: null as unknown as number, hasMore: q.page < 3 }) })],
    });
    await flush();
    g.page(2);
    await flush();
    g.page(3);
    await flush();
    expect(g.page(4)).toBe(3); // no next page
    g.page(2);
    await flush();
    expect(g.page()).toBe(2);
    expect(seen).toEqual([1, 2, 3, 2]);
    g.destroy();
  });
});

describe("chaining, remount and warnings", () => {
  it("a source chained with .use() replaces the default one; remount keeps chained modules", async () => {
    const t = mount();
    const seen: number[] = [];
    const src = customSource({ mode: "server", load: async (q) => (seen.push(q.page), { rows: [{ id: 1, ad: "Jill Valentine" }], total: 1, filtered: 1 }) });
    const { colVis } = await import("../../src/index");
    const g = new Datagrid(t, { columns: [column.text("ad")] }).use(src).use(colVis());
    await flush();
    expect(seen).toEqual([1]);
    expect(g.mode).toBe("server");
    const g2 = g.remount();
    await flush();
    expect(seen).toEqual([1, 1]);
    expect(g2.module(colVis)).not.toBeNull();
    g2.destroy();
  });

  it("an explicit second source still fails (DG008)", () => {
    const t = mount();
    expect(() => new Datagrid(t, { columns: [column.text("ad")], use: [arraySource(rows)] }).use(arraySource(rows))).toThrow(/DG008/);
  });

  it("initial pageSize above maxPageSize is clamped with DG013; warnings:false silences module notices", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const g = new Datagrid(mount(), { columns: [column.text("ad")], pageSize: 5000, maxPageSize: 500, use: [arraySource(rows)] });
      expect(g.pageSize()).toBe(500);
      expect(spy.mock.calls.some((c) => String(c[0]).includes("DG013"))).toBe(true);
      g.destroy();
      spy.mockClear();
      configure({ warnings: false });
      const { footer } = await import("../../src/index");
      const g2 = new Datagrid(mount(), { columns: [column.text("ad")], use: [arraySource(rows), footer({ cols: { yok: "sum" } })] });
      await flush();
      expect(spy).not.toHaveBeenCalled();
      g2.destroy();
    } finally {
      configure({ warnings: true });
      spy.mockRestore();
    }
  });
});

describe("grid.action session expiry", () => {
  it("a 419 fires sessionexpired and the host's onSessionExpired", async () => {
    const onSessionExpired = vi.fn();
    configure({ onSessionExpired, notify: vi.fn(), fetch: (async () => new Response("", { status: 419 })) as typeof fetch } as never);
    const g = new Datagrid(mount(), { columns: [column.text("ad")], use: [arraySource(rows)] });
    const ev = vi.fn();
    g.on("sessionexpired", ev);
    await expect(g.action("/x/1")).rejects.toMatchObject({ kind: "session" });
    expect(ev).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    g.destroy();
    configure({ onSessionExpired: undefined } as never);
  });
});

describe("review fixes", () => {
  it("page(n) while the first load is in flight requests page n", async () => {
    const seen: number[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const g = new Datagrid(mount(), {
      columns: [column.text("ad")],
      pageSize: 1,
      use: [customSource({ mode: "server", load: async (q) => { seen.push(q.page); if (seen.length === 1) await gate; return { rows: [{ id: q.page, ad: `p${q.page}` }], total: 5, filtered: 5 }; } })],
    });
    await flush();
    g.page(3);
    release();
    await flush();
    await flush();
    expect(seen).toEqual([1, 3]);
    expect(g.page()).toBe(3);
    expect(g.viewRows()[0]!.ad).toBe("p3");
    g.destroy();
  });

  it("autoRefresh leaves a manual grid alone until it is loaded", async () => {
    vi.useFakeTimers();
    try {
      const { autoRefresh } = await import("../../src/index");
      const seen: number[] = [];
      const g = new Datagrid(mount(), { columns: [column.text("ad")], load: "manual", use: [customSource({ mode: "server", load: async (q) => (seen.push(q.page), { rows: [], total: 0, filtered: 0 }) }), autoRefresh({ every: 5000 })] });
      await vi.advanceTimersByTimeAsync(11000);
      expect(seen).toEqual([]);
      g.destroy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("DOM source: back to the definition order moves the host cells back too", async () => {
    document.body.innerHTML = "<table id='t'><thead><tr><th>Ad</th><th>Birim</th><th>Tutar</th></tr></thead><tbody><tr><td>Jill Valentine</td><td>R.P.D.</td><td>10</td></tr></tbody></table>";
    const { domSource } = await import("../../src/index");
    const g = new Datagrid("#t", { columns: [column.text("ad"), column.text("birim"), column.number("tutar")], use: [domSource()] });
    await flush();
    g.columnOrder(["tutar", "ad", "birim"]);
    g.columnOrder([]);
    const t = document.getElementById("t") as HTMLTableElement;
    expect(Array.from(t.tBodies[0]!.rows[0]!.cells).map((c) => c.getAttribute("data-key"))).toEqual(["ad", "birim", "tutar"]);
    g.destroy();
  });

  it("client filters read TR-formatted numbers and dd.mm.yyyy HH:ii:ss; free text is not a date", async () => {
    const g = new Datagrid(mount(), {
      columns: [column.text("tutar"), column.text("t"), column.text("ad")],
      use: [arraySource([
        { id: 1, tutar: "1.234,56 ₺", t: "20.10.2026 09:15:30", ad: "Bravo 2" },
        { id: 2, tutar: "999,00 ₺", t: "22.10.2026 18:00:00", ad: "Alfa" },
      ])],
    });
    await flush();
    g.filters({ tutar: { op: "gt", value: 1000 } });
    expect(g.viewRows().map((r) => r.id)).toEqual([1]);
    g.filters({ tutar: null, t: { op: "lte", value: "2026-10-20" } });
    expect(g.viewRows().map((r) => r.id)).toEqual([1]);
    g.filters({ t: null, ad: { op: "gt", value: "2000-01-01" } });
    expect(g.viewRows().map((r) => r.id)).toEqual([]);
    g.destroy();
  });
});

describe("empty result past page 1", () => {
  it("a keepPage reload that finds no rows at all goes back to page 1", async () => {
    let data = [{ id: 1, ad: "a" }, { id: 2, ad: "b" }, { id: 3, ad: "c" }];
    const seen: number[] = [];
    const g = new Datagrid(mount(), {
      columns: [column.text("ad")],
      pageSize: 1,
      use: [customSource({ mode: "server", load: async (q) => (seen.push(q.page), { rows: data.slice(q.page - 1, q.page), total: data.length, filtered: data.length }) })],
    });
    await flush();
    g.page(2);
    await flush();
    data = [];
    await g.reload({ keepPage: true });
    expect(g.page()).toBe(1);
    expect(seen).toEqual([1, 2, 2, 1]);
    g.destroy();
  });
});

describe("DOM source with explicit columns", () => {
  it("a can:false column's host cell is hidden and later cells keep their columns; dotted data paths work", async () => {
    document.body.innerHTML = "<table id='t'><thead><tr><th>Ad</th><th>Maaş</th><th>Birim</th></tr></thead><tbody>" +
      "<tr><td>Jill Valentine</td><td>999</td><td>S.T.A.R.S. Alfa</td></tr><tr><td>Ada Wong</td><td>888</td><td>Bağımsız</td></tr></tbody></table>";
    const before = document.body.innerHTML;
    const { domSource } = await import("../../src/index");
    const g = new Datagrid("#t", {
      columns: [column.text("ad"), column.number("maas", { can: false }), column.text("birim", { data: "birim.ad" })],
      use: [domSource()],
    });
    await flush();
    const t = document.getElementById("t") as HTMLTableElement;
    const first = t.tBodies[0]!.rows[0]!;
    const visible = Array.from(first.cells).filter((c) => !c.hidden);
    expect(visible.map((c) => [c.getAttribute("data-key"), c.textContent])).toEqual([["ad", "Jill Valentine"], ["birim", "S.T.A.R.S. Alfa"]]);
    expect(Array.from(t.tHead!.rows[0]!.cells).map((c) => c.getAttribute("data-key"))).toEqual(["ad", "birim"]);
    g.search("bağımsız");
    expect(g.viewRows().map((r) => (r as { birim: { ad: string } }).birim.ad)).toEqual(["Bağımsız"]);
    g.search("");
    g.sort([["birim", "asc"]]);
    await flush();
    expect(t.tBodies[0]!.rows[0]!.cells[0]!.textContent).toBe("Ada Wong");
    g.destroy();
    expect(document.body.innerHTML).toBe(before);
  });
});

describe("chained server source over a placeholder body", () => {
  it("behaves like use:[…]: typed columns from the head, -1 page size kept with allowAll", async () => {
    const bodies: URLSearchParams[] = [];
    configure({ fetch: (async (_u: RequestInfo | URL, init?: RequestInit) => {
      const b = new URLSearchParams(String(init?.body ?? ""));
      bodies.push(b);
      return new Response(JSON.stringify({ draw: Number(b.get("draw")), recordsTotal: 1, recordsFiltered: 1, data: [{ id: 1, ad: "Jill Valentine", tutar: "1234.5" }] }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch });
    try {
      document.body.innerHTML = "<table id='t'><thead><tr><th data-dg-key='ad'>Ad</th><th data-dg-key='tutar' data-dg-type='money'>Tutar</th></tr></thead><tbody><tr><td colspan='2'>Yükleniyor…</td></tr></tbody></table>";
      const { serverSide, yajra } = await import("../../src/index");
      const g = new Datagrid("#t", { pageSize: -1 }).use(serverSide({ url: "/x", protocol: yajra({ allowAll: true }) }));
      await new Promise((r) => setTimeout(r, 10));
      expect(bodies[0]!.get("length")).toBe("-1");
      expect(g.root.querySelector("td[data-key=tutar] .dg-money")).not.toBeNull();
      g.destroy();
    } finally {
      configure({ fetch: undefined });
    }
  });
});

describe("reload over in-page rows", () => {
  it("keeps setData / addRows / removeRow changes", async () => {
    const g = new Datagrid(mount(), { columns: [column.text("ad")], use: [arraySource(rows)] });
    await flush();
    g.setData([{ id: 9, ad: "Ada Wong" }]);
    g.addRows([{ id: 10, ad: "Leon S. Kennedy" }]);
    await g.reload();
    expect(g.viewRows().map((r) => r.id)).toEqual([9, 10]);
    g.destroy();
  });
});

describe("destroy restores host rows on every page", () => {
  it("rowReorder handles and keyboardGrid tabindex leave no trace, even on rows of another page", async () => {
    document.body.innerHTML = "<table id='t'><thead><tr><th>Ad</th><th>Birim</th></tr></thead><tbody>" +
      "<tr><td><a href='/p/1'>Jill Valentine</a></td><td>R.P.D.</td></tr><tr><td><a href='/p/2'>Ada Wong</a></td><td>Bağımsız</td></tr></tbody></table>";
    const before = document.body.innerHTML;
    const { domSource, rowReorder, keyboardGrid } = await import("../../src/index");
    const g = new Datagrid("#t", { columns: [column.html("ad"), column.text("birim")], pageSize: 1, use: [domSource(), rowReorder({ onEnd() {} }), keyboardGrid()] });
    await flush();
    g.page(2);
    await flush();
    g.page(1);
    await flush();
    g.destroy();
    expect(document.body.innerHTML).toBe(before);
  });
});

describe("review 2 small fixes", () => {
  it("button.custom: disabled() is not called with null at setup; a double click runs onClick once", async () => {
    const { button } = await import("../../src/index");
    let runs = 0;
    let release: () => void = () => {};
    const g = new Datagrid(mount(), {
      columns: [column.text("ad")],
      use: [arraySource(rows), button.custom({ label: "Gönder", disabled: (json: any) => json.hasInsufficientBalanceLogs, onClick: () => { runs++; return new Promise<void>((r) => (release = r)); } })],
    });
    await flush();
    const b = Array.from(g.root.querySelectorAll<HTMLButtonElement>(".dg-btn")).find((x) => x.textContent?.includes("Gönder"))!;
    b.click();
    b.click();
    expect(runs).toBe(1);
    release();
    g.destroy();
  });

  it("softDeletes: destroy takes the muted tone off host rows", async () => {
    document.body.innerHTML = "<table id='t'><thead><tr><th>Ad</th><th>Silindi</th></tr></thead><tbody><tr><td>Jill Valentine</td><td>1</td></tr><tr><td>Ada Wong</td><td></td></tr></tbody></table>";
    const before = document.body.innerHTML;
    const { domSource, softDeletes } = await import("../../src/index");
    const g = new Datagrid("#t", { columns: [column.text("ad"), column.text("silindi")], use: [domSource(), softDeletes({ field: "silindi", initial: true })] });
    await flush();
    expect(document.querySelector("tr[data-tone=muted]")).not.toBeNull();
    g.destroy();
    expect(document.body.innerHTML).toBe(before);
  });
});

describe("grid.action and legacy redirects", () => {
  it("a POST answered with a redirect to a page (back()) counts as success; to the login page as session expiry", async () => {
    const notify = vi.fn();
    const mk = (url: string) => {
      const r = new Response("<html></html>", { status: 200, headers: { "Content-Type": "text/html" } });
      Object.defineProperty(r, "redirected", { value: true });
      Object.defineProperty(r, "url", { value: url });
      return r;
    };
    let next = "http://localhost/liste";
    configure({ notify, fetch: (async () => mk(next)) as typeof fetch });
    const g = new Datagrid(mount(), { columns: [column.text("ad")], use: [arraySource(rows)] });
    await expect(g.action("/x/1", { reload: false })).resolves.toBeDefined();
    expect(notify).toHaveBeenLastCalledWith("success", expect.any(String));
    next = "http://localhost/login";
    await expect(g.action("/x/1", { reload: false })).rejects.toMatchObject({ kind: "session" });
    g.destroy();
  });
});
