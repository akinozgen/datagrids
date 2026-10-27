import { describe, expect, it } from "vitest";
import { Datagrid, column, arraySource } from "../../src/index";
import { responsive, type ResponsiveApi } from "../../src/modules/responsive";
import type { Row } from "../../src/index";

const flush = () => new Promise((r) => setTimeout(r, 0));
const rows: Row[] = [
  { id: 1, kayit: "RPD-1", ad: "Jill Valentine", birim: "S.T.A.R.S. Alfa", tutar: 10, mekan: "Spencer Malikanesi" },
  { id: 2, kayit: "RPD-2", ad: "Chris Redfield", birim: "S.T.A.R.S. Alfa", tutar: 20, mekan: "Raccoon City" },
];

/** jsdom has no layout: each shown column is 100px wide, the frame 350px. */
function fakeLayout(t: HTMLTableElement) {
  const frame = t.closest(".dg-scroll") as HTMLElement;
  Object.defineProperty(frame, "clientWidth", { configurable: true, get: () => 350 });
  Object.defineProperty(frame, "scrollWidth", {
    configurable: true,
    get: () => t.querySelectorAll("thead th:not([data-dg-collapsed]):not([hidden])").length * 100,
  });
}

describe("responsive", () => {
  it("collapses by priority, adds expand buttons and detail rows, cleans up on destroy", async () => {
    document.body.innerHTML = "<table id='t'></table>";
    const t = document.getElementById("t") as HTMLTableElement;
    const g = new Datagrid(t, {
      columns: [column.text("kayit", { title: "Kayıt" }), column.text("ad", { title: "Personel" }), column.text("birim", { title: "Birim" }), column.number("tutar", { title: "Tutar" }), column.text("mekan", { title: "Mekân" })],
      use: [arraySource(rows), responsive({ priority: { tutar: 1 } })],
    });
    fakeLayout(t);
    const seen: string[][] = [];
    g.on("collapse" as never, ((d: { columns: string[] }) => seen.push(d.columns)) as never);
    await flush();
    const api = (g as unknown as { responsive: ResponsiveApi }).responsive;
    api.refit();
    // 5 columns → 3 fit: the last defined go first, tutar (priority 1) stays
    expect(api.collapsed()).toEqual(["mekan", "birim"]);
    expect(seen.at(-1)).toEqual(["mekan", "birim"]);
    expect(t.querySelectorAll("tbody td[data-dg-collapsed]").length).toBe(4);
    const btn = t.querySelector<HTMLButtonElement>("tbody tr td[data-key=kayit] > .dg-expand")!;
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    btn.click();
    const detail = t.querySelector("tbody tr.dg-detail-row")!;
    expect(detail.getAttribute("data-detail-for")).toBe("1");
    expect(Array.from(detail.querySelectorAll("dt")).map((d) => d.textContent)).toEqual(["Birim", "Mekân"]);
    expect(detail.querySelector("td")!.id).toBe(btn.getAttribute("aria-controls"));
    expect(detail.querySelector("td")!.colSpan).toBe(3);
    // a re-render keeps the open detail
    g.sort([["ad", "asc"]]);
    await flush();
    expect(t.querySelector("tbody tr.dg-detail-row")!.previousElementSibling!.getAttribute("data-key")).toBe("1");
    g.destroy();
    expect(t.querySelector(".dg-expand, .dg-detail-row, [data-dg-collapsed]")).toBeNull();
  });
});

describe("responsive + virtual", () => {
  it("a page turning virtual brings collapsed columns back and drops the expand buttons", async () => {
    document.body.innerHTML = "<table id='t'></table>";
    const t = document.getElementById("t") as HTMLTableElement;
    const rows = Array.from({ length: 400 }, (_, i) => ({ id: i + 1, kayit: `K${i}`, ad: "Jill Valentine", birim: "R.P.D.", tutar: i, mekan: "NEST" }));
    const g = new Datagrid(t, {
      columns: [column.text("kayit"), column.text("ad"), column.text("birim"), column.number("tutar"), column.text("mekan")],
      pageSize: 10,
      pageSizes: [10, 400],
      use: [arraySource(rows), responsive()],
    });
    fakeLayout(t);
    await flush();
    const api = (g as unknown as { responsive: ResponsiveApi }).responsive;
    api.refit();
    expect(api.collapsed().length).toBeGreaterThan(0);
    g.pageSize(400);
    await flush();
    expect(g.root.hasAttribute("data-dg-virtual")).toBe(true);
    expect(api.collapsed()).toEqual([]);
    expect(t.querySelector("[data-dg-collapsed], .dg-expand")).toBeNull();
    g.destroy();
  });
});
