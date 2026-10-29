import { afterEach, describe, expect, it, vi } from "vitest";
import { Datagrid, arraySource, column, serverSide, yajra, laravelPaginator, configure } from "../../src/index";
import type { Row } from "../../src/index";
import { rowReorder, reorderColumn, REORDER_KEY, type RowReorderApi, type RowReorderEnd } from "../../src/modules/row-reorder";
import { filterPresets, presetMatches, type FilterPresetsApi } from "../../src/modules/filter-presets";
import { filterPanel } from "../../src/modules/filter-panel";
import { urlSync } from "../../src/modules/url-sync";
import { stateSave } from "../../src/modules/state-save";
import { createEmulator, parsePhp, type EmuRow } from "../fixtures/server/emulator";

const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};
const live = (g: Datagrid) => new Promise<string>((r) => setTimeout(() => r(g.root.querySelector(".dg-live")!.textContent ?? ""), 40));
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
  localStorage.clear();
  configure({ notify: undefined });
});
const mkTable = () => document.body.appendChild(document.createElement("table"));
const keydown = (el: Element, key: string) => el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

const crew = (): Row[] =>
  ["Jill Valentine", "Chris Redfield", "Leon S. Kennedy", "Claire Redfield", "Albert Wesker", "Rebecca Chambers"].map((ad, i) => ({
    id: 101 + i,
    ad,
    sira: i + 1,
    tutar: (i + 1) * 100,
  }));
const reorderCols = () => [reorderColumn(), column.number("sira", { title: "Sıra" }), column.text("ad", { title: "Ad" }), column.number("tutar", { title: "Tutar" })];
const names = (t: HTMLTableElement) => Array.from(t.tBodies[0]!.rows, (r) => r.querySelector('td[data-key="ad"]')!.textContent);
const api = (g: Datagrid) => (g as unknown as { rowReorder: RowReorderApi }).rowReorder;
const handle = (t: HTMLTableElement, i: number) => t.tBodies[0]!.rows[i]!.querySelector<HTMLButtonElement>(".dg-reorder")!;

/* ============================== rowReorder ============================== */

describe("rowReorder: handles", () => {
  it("dedicated column: a named grip button per row, instructions, hidden header text; control-column defaults", async () => {
    const t = mkTable();
    const g = grid(t, { columns: reorderCols(), sort: [["sira", "asc"]], use: [arraySource(crew()), rowReorder({ orderKey: "sira", onEnd: () => {} })] });
    await flush();
    const col = g.columns().find((c) => c.key === REORDER_KEY)!;
    expect(col).toMatchObject({ sortable: false, searchable: false, exportable: false, hideable: false });
    const b = handle(t, 0);
    expect(b.tagName).toBe("BUTTON");
    expect(b.getAttribute("aria-label")).toBe("Taşı: Jill Valentine");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(document.getElementById(b.getAttribute("aria-describedby")!)!.textContent).toContain("Boşluk ya da Enter");
    expect(b.querySelector("svg")).not.toBeNull();
    expect(t.tHead!.querySelector(`th[data-key="${REORDER_KEY}"] .dg-offscreen`)!.textContent).toBe("Sıra");
  });

  it("inside a data column (`handle`): wrapped next to the content; destroy() unwraps", async () => {
    const t = mkTable();
    const g = grid(t, { columns: [column.text("ad", { title: "Ad" }), column.number("tutar")], use: [arraySource(crew()), rowReorder({ handle: "ad", onEnd: () => {} })] });
    await flush();
    const td = t.tBodies[0]!.rows[0]!.querySelector('td[data-key="ad"]')!;
    expect(td.firstElementChild!.className).toBe("dg-reorder-wrap");
    expect(td.textContent).toBe("Jill Valentine");
    g.destroy();
    grids.length = 0;
    expect(t.querySelector(".dg-reorder, .dg-reorder-wrap, .dg-drop-line")).toBeNull();
  });

  it("disabled with a reason while sorted by another column; active again on the order column", async () => {
    const t = mkTable();
    const g = grid(t, { columns: reorderCols(), sort: [["sira", "asc"]], use: [arraySource(crew()), rowReorder({ orderKey: "sira", onEnd: () => {} })] });
    await flush();
    expect(api(g).enabled()).toBe(true);
    g.sort([["tutar", "desc"]]);
    await flush();
    expect(api(g).enabled()).toBe(false);
    const b = handle(t, 0);
    expect(b.getAttribute("aria-disabled")).toBe("true");
    expect(b.getAttribute("data-dg-tip")).toBe("Taşımak için “Sıra” sıralamasına dönün");
    expect(b.getAttribute("aria-description")).toBe("Taşımak için “Sıra” sıralamasına dönün");
    expect(b.hasAttribute("title")).toBe(false);
    expect(b.hasAttribute("aria-describedby")).toBe(false);
    // keyboard: explains instead of grabbing
    b.focus();
    keydown(b, " ");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(await live(g)).toBe("Taşımak için “Sıra” sıralamasına dönün");
    g.sort([["sira", "desc"]]);
    await flush();
    expect(handle(t, 0).hasAttribute("aria-disabled")).toBe(false);
  });

  it("disabled while a search or filter hides rows: the order of a partial list is never saved", async () => {
    const t = mkTable();
    const onEnd = vi.fn();
    const g = grid(t, { columns: reorderCols(), sort: [["sira", "asc"]], use: [arraySource(crew()), rowReorder({ orderKey: "sira", onEnd })] });
    await flush();
    g.search("Jill");
    await flush();
    expect(api(g).enabled()).toBe(false);
    expect(handle(t, 0).getAttribute("aria-disabled")).toBe("true");
    expect(handle(t, 0).getAttribute("data-dg-tip")).toBe("Taşımak için aramayı ve filtreleri temizleyin");
    expect(await api(g).move(g.keyOf(g.viewRows()[0]!), 0)).toBe(false);
    g.search("");
    await flush();
    expect(api(g).enabled()).toBe(true);
    expect(handle(t, 0).hasAttribute("aria-disabled")).toBe(false);
    g.filters({ birim: "Bravo" });
    await flush();
    expect(api(g).enabled()).toBe(false);
    g.filters({ birim: null });
    await flush();
    expect(api(g).enabled()).toBe(true);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("without orderKey any sort disables", async () => {
    const t = mkTable();
    const g = grid(t, { columns: reorderCols(), use: [arraySource(crew()), rowReorder({ onEnd: () => {} })] });
    await flush();
    expect(api(g).enabled()).toBe(true);
    g.sort([["sira", "asc"]]);
    expect(handle(t, 0).getAttribute("data-dg-tip")).toBe("Sıralı görünümde satırlar taşınamaz");
  });
});

describe("rowReorder: client mode", () => {
  it("sorted by orderKey: the order values follow the new order, the list sticks, onEnd gets neighbours", async () => {
    const t = mkTable();
    const seen: RowReorderEnd[] = [];
    const g = grid(t, { columns: reorderCols(), sort: [["sira", "asc"]], pageSize: 4, use: [arraySource(crew()), rowReorder({ orderKey: "sira", onEnd: (e) => void seen.push(e) })] });
    await flush();
    expect(await api(g).move("101", 2)).toBe(true);
    expect(names(t)).toEqual(["Chris Redfield", "Leon S. Kennedy", "Jill Valentine", "Claire Redfield"]);
    expect(seen[0]).toMatchObject({ key: "101", from: 0, to: 2, offset: 0, prevKey: "103", nextKey: "104" });
    expect(seen[0]!.rows.map((r) => r.sira)).toEqual([1, 2, 3, 4]);
    expect(g.rows().map((r) => `${r.ad}:${r.sira}`).slice(0, 4)).toEqual(["Chris Redfield:1", "Leon S. Kennedy:2", "Jill Valentine:3", "Claire Redfield:4"]);
    // rows are copies, the originals are untouched
    expect(crew()[0]!.sira).toBe(1);
    // page 2: offset and the moved row lands before its new neighbour in the whole list
    g.page(2);
    await api(g).move("106", 0);
    expect(seen[1]).toMatchObject({ key: "106", from: 1, to: 0, offset: 4, prevKey: null, nextKey: "105" });
    expect(g.rows().map((r) => r.ad)).toEqual(["Chris Redfield", "Leon S. Kennedy", "Jill Valentine", "Claire Redfield", "Rebecca Chambers", "Albert Wesker"]);
    expect(g.rows().map((r) => r.sira)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("unsorted: the underlying order changes", async () => {
    const t = mkTable();
    const g = grid(t, { columns: reorderCols(), use: [arraySource(crew()), rowReorder({ onEnd: () => {} })] });
    await flush();
    await api(g).move("104", 0);
    expect(names(t).slice(0, 2)).toEqual(["Claire Redfield", "Jill Valentine"]);
    expect(g.rows()[0]!.sira).toBe(4); // no orderKey: values untouched
  });

  it("a rejected onEnd reverts, notifies and emits reordererror; handles are blocked while saving", async () => {
    const notify = vi.fn();
    configure({ notify });
    const t = mkTable();
    let reject!: (e: Error) => void;
    const g = grid(t, {
      columns: reorderCols(),
      sort: [["sira", "asc"]],
      use: [arraySource(crew()), rowReorder({ orderKey: "sira", onEnd: () => new Promise((_r, rej) => (reject = rej)) })],
    });
    await flush();
    const errors: unknown[] = [];
    g.on("reordererror", (d) => errors.push(d.error));
    const done = api(g).move("101", 3);
    await flush();
    expect(names(t)[3]).toBe("Jill Valentine");
    expect(api(g).enabled()).toBe(false);
    expect(handle(t, 0).getAttribute("data-dg-tip")).toBe("Sıra kaydediliyor…");
    expect(t.tBodies[0]!.rows[3]!.getAttribute("aria-busy")).toBe("true");
    reject(new Error("sunucu 500"));
    expect(await done).toBe(false);
    expect(names(t)[0]).toBe("Jill Valentine");
    expect(g.rows().map((r) => r.sira)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(notify).toHaveBeenCalledWith("error", "Sıra kaydedilemedi: sunucu 500");
    expect(errors).toHaveLength(1);
    expect(api(g).enabled()).toBe(true);
    expect(t.querySelector("tr[aria-busy]")).toBeNull();
  });

  it("beforeReorder can cancel", async () => {
    const t = mkTable();
    const onEnd = vi.fn();
    const g = grid(t, { columns: reorderCols(), use: [arraySource(crew()), rowReorder({ onEnd })] });
    await flush();
    g.on("beforeReorder", (d: { cancel(): void }) => d.cancel());
    expect(await api(g).move("101", 2)).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
    expect(names(t)[0]).toBe("Jill Valentine");
  });
});

describe("rowReorder: keyboard", () => {
  it("Space grabs, arrows move (focus stays), Enter drops; announcements follow", async () => {
    const t = mkTable();
    const onEnd = vi.fn();
    const g = grid(t, { columns: reorderCols(), sort: [["sira", "asc"]], use: [arraySource(crew()), rowReorder({ orderKey: "sira", onEnd })] });
    await flush();
    const b = handle(t, 1);
    b.focus();
    keydown(b, " ");
    expect(b.getAttribute("aria-pressed")).toBe("true");
    expect(b.closest("tr")!.getAttribute("data-state")).toBe("dragging");
    expect(await live(g)).toBe("Chris Redfield tutuldu, konum 2 / 6.");
    keydown(b, "ArrowDown");
    keydown(b, "ArrowDown");
    expect(document.activeElement).toBe(b);
    expect(names(t).slice(0, 4)).toEqual(["Jill Valentine", "Leon S. Kennedy", "Claire Redfield", "Chris Redfield"]);
    expect(await live(g)).toBe("Chris Redfield: konum 4 / 6.");
    keydown(b, "Home");
    expect(names(t)[0]).toBe("Chris Redfield");
    keydown(b, "End");
    expect(names(t)[5]).toBe("Chris Redfield");
    keydown(b, "ArrowUp");
    keydown(b, "Enter");
    await flush();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd.mock.calls[0]![0]).toMatchObject({ key: "102", from: 1, to: 4 });
    expect(names(t)[4]).toBe("Chris Redfield");
    expect(g.rows().find((r) => r.ad === "Chris Redfield")!.sira).toBe(5);
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Taşı: Chris Redfield");
    expect(document.activeElement?.getAttribute("aria-pressed")).toBe("false");
  });

  it("Escape (and Tab) cancel and put the row back", async () => {
    const t = mkTable();
    const onEnd = vi.fn();
    const g = grid(t, { columns: reorderCols(), use: [arraySource(crew()), rowReorder({ onEnd })] });
    await flush();
    const b = handle(t, 0);
    b.focus();
    keydown(b, "Enter");
    keydown(b, "ArrowDown");
    keydown(b, "ArrowDown");
    keydown(b, "Escape");
    expect(names(t)[0]).toBe("Jill Valentine");
    expect(b.getAttribute("aria-pressed")).toBe("false");
    expect(await live(g)).toBe("Taşıma iptal edildi. Jill Valentine: konum 1 / 6.");
    keydown(b, " ");
    keydown(b, "ArrowDown");
    keydown(b, "Tab");
    expect(names(t)[0]).toBe("Jill Valentine");
    expect(onEnd).not.toHaveBeenCalled();
  });
});

describe("rowReorder: server mode", () => {
  it("onEnd, then one reload that keeps the page", async () => {
    const data = crew().concat(crew().map((r) => ({ ...r, id: Number(r.id) + 10, sira: Number(r.sira) + 6 }))) as unknown as EmuRow[];
    const starts: string[] = [];
    const emu = createEmulator({ rows: () => data, latency: 0, onLog: (e) => starts.push(String((e.params as Record<string, string>).start)) });
    const t = mkTable();
    document.head.insertAdjacentHTML("beforeend", '<meta name="csrf-token" content="t">');
    const order: string[] = [];
    const g = grid(t, {
      columns: reorderCols(),
      sort: [["sira", "asc"]],
      pageSize: 4,
      use: [
        serverSide({ url: "/api/satir", protocol: yajra(), csrf: true, fetch: emu.handle as typeof fetch }),
        rowReorder({ orderKey: "sira", onEnd: async (e) => void order.push(`${e.key}@${e.offset + e.to}`) }),
      ],
    });
    await flush();
    g.page(2);
    await flush();
    expect(starts).toEqual(["0", "4"]);
    expect(await api(g).move("105", 2)).toBe(true);
    expect(order).toEqual(["105@6"]);
    expect(starts).toEqual(["0", "4", "4"]);
    expect(g.page()).toBe(2);
    document.head.querySelector("meta[name=csrf-token]")?.remove();
  });
});

/* ============================== cursorPaginate ============================== */

const cursorRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, ad: `Kişi ${i + 1}`, tarih: `2026-10-${String(28 - (i % 27)).padStart(2, "0")}` })) as unknown as EmuRow[];

function cursorGrid(n: number, o: { resource?: boolean; pageSize?: number } = {}) {
  const urls: string[] = [];
  const emu = createEmulator({ rows: () => cursorRows(n), latency: 0, onLog: (e) => urls.push(decodeURIComponent(e.url)) });
  emu.faults.resource = !!o.resource;
  const t = mkTable();
  const g = grid(t, {
    columns: [column.text("ad"), column.text("tarih")],
    pageSize: o.pageSize ?? 10,
    sort: [["tarih", "desc"]],
    use: [serverSide({ url: "/api/cursor/x", protocol: laravelPaginator(), fetch: emu.handle as typeof fetch })],
  });
  const step = async (fn: () => void) => {
    fn();
    await flush();
  };
  return { g, t, urls, step };
}
const firstId = (t: HTMLTableElement) => t.tBodies[0]!.rows[0]!.getAttribute("data-key");

describe("laravelPaginator: cursorPaginate()", () => {
  it("detects the cursor JSON, walks pages with the learned cursors, back uses the same cursor", async () => {
    const { g, t, urls, step } = cursorGrid(25);
    await flush();
    expect(urls[0]).toBe("/api/cursor/x?page=1&per_page=10&sort=-tarih"); // before detection: a plain first page
    expect(g.status()).toMatchObject({ total: null, filtered: null, hasMore: true });
    const p1 = firstId(t);
    await step(() => g.page(2));
    expect(urls[1]).toMatch(/^\/api\/cursor\/x\?cursor=[\w-]+&per_page=10&sort=-tarih$/);
    expect(urls[1]).not.toContain("page=2");
    const p2 = firstId(t);
    expect(p2).not.toBe(p1);
    await step(() => g.page(1));
    expect(urls[2]).toBe("/api/cursor/x?per_page=10&sort=-tarih");
    expect(firstId(t)).toBe(p1);
    await step(() => g.page(2));
    expect(urls[3]).toBe(urls[1]);
    expect(firstId(t)).toBe(p2);
  });

  it("the last page reveals the count; then the pager knows the pages", async () => {
    const { g, t, step } = cursorGrid(25);
    await flush();
    await step(() => g.page(2));
    await step(() => g.page(3));
    expect(t.tBodies[0]!.rows).toHaveLength(5);
    expect(g.status()).toMatchObject({ filtered: 25, hasMore: false });
    expect(g.root.querySelector(".dg-info")!.textContent).toContain("21–25 / 25");
    await step(() => g.page(2));
    expect(g.status()).toMatchObject({ filtered: 25, hasMore: true });
    expect(g.root.querySelector<HTMLButtonElement>('[data-go="last"]')!.disabled).toBe(false);
    await step(() => g.page(3));
    expect(g.page()).toBe(3);
  });

  it("a jump past the furthest known cursor lands on it", async () => {
    const { g, urls, step } = cursorGrid(60);
    await flush();
    expect(g.root.querySelector<HTMLButtonElement>('[data-go="last"]')!.disabled).toBe(true);
    await step(() => g.page(5)); // only page 2's cursor is known
    expect(g.page()).toBe(2);
    expect(urls).toHaveLength(2);
    await step(() => g.page(3));
    await step(() => g.page(9));
    expect(g.page()).toBe(4);
  });

  it("a restored page without a cursor is served (and shown) as page 1; urlSync's re-apply lands on the furthest known page", async () => {
    const urls: string[] = [];
    const emu = createEmulator({ rows: () => cursorRows(40), latency: 0, onLog: (e) => urls.push(decodeURIComponent(e.url)) });
    const mk = (use: Parameters<Datagrid["use"]>[0][] = []) =>
      grid(mkTable(), {
        columns: [column.text("ad")],
        pageSize: 10,
        load: "manual",
        use: [serverSide({ url: "/api/cursor/x", protocol: laravelPaginator(), fetch: emu.handle as typeof fetch }), ...(use as never[])],
      });
    const g = mk();
    g.page(3); // restored before the first load
    await g.load();
    expect(urls).toEqual(["/api/cursor/x?page=3&per_page=10"]);
    expect(g.page()).toBe(1);
    expect(firstId(g.table)).toBe("1");
    expect(g.root.querySelector(".dg-info")!.textContent).toContain("1–10");

    urls.length = 0;
    history.replaceState(null, "", "/?page=3");
    const g2 = mk([urlSync()]);
    await g2.load();
    await flush();
    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain("cursor=");
    expect(g2.page()).toBe(2);
    expect(location.search).toBe("?page=2");
  });

  it("JsonResource::collection(cursorPaginate()) shape; a new query starts a new cursor map", async () => {
    const { g, t, urls, step } = cursorGrid(30, { resource: true });
    await flush();
    await step(() => g.page(2));
    expect(urls[1]).toContain("cursor=");
    expect((g.lastResponse() as { meta: { next_cursor: string } }).meta.next_cursor).toBeTruthy();
    await step(() => g.search("Kişi 2"));
    expect(urls[2]).toBe("/api/cursor/x?per_page=10&sort=-tarih&search=Ki%C5%9Fi 2".replace("%C5%9F", "ş"));
    expect(g.page()).toBe(1);
    expect(t.tBodies[0]!.rows.length).toBeGreaterThan(0);
  });

  it("protocol level: plain paginate() stays page-based; decode exposes the cursor meta", () => {
    const p = laravelPaginator();
    const q = { page: 1, pageSize: 2, sort: [], search: "", filters: {}, columns: [] };
    const r = p.decode({ data: [{ id: 1 }, { id: 2 }], path: "/x", per_page: 2, next_cursor: "abc", next_page_url: "/x?cursor=abc", prev_cursor: null, prev_page_url: null }, q);
    expect(r).toMatchObject({ total: null, filtered: null, hasMore: true, meta: { next_cursor: "abc", prev_cursor: null } });
    const q2 = { ...q, page: 2 };
    expect(p.encode({ url: "/x", method: "GET", headers: {}, query: q2, params: {} }, q2).url).toBe("/x?cursor=abc&per_page=2");
    // the endpoint went back to paginate(): page numbers again
    p.decode({ data: [], total: 0, current_page: 1, last_page: 1 }, q);
    expect(p.encode({ url: "/x", method: "GET", headers: {}, query: q2, params: {} }, q2).url).toBe("/x?page=2&per_page=2");
  });

  it("emulator: cursors are keyset based and survive Turkish sort values", async () => {
    const emu = createEmulator({ rows: () => [{ id: 1, b: "Şemsiye" }, { id: 2, b: "Işık" }, { id: 3, b: "Ağaç" }] as EmuRow[], latency: 0 });
    const r1 = await (await emu.handle("/api/cursor/x?per_page=2&sort=b")).json();
    expect(r1.data.map((r: EmuRow) => r.id)).toEqual([3, 2]);
    const r2 = await (await emu.handle(`/api/cursor/x?per_page=2&sort=b&cursor=${r1.next_cursor}`)).json();
    expect(r2.data.map((r: EmuRow) => r.id)).toEqual([1]);
    expect(r2.next_cursor).toBeNull();
    const back = await (await emu.handle(`/api/cursor/x?per_page=2&sort=b&cursor=${r2.prev_cursor}`)).json();
    expect(back.data.map((r: EmuRow) => r.id)).toEqual([3, 2]);
  });
});

/* ============================== filterPresets ============================== */

describe("presetMatches", () => {
  it("normalizes empty values, arrays, booleans and objects", () => {
    expect(presetMatches("", null)).toBe(true);
    expect(presetMatches("0", null)).toBe(true); // unchecked checkbox on the server
    expect(presetMatches([], undefined)).toBe(true);
    expect(presetMatches("acik", null)).toBe(false);
    expect(presetMatches("1", true)).toBe(true);
    expect(presetMatches("0", true)).toBe(false);
    expect(presetMatches(["b", "a"], ["a", "b"])).toBe(true);
    expect(presetMatches(["a"], ["a", "b"])).toBe(false);
    expect(presetMatches(5, "5")).toBe(true);
    expect(presetMatches({ op: "lt", value: 0 }, { op: "lt", value: 0 })).toBe(true);
    const fn = () => true;
    expect(presetMatches(fn, fn)).toBe(true);
    expect(presetMatches(() => true, fn)).toBe(false);
  });
});

const people = (): Row[] =>
  Array.from({ length: 20 }, (_, i) => ({ id: i + 1, ad: `Kişi ${i + 1}`, durum: ["acik", "tamam", "bekliyor", "taslak"][i % 4], tutar: i % 5 === 0 ? -10 : 10 }));
const presetList = [
  { id: "tumu", label: "Tümü", values: {}, default: true },
  { id: "acik", label: "Açık", values: { durum: "acik" } },
  { id: "sirada", label: "Sırada", values: { durum: ["bekliyor", "taslak"] } },
  { id: "eksi", label: "Eksi", values: { tutar: { op: "lt", value: 0 } } },
];
const chips = (g: Datagrid) => Array.from(g.root.querySelectorAll<HTMLButtonElement>(".dg-preset"));
const pressed = (g: Datagrid) => chips(g).filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.preset);
const presetsApi = (g: Datagrid) => (g as unknown as { filterPresets: FilterPresetsApi }).filterPresets;

describe("filterPresets: grid target", () => {
  it("chips with a permanent dot in a labelled group; the default is active", async () => {
    const t = mkTable();
    const g = grid(t, { columns: [column.text("ad"), column.text("durum"), column.number("tutar")], use: [arraySource(people()), filterPresets({ presets: presetList })] });
    await flush();
    const group = g.root.querySelector(".dg-presets")!;
    expect(group.getAttribute("role")).toBe("group");
    expect(document.getElementById(group.getAttribute("aria-labelledby")!)!.textContent).toBe("Hazır filtreler");
    expect(group.closest('[data-slot="filters"]')).not.toBeNull();
    expect(chips(g).map((b) => b.textContent)).toEqual(["Tümü", "Açık", "Sırada", "Eksi"]);
    expect(chips(g).every((b) => b.querySelector(".dg-preset-dot"))).toBe(true);
    expect(pressed(g)).toEqual(["tumu"]);
  });

  it("a click applies the values (clearing the other presets' keys) in one load; manual drift clears the active chip", async () => {
    const t = mkTable();
    const g = grid(t, { columns: [column.text("ad"), column.text("durum"), column.number("tutar")], use: [arraySource(people()), filterPresets({ presets: presetList })] });
    await flush();
    let loads = 0;
    g.on("load", () => loads++);
    chips(g)[2]!.click();
    expect(loads).toBe(1);
    expect(g.filters()).toEqual({ durum: ["bekliyor", "taslak"] });
    expect(pressed(g)).toEqual(["sirada"]);
    chips(g)[3]!.click();
    expect(g.filters()).toEqual({ tutar: { op: "lt", value: 0 } });
    expect(g.status().filtered).toBe(4);
    expect(presetsApi(g).active()).toBe("eksi");
    g.filters({ durum: "acik" });
    expect(pressed(g)).toEqual([]);
    expect(presetsApi(g).active()).toBeNull();
    presetsApi(g).apply("acik");
    expect(g.filters()).toEqual({ durum: "acik" });
    expect(await live(g)).toBe("Hazır filtre uygulandı: Açık");
  });

  it("server: one request with the preset values; the default rides on the first request", async () => {
    const bodies: Record<string, any>[] = [];
    const fetch = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(parsePhp(String(init?.body ?? "")));
      return new Response(JSON.stringify({ draw: 1, recordsTotal: 0, recordsFiltered: 0, data: [] }), { headers: { "content-type": "application/json" } });
    });
    const t = mkTable();
    const g = grid(t, {
      columns: [column.text("ad"), column.text("durum")],
      use: [serverSide({ url: "/x", protocol: yajra(), fetch: fetch as unknown as typeof globalThis.fetch }), filterPresets({ presets: [{ id: "a", label: "A", values: { birim: "R.P.D." }, default: true }, { id: "b", label: "B", values: {} }] })],
    });
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(bodies[0]!.birim).toBe("R.P.D.");
    chips(g)[1]!.click();
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(bodies[1]!.birim).toBeUndefined();
  });
});

describe("filterPresets: panel target", () => {
  const form = () => {
    const d = document.createElement("div");
    d.innerHTML = `<select id="p-durum"><option value="">Tümü</option><option value="acik">Açık</option><option value="bekliyor">Beklemede</option></select>
      <select id="p-birim" multiple><option>R.P.D.</option><option>Sivil</option><option>B.S.A.A.</option></select>
      <input type="checkbox" id="p-eksi">`;
    document.body.append(d);
  };
  const panelPresets = [
    { id: "tumu", label: "Tümü", values: {}, default: true },
    { id: "acik", label: "Açık", values: { durum: "acik" } },
    { id: "rpd-eksi", label: "R.P.D. eksi", values: { birim: ["R.P.D."], eksi: true } },
  ];

  it("writes the controls through filterPanel and reloads once; a manual control change clears the chip", async () => {
    form();
    const bodies: Record<string, any>[] = [];
    const fetch = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(parsePhp(String(init?.body ?? "")));
      return new Response(JSON.stringify({ draw: 1, recordsTotal: 0, recordsFiltered: 0, data: [] }), { headers: { "content-type": "application/json" } });
    });
    const t = mkTable();
    const g = grid(t, {
      columns: [column.text("ad")],
      use: [
        serverSide({ url: "/x", protocol: yajra(), fetch: fetch as unknown as typeof globalThis.fetch }),
        filterPresets({ presets: panelPresets }),
        filterPanel({ fields: { durum: "#p-durum", birim: "#p-birim", eksi: "#p-eksi" } }),
      ],
    });
    await flush();
    expect(pressed(g)).toEqual(["tumu"]);
    chips(g)[2]!.click();
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(bodies[1]).toMatchObject({ durum: "", birim: ["R.P.D."], eksi: "1" });
    expect((document.getElementById("p-eksi") as HTMLInputElement).checked).toBe(true);
    expect(pressed(g)).toEqual(["rpd-eksi"]);
    chips(g)[1]!.click();
    await flush();
    expect(bodies[2]).toMatchObject({ durum: "acik", eksi: "0" });
    expect(bodies[2]!.birim).toBeUndefined();
    const sel = document.getElementById("p-durum") as HTMLSelectElement;
    sel.value = "bekliyor";
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(pressed(g)).toEqual([]);
  });

  it("URL values win over the default (any module order) and select the matching chip", async () => {
    for (const order of ["before", "after"]) {
      document.body.innerHTML = "";
      form();
      history.replaceState(null, "", "/?f.durum=acik");
      const t = mkTable();
      const presets = filterPresets({ presets: [{ id: "bek", label: "Beklemede", values: { durum: "bekliyor" }, default: true }, ...panelPresets.slice(1)] });
      const panel = filterPanel({ fields: { durum: "#p-durum", birim: "#p-birim", eksi: "#p-eksi" } });
      const g = grid(t, { columns: [column.text("ad"), column.text("durum")], use: [arraySource(people()), panel, ...(order === "before" ? [urlSync(), presets] : [presets, urlSync()])] });
      await flush();
      expect((document.getElementById("p-durum") as HTMLSelectElement).value, order).toBe("acik");
      expect(pressed(g), order).toEqual(["acik"]);
      expect(g.status().filtered).toBe(5);
      g.destroy();
      grids.length = 0;
    }
  });

  it("stateSave restores the active preset", async () => {
    form();
    const mk = () => {
      const t = mkTable();
      return grid(t, {
        name: "fp",
        columns: [column.text("ad"), column.text("durum")],
        use: [arraySource(people()), filterPanel({ fields: { durum: "#p-durum", birim: "#p-birim", eksi: "#p-eksi" } }), filterPresets({ presets: panelPresets }), stateSave({ delay: 0 })],
      });
    };
    const g = mk();
    await flush();
    chips(g)[1]!.click();
    await new Promise((r) => setTimeout(r, 20));
    g.destroy();
    grids.length = 0;
    (document.getElementById("p-durum") as HTMLSelectElement).value = "";
    const g2 = mk();
    await flush();
    expect(pressed(g2)).toEqual(["acik"]);
    expect((document.getElementById("p-durum") as HTMLSelectElement).value).toBe("acik");
    expect(g2.status().filtered).toBe(5);
  });
});

describe("rowReorder handle host", () => {
  it("hiding and showing the first column leaves one handle per row", async () => {
    const { Datagrid, column, arraySource, rowReorder } = await import("../../src/index");
    document.body.innerHTML = "<table id='t'></table>";
    const g = new Datagrid("#t", {
      columns: [column.text("ad"), column.text("birim")],
      use: [arraySource([{ id: 1, ad: "Jill Valentine", birim: "R.P.D." }, { id: 2, ad: "Chris Redfield", birim: "R.P.D." }]), rowReorder({ onEnd() {} })],
    });
    await new Promise((r) => setTimeout(r, 0));
    g.setColumnVisible("ad", false);
    g.setColumnVisible("ad", true);
    await new Promise((r) => setTimeout(r, 0));
    for (const tr of Array.from(g.root.querySelectorAll("tbody tr"))) expect(tr.querySelectorAll(".dg-reorder").length).toBe(1);
    expect(g.root.querySelector('tbody td[data-key="birim"]')!.textContent).toBe("R.P.D.");
    g.destroy();
  });
});
