import { resolve } from "node:path";
import { test, expect } from "@playwright/test";

const entry = `/@fs${resolve("src/index.ts")}`;

test("a bulk action returning a bare thenable keeps working after it settles", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(async (src) => {
    document.documentElement.lang = "tr";
    const lib = await import(src);
    document.body.innerHTML = "<main style='padding:16px;max-width:760px'><table id='th'></table></main>";
    const w = window as unknown as { calls: number; settle: () => void };
    w.calls = 0;
    new lib.Datagrid("#th", {
      label: "Toplu",
      columns: [lib.column.select(), lib.column.text("ad", { title: "Ad" })],
      use: [
        lib.arraySource([{ id: 1, ad: "Jill Valentine" }, { id: 2, ad: "Chris Redfield" }]),
        // a confirm dialog library's promise: `then` only
        lib.selection({ bulk: { actions: [{ id: "sil", label: "Sil", icon: "trash", onClick: () => { w.calls++; return { then: (ok: () => void) => void (w.settle = ok) }; } }] } }),
      ],
    });
  }, entry);
  const grid = page.locator(".dg");
  await grid.locator("tbody tr").first().locator(".dg-check-input").check({ force: true });
  const btn = grid.locator('.dg-bulk-actions [data-action="sil"]');
  await btn.click();
  await expect(btn).toHaveAttribute("aria-busy", "true");
  await page.evaluate(() => (window as unknown as { settle: () => void }).settle());
  await expect(btn).not.toHaveAttribute("aria-busy", "true");
  await btn.click();
  expect(await page.evaluate(() => (window as unknown as { calls: number }).calls)).toBe(2);
  expect(errors).toEqual([]);
  if (process.env.DG_SHOT) await page.locator("main").screenshot({ path: process.env.DG_SHOT });
});
