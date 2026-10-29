import { resolve } from "node:path";
import { test, expect } from "@playwright/test";

const entry = `/@fs${resolve("src/index.ts")}`;

test("'all matching' carries the filters a yajra `data` function added to the wire", async ({ page }) => {
  await page.route("**/liste*", async (r) => {
    const b = new URLSearchParams(r.request().postData() ?? "");
    const start = Number(b.get("start"));
    const data = Array.from({ length: 5 }, (_, i) => ({ id: start + i + 1, ad: `Kişi ${start + i + 1}` }));
    await r.fulfill({ contentType: "application/json", body: JSON.stringify({ draw: Number(b.get("draw")), recordsTotal: 40, recordsFiltered: 40, data }) });
  });
  await page.goto("/");
  await page.evaluate(async (src) => {
    document.documentElement.lang = "tr";
    const lib = await import(src);
    document.body.innerHTML = "<main style='padding:16px;max-width:760px'><table id='rp'></table></main>";
    const w = window as unknown as { payload: unknown };
    new lib.Datagrid("#rp", {
      label: "Liste",
      pageSize: 5,
      columns: [lib.column.select(), lib.column.text("ad", { title: "Ad" })],
      use: [
        lib.serverSide({ url: "/liste", protocol: lib.yajra({ data: (d: Record<string, unknown>) => void (d.f_bayi = "7") }) }),
        lib.selection({ bulk: { actions: [{ id: "sms", label: "SMS", icon: "send", onClick: (p: unknown) => void (w.payload = p) }] } }),
      ],
    });
  }, entry);
  const grid = page.locator(".dg");
  await expect(grid.locator("tbody tr")).toHaveCount(5);
  await grid.locator("thead .dg-check-input").check({ force: true });
  await grid.getByRole("button", { name: /Filtre sonucunun tümünü seç/ }).click();
  await grid.locator('.dg-bulk-actions [data-action="sms"]').click();
  const p = (await page.evaluate(() => (window as unknown as { payload: { all: boolean; query: { params: unknown } } }).payload));
  expect(p.all).toBe(true);
  expect(p.query.params).toEqual({ f_bayi: "7" });
  if (process.env.DG_SHOT) await page.locator("main").screenshot({ path: process.env.DG_SHOT });
});
