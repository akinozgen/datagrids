import { afterEach, describe, expect, it, vi } from "vitest";
import { Datagrid, column, arraySource, customSource, autoRefresh, type AutoRefreshApi } from "../../src/index";
import { parseBool } from "../../src/columns/index";

const flush = () => new Promise((r) => setTimeout(r, 0));
afterEach(() => vi.useRealTimers());

describe("column.boolean", () => {
  it("parses common spellings, renders icon + text, sorts and exports labels", async () => {
    expect([1, 0, "1", "0", true, "false", "Evet", "HAYIR", "on", "", null, "x"].map(parseBool)).toEqual([true, false, true, false, true, false, true, false, true, null, null, null]);
    document.documentElement.lang = "tr";
    document.body.innerHTML = "<table id='t'></table>";
    const g = new Datagrid("#t", {
      columns: [column.text("ad"), column.boolean("aktif"), column.boolean("vip", { labels: { true: "Var", false: "Yok" }, showFalse: false })],
      sort: [["aktif", "desc"]],
      use: [arraySource([{ id: 1, ad: "Ada Wong", aktif: 0, vip: 1 }, { id: 2, ad: "Leon S. Kennedy", aktif: "evet", vip: 0 }])],
    });
    await flush();
    const first = g.root.querySelector("tbody tr")!;
    expect(first.querySelector("td[data-key=aktif]")!.textContent).toBe("Evet");
    expect(first.querySelector("td[data-key=aktif] .dg-bool")!.getAttribute("data-value")).toBe("true");
    expect(first.querySelector("td[data-key=aktif] svg")).not.toBeNull();
    expect(first.querySelector("td[data-key=vip] .dg-bool")).toBeNull();
    g.search("hayır");
    expect(g.viewRows().map((r) => r.ad)).toEqual(["Ada Wong"]);
    const rows = await g.exportRows("all");
    const vip = g.columns().find((c) => c.key === "vip")!;
    expect(vip.exportValue!(rows[0]!)).toBe("Var");
    g.destroy();
  });
});

describe("autoRefresh", () => {
  it("reloads in place on each tick, skips hidden tabs, stops on session expiry", async () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    document.body.innerHTML = "<table id='t'></table>";
    const g = new Datagrid("#t", {
      columns: [column.text("ad")],
      pageSize: 1,
      use: [customSource({ mode: "server", load: async (q) => (calls.push(q.page), { rows: [{ id: q.page, ad: "x" }], total: 3, filtered: 3 }) }), autoRefresh({ every: 5000 })],
    });
    await vi.advanceTimersByTimeAsync(0);
    g.page(2);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toEqual([1, 2, 2]);
    const btn = g.root.querySelector<HTMLButtonElement>(".dg-btn[aria-pressed]")!;
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    // hidden tab: no request, catches up when visible
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls.length).toBe(3);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls.length).toBe(4);
    btn.click();
    expect((g as unknown as { autoRefresh: AutoRefreshApi }).autoRefresh.running()).toBe(false);
    await vi.advanceTimersByTimeAsync(15000);
    expect(calls.length).toBe(4);
    btn.click();
    g.emit("sessionexpired", { error: { kind: "session", status: 419, message: "x", retryable: false } });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    g.destroy();
  });
});

describe("multiSort", () => {
  it("Shift+click adds, flips, removes; rank badges only while 2+ keys; max applies", async () => {
    const { multiSort } = await import("../../src/index");
    document.body.innerHTML = "<table id='t'></table>";
    const g = new Datagrid("#t", {
      columns: [column.text("a"), column.text("b"), column.text("c"), column.text("d")],
      sort: [["a", "asc"]],
      use: [arraySource([{ id: 1, a: "x", b: "y", c: "z", d: "w" }]), multiSort({ max: 3 })],
    });
    await flush();
    const click = (k: string, shift = true) => g.root.querySelector<HTMLElement>(`th[data-key=${k}] .dg-sort`)!.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: shift }));
    click("b");
    expect(g.sort()).toEqual([{ key: "a", dir: "asc" }, { key: "b", dir: "asc" }]);
    expect(g.root.querySelector("th[data-key=b] .dg-sort-rank")!.textContent).toBe("2");
    expect(g.root.querySelector("th[data-key=b]")!.getAttribute("data-sort-dir")).toBe("asc");
    expect(g.root.querySelector("th[data-key=b]")!.hasAttribute("aria-sort")).toBe(false);
    click("b");
    expect(g.sort()[1]).toEqual({ key: "b", dir: "desc" });
    click("c");
    click("d"); // max 3: the oldest key drops
    expect(g.sort().map((s) => s.key)).toEqual(["b", "c", "d"]);
    click("c");
    click("c");
    expect(g.sort().map((s) => s.key)).toEqual(["b", "d"]);
    click("a", false); // plain click: single sort again
    expect(g.sort()).toEqual([{ key: "a", dir: "asc" }]);
    expect(g.root.querySelector(".dg-sort-rank")).toBeNull();
    g.destroy();
    expect(document.querySelector("[data-sort-rank], .dg-sort-rank")).toBeNull();
  });
});
