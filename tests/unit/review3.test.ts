import { describe, expect, it, vi } from "vitest";
import { Datagrid, column, arraySource, customSource, domSource } from "../../src/index";
import { createPanel } from "../../src/dom/popover";

const flush = () => new Promise((r) => setTimeout(r, 0));
const mount = (html = "<table id='t'></table>") => {
  document.body.innerHTML = html;
  return document.getElementById("t") as HTMLTableElement;
};
const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, ad: `Kişi ${i + 1}` }));

describe("core review 3", () => {
  it("destroy after virtual mode restores the table; remount keeps one colgroup", async () => {
    const t = mount();
    const before = document.body.innerHTML;
    let g = new Datagrid(t, { columns: [column.text("ad")], paging: false, use: [arraySource(many(400))] });
    await flush();
    expect(g.root.hasAttribute("data-dg-virtual")).toBe(true);
    g = g.remount();
    await flush();
    expect(t.querySelectorAll(":scope > colgroup").length).toBeLessThanOrEqual(1);
    g.destroy();
    expect(document.body.innerHTML).toBe(before);
  });

  it("an in-place edit + refreshRow and a new searchable column are found by search", async () => {
    const rows = many(3);
    const g = new Datagrid(mount(), { columns: [column.text("ad")], use: [arraySource(rows)] });
    await flush();
    g.search("kişi");
    rows[1]!.ad = "Jill Valentine";
    g.refreshRow("2");
    g.search("jill");
    expect(g.viewRows().map((r) => r.id)).toEqual([2]);
    g.search("");
    (rows[0] as Record<string, unknown>).mekan = "Raccoon City";
    g.setColumns([column.text("ad"), column.text("mekan")]);
    await flush();
    g.search("raccoon");
    expect(g.viewRows().map((r) => r.id)).toEqual([1]);
    g.destroy();
  });

  it("rows leaving a virtual page lose aria-rowindex", async () => {
    const g = new Datagrid(mount(), { columns: [column.text("ad")], paging: false, use: [arraySource(many(400))] });
    await flush();
    g.search("Kişi 39");
    await new Promise((r) => setTimeout(r, 250));
    expect(g.root.hasAttribute("data-dg-virtual")).toBe(false);
    expect(g.root.querySelector("tbody tr[aria-rowindex]")).toBeNull();
    g.destroy();
  });

  it("unknown total announces the page alone; a silent failed first load does not spin", async () => {
    const g = new Datagrid(mount(), {
      columns: [column.text("ad")],
      pageSize: 1,
      use: [customSource({ mode: "server", load: async (q) => ({ rows: [{ id: q.page, ad: "x" }], total: null as never, filtered: null as never, hasMore: true }) })],
    });
    await flush();
    g.page(3);
    await new Promise((r) => setTimeout(r, 60));
    expect(g.root.querySelector(".dg-live")!.textContent).toBe("Sayfa 3");
    g.destroy();
    const g2 = new Datagrid(mount(), { columns: [column.text("ad")], errorMode: "silent", use: [customSource({ mode: "server", load: async () => { throw { kind: "http", status: 500, message: "x", retryable: true }; } })] });
    await flush();
    await flush();
    expect(g2.root.querySelector(".dg-state[data-kind=loading]")).toBeNull();
    g2.destroy();
  });

  it("a confirm open while the grid is destroyed answers false", async () => {
    const g = new Datagrid(mount(), { columns: [column.text("ad")], use: [arraySource(many(2))] });
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.open = true; };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.open = false; };
    const p = g.confirm("Silinsin mi?");
    g.destroy();
    await expect(p).resolves.toBe(false);
  });

  it("re-anchoring an open panel clears the old trigger's aria-expanded", () => {
    document.body.innerHTML = "<div id='h'></div><button id='a'></button><button id='b'></button>";
    const panel = createPanel(document.getElementById("h")!, { role: "dialog" });
    const a = document.getElementById("a")!;
    const b = document.getElementById("b")!;
    panel.show(a);
    panel.show(b);
    panel.hide(false);
    expect(a.getAttribute("aria-expanded")).toBe("false");
    expect(b.getAttribute("aria-expanded")).toBe("false");
  });

  it("pager box shows the page actually open; addRows is ignored in server mode; get() works from the toolbar", async () => {
    const g = new Datagrid(mount(), { columns: [column.text("ad")], pageSize: 1, use: [arraySource(many(3))] });
    await flush();
    g.page(3);
    const input = g.root.querySelector<HTMLInputElement>(".dg-pager-input")!;
    input.value = "99";
    input.dispatchEvent(new Event("change"));
    expect(g.root.querySelector<HTMLInputElement>(".dg-pager-input")!.value).toBe("3");
    expect(Datagrid.get(g.root.querySelector(".dg-search-input"))).toBe(g);
    g.destroy();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const s = new Datagrid(mount(), { columns: [column.text("ad")], use: [customSource({ mode: "server", load: async () => ({ rows: many(2), total: 9, filtered: 9 }) })] });
    await flush();
    s.addRows([{ id: 99, ad: "x" }]);
    expect(s.status().filtered).toBe(9);
    s.destroy();
    spy.mockRestore();
  });

  it("DOM headers with the same title become two columns", async () => {
    const t = mount("<table id='t'><thead><tr><th>Tutar</th><th>Tutar</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>");
    const g = new Datagrid(t, { use: [domSource()] });
    await flush();
    expect(new Set(g.columns().map((c) => c.key)).size).toBe(2);
    g.destroy();
  });
});

describe("filter announcements", () => {
  it("a filter change announces the new result count", async () => {
    const g = new Datagrid(mount(), { columns: [column.text("ad")], use: [arraySource(many(5))] });
    await flush();
    g.filters({ ad: "Kişi 2" });
    await new Promise((r) => setTimeout(r, 60));
    expect(g.root.querySelector(".dg-live")!.textContent).toMatch(/1/);
    g.destroy();
  });
});
