import { describe, expect, it, vi, beforeEach } from "vitest";
import { parseNumber, fold } from "../../src/core/collate";
import { runClient } from "../../src/data/client";
import { Datagrid, column, arraySource, customSource } from "../../src/index";
import type { ResolvedColumn, Row } from "../../src/index";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("parseNumber (TR money)", () => {
  it.each([
    ["-403,00", -403],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["12.450,00 ₺", 12450],
    ["0,1234", 0.1234],
    ["1.234", 1234],
    ["12.5", 12.5],
    [42, 42],
    ["", null],
    ["—", null],
  ])("%s → %s", (i, o) => expect(parseNumber(i)).toBe(o));
});

describe("fold", () => {
  it("folds Turkish letters and diacritics", () => {
    expect(fold("IŞIK Kulesi")).toBe("isik kulesi");
    expect(fold("İstanbul")).toBe("istanbul");
    expect(fold("Şemsiye A.Ş.")).toBe("semsiye a.s.");
  });
});

const cols = (defs: Partial<ResolvedColumn>[]): ResolvedColumn[] =>
  defs.map((d, index) => ({ index, title: d.key!, sortable: true, searchable: true, visible: true, hideable: true, exportable: true, ...d }) as ResolvedColumn);

describe("runClient", () => {
  const rows: Row[] = [
    { id: 1, ad: "Işık Kulesi", tutar: "1.234,56" },
    { id: 2, ad: "Yeşil Ot", tutar: "-403,00" },
    { id: 3, ad: "Kırmızı Ot", tutar: "99,90" },
  ];
  const money = column.money("tutar", { source: "tr" });
  const c = cols([{ key: "ad" }, { ...money, key: "tutar" }]);
  it("searches with TR folding", () => {
    const r = runClient(rows, { page: 1, pageSize: 10, sort: [], search: "isik", filters: {}, columns: c }, "tr", new WeakMap());
    expect(r.view.map((x) => x.id)).toEqual([1]);
    expect(r.filtered).toBe(1);
    expect(r.total).toBe(3);
  });
  it("sorts money numerically", () => {
    const r = runClient(rows, { page: 1, pageSize: 10, sort: [{ key: "tutar", dir: "desc" }], search: "", filters: {}, columns: c }, "tr", new WeakMap());
    expect(r.view.map((x) => x.id)).toEqual([1, 3, 2]);
  });
  it("pages", () => {
    const r = runClient(rows, { page: 2, pageSize: 2, sort: [], search: "", filters: {}, columns: c }, "tr", new WeakMap());
    expect(r.view.map((x) => x.id)).toEqual([3]);
  });
  it("filters with ops", () => {
    const r = runClient(rows, { page: 1, pageSize: 10, sort: [], search: "", filters: { ad: { op: "contains", value: "ot" } }, columns: c }, "tr", new WeakMap());
    expect(r.view.map((x) => x.id)).toEqual([2, 3]);
  });
});

function mount(html: string): HTMLTableElement {
  document.body.innerHTML = `<div id="host">${html}</div>`;
  return document.querySelector("table")!;
}

describe("Datagrid lifecycle", () => {
  beforeEach(() => {
    document.documentElement.lang = "tr";
  });

  it("get() never creates a grid", () => {
    const t = mount("<table><tbody></tbody></table>");
    expect(Datagrid.get(t)).toBeNull();
    expect(t.closest(".dg")).toBeNull();
  });

  it("enhances a DOM table and destroy() restores it byte-for-byte with identity", async () => {
    const html =
      '<table id="t" class="x"><thead><tr><th>Ad</th><th data-dg-type="number">Adet</th></tr></thead>' +
      '<tbody><tr id="a"><td>Yeşil Ot</td><td>42</td></tr><tr id="b"><td>Kırmızı Ot</td><td>7</td></tr></tbody></table>';
    const t = mount(html);
    const before = document.getElementById("host")!.innerHTML;
    const trs = Array.from(t.tBodies[0]!.rows);
    const g = new Datagrid(t, { label: "Envanter" });
    await flush();
    await flush();
    expect(Datagrid.get(t)).toBe(g);
    expect(t.closest(".dg")).not.toBeNull();
    expect(t.tBodies[0]!.rows[0]).toBe(trs[0]); // adopted
    g.sort([["adet", "asc"]]);
    expect(Array.from(t.tBodies[0]!.rows).map((r) => r.id)).toEqual(["b", "a"]);
    g.destroy();
    expect(document.getElementById("host")!.innerHTML).toBe(before);
    expect(Array.from(t.tBodies[0]!.rows)).toEqual(trs);
    expect(Datagrid.get(t)).toBeNull();
  });

  it("renders array rows with typed columns and text-safe cells", async () => {
    const t = mount("<table></table>");
    const g = new Datagrid(t, {
      label: "x",
      columns: [column.text("ad"), column.money("tutar")],
      use: [arraySource([{ id: 1, ad: "<b>x</b>", tutar: 12450 }])],
    });
    await flush();
    const td = t.querySelector("tbody td")!;
    expect(td.innerHTML).toBe("&lt;b&gt;x&lt;/b&gt;");
    expect(t.querySelector(".dg-money")!.textContent).toBe("12.450,00₺");
    expect(g.root.getAttribute("data-state")).toBe("ready");
    g.destroy();
  });

  it("warns on unknown options with a suggestion", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = mount("<table></table>");
    new Datagrid(t, { label: "x", serverside: true, pageSzie: 10 } as never).destroy();
    const msgs = spy.mock.calls.map((c) => String(c[0]));
    expect(msgs.some((m) => m.includes("DG001") && m.includes("serverSide({"))).toBe(true);
    expect(msgs.some((m) => m.includes("DG001") && m.includes("Did you mean `pageSize`"))).toBe(true);
    spy.mockRestore();
  });

  it("throws on module wiring mistakes", () => {
    const t = mount("<table></table>");
    const src = customSource({ mode: "client", load: async () => ({ rows: [], total: 0, filtered: 0 }) });
    expect(() => new Datagrid(t, { label: "x", use: [src, arraySource([])] })).toThrow(/DG008/);
    const t2 = mount("<table></table>");
    const m = { name: "x", kind: "feature" as const, setup: () => {} };
    expect(() => new Datagrid(t2, { label: "x", use: [m, m] })).toThrow(/DG009/);
    const t3 = mount("<table></table>");
    expect(() => new Datagrid(t3, { label: "x", use: [{ name: "reload", kind: "feature" as const }] })).toThrow(/DG010/);
    const t4 = mount("<table></table>");
    expect(() => new Datagrid(t4, { label: "x", use: [{ name: "resetBtn", kind: "toolbar" as const, requires: ["state"] }] })).toThrow(/DG007/);
  });

  it("last request wins (stale responses are dropped)", async () => {
    const t = mount("<table></table>");
    const resolvers: Array<(v: unknown) => void> = [];
    const g = new Datagrid(t, {
      label: "x",
      columns: [column.text("ad")],
      use: [customSource({ mode: "server", load: (q) => new Promise((r) => resolvers.push(() => r({ rows: [{ id: q.search || "first", ad: q.search || "first" }], total: 1, filtered: 1 }))) })],
    });
    await flush();
    g.search("ikinci");
    await flush();
    resolvers[1]!(0); // newer first
    await flush();
    resolvers[0]!(0); // stale
    await flush();
    expect(t.querySelector("tbody td")!.textContent).toBe("ikinci");
    g.destroy();
  });
});

describe("client filters on dates", () => {
  it("ISO, local and dd.mm.yyyy values compare with date-only bounds (upper bound covers the day)", async () => {
    const { Datagrid, column, arraySource } = await import("../../src/index");
    document.body.innerHTML = "<table id='t'></table>";
    const rows = [
      { id: 1, t: "2026-10-20T09:00:00" },
      { id: 2, t: "2026-10-20 23:30:00" },
      { id: 3, t: "21.10.2026" },
      { id: 4, t: "2026-10-22" },
    ];
    const g = new Datagrid("#t", { columns: [column.date("t", { source: "local" })], use: [arraySource(rows)] });
    await new Promise((r) => setTimeout(r, 0));
    const ids = () => g.viewRows().map((r) => r.id);
    g.filters({ t: { op: "eq", value: "2026-10-20" } });
    expect(ids()).toEqual([1, 2]);
    g.filters({ t: { op: "lte", value: "2026-10-20" } });
    expect(ids()).toEqual([1, 2]);
    g.filters({ t: { op: "gt", value: "2026-10-20" } });
    expect(ids()).toEqual([3, 4]);
    g.filters({ t: { op: "between", value: ["2026-10-21", "2026-10-22"] } });
    expect(ids()).toEqual([3, 4]);
    g.filters({ t: { op: "gte", value: "2026-10-21" } });
    expect(ids()).toEqual([3, 4]);
    g.destroy();
  });
});

describe("typed columns follow the grid locale", () => {
  it("en-US grid formats numbers, money and dates in English; an explicit column locale wins", async () => {
    const { Datagrid, column, arraySource } = await import("../../src/index");
    document.body.innerHTML = "<table id='t'></table>";
    const g = new Datagrid("#t", {
      locale: "en-US",
      columns: [column.number("n", { decimals: 1 }), column.money("m"), column.date("d", { source: "local" }), column.number("tr", { locale: "tr-TR", decimals: 1 })],
      use: [arraySource([{ id: 1, n: 1234.5, m: 99.5, d: "2026-10-26", tr: 1234.5 }])],
    });
    await new Promise((r) => setTimeout(r, 0));
    const cell = (k: string) => g.root.querySelector(`td[data-key=${k}]`)!.textContent;
    expect(cell("n")).toBe("1,234.5");
    expect(cell("m")).toContain("99.50");
    expect(cell("d")).toBe("10/26/2026");
    expect(cell("tr")).toBe("1.234,5");
    g.destroy();
  });
});

describe("number reading", () => {
  it("data strings are machine numbers; formatted text opts in with source:'tr'; 0.x never groups", async () => {
    const { parseNumber, readNumber } = await import("../../src/core/collate");
    expect(parseNumber("0.125")).toBe(0.125);
    expect(parseNumber("-0.500")).toBe(-0.5);
    expect(parseNumber("1.234")).toBe(1234);
    expect(readNumber("1.500")).toBe(1.5);
    expect(readNumber("1.500", "tr")).toBe(1500);
    expect(readNumber("1.234,56 ₺")).toBe(1234.56);
    const { Datagrid, column, arraySource } = await import("../../src/index");
    document.body.innerHTML = "<table id='t'></table>";
    const g = new Datagrid("#t", {
      columns: [column.number("oran", { decimals: 3 }), column.number("adet", { source: "tr" })],
      use: [arraySource([{ id: 1, oran: "0.125", adet: "1.500" }, { id: 2, oran: "1.500", adet: "12" }])],
    });
    await new Promise((r) => setTimeout(r, 0));
    const cells = Array.from(g.root.querySelectorAll("tbody td")).map((c) => c.textContent);
    expect(cells).toEqual(["0,125", "1.500", "1,500", "12"]);
    const oran = g.columns().find((c) => c.key === "oran")!;
    expect(g.viewRows().map((r) => oran.exportValue!(r))).toEqual([0.125, 1.5]);
    g.destroy();
  });
});
