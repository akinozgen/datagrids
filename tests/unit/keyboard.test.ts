import { describe, expect, it } from "vitest";
import { Datagrid, column, arraySource } from "../../src/index";
import { keyboardGrid, type KeyboardGridApi } from "../../src/modules/keyboard-grid";

const flush = () => new Promise((r) => setTimeout(r, 0));
const key = (el: Element, k: string, o: KeyboardEventInit = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, ...o }));

describe("keyboardGrid", () => {
  it("roving tab stop, arrow moves, Ctrl+End; destroy restores the table", async () => {
    document.body.innerHTML = "<table id='t'></table>";
    const t = document.getElementById("t") as HTMLTableElement;
    const g = new Datagrid(t, {
      columns: [column.text("ad", { title: "Ad" }), column.text("birim", { title: "Birim", sortable: false }), column.link("eposta", { title: "E-posta", href: "mailto:{eposta}" })],
      use: [arraySource([
        { id: 1, ad: "Jill Valentine", birim: "S.T.A.R.S. Alfa", eposta: "jill@rpd.example" },
        { id: 2, ad: "Chris Redfield", birim: "S.T.A.R.S. Alfa", eposta: "chris@rpd.example" },
      ]), keyboardGrid()],
    });
    await flush();
    const api = (g as unknown as { keyboardGrid: KeyboardGridApi }).keyboardGrid;
    expect(t.getAttribute("role")).toBe("grid");
    const stops = () => Array.from(t.querySelectorAll<HTMLElement>("[tabindex='0']"));
    expect(stops().map((e) => e.className)).toEqual(["dg-sort"]);
    // every other widget is out of the tab order
    expect(Array.from(t.querySelectorAll<HTMLElement>("button, a")).filter((e) => e.tabIndex === 0).length).toBe(1);
    stops()[0]!.focus();
    key(document.activeElement!, "ArrowDown");
    expect(api.position()).toEqual({ row: 1, col: 0 });
    expect(document.activeElement!.tagName).toBe("TD");
    key(document.activeElement!, "End", { ctrlKey: true });
    expect(api.position()).toEqual({ row: 2, col: 2 });
    expect(document.activeElement!.tagName).toBe("A");
    expect(stops()).toEqual([document.activeElement]);
    g.destroy();
    expect(t.hasAttribute("role")).toBe(false);
    expect(t.querySelector("[tabindex]")).toBeNull();
  });
});
