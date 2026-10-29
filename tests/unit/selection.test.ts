import { describe, expect, it, vi, beforeEach } from "vitest";
import { Datagrid, column, arraySource, customSource } from "../../src/index";
import type { Row } from "../../src/index";
import { selection, SelectionModel, type SelectionApi } from "../../src/modules/selection";

const flush = () => new Promise((r) => setTimeout(r, 0));
const q = (search = "", filters: Record<string, unknown> = {}) => ({ search, filters });

describe("SelectionModel", () => {
  it("dedupes keys (Set of strings)", () => {
    const m = new SelectionModel();
    m.add("7");
    m.add("7");
    m.add(String(7));
    expect(m.count()).toBe(1);
    expect(m.payload({ search: "", sort: [], filters: {} })).toEqual({ all: false, keys: ["7"] });
  });

  it("some → all → except → payload", () => {
    const m = new SelectionModel();
    m.add("1", { id: 1 });
    m.selectAll(q("jill"), 120);
    expect(m.all).toBe(true);
    expect(m.keys.size).toBe(0);
    expect(m.has("999")).toBe(true);
    m.remove("5");
    m.remove("6");
    expect(m.count(120)).toBe(118);
    m.add("6");
    expect(m.count(120)).toBe(119);
    const query = { search: "jill", sort: [{ key: "ad", dir: "asc" as const }], filters: {} };
    expect(m.payload(query)).toEqual({ all: true, except: ["5"], query });
  });

  it("all goes stale when search/filters or the matching count change; sort does not matter", () => {
    const m = new SelectionModel();
    m.selectAll(q("x", { durum: "acik", birim: "rpd" }), 50);
    expect(m.stale(q("x", { birim: "rpd", durum: "acik" }), 50)).toBe(false);
    expect(m.stale(q("y", { durum: "acik", birim: "rpd" }), 50)).toBe(true);
    expect(m.stale(q("x", { durum: "tamam", birim: "rpd" }), 50)).toBe(true);
    expect(m.stale(q("x", { durum: "acik", birim: "rpd" }), 49)).toBe(true);
    m.clear();
    expect(m.stale(q("z"), 1)).toBe(false);
  });

  it("clear resets every part", () => {
    const m = new SelectionModel();
    m.selectAll(q(), 10);
    m.remove("1");
    m.clear();
    expect(m.all).toBe(false);
    expect(m.except.size).toBe(0);
    expect(m.count(10)).toBe(0);
  });
});

/* ---------- module in a grid (jsdom) ---------- */

const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, ad: i % 2 ? `Chris Redfield ${i + 1}` : `Jill Valentine ${i + 1}`, birim: i < 5 ? "R.P.D." : "S.T.A.R.S. Alfa" }));

function mount(): HTMLTableElement {
  document.body.innerHTML = `<div id="host"><table></table></div>`;
  return document.querySelector("table")!;
}

async function make(opts: Parameters<typeof selection>[0] = {}, data = rows(12), extra: Record<string, unknown> = {}) {
  const t = mount();
  const g = new Datagrid(t, {
    label: "Seçim",
    pageSize: 5,
    columns: [column.select(), column.text("ad", { title: "Ad" }), column.text("birim", { title: "Birim" })],
    use: [arraySource(data), selection(opts)],
    ...extra,
  });
  await flush();
  await flush();
  return { g, t, sel: g.module(selection) as SelectionApi };
}

const rowInputs = (t: HTMLTableElement) => Array.from(t.querySelectorAll<HTMLInputElement>("tbody .dg-check-input"));
const head = (t: HTMLTableElement) => t.querySelector<HTMLInputElement>("thead .dg-check-input")!;

describe("selection()", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders header + row checkboxes with accessible names", async () => {
    const { t, g } = await make();
    expect(head(t).getAttribute("aria-label")).toBe("Sayfadaki tümünü seç");
    const inputs = rowInputs(t);
    expect(inputs).toHaveLength(5);
    expect(inputs[0]!.getAttribute("aria-label")).toBe("Seç: Jill Valentine 1");
    expect(t.querySelector('th[data-col="select"] .dg-check')).not.toBeNull();
    expect(g.root.querySelector(".dg-bulk")!.hasAttribute("data-active")).toBe(false);
    expect(g.root.querySelector(".dg-bulk-count")!.textContent).toBe("0");
    expect(g.root.querySelectorAll<HTMLButtonElement>(".dg-bulk .dg-btn")).toHaveLength(0);
  });

  it("row click selects, marks the row and keeps it across pages", async () => {
    const { t, g, sel } = await make();
    rowInputs(t)[1]!.click();
    rowInputs(t)[3]!.click();
    expect(sel.keys()).toEqual(["2", "4"]);
    const tr = t.querySelector('tbody tr[data-key="2"]')!;
    expect(tr.hasAttribute("data-selected")).toBe(true);
    expect(tr.hasAttribute("aria-selected")).toBe(false);
    expect(head(t).indeterminate).toBe(true);
    g.page(2);
    await flush();
    expect(head(t).indeterminate).toBe(false);
    expect(head(t).checked).toBe(false);
    rowInputs(t)[0]!.click();
    expect(sel.count()).toBe(3);
    expect(g.root.querySelector(".dg-bulk")!.textContent).toContain("2 tanesi görünmüyor");
    g.page(1);
    await flush();
    expect(rowInputs(t)[1]!.checked).toBe(true);
    expect(sel.get().map((r) => r.id)).toEqual([2, 4, 6]);
  });

  it("header checkbox is tri-state for the page", async () => {
    const { t, sel } = await make();
    head(t).click();
    expect(head(t).checked).toBe(true);
    expect(head(t).indeterminate).toBe(false);
    expect(sel.count()).toBe(5);
    rowInputs(t)[0]!.click();
    expect(head(t).indeterminate).toBe(true);
    head(t).click(); // mixed → select the page
    expect(sel.count()).toBe(5);
    head(t).click(); // full → deselect the page
    expect(sel.count()).toBe(0);
    expect(head(t).checked).toBe(false);
  });

  it("offers select-all-matching only for a full page, then switches to all + except", async () => {
    const { t, g, sel } = await make();
    const bar = g.root.querySelector(".dg-bulk")!;
    rowInputs(t)[0]!.click();
    expect(bar.querySelector(".dg-textbtn")!.textContent).toBe("Seçimi temizle");
    head(t).click();
    const btns = Array.from(bar.querySelectorAll<HTMLButtonElement>(".dg-textbtn"));
    expect(btns.map((b) => b.textContent)).toEqual(["Filtre sonucunun tümünü seç (12)", "Seçimi temizle"]);
    btns[0]!.click();
    expect(sel.isAll()).toBe(true);
    expect(sel.count()).toBe(12);
    expect(bar.textContent).toContain("Filtre sonucunun tümü seçili.");
    rowInputs(t)[2]!.click();
    expect(sel.count()).toBe(11);
    expect(sel.payload()).toEqual({ all: true, except: ["3"], query: { search: "", sort: [], filters: {}, params: {} } });
    g.page(3);
    await flush();
    expect(rowInputs(t).every((i) => i.checked)).toBe(true);
    // client mode: every matching row is known
    await flush();
    expect(sel.get()).toHaveLength(11);
  });

  it("a query change resets all; individual picks survive", async () => {
    const { t, g, sel } = await make();
    rowInputs(t)[0]!.click();
    g.search("Chris");
    await flush();
    expect(sel.keys()).toEqual(["1"]);
    head(t).click();
    sel.selectAllMatching();
    expect(sel.isAll()).toBe(true);
    const n = sel.count();
    expect(n).toBe(6);
    g.sort([["ad", "desc"]]);
    await flush();
    expect(sel.isAll()).toBe(true);
    g.search("");
    await flush();
    expect(sel.isAll()).toBe(false);
    expect(sel.count()).toBe(0);
    expect(rowInputs(t).some((i) => i.checked)).toBe(false);
  });

  it("filters() change also resets all (client mode refreshes without beforeLoad)", async () => {
    const { g, sel } = await make();
    sel.selectAllMatching();
    g.filters({ birim: "R.P.D." });
    await flush();
    expect(sel.isAll()).toBe(false);
  });

  it("emits selectionchange and announces", async () => {
    const { t, g } = await make();
    const seen: unknown[] = [];
    g.on("selectionchange", (d) => seen.push(d));
    rowInputs(t)[0]!.click();
    expect(seen).toEqual([{ count: 1, keys: ["1"], all: false }]);
    await new Promise((r) => setTimeout(r, 40));
    expect(g.root.querySelector(".dg-live")!.textContent).toBe("1 satır seçildi");
  });

  it("API: select / deselect / toggle / clear / isSelected / selectPage", async () => {
    const { sel, t } = await make();
    sel.select(["3", "3", "9"]);
    expect(sel.keys()).toEqual(["3", "9"]);
    sel.toggle("9");
    expect(sel.isSelected("9")).toBe(false);
    sel.deselect("3");
    expect(sel.count()).toBe(0);
    sel.selectPage();
    expect(sel.count()).toBe(5);
    expect(rowInputs(t).every((i) => i.checked)).toBe(true);
    sel.clear();
    expect(sel.count()).toBe(0);
  });

  it("shift+click selects a range within the page", async () => {
    const { t, sel } = await make();
    rowInputs(t)[0]!.click();
    rowInputs(t)[3]!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: true }));
    expect(sel.keys().sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("the whole select cell toggles, without firing rowClick", async () => {
    const rowClick = vi.fn();
    const { t, sel } = await make({}, rows(12), { rowClick });
    t.querySelector<HTMLElement>('tbody tr td[data-col="select"]')!.click();
    expect(sel.keys()).toEqual(["1"]);
    expect(rowClick).not.toHaveBeenCalled();
    t.querySelector<HTMLElement>('thead th[data-col="select"]')!.click();
    expect(sel.count()).toBe(5);
  });

  it("single mode keeps one key and has no page checkbox", async () => {
    const { t, sel } = await make({ mode: "single" });
    expect(head(t)).toBeNull();
    expect(t.querySelector('th[data-col="select"]')!.textContent).toBe("Seç");
    rowInputs(t)[0]!.click();
    rowInputs(t)[2]!.click();
    expect(sel.keys()).toEqual(["3"]);
    expect(rowInputs(t)[0]!.checked).toBe(false);
  });

  it("acrossPages:false drops off-page keys", async () => {
    const { t, g, sel } = await make({ acrossPages: false });
    rowInputs(t)[0]!.click();
    g.page(2);
    await flush();
    expect(sel.count()).toBe(0);
  });

  it("bulk actions: disabled at 0, receive the payload, danger tone (outline, CSS greys it while disabled)", async () => {
    const onClick = vi.fn();
    const { t, g } = await make({ bulk: { actions: [{ id: "sms", label: "SMS", icon: "send", onClick }, { id: "sil", label: "Sil", tone: "danger", onClick }, { id: "gizli", label: "X", can: false, onClick }] } });
    const btns = Array.from(g.root.querySelectorAll<HTMLButtonElement>(".dg-bulk-actions .dg-btn"));
    expect(btns.map((b) => b.dataset.action)).toEqual(["sms", "sil"]);
    expect(btns.every((b) => b.disabled)).toBe(true);
    expect(btns[1]!.getAttribute("data-tone")).toBe("bad");
    expect(btns[0]!.getAttribute("aria-label")).toBe("SMS");
    rowInputs(t)[1]!.click();
    expect(g.root.querySelector(".dg-bulk")!.hasAttribute("data-active")).toBe(true);
    expect(btns[1]!.disabled).toBe(false);
    btns[1]!.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]![0]).toEqual({ all: false, keys: ["2"] });
    expect(onClick.mock.calls[0]![1]).toBe(g);
  });

  it("a bulk handler returning a bare thenable (no catch/finally) is awaited and releases the busy state", async () => {
    let settle!: () => void;
    // what some dialog libraries return: only `then`
    const thenable = { then: (ok: () => void) => void (settle = ok) };
    const onClick = vi.fn(() => thenable);
    const { t, g } = await make({ bulk: { actions: [{ id: "sil", label: "Sil", onClick }] } });
    const btn = g.root.querySelector<HTMLButtonElement>(".dg-bulk-actions .dg-btn")!;
    rowInputs(t)[0]!.click();
    btn.click();
    await flush();
    expect(btn.getAttribute("aria-busy")).toBe("true");
    btn.click(); // ignored while busy
    expect(onClick).toHaveBeenCalledTimes(1);
    settle();
    await flush();
    expect(btn.hasAttribute("aria-busy")).toBe(false);
    btn.click();
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("bulk:false mounts no bar", async () => {
    const { g } = await make({ bulk: false });
    expect(g.root.querySelector(".dg-bulk")).toBeNull();
  });

  it("drops keys of removed rows in client mode", async () => {
    const { g, sel } = await make();
    sel.select(["2", "3"]);
    g.removeRow("2");
    await flush();
    expect(sel.keys()).toEqual(["3"]);
  });

  it("warns when column.select() is missing", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const t = mount();
    const g = new Datagrid(t, { label: "x", columns: [column.text("ad")], use: [arraySource(rows(2)), selection()] });
    await flush();
    expect(spy.mock.calls.some((c) => String(c[0]).includes("column.select()"))).toBe(true);
    g.destroy();
  });

  it("server mode: payload query is the grid query without paging", async () => {
    const t = mount();
    const src = customSource({
      mode: "server",
      load: async (query) => {
        const all = rows(40).filter((r) => !query.search || String(r.ad).includes(query.search));
        const start = (query.page - 1) * query.pageSize;
        return { rows: all.slice(start, start + query.pageSize), total: 40, filtered: all.length };
      },
    });
    const g = new Datagrid(t, { label: "x", pageSize: 5, columns: [column.select(), column.text("ad")], use: [src, selection()] });
    await flush();
    await flush();
    const sel = g.module(selection) as SelectionApi;
    head(t).click();
    sel.selectAllMatching();
    expect(sel.count()).toBe(40);
    rowInputs(t)[0]!.click();
    expect(sel.payload()).toEqual({ all: true, except: ["1"], query: { search: "", sort: [], filters: {}, params: {} } });
    g.page(2);
    await flush();
    await flush();
    expect(sel.isAll()).toBe(true);
    expect(rowInputs(t).every((i) => i.checked)).toBe(true);
    g.search("Jill");
    await flush();
    await flush();
    expect(sel.isAll()).toBe(false);
    g.destroy();
  });

  it("destroy removes the bar and restores the table", async () => {
    const { g, t } = await make();
    rowInputs(t)[0]!.click();
    g.destroy();
    expect(document.querySelector(".dg-bulk")).toBeNull();
    expect(t.querySelector("[data-selected]")).toBeNull();
  });
});

describe("select all matching carries page params", () => {
  it("payload.query.params has the filter panel values; a change of them resets 'all'", async () => {
    const { Datagrid, column, serverSide, yajra, configure, selection } = await import("../../src/index");
    configure({ fetch: (async (_u: RequestInfo | URL, init?: RequestInit) => {
      const b = new URLSearchParams(String(init?.body ?? ""));
      const data = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, ad: `Kişi ${i + 1}` }));
      return new Response(JSON.stringify({ draw: Number(b.get("draw")), recordsTotal: 50, recordsFiltered: 50, data }), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch });
    try {
      let durum = "acik";
      const panel = { name: "panelStub", kind: "feature" as const, setup(ctx: { request(mw: (r: { params: Record<string, unknown> }, n: (r: unknown) => Promise<Response>) => Promise<Response>): void }) {
        ctx.request((r, next) => ((r.params.durum = durum), next(r)));
      } };
      document.body.innerHTML = "<table id='t'></table>";
      const g = new Datagrid("#t", {
        columns: [column.select(), column.text("ad")],
        pageSize: 5,
        use: [serverSide({ url: "/x", protocol: yajra(), params: { tur: "personel" } }), panel as never, selection()],
      });
      await new Promise((r) => setTimeout(r, 10));
      expect(g.lastRequestParams()).toEqual({ tur: "personel", durum: "acik" });
      const sel = (g as unknown as { selection: { selectPage(): void; selectAllMatching(): void; payload(): { all: boolean; query?: { params?: unknown } } } }).selection;
      // the form changed but was not applied: "all" still means the rows on screen
      durum = "iptal";
      sel.selectPage();
      sel.selectAllMatching();
      const p = sel.payload();
      expect(p.all).toBe(true);
      expect(p.query!.params).toEqual({ tur: "personel", durum: "acik" });
      await g.reload({ keepPage: true });
      await new Promise((r) => setTimeout(r, 10));
      expect(sel.payload().all).toBe(false);
      g.destroy();
    } finally {
      configure({ fetch: undefined });
    }
  });
});
