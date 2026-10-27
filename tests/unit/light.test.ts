import { afterEach, describe, expect, it, vi } from "vitest";
import { Datagrid, arraySource, column, serverSide, yajra } from "../../src/index";
import type { ResolvedColumn, Row } from "../../src/index";
import { filterPanel, readControl, type FilterPanelApi } from "../../src/modules/filter-panel";
import { urlSync, readUrlState, writeUrlState, type UrlSyncApi } from "../../src/modules/url-sync";
import { softDeletes, type SoftDeletesApi } from "../../src/modules/soft-deletes";
import { metaBind, formatMeta } from "../../src/modules/meta-bind";
import { footer, aggregate } from "../../src/modules/footer";
import { stateSave } from "../../src/modules/state-save";
import { parsePhp } from "../fixtures/server/emulator";

const flush = async (n = 5) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};
const grids: Datagrid[] = [];
const grid = (t: HTMLTableElement, o: ConstructorParameters<typeof Datagrid>[1]) => {
  const g = new Datagrid(t, { label: "test", ...o });
  grids.push(g);
  return g;
};
afterEach(() => {
  grids.splice(0).forEach((g) => g.destroy());
  document.body.innerHTML = "";
  history.replaceState(null, "", "/");
});
const html = (s: string) => {
  const d = document.createElement("div");
  d.innerHTML = s;
  document.body.append(d);
  return d;
};
const mkTable = () => document.body.appendChild(document.createElement("table"));

/** yajra server with a recording fetch. */
function server(rows: Row[] = [], extra: Record<string, unknown> = {}) {
  const bodies: Record<string, any>[] = [];
  const fetch = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
    const p = parsePhp(String(init?.body ?? ""));
    bodies.push(p);
    const body = { draw: Number(p.draw), recordsTotal: rows.length, recordsFiltered: rows.length, data: rows, ...extra };
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  });
  return { fetch, bodies, source: serverSide({ url: "/x", protocol: yajra(), fetch: fetch as unknown as typeof globalThis.fetch }) };
}

const people: Row[] = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  ad: `Kişi ${i + 1}`,
  durum: i % 3 ? "acik" : "iptal",
  tutar: i % 5 === 0 ? -(i + 0.5) : i * 10 + 0.25,
  deleted: i % 7 === 3,
}));
const cols = () => [column.index(), column.text("ad", { title: "Ad" }), column.text("durum", { title: "Durum" }), column.money("tutar", { title: "Tutar" })];

/* ============================== filterPanel ============================== */

describe("readControl (jQuery .val() semantics)", () => {
  it("select, multi-select, text", () => {
    const d = html(`
      <select id="s"><option value="">Tümü</option><option value="a" selected>A</option></select>
      <select id="e"></select>
      <select id="m" multiple><option value="x">X</option><option value="y">Y</option><option value="z">Z</option></select>
      <input id="t" value="Işık"><textarea id="ta">not</textarea>`);
    const $ = (id: string) => d.querySelector(`#${id}`);
    expect(readControl($("s"))).toBe("a");
    expect(readControl($("e"))).toBeNull();
    expect(readControl($("m"))).toEqual([]);
    (d.querySelector("#m option[value=x]") as HTMLOptionElement).selected = true;
    (d.querySelector("#m option[value=z]") as HTMLOptionElement).selected = true;
    expect(readControl($("m"))).toEqual(["x", "z"]);
    expect(readControl($("t"))).toBe("Işık");
    expect(readControl($("ta"))).toBe("not");
    expect(readControl(null)).toBeNull();
  });
  it("checkbox: 1/0 on the server, no filter on the client, custom values", () => {
    const d = html(`<input type="checkbox" id="c"><input type="checkbox" id="k" checked>`);
    const c = d.querySelector("#c")!;
    const k = d.querySelector("#k")!;
    expect(readControl(c)).toBe("0");
    expect(readControl(c, {}, true)).toBeNull();
    expect(readControl(k)).toBe("1");
    expect(readControl(k, { value: "evet" })).toBe("evet");
    expect(readControl(c, { unchecked: null })).toBeNull();
    expect(readControl(c, { unchecked: "hayir" }, true)).toBe("hayir");
  });
  it("radio reads the checked one of its group", () => {
    const d = html(`<form><input type="radio" name="r" value="1"><input type="radio" name="r" value="2" checked></form>`);
    expect(readControl(d.querySelector("input"))).toBe("2");
    (d.querySelector("input[value='2']") as HTMLInputElement).checked = false;
    expect(readControl(d.querySelector("input"))).toBeNull();
  });
});

describe("filterPanel", () => {
  const form = () =>
    html(`
      <select id="f-durum"><option value="">Tümü</option><option value="iptal">İptal</option></select>
      <select id="f-birim" multiple><option value="a">A</option><option value="b">B</option></select>
      <input id="f-ara"><input type="checkbox" id="f-eksi"><input id="f-tarih" value="01/09/2026 - 30/09/2026">`);

  it("server: values are read at request time and travel as plain params", async () => {
    form();
    const s = server();
    const g = grid(mkTable(), {
      columns: cols(),
      use: [
        s.source,
        filterPanel({
          fields: { durum: "#f-durum", birim: "#f-birim", ara: "#f-ara", eksi: "#f-eksi", tarih: { el: "#f-tarih", format: (v) => String(v).replaceAll("/", "-") } },
        }),
      ],
    });
    await flush();
    expect(s.bodies[0]).toMatchObject({ durum: "", ara: "", eksi: "0", tarih: "01-09-2026 - 30-09-2026" });
    expect("birim" in s.bodies[0]!).toBe(false); // empty multi-select is never sent ($.param)
    (document.querySelector("#f-birim option[value=b]") as HTMLOptionElement).selected = true;
    (g.module(filterPanel) as FilterPanelApi).apply();
    await flush();
    expect(s.bodies[1]!.birim).toEqual(["b"]);
    expect((g.module(filterPanel) as FilterPanelApi).values()).toMatchObject({ birim: ["b"], eksi: "0" });
  });

  it("server: change reloads from page 1; typing is debounced; unchanged values do not reload", async () => {
    form();
    const s = server(people, { recordsTotal: 100, recordsFiltered: 100 });
    const g = grid(mkTable(), { columns: cols(), pageSize: 10, use: [s.source, filterPanel({ fields: { durum: "#f-durum", ara: "#f-ara" }, debounce: 20 })] });
    await flush();
    g.page(3);
    await flush();
    expect(s.bodies.at(-1)!.start).toBe("20");
    const sel = document.querySelector<HTMLSelectElement>("#f-durum")!;
    sel.value = "iptal";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    expect(s.bodies.at(-1)).toMatchObject({ durum: "iptal", start: "0" });
    const n = s.fetch.mock.calls.length;
    sel.dispatchEvent(new Event("change", { bubbles: true })); // same value
    await flush();
    expect(s.fetch.mock.calls.length).toBe(n);
    const ara = document.querySelector<HTMLInputElement>("#f-ara")!;
    for (const v of ["d", "de", "dev"]) {
      ara.value = v;
      ara.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await flush(1);
    expect(s.fetch.mock.calls.length).toBe(n);
    await new Promise((r) => setTimeout(r, 40));
    await flush();
    expect(s.fetch.mock.calls.length).toBe(n + 1);
    expect(s.bodies.at(-1)!.ara).toBe("dev");
  });

  it("subscribe() lets non-native events notify; set() and reset() write the controls", async () => {
    form();
    const s = server();
    let notify = () => {};
    const g = grid(mkTable(), {
      columns: cols(),
      use: [s.source, filterPanel({ fields: { durum: "#f-durum", tarih: { el: "#f-tarih", subscribe: (_el, n) => void (notify = n) } } })],
    });
    await flush();
    const n = s.fetch.mock.calls.length;
    document.querySelector<HTMLInputElement>("#f-tarih")!.value = "x";
    notify();
    await flush();
    expect(s.fetch.mock.calls.length).toBe(n + 1);
    const api = g.module(filterPanel) as FilterPanelApi;
    const changes = vi.fn();
    document.querySelector("#f-durum")!.addEventListener("change", changes);
    api.set({ durum: "iptal" });
    await flush();
    expect(changes).toHaveBeenCalledTimes(1); // host widgets follow
    expect(s.bodies.at(-1)!.durum).toBe("iptal");
    api.reset();
    await flush();
    expect(document.querySelector<HTMLSelectElement>("#f-durum")!.value).toBe("");
    expect(s.bodies.at(-1)).toMatchObject({ durum: "", tarih: "01/09/2026 - 30/09/2026" });
  });

  it("client: values become core filters (format may return ops or predicates)", async () => {
    form();
    const g = grid(mkTable(), {
      columns: cols(),
      use: [
        arraySource(people),
        filterPanel({ fields: { durum: "#f-durum", eksi: { el: "#f-eksi", format: (v) => (v ? (_x: unknown, r: Row) => Number(r.tutar) < 0 : null) } } }),
      ],
    });
    await flush();
    expect(g.status().filtered).toBe(23);
    const sel = document.querySelector<HTMLSelectElement>("#f-durum")!;
    sel.value = "iptal";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    expect(g.filters()).toEqual({ durum: "iptal" });
    expect(g.status().filtered).toBe(8);
    const box = document.querySelector<HTMLInputElement>("#f-eksi")!;
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
    expect(g.viewRows().every((r) => r.durum === "iptal" && Number(r.tutar) < 0)).toBe(true);
    expect(g.status().filtered).toBe(2);
  });
});

/* ============================== urlSync ============================== */

describe("urlSync parse / serialize", () => {
  it("reads q, sort, page and repeated filters", () => {
    expect(readUrlState("?q=Işık+Kulesi&sort=-tarih,ad&page=3&f.durum=iptal&f.birim=a&f.birim=b&x=1")).toEqual({
      q: "Işık Kulesi",
      sort: [{ key: "tarih", dir: "desc" }, { key: "ad", dir: "asc" }],
      page: 3,
      filters: { durum: "iptal", birim: ["a", "b"] },
    });
    expect(readUrlState("?sort=&page=1")).toEqual({ sort: [], filters: {} });
    expect(readUrlState("?g1.q=a&q=b&g1.f.x=1", "g1")).toEqual({ q: "a", filters: { x: "1" } });
  });
  it("writes only its own keys and keeps the rest + hash", () => {
    const out = writeUrlState("http://h/liste?tab=2&q=old&f.durum=x&g1.q=keep#ozet", { q: "jill", sort: [{ key: "tarih", dir: "desc" }], page: 2, filters: { birim: ["a", "b"] } });
    const u = new URL(out);
    expect(u.hash).toBe("#ozet");
    expect(u.searchParams.get("tab")).toBe("2");
    expect(u.searchParams.get("g1.q")).toBe("keep");
    expect(u.searchParams.get("q")).toBe("jill");
    expect(u.searchParams.get("sort")).toBe("-tarih");
    expect(u.searchParams.get("page")).toBe("2");
    expect(u.searchParams.getAll("f.birim")).toEqual(["a", "b"]);
    expect(u.searchParams.has("f.durum")).toBe(false);
    expect(writeUrlState("http://h/l?q=a&page=4", { page: 1, filters: {} })).toBe("http://h/l");
    expect(new URL(writeUrlState("http://h/l", { q: "x", filters: {} }, "g2")).searchParams.get("g2.q")).toBe("x");
  });
  it("round-trips", () => {
    const s = { q: "a&b=c", sort: [{ key: "ad", dir: "asc" as const }], page: 5, filters: { k: "ş ğ", m: ["1", "2"] } };
    expect(readUrlState(new URL(writeUrlState("http://h/", s)).search)).toEqual(s);
  });
});

describe("urlSync on a grid", () => {
  it("URL wins at init (search, sort, filters), page follows the first load, changes are written back", async () => {
    history.replaceState(null, "", "/liste?q=Kişi&sort=-tutar&page=2&f.durum=iptal&f.gizli=x&other=1");
    const g = grid(mkTable(), { columns: cols(), pageSize: 3, sort: [["ad", "asc"]], use: [arraySource(people), urlSync({ keys: ["durum"] })] });
    await flush();
    expect(g.search()).toBe("Kişi");
    expect(g.sort()).toEqual([{ key: "tutar", dir: "desc" }]);
    expect(g.filters()).toEqual({ durum: "iptal" }); // f.gizli is not whitelisted
    expect(g.page()).toBe(2);
    g.page(3);
    expect(location.search).toContain("page=3");
    g.search("");
    expect(location.search).not.toContain("q=");
    expect(location.search).not.toContain("page=");
    expect(location.search).toContain("other=1");
    g.sort([["ad", "asc"]]); // back to the configured default → left out
    expect(location.search).not.toContain("sort=");
    g.filters({ durum: null });
    expect(location.search).toBe("?other=1");
    expect((g.module(urlSync) as UrlSyncApi).link()).toBe(location.href);
  });

  it("server: one request carries the URL state; filterPanel controls are set from f.*", async () => {
    html(`<select id="u-durum"><option value="">Tümü</option><option value="acik">Açık</option></select>`);
    history.replaceState(null, "", "/?q=jill&f.durum=acik&sort=bogus");
    const s = server();
    const g = grid(mkTable(), { columns: cols(), sort: [["tutar", "desc"]], use: [s.source, filterPanel({ fields: { durum: "#u-durum" } }), urlSync()] });
    await flush();
    expect(s.fetch).toHaveBeenCalledTimes(1);
    expect(s.bodies[0]).toMatchObject({ durum: "acik", search: { value: "jill" } });
    expect(g.sort()).toEqual([{ key: "tutar", dir: "desc" }]); // unknown sort key ignored
    expect(document.querySelector<HTMLSelectElement>("#u-durum")!.value).toBe("acik");
  });

  it.each([["after", true], ["before", false]])("URL sort wins over a stored sort (urlSync %s stateSave)", async (_n, after) => {
    const mk = () => {
      const mods = [stateSave({ key: "url-vs-state" }), urlSync()];
      return grid(mkTable(), { columns: cols(), sort: [["ad", "asc"]], use: [arraySource(people), ...(after ? mods : mods.reverse())] });
    };
    const first = mk();
    await flush();
    first.sort([["durum", "desc"]]);
    (first.module(stateSave) as { save(): void }).save();
    first.destroy();
    history.replaceState(null, "", "/?sort=-tutar");
    const g = mk();
    await flush();
    expect(g.sort()).toEqual([{ key: "tutar", dir: "desc" }]);
    expect(g.viewRows()[0]!.tutar).toBe(Math.max(...people.map((r) => Number(r.tutar))));
    localStorage.clear();
  });

  it("a second grid without a namespace gets its name as prefix", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    history.replaceState(null, "", "/?q=a&b.q=b");
    const a = grid(mkTable(), { columns: cols(), use: [arraySource(people), urlSync()] });
    const b = grid(mkTable(), { name: "b", columns: cols(), use: [arraySource(people), urlSync()] });
    await flush();
    expect(a.search()).toBe("a");
    expect(b.search()).toBe("b");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("push mode follows back/forward", async () => {
    const g = grid(mkTable(), { columns: cols(), pageSize: 5, use: [arraySource(people), urlSync({ mode: "push" })] });
    await flush();
    const len = history.length;
    g.search("Kişi 1");
    expect(history.length).toBe(len + 1);
    g.page(2);
    expect(history.length).toBe(len + 2);
    history.replaceState(null, "", "/?page=2");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await flush();
    expect(g.search()).toBe("");
    expect(g.page()).toBe(2);
    expect(history.length).toBe(len + 2); // back/forward never adds entries
    const load = vi.fn();
    g.on("load", load);
    history.replaceState(null, "", "/?page=2#baska");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await flush();
    expect(load).not.toHaveBeenCalled(); // not this grid's change
  });
});

/* ============================== softDeletes ============================== */

describe("softDeletes", () => {
  it("client: hides deleted rows until switched on; deleted rows are muted", async () => {
    const g = grid(mkTable(), { columns: cols(), pageSize: 50, use: [arraySource(people), softDeletes()] });
    await flush();
    const deleted = people.filter((r) => r.deleted).length;
    expect(g.status().filtered).toBe(23 - deleted);
    const btn = g.root.querySelector<HTMLButtonElement>("[aria-pressed]")!;
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.querySelector(".dg-check-box svg")).not.toBeNull(); // permanent indicator
    btn.click();
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(g.status().filtered).toBe(23);
    expect(g.root.querySelectorAll('tbody tr[data-tone="muted"]').length).toBe(deleted);
    (g.module(softDeletes) as SoftDeletesApi).toggle(false);
    expect(g.status().filtered).toBe(23 - deleted);
  });
  it("server: adds _deleted=1 and reloads", async () => {
    const s = server();
    const g = grid(mkTable(), { columns: cols(), use: [s.source, softDeletes({ messages: { label: "Çöp" } })] });
    await flush();
    expect("_deleted" in s.bodies[0]!).toBe(false);
    g.root.querySelector<HTMLButtonElement>("[aria-pressed]")!.click();
    await flush();
    expect(s.bodies[1]!._deleted).toBe("1");
    expect(g.root.querySelector("[aria-pressed]")!.textContent).toBe("Çöp");
  });
});

/* ============================== metaBind ============================== */

describe("metaBind", () => {
  it("formats", () => {
    expect(formatMeta(1234.5, "money", "tr")).toBe("1.234,50 ₺");
    expect(formatMeta("1.234,5", "number", "tr")).toBe("1.234,5");
    expect(formatMeta(5, "money", "en", { currency: "USD", decimals: 0 })).toBe("5 $");
    expect(formatMeta(null, "money", "tr")).toBeNull();
    expect(formatMeta("abc", "number", "tr")).toBe("abc");
    expect(formatMeta("3/3", "money", "tr")).toBe("3/3");
  });
  it("writes response paths and functions after each load; destroy restores the hosts", async () => {
    const d = html(`<b id="m-top">…</b><i class="m-n"></i><i class="m-n"></i><u id="m-fn"></u><s id="m-miss"></s>`);
    const s = server(people.slice(0, 3), { summary: { toplam: 1500.5 } });
    const g = grid(mkTable(), {
      columns: cols(),
      use: [
        s.source,
        metaBind(
          {
            "#m-top": "summary.toplam",
            ".m-n": { value: "recordsFiltered", format: "number" },
            "#m-fn": (raw, grid) => `${raw.data.length}/${grid.viewRows().length}`,
            "#m-miss": "summary.yok",
          },
          { format: "money" },
        ),
      ],
    });
    await flush();
    expect(d.querySelector("#m-top")!.textContent).toBe("1.500,50 ₺");
    expect(Array.from(d.querySelectorAll(".m-n"), (e) => e.textContent)).toEqual(["3", "3"]);
    expect(d.querySelector("#m-fn")!.textContent).toBe("3/3");
    expect(d.querySelector("#m-miss")!.textContent).toBe("—");
    g.destroy();
    expect(d.querySelector("#m-top")!.textContent).toBe("…");
  });
});

/* ============================== footer ============================== */

describe("footer", () => {
  const rc = (c: ReturnType<typeof column.money>) => ({ index: 0, title: "", sortable: true, searchable: true, visible: true, hideable: true, exportable: true, ...c }) as ResolvedColumn;
  it("aggregates like export (TR strings, html money)", () => {
    const money = rc(column.money("t", { source: "tr" }));
    const rows = [{ t: "1.234,50" }, { t: "-0,50" }, { t: "" }, { t: null }];
    expect(aggregate(rows, money, "sum")).toBe(1234);
    expect(aggregate(rows, money, "avg")).toBe(617);
    expect(aggregate(rows, money, "count")).toBe(2);
    expect(aggregate([{ t: 0.1 }, { t: 0.2 }], rc(column.money("t")), "sum")).toBe(0.3);
    expect(aggregate([], money, "avg")).toBeNull();
  });

  it("renders a tfoot row: label spans the leading columns, value uses the column render, paging updates it", async () => {
    const t = mkTable();
    const g = grid(t, { columns: cols(), pageSize: 5, use: [arraySource(people), footer({ cols: { tutar: "sum", durum: "count" } })] });
    await flush();
    const row = t.tFoot!.rows[0]!;
    const label = row.querySelector("th[data-col=label]")!;
    expect(label.textContent).toBe("Sayfa toplamı");
    expect(label.getAttribute("scope")).toBe("row");
    expect(label.getAttribute("colspan")).toBe("2"); // index + ad
    const cell = row.querySelector<HTMLElement>('td[data-key="tutar"]')!;
    expect(cell.getAttribute("data-align")).toBe("end");
    expect(cell.querySelector(".dg-money .dg-money-cur")?.textContent).toBe("₺");
    const pageSum = (rows: Row[]) => rows.reduce((s, r) => s + Number(r.tutar), 0);
    const fmt = (n: number) => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + "₺";
    expect(cell.textContent).toBe(fmt(pageSum(g.viewRows())));
    expect(row.querySelector('td[data-key="durum"]')!.textContent).toBe("5");
    g.page(2);
    expect(t.tFoot!.querySelector('td[data-key="tutar"]')!.textContent).toBe(fmt(pageSum(g.viewRows())));
  });

  it("hidden columns stay hidden; empty view hides the tfoot; response scope; destroy removes / restores", async () => {
    const t = mkTable();
    const g = grid(t, { columns: cols(), pageSize: 5, use: [arraySource(people), footer({ scope: "response", cols: { tutar: "sum" } })] });
    await flush();
    const cell = () => t.tFoot!.querySelector<HTMLElement>('td[data-key="tutar"]')!;
    expect(t.tFoot!.querySelector("th")!.textContent).toBe("Toplam");
    const all = people.reduce((s, r) => s + Number(r.tutar), 0);
    expect(cell().textContent).toContain(new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2 }).format(all));
    g.setColumnVisible("tutar", false);
    expect(cell().hidden).toBe(true);
    expect(t.tFoot!.querySelector("th")!.getAttribute("colspan")).toBe("3"); // no visible value column left
    g.setColumnVisible("tutar", true);
    expect(cell().hidden).toBe(false);
    g.search("yok-boyle-biri");
    await flush();
    expect(t.tFoot!.hidden).toBe(true);
    g.destroy();
    expect(t.tFoot).toBeNull();

    const t2 = mkTable();
    t2.innerHTML = `<thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody><tfoot><tr><td>host</td></tr></tfoot>`;
    const g2 = grid(t2, { use: [footer({ cols: { a: "count" } })] });
    await flush();
    expect(t2.tFoot!.textContent).not.toContain("host");
    g2.destroy();
    expect(t2.tFoot!.textContent).toBe("host");
  });

  it("does not shadow the core's private footer element", async () => {
    const g = grid(mkTable(), { columns: cols(), use: [arraySource(people), footer({ cols: { tutar: "sum" } })] });
    await flush();
    expect(g.root.querySelector(".dg-footer .dg-info")!.textContent).toContain("23");
  });
});
