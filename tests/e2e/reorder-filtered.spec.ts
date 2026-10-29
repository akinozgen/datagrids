import { resolve } from "node:path";
import { test, expect } from "@playwright/test";

const entry = `/@fs${resolve("src/index.ts")}`;

test("rowReorder handles turn off with a visible reason while the search hides rows", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async (src) => {
    document.documentElement.lang = "tr";
    const lib = await import(src);
    document.body.innerHTML = "<main style='padding:56px 16px 16px;max-width:760px'><table id='rf'></table></main>";
    const crew = ["Jill Valentine", "Chris Redfield", "Leon S. Kennedy", "Claire Redfield"].map((ad, i) => ({ id: i + 1, sira: i + 1, ad }));
    new lib.Datagrid("#rf", {
      label: "Sıra",
      sort: [["sira", "asc"]],
      columns: [lib.reorderColumn(), lib.column.number("sira", { title: "Sıra" }), lib.column.text("ad", { title: "Ad" })],
      use: [lib.arraySource(crew), lib.rowReorder({ orderKey: "sira", onEnd: () => {} })],
    });
  }, entry);
  const grid = page.locator(".dg");
  const first = () => grid.locator("tbody tr").first().locator(".dg-reorder");
  await expect(first()).not.toHaveAttribute("aria-disabled", "true");
  await grid.getByRole("searchbox").fill("Redfield");
  await expect(grid.locator("tbody tr")).toHaveCount(2);
  await expect(first()).toHaveAttribute("aria-disabled", "true");
  await expect(first()).toHaveAccessibleDescription("Taşımak için aramayı ve filtreleri temizleyin");
  await expect(first()).toHaveCSS("cursor", "not-allowed");
  await first().hover();
  await expect(page.locator(".dg-tip")).toHaveText("Taşımak için aramayı ve filtreleri temizleyin");
  if (process.env.DG_SHOT) await page.locator("main").screenshot({ path: process.env.DG_SHOT });
  await grid.getByRole("searchbox").fill("");
  await expect(grid.locator("tbody tr")).toHaveCount(4);
  await expect(first()).not.toHaveAttribute("aria-disabled", "true");
});
