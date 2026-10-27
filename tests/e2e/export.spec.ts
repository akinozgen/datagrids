import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { ready, axe } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/#export");
  await ready(page, "export");
});

const trigger = '#export .dg-btn[aria-haspopup="menu"]';

test("menu opens into the first item, arrows move, Escape returns focus", async ({ page }) => {
  const btn = page.locator(trigger);
  await expect(btn).toHaveText(/Dışa aktar/);
  await btn.click();
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  const menu = page.locator('#export .dg-panel[role="menu"]');
  await expect(menu).toBeVisible();
  const items = menu.locator('[role="menuitem"]');
  await expect(items).toHaveText(["Excel (.xlsx)", "CSV", "Yazdır"]);
  await expect(items.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(items.nth(2)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(btn).toBeFocused();
  await expect(btn).toHaveAttribute("aria-expanded", "false");
  // keyboard opening: ArrowUp lands on the last item
  await page.keyboard.press("ArrowUp");
  await expect(items.nth(2)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
});

test("Excel download: .xlsx with real numbers", async ({ page }) => {
  await page.locator(trigger).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('#export [role="menuitem"][data-export="excel"]').click()]);
  expect(dl.suggestedFilename()).toMatch(/^gorevler-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const buf = readFileSync((await dl.path())!);
  expect(buf.length).toBeGreaterThan(1000);
  expect(buf.readUInt32LE(0)).toBe(0x04034b50); // zip
  await expect(page.locator("#export .dg-live")).toHaveText("40 kayıt dışa aktarıldı");
});

test("CSV download: BOM, header, TR money, formula guard, clean HTML", async ({ page }) => {
  await page.locator(trigger).click();
  const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('#export [role="menuitem"][data-export="csv"]').click()]);
  expect(dl.suggestedFilename()).toMatch(/^export-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = readFileSync((await dl.path())!, "utf8");
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const lines = text.slice(1).trim().split("\r\n");
  expect(lines[0]).toBe("Kayıt;Personel;Birim;Görev;Durum;Tutar;Tarih;Not");
  expect(lines.length).toBe(41); // client mode: every filtered row, not just the page
  expect(text).toMatch(/;-?\d+,\d{2};\d{2}\.\d{2}\.2026 \d{2}:\d{2};/);
  expect(text).toContain(`"<Şemsiye A.Ş.> & ""İç"""`);
  expect(text).toContain(";'+ Kırmızı Ot karışımı;");
  expect(text).toContain(";'=Yeşil Ot stok;");
  expect(text).toContain(";Acil teslim\r\n");
  expect(text).toContain(";Şemsiye A.Ş. & ortakları\r\n");
  expect(text).not.toMatch(/ekran okuyucu|Düzenle|ayrıntı/);
});

test("print builds a plain-text iframe document (dialog stubbed)", async ({ page }) => {
  await page.evaluate(() => window.grids.export!.on("beforePrint", (d: { cancel(): void }) => d.cancel()));
  await page.locator(trigger).click();
  await page.locator('#export [role="menuitem"][data-export="print"]').click();
  const frame = page.frameLocator('iframe[data-dg-print="export"]');
  await expect(frame.locator("h1")).toHaveText("Görev listesi");
  await expect(frame.locator("tbody tr")).toHaveCount(40);
  await expect(frame.locator("thead th")).toHaveText(["Kayıt", "Personel", "Birim", "Görev", "Durum", "Tutar", "Tarih", "Not"]);
  await expect(frame.locator("tbody td.n").first()).toHaveText(/^-?[\d.]+,\d{2} ₺$/);
  expect(await frame.locator("body b, body span, body ul, body a, link").count()).toBe(0);
  // second print replaces the frame
  await page.locator(trigger).click();
  await page.locator('#export [role="menuitem"][data-export="print"]').click();
  await expect(page.locator("iframe[data-dg-print]")).toHaveCount(1);
});

test("axe: grid and open menu", async ({ page }) => {
  await axe(page, "#export .dg");
  await page.locator(trigger).click();
  await expect(page.locator('#export .dg-panel[role="menu"]')).toBeVisible();
  await axe(page, "#export .dg");
});

test.describe("narrow grid", () => {
  test.use({ viewport: { width: 420, height: 800 } });
  test("icon-only trigger keeps its name; menu passes axe", async ({ page }) => {
    const btn = page.locator(trigger);
    await expect(btn).toHaveAccessibleName("Dışa aktar");
    await btn.click();
    await expect(page.locator('#export .dg-panel[role="menu"]')).toBeVisible();
    await axe(page, "#export .dg");
  });
});
