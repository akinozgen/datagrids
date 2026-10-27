import { describe, expect, it } from "vitest";
import { Datagrid, column, arraySource } from "../../src/index";
import { stickyHeader, type StickyHeaderApi } from "../../src/modules/sticky-header";

describe("stickyHeader", () => {
  it("mounts a hidden aria-hidden bar, never shows it in maxHeight mode, and cleans up", async () => {
    document.body.innerHTML = "<table id='t'></table>";
    const g = new Datagrid("#t", { columns: [column.text("ad")], maxHeight: "300px", use: [arraySource([{ id: 1, ad: "Ada Wong" }]), stickyHeader({ offset: () => 56 })] });
    await new Promise((r) => setTimeout(r, 0));
    const bar = g.root.querySelector<HTMLElement>(".dg-sticky-bar")!;
    expect(bar.hidden).toBe(true);
    expect(bar.getAttribute("aria-hidden")).toBe("true");
    const api = (g as unknown as { stickyHeader: StickyHeaderApi }).stickyHeader;
    api.refresh();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    expect(api.stuck()).toBe(false);
    g.destroy();
    expect(document.querySelector(".dg-sticky-bar")).toBeNull();
  });
});
