import { resolve } from "node:path";
import { test, expect } from "@playwright/test";

const entry = `/@fs${resolve("src/index.ts")}`;

test("an invalid <html lang> does not stop the grid: it falls back to the browser language and warns", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (m) => m.type() === "warning" && warnings.push(m.text()));
  await page.goto("/");
  await page.evaluate(async (src) => {
    document.documentElement.lang = "1";
    const lib = await import(src);
    document.body.innerHTML = "<main style='padding:16px;max-width:640px'><table id='loc'></table></main>";
    new lib.Datagrid("#loc", {
      label: "Locale",
      columns: [lib.column.text("ad", { title: "Name" }), lib.column.money("tutar", { title: "Amount" }), lib.column.date("tarih", { title: "Date" })],
      use: [lib.arraySource([{ id: 1, ad: "Jill Valentine", tutar: 1234.5, tarih: "1998-07-24" }, { id: 2, ad: "Chris Redfield", tutar: -40, tarih: "1998-07-25" }])],
    });
  }, entry);
  const root = page.locator(".dg");
  await expect(root.locator("tbody tr")).toHaveCount(2);
  await expect(root.locator("tbody tr").first().locator("td").nth(1)).toContainText("1,234.50");
  await expect(root.locator(".dg-info")).toContainText("1–2");
  expect(warnings.some((w) => w.includes("DG015"))).toBe(true);
  if (process.env.DG_SHOT) await page.locator("main").screenshot({ path: process.env.DG_SHOT });
});
