import { resolve } from "node:path";
import { test, expect } from "@playwright/test";

const entry = `/@fs${resolve("src/index.ts")}`;

test("a row action answered with 200 { status: false } is an error under an isError rule: banner, no success, no reload", async ({ page }) => {
  let calls = 0;
  await page.route("**/grup/*", (r) => {
    calls++;
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: false, error: "Grup kullanımda, silinemez." }) });
  });
  await page.goto("/");
  await page.evaluate(async (src) => {
    document.documentElement.lang = "tr";
    const lib = await import(src);
    lib.configure({ isError: (b: { status?: unknown; error?: string }) => b?.status === false && (b.error ?? true) });
    document.body.innerHTML = "<main style='padding:16px;max-width:760px'><table id='ae'></table></main>";
    const g = new lib.Datagrid("#ae", {
      label: "Gruplar",
      columns: [lib.column.text("ad", { title: "Grup" }), lib.column.actions()],
      use: [
        lib.arraySource([{ id: 1, ad: "S.T.A.R.S. Alpha" }, { id: 2, ad: "S.T.A.R.S. Bravo" }]),
        lib.actions({ items: [{ id: "sil", label: "Sil", tone: "danger", request: { url: "/grup/{id}", method: "DELETE" } }] }),
      ],
    });
    (window as unknown as { loads: number }).loads = 0;
    g.on("load", () => (window as unknown as { loads: number }).loads++);
  }, entry);
  const grid = page.locator(".dg");
  await expect(grid.locator("tbody tr")).toHaveCount(2);
  await page.evaluate(() => ((window as unknown as { loads: number }).loads = 0));
  await grid.locator("tbody tr").first().getByRole("button", { name: /Sil/ }).click();
  await expect(grid.locator(".dg-banner")).toContainText("Grup kullanımda, silinemez.");
  await expect(grid.locator(".dg-live")).toHaveText("Grup kullanımda, silinemez.");
  expect(calls).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { loads: number }).loads)).toBe(0);
  if (process.env.DG_SHOT) await page.locator("main").screenshot({ path: process.env.DG_SHOT });
});
