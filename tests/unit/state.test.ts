import { describe, expect, it, vi, beforeEach } from "vitest";
import { Datagrid, column, arraySource, customSource } from "../../src/index";
import type { ColumnDef, ModuleDef, Row } from "../../src/index";
import { stateSave, parsePayload, type StateApi, type StatePayload } from "../../src/modules/state-save";
import { colVis, type ColVisApi } from "../../src/modules/colvis";
import { reload, resetState } from "../../src/modules/buttons";

const flush = async () => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
};

class MemStorage implements Storage {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return Array.from(this.map.keys())[i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
}

const rows: Row[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  ad: ["Jill Valentine", "Chris Redfield", "Leon S. Kennedy"][i % 3],
  birim: ["R.P.D.", "S.T.A.R.S. Alfa"][i % 2],
  tutar: i * 10,
  durum: i % 2 ? "acik" : "tamam",
}));

const baseCols = (): ColumnDef[] => [
  column.index(),
  column.text("ad", { title: "Ad", hideable: false }),
  column.text("birim", { title: "Birim" }),
  column.money("tutar", { title: "Tutar" }),
  column.text("durum", { title: "Durum", visible: false }),
];

function mount(): HTMLTableElement {
  document.body.innerHTML = `<div id="host"><table id="t"></table></div>`;
  return document.querySelector("table")!;
}

type G = Datagrid & { state: StateApi; colVis: ColVisApi };

function make(storage: Storage, o: { cols?: ColumnDef[]; use?: ModuleDef[]; state?: Parameters<typeof stateSave>[0]; load?: () => void } = {}): G {
  const src = o.load
    ? customSource({ mode: "client", load: async () => (o.load!(), { rows, total: rows.length, filtered: rows.length }) })
    : arraySource(rows);
  return new Datagrid(mount(), {
    name: "liste",
    label: "Liste",
    columns: o.cols ?? baseCols(),
    sort: [["ad", "asc"]],
    pageSize: 10,
    use: [src, colVis(), stateSave({ storage, ...o.state }), ...(o.use ?? [])],
  }) as G;
}

const KEY = "dg:1:liste:/";
const stored = (s: MemStorage) => JSON.parse(s.getItem(KEY)!) as StatePayload;

beforeEach(() => {
  document.documentElement.lang = "tr";
});

describe("stateSave", () => {
  it("saves sort, pageSize, hidden columns and a column fingerprint", async () => {
    const s = new MemStorage();
    const g = make(s);
    await flush();
    g.sort([["tutar", "desc"]]);
    g.pageSize(25);
    g.setColumnVisible("birim", false);
    g.search("Jill");
    g.state.save();
    const p = stored(s);
    expect(g.state.key).toBe(KEY);
    expect(p.v).toBe(1);
    expect(typeof p.t).toBe("number");
    expect(p.fp).toEqual(["__index", "ad", "birim", "durum", "tutar"]);
    expect(p.core.sort).toEqual([{ key: "tutar", dir: "desc" }]);
    expect(p.core.pageSize).toBe(25);
    expect(p.core.hidden.sort()).toEqual(["birim", "durum"]);
    expect("search" in p.core).toBe(false); // never saved by default
    expect("page" in p.core).toBe(false);
    g.destroy();
  });

  it("restores the state before the first load, with a single load", async () => {
    const s = new MemStorage();
    const g1 = make(s);
    await flush();
    g1.sort([["tutar", "desc"]]);
    g1.pageSize(25);
    g1.setColumnVisible("birim", false);
    g1.setColumnVisible("durum", true);
    g1.search("Leon");
    g1.destroy(); // flushes the pending write
    const load = vi.fn();
    const g = make(s, { load });
    await flush();
    expect(load).toHaveBeenCalledTimes(1);
    expect(g.sort()).toEqual([{ key: "tutar", dir: "desc" }]);
    expect(g.pageSize()).toBe(25);
    expect(g.columns().find((c) => c.key === "birim")!.visible).toBe(false);
    expect(g.columns().find((c) => c.key === "durum")!.visible).toBe(true);
    expect(g.table.querySelector('th[data-key="birim"]')!.hasAttribute("hidden")).toBe(true);
    expect(g.search()).toBe("");
    expect(g.table.tBodies[0]!.rows.length).toBe(25);
    g.destroy();
  });

  it("debounces writes on sort / pagesize / columnchange", async () => {
    const s = new MemStorage();
    const g = make(s, { state: { delay: 10 } });
    await flush();
    const before = s.getItem(KEY);
    g.sort([["tutar", "asc"]]);
    g.setColumnVisible("birim", false);
    expect(s.getItem(KEY)).toBe(before);
    await new Promise((r) => setTimeout(r, 30));
    expect(stored(s).core.sort).toEqual([{ key: "tutar", dir: "asc" }]);
    expect(stored(s).core.hidden).toContain("birim");
    g.destroy();
  });

  it("drops expired state (TTL) and removes the key", async () => {
    const s = new MemStorage();
    const old: StatePayload = {
      v: 1,
      t: Date.now() - 91 * 86_400_000,
      fp: ["ad", "birim", "durum", "__index", "tutar"],
      core: { sort: [{ key: "tutar", dir: "desc" }], pageSize: 25, hidden: ["birim"] },
      modules: {},
    };
    s.setItem(KEY, JSON.stringify(old));
    const g = make(s);
    await flush();
    expect(g.sort()).toEqual([{ key: "ad", dir: "asc" }]);
    expect(g.pageSize()).toBe(10);
    expect(s.getItem(KEY)).toBeNull();
    g.destroy();
    // a custom ttl keeps it
    s.setItem(KEY, JSON.stringify(old));
    const g2 = make(s, { state: { ttl: 0 } });
    await flush();
    expect(g2.pageSize()).toBe(25);
    g2.destroy();
  });

  it("drops a payload of another version", async () => {
    const s = new MemStorage();
    s.setItem(KEY, JSON.stringify({ v: 1, t: Date.now(), fp: [], core: { sort: [], pageSize: 50, hidden: [] }, modules: {} }));
    const g = make(s, { state: { version: 2 } });
    await flush();
    expect(g.pageSize()).toBe(10);
    expect(s.getItem(KEY)).toBeNull();
    g.destroy();
  });

  it("parsePayload rejects garbage and sanitises fields", () => {
    expect(parsePayload("{oops", 1, 0)).toBeNull();
    expect(parsePayload(JSON.stringify([1]), 1, 0)).toBeNull();
    expect(parsePayload(JSON.stringify({ v: 1, t: 1 }), 1, 0)).toBeNull();
    const p = parsePayload(
      JSON.stringify({ v: 1, t: 5, fp: ["a", 3], core: { sort: [{ key: "a", dir: "up" }, { key: "a", dir: "desc" }], pageSize: "x", hidden: [1, "b"] } }),
      1,
      0,
    )!;
    expect(p.fp).toEqual(["a"]);
    expect(p.core.sort).toEqual([{ key: "a", dir: "desc" }]);
    expect(p.core.pageSize).toBeNaN();
    expect(p.core.hidden).toEqual(["b"]);
    expect(p.modules).toEqual({});
  });

  it("fingerprint mismatch: selective cleanup keeps known parts, new columns keep defaults", async () => {
    const s = new MemStorage();
    s.setItem(
      KEY,
      JSON.stringify({
        v: 1,
        t: Date.now(),
        // saved before "durum" existed; "eski" was removed since
        fp: ["ad", "birim", "eski", "__index", "tutar"],
        core: { sort: [{ key: "eski", dir: "asc" }], pageSize: 25, hidden: ["birim", "eski"] },
        modules: {},
      }),
    );
    const g = make(s);
    await flush();
    expect(g.sort()).toEqual([{ key: "ad", dir: "asc" }]); // emptied sort → default kept
    expect(g.pageSize()).toBe(25);
    const vis = Object.fromEntries(g.columns().map((c) => [c.key, c.visible]));
    expect(vis.birim).toBe(false); // known: applied
    expect(vis.tutar).toBe(true);
    expect(vis.durum).toBe(false); // new column: its default (hidden)
    g.destroy();
  });

  it("clamps pageSize to maxPageSize", async () => {
    const s = new MemStorage();
    s.setItem(KEY, JSON.stringify({ v: 1, t: Date.now(), fp: [], core: { sort: [], pageSize: 50_000, hidden: [] }, modules: {} }));
    const g = make(s);
    await flush();
    expect(g.pageSize()).toBe(1000);
    g.destroy();
  });

  it("swallows storage errors (quota / private mode) and warns once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = new MemStorage();
    bad.getItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
    bad.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    bad.removeItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
    const g = make(bad);
    await flush();
    expect(() => {
      g.sort([["tutar", "desc"]]);
      g.state.save();
      g.state.save();
      g.state.clear();
    }).not.toThrow();
    expect(g.state.read()).toBeNull();
    const msgs = warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes("stateSave"));
    expect(msgs.length).toBeLessThanOrEqual(1);
    g.destroy();
    warn.mockRestore();
  });

  it("round-trips module contributions", async () => {
    const s = new MemStorage();
    let value = { density: "compact", pinned: ["ad"] };
    const loaded: unknown[] = [];
    const contrib: ModuleDef = {
      name: "prefs",
      kind: "feature",
      setup(ctx) {
        ctx.state({ key: "prefs", save: () => value, load: (v) => loaded.push(v) });
      },
    };
    const g1 = make(s, { use: [contrib] });
    await flush();
    g1.state.save();
    expect(stored(s).modules).toEqual({ prefs: { density: "compact", pinned: ["ad"] } });
    g1.destroy();
    value = { density: "normal", pinned: [] };
    loaded.length = 0;
    const g2 = make(s, { use: [contrib] });
    await flush();
    expect(loaded).toEqual([{ density: "compact", pinned: ["ad"] }]);
    g2.destroy();
  });

  it("include: filters / search / page are opt-in", async () => {
    const s = new MemStorage();
    const g1 = make(s, { state: { include: ["filters", "search", "page"] } });
    await flush();
    g1.filters({ durum: "acik" });
    g1.search("Chris");
    await flush();
    g1.state.save();
    expect(stored(s).core.filters).toEqual({ durum: "acik" });
    expect(stored(s).core.search).toBe("Chris");
    g1.destroy();
    const g2 = make(s, { state: { include: ["filters", "search", "page"] } });
    await flush();
    expect(g2.filters()).toEqual({ durum: "acik" });
    expect(g2.search()).toBe("Chris");
    g2.destroy();
    // without include the same payload restores neither
    const g3 = make(s);
    await flush();
    expect(g3.filters()).toEqual({});
    expect(g3.search()).toBe("");
    g3.destroy();
  });

  it("reset() clears storage, restores defaults and reloads once", async () => {
    const s = new MemStorage();
    const load = vi.fn();
    const g = make(s, { load, use: [resetState()] });
    await flush();
    g.sort([["tutar", "desc"]]);
    g.pageSize(25);
    g.setColumnVisible("birim", false);
    g.setColumnVisible("durum", true);
    g.state.save();
    expect(s.getItem(KEY)).not.toBeNull();
    load.mockClear();
    g.root.querySelector<HTMLButtonElement>('.dg-btn[aria-label="Sıfırla"]')!.click();
    await flush();
    expect(s.getItem(KEY)).toBeNull();
    expect(g.sort()).toEqual([{ key: "ad", dir: "asc" }]);
    expect(g.pageSize()).toBe(10);
    expect(g.columns().find((c) => c.key === "birim")!.visible).toBe(true);
    expect(g.columns().find((c) => c.key === "durum")!.visible).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 300));
    expect(s.getItem(KEY)).toBeNull(); // nothing re-written until the user changes something
    g.destroy();
  });

  it("resetState requires the state module", () => {
    mount();
    expect(() => new Datagrid("#t", { label: "x", use: [resetState()] })).toThrow(/DG007/);
  });
});

describe("colVis", () => {
  it("badge counts titled, non-special columns; toggles hide th and td", async () => {
    const s = new MemStorage();
    const g = make(s);
    await flush();
    const btn = g.root.querySelector<HTMLButtonElement>('.dg-btn[aria-haspopup="dialog"]')!;
    expect(btn.querySelector(".dg-btn-badge")!.textContent).toBe("3/4");
    g.colVis.open();
    const panel = g.root.querySelector<HTMLElement>(".dg-colvis")!;
    expect(panel.getAttribute("role")).toBe("dialog");
    expect(panel.querySelector("fieldset > legend")!.textContent).toBe("Kolonları göster / gizle");
    const keys = Array.from(panel.querySelectorAll<HTMLInputElement>(".dg-check-input")).map((i) => i.value);
    expect(keys).toEqual(["ad", "birim", "tutar", "durum"]); // rownum excluded
    const locked = panel.querySelector<HTMLInputElement>('.dg-check-input[value="ad"]')!;
    expect(locked.disabled && locked.checked).toBe(true);
    const birim = panel.querySelector<HTMLInputElement>('.dg-check-input[value="birim"]')!;
    birim.click();
    expect(g.table.querySelector('th[data-key="birim"]')!.hasAttribute("hidden")).toBe(true);
    expect(g.table.querySelector('tbody td[data-key="birim"]')!.hasAttribute("hidden")).toBe(true);
    expect(btn.querySelector(".dg-btn-badge")!.textContent).toBe("2/4");
    g.colVis.reset();
    expect(btn.querySelector(".dg-btn-badge")!.textContent).toBe("3/4");
    expect(birim.checked).toBe(true);
    g.colVis.close();
    g.destroy();
    expect(document.querySelector(".dg-colvis")).toBeNull();
  });

  it("defaults survive a restored state (reset goes to the column definitions)", async () => {
    const s = new MemStorage();
    s.setItem(KEY, JSON.stringify({ v: 1, t: Date.now(), fp: ["ad", "birim", "durum", "__index", "tutar"], core: { sort: [], pageSize: 10, hidden: ["birim", "tutar"] }, modules: {} }));
    const g = make(s);
    await flush();
    expect(g.colVis.count()).toEqual({ visible: 2, total: 4 });
    g.colVis.reset();
    expect(g.colVis.count()).toEqual({ visible: 3, total: 4 });
    g.destroy();
  });

  it("shows the in-panel search only above 12 columns", async () => {
    const s = new MemStorage();
    const many = Array.from({ length: 13 }, (_, i) => column.text(`k${i}`, { title: i === 3 ? "Işık Kulesi" : `Kolon ${i}` }));
    const g = make(s, { cols: many });
    await flush();
    g.colVis.open();
    const search = g.root.querySelector<HTMLInputElement>(".dg-colvis-search-input")!;
    expect(search.closest<HTMLElement>(".dg-colvis-search")!.hidden).toBe(false);
    search.value = "isik";
    search.dispatchEvent(new Event("input"));
    const shown = Array.from(g.root.querySelectorAll<HTMLElement>(".dg-colvis-list > label")).filter((l) => !l.hidden);
    expect(shown.map((l) => l.textContent)).toEqual(["Işık Kulesi"]);
    g.destroy();
  });

  it("reload button reloads and spins while loading", async () => {
    const s = new MemStorage();
    let resolve!: () => void;
    let calls = 0;
    const g = new Datagrid(mount(), {
      label: "x",
      columns: baseCols(),
      use: [
        customSource({
          mode: "server",
          load: () => (calls++, new Promise((r) => (resolve = () => r({ rows, total: 30, filtered: 30 })))),
        }),
        reload(),
        stateSave({ storage: s }),
      ],
    });
    await flush();
    resolve();
    await flush();
    const btn = g.root.querySelector<HTMLButtonElement>('.dg-btn[aria-label="Yenile"]')!;
    expect(btn.title).toBe("Yenile");
    btn.click();
    expect(calls).toBe(2);
    expect(btn.querySelector("svg")!.classList.contains("dg-spin")).toBe(true);
    resolve();
    await flush();
    expect(btn.querySelector("svg")!.classList.contains("dg-spin")).toBe(false);
    g.destroy();
  });
});

describe("two unnamed grids on one page", () => {
  it("stateSave gives the second its own slot; urlSync its own namespace", async () => {
    const { Datagrid, column, arraySource, stateSave, urlSync } = await import("../../src/index");
    localStorage.clear();
    history.replaceState(null, "", "/liste");
    document.body.innerHTML = "<table></table><table></table>";
    const [ta, tb] = Array.from(document.querySelectorAll("table"));
    const rows = [{ id: 1, ad: "Jill Valentine", birim: "R.P.D." }];
    const a = new Datagrid(ta!, { columns: [column.text("ad"), column.text("birim")], use: [arraySource(rows), stateSave({ delay: 0 }), urlSync()] });
    const b = new Datagrid(tb!, { columns: [column.text("ad"), column.text("birim")], use: [arraySource(rows), stateSave({ delay: 0 }), urlSync()] });
    await new Promise((r) => setTimeout(r, 10));
    a.setColumnVisible("birim", false);
    b.sort([["ad", "desc"]]);
    b.search("zzz");
    await new Promise((r) => setTimeout(r, 30));
    expect(Object.keys(localStorage).sort()).toEqual(["dg:1:grid-2:/liste", "dg:1:grid:/liste"]);
    expect(JSON.parse(localStorage.getItem("dg:1:grid-2:/liste")!).core.hidden).toEqual([]);
    expect(location.search).toContain("g2.q=zzz");
    expect(a.search()).toBe("");
    a.destroy();
    b.destroy();
    history.replaceState(null, "", "/");
  });
});

describe("shared link vs saved filters", () => {
  it("the URL's filter wins over a filter restored by stateSave registered after urlSync", async () => {
    const { Datagrid, column, arraySource, stateSave, urlSync } = await import("../../src/index");
    localStorage.clear();
    const rows = [{ id: 1, ad: "a", durum: "acik" }, { id: 2, ad: "b", durum: "iptal" }];
    history.replaceState(null, "", "/l2");
    document.body.innerHTML = "<table id='t'></table>";
    const g1 = new Datagrid("#t", { name: "x", columns: [column.text("ad"), column.text("durum")], use: [arraySource(rows), urlSync({ keys: ["durum"] }), stateSave({ include: ["filters"], delay: 0 })] });
    await new Promise((r) => setTimeout(r, 5));
    g1.filters({ durum: "acik" });
    g1.sort([["ad", "desc"]]);
    await new Promise((r) => setTimeout(r, 30));
    g1.destroy();
    history.replaceState(null, "", "/l2?f.durum=iptal");
    document.body.innerHTML = "<table id='t'></table>";
    const g2 = new Datagrid("#t", { name: "x", columns: [column.text("ad"), column.text("durum")], use: [arraySource(rows), urlSync({ keys: ["durum"] }), stateSave({ include: ["filters"], delay: 0 })] });
    await new Promise((r) => setTimeout(r, 10));
    expect(g2.filters().durum).toBe("iptal");
    expect(g2.viewRows().map((r) => r.id)).toEqual([2]);
    expect(location.search).toContain("f.durum=iptal");
    g2.destroy();
    history.replaceState(null, "", "/");
  });
});

describe("filterPanel + stateSave in either order", () => {
  for (const order of ["panel-first", "state-first"] as const) {
    it(`restores the controls and the data together (${order})`, async () => {
      const { Datagrid, column, arraySource, stateSave, filterPanel } = await import("../../src/index");
      localStorage.clear();
      const rows = [{ id: 1, ad: "a", durum: "acik" }, { id: 2, ad: "b", durum: "iptal" }];
      const make = () => {
        document.body.innerHTML = "<select id='f-durum'><option value=''>Hepsi</option><option value='acik'>Açık</option><option value='iptal'>İptal</option></select><table id='t'></table>";
        const fp = filterPanel({ fields: { durum: "#f-durum" }, debounce: 0 });
        const st = stateSave({ include: ["filters"], delay: 0 });
        return new Datagrid("#t", { name: "fp", columns: [column.text("ad"), column.text("durum")], use: [arraySource(rows), ...(order === "panel-first" ? [fp, st] : [st, fp])] });
      };
      const g1 = make();
      await new Promise((r) => setTimeout(r, 5));
      const sel = document.getElementById("f-durum") as HTMLSelectElement;
      sel.value = "iptal";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      g1.sort([["ad", "desc"]]);
      await new Promise((r) => setTimeout(r, 40));
      g1.destroy();
      const g2 = make();
      await new Promise((r) => setTimeout(r, 10));
      expect((document.getElementById("f-durum") as HTMLSelectElement).value).toBe("iptal");
      expect(g2.viewRows().map((r) => r.id)).toEqual([2]);
      g2.destroy();
    });
  }
});
