import { resolve } from "node:path";
import { test, expect, type Page } from "@playwright/test";

const entry = `/@fs${resolve("src/index.ts")}`;

// a grid with most chrome on: every control that used to carry a native title
async function mount(page: Page) {
  await page.goto("/");
  await page.evaluate(async (src) => {
    document.documentElement.lang = "tr";
    const lib = await import(src);
    document.body.innerHTML = "<main style='padding:80px 16px 16px;max-width:900px'><table id='tip'></table></main>";
    const rows = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, sira: i + 1, ad: `Kişi ${i + 1}`, tel: "05321234567", tutar: i * 10 }));
    const g = new lib.Datagrid("#tip", {
      label: "İpucu",
      pageSize: 10,
      columns: [lib.column.select(), lib.reorderColumn(), lib.column.text("ad"), lib.column.phone("tel", { whatsapp: true }), lib.column.money("tutar"), lib.column.actions()],
      use: [
        lib.arraySource(rows),
        lib.selection({ actions: [{ id: "sil", label: "Sil", icon: "trash", onClick: () => {} }] }),
        lib.actions({ items: [{ id: "duzenle", label: "Düzenle", icon: "edit", onClick: () => {} }, { id: "sil", label: "Sil", onClick: () => {} }] }),
        lib.rowReorder({ orderKey: "sira", onEnd: () => {} }),
        lib.colVis(), lib.colReorder(), lib.multiSort(), lib.columnFilters(), lib.stateSave({ key: "tip" }), lib.button.reload(), lib.button.resetState(), lib.excel(),
      ],
    });
    (window as unknown as { g: unknown }).g = g;
  }, entry);
  await expect(page.locator(".dg tbody tr")).toHaveCount(10);
}

const tip = (page: Page) => page.locator(".dg-tip");

test("grid controls carry no native title; their tooltip is data-dg-tip", async ({ page }) => {
  await mount(page);
  await page.locator(".dg tbody tr").first().locator(".dg-check-input").check({ force: true });
  expect(await page.locator(".dg [title]").evaluateAll((els) => els.map((e) => e.outerHTML.slice(0, 80)))).toEqual([]);
  expect(await page.locator(".dg [data-dg-tip]").count()).toBeGreaterThan(10);
});

test("pager tooltip: shows on hover, goes on click and never piles up across re-renders", async ({ page }) => {
  await mount(page);
  const next = page.locator('.dg-pager-btn[data-go="next"]');
  await next.hover();
  await expect(tip(page)).toBeVisible();
  await expect(tip(page)).toHaveText("Sonraki sayfa");
  await expect(tip(page)).toHaveCount(1);
  await next.click();
  await expect(page.locator(".dg-info")).toContainText("11–20");
  await page.mouse.move(5, 5);
  await expect(tip(page)).toBeHidden();
  // the button turns disabled under the pointer
  const last = page.locator('.dg-pager-btn[data-go="last"]');
  await last.hover();
  await expect(tip(page)).toHaveText("Son sayfa");
  await last.click();
  await expect(last).toBeDisabled();
  await page.mouse.move(5, 5);
  await expect(tip(page)).toBeHidden();
  await expect(tip(page)).toHaveCount(1);
  // re-rendered controls come back without a title a page-wide [title] plugin could take over
  expect(await page.locator(".dg [title]").count()).toBe(0);
});

test("keyboard focus shows the tooltip at once; Escape and blur hide it", async ({ page }) => {
  await mount(page);
  await page.locator('.dg-pager-btn[data-go="next"]').focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(tip(page)).toBeVisible();
  await expect(tip(page)).toHaveText("Sonraki sayfa");
  await page.keyboard.press("Enter");
  await expect(page.locator(".dg-info")).toContainText("11–20");
  await expect(tip(page)).toHaveText("Sonraki sayfa");
  await page.keyboard.press("Escape");
  await expect(tip(page)).toBeHidden();
  await page.keyboard.press("Tab");
  await expect(tip(page)).toHaveText("Son sayfa");
  await page.locator("main").click({ position: { x: 5, y: 5 } });
  await expect(tip(page)).toBeHidden();
});
