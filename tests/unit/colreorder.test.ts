import { describe, expect, it } from "vitest";
import { Datagrid, column, arraySource, domSource, customSource } from "../../src/index";
import { colReorder, type ColReorderApi } from "../../src/modules/col-reorder";
import { stateSave } from "../../src/modules/state-save";
import type { Query, Row } from "../../src/index";

const flush = () => new Promise((r) => setTimeout(r, 0));
const mount = (html = "<table id='t'></table>") => {
  document.body.innerHTML = html;
  return document.getElementById("t") as HTMLTableElement;
};
const rows: Row[] = [
  { id: 1, ad: "Jill Valentine", birim: "S.T.A.R.S. Alfa", tutar: 10 },
  { id: 2, ad: "Chris Redfield", birim: "S.T.A.R.S. Alfa", tutar: 20 },
];
const keys = (tr: Element | null | undefined) => Array.from(tr?.children ?? []).map((c) => c.getAttribute("data-key"));

describe("core column order", () => {
  it("special and sticky columns keep their slots; unknown keys are ignored, missing ones appended", async () => {
    const t = mount();
    const g = new Datagrid(t, {
      columns: [column.select(), column.text("ad"), column.text("birim"), column.number("tutar"), column.actions()],
      use: [arraySource(rows)],
    });
    await flush();
    expect(g.columnOrder(["tutar", "nope", "ad"])).toEqual(["__select", "tutar", "ad", "birim", "__actions"]);
    expect(keys(t.tHead!.rows[0])).toEqual(["__select", "tutar", "ad", "birim", "__actions"]);
    expect(keys(t.tBodies[0]!.rows[0])).toEqual(["__select", "tutar", "ad", "birim", "__actions"]);
    expect(g.columns().map((c) => c.key)).toEqual(["__select", "tutar", "ad", "birim", "__actions"]);
    // back to the definition order
    expect(g.columnOrder([])).toEqual(["__select", "ad", "birim", "tutar", "__actions"]);
    g.destroy();
  });

  it("the request keeps the definition order and indexes", async () => {
    const seen: Query[] = [];
    const t = mount();
    const g = new Datagrid(t, {
      columns: [column.text("ad"), column.text("birim"), column.number("tutar")],
      sort: [["tutar", "asc"]],
      use: [customSource({ mode: "server", load: async (q) => (seen.push(q), { rows, total: 2, filtered: 2 }) })],
    });
    await flush();
    g.columnOrder(["tutar", "ad", "birim"]);
    await g.reload();
    const q = seen.at(-1)!;
    expect(q.columns.map((c) => c.key)).toEqual(["ad", "birim", "tutar"]);
    expect(q.columns.find((c) => c.key === "tutar")!.index).toBe(2);
    g.destroy();
  });

  it("DOM source: host cells are moved and destroy restores the original markup exactly", async () => {
    const html = "<table id='t'><thead><tr><th>Ad</th><th>Birim</th><th>Tutar</th></tr></thead><tbody>" +
      "<tr><td>Jill Valentine</td><td>S.T.A.R.S. Alfa</td><td>10</td></tr><tr><td>Chris Redfield</td><td>S.T.A.R.S. Alfa</td><td>20</td></tr></tbody></table>";
    const t = mount(html);
    const before = document.body.innerHTML;
    const g = new Datagrid(t, { columns: [column.text("ad"), column.text("birim"), column.number("tutar")], use: [domSource()] });
    await flush();
    g.columnOrder(["tutar", "ad"]);
    expect(Array.from(t.tBodies[0]!.rows[0]!.cells).map((c) => c.textContent)).toEqual(["10", "Jill Valentine", "S.T.A.R.S. Alfa"]);
    // a re-render after the move maps cells by their original position
    g.sort([["ad", "asc"]]);
    await flush();
    expect(Array.from(t.tBodies[0]!.rows[0]!.cells).map((c) => c.textContent)).toEqual(["20", "Chris Redfield", "S.T.A.R.S. Alfa"]);
    g.destroy();
    expect(document.body.innerHTML).toBe(before);
  });

  it("setColumns keeps the order of the columns that still exist", async () => {
    const t = mount();
    const g = new Datagrid(t, { columns: [column.text("ad"), column.text("birim"), column.number("tutar")], use: [arraySource(rows)] });
    await flush();
    g.columnOrder(["tutar", "birim", "ad"]);
    g.setColumns([column.text("ad"), column.number("tutar"), column.text("yeni")]);
    expect(g.columnOrder()).toEqual(["tutar", "ad", "yeni"]);
    g.destroy();
  });
});

describe("colReorder module", () => {
  it("move() announces, reset() restores; the order goes through stateSave", async () => {
    localStorage.clear();
    const t = mount();
    const g = new Datagrid(t, {
      name: "cr",
      columns: [column.index(), column.text("ad", { title: "Ad" }), column.text("birim", { title: "Birim" }), column.number("tutar", { title: "Tutar" })],
      use: [arraySource(rows), colReorder(), stateSave({ delay: 0 })],
    });
    await flush();
    const api = (g as unknown as { colReorder: ColReorderApi }).colReorder;
    expect(t.tHead!.querySelectorAll("th[data-dg-movable] .dg-col-grip").length).toBe(3);
    api.move("tutar", 0);
    expect(api.order()).toEqual(["__index", "tutar", "ad", "birim"]);
    await new Promise((r) => setTimeout(r, 40));
    expect(g.root.querySelector(".dg-live")!.textContent).toContain("Tutar kolonu 1. sıraya taşındı");
    await new Promise((r) => setTimeout(r, 10));
    const saved = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes(":cr:"))!)!);
    expect(saved.modules.colReorder).toEqual(["tutar", "ad", "birim"]);
    g.destroy();
    expect(t.querySelector(".dg-col-grip")).toBeNull();

    // a new grid restores the saved order before the first render
    const g2 = new Datagrid(mount(), {
      name: "cr",
      columns: [column.index(), column.text("ad", { title: "Ad" }), column.text("birim", { title: "Birim" }), column.number("tutar", { title: "Tutar" })],
      use: [arraySource(rows), colReorder(), stateSave({ delay: 0 })],
    });
    await flush();
    const api2 = (g2 as unknown as { colReorder: ColReorderApi }).colReorder;
    expect(api2.order()).toEqual(["__index", "tutar", "ad", "birim"]);
    api2.reset();
    expect(api2.order()).toEqual(["__index", "ad", "birim", "tutar"]);
    g2.destroy();
  });
});
