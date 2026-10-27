import { test, expect } from "@playwright/test";
import { ready, axe } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page, "kolon-filtresi");
});

test("client: money ≥ filter, badge in-list, chips, clear", async ({ page }) => {
  const s = page.locator("#kolon-filtresi");
  const btn = s.locator('th[data-key="tutar"] .dg-colfilter');
  await expect(btn).toHaveAttribute("aria-label", "Filtre: Tutar");
  await btn.click();
  await expect(s.locator(".dg-colfilter-panel")).toBeVisible();
  await s.locator(".dg-cf-op").selectOption("gte");
  await s.locator(".dg-cf-input").fill("15.000");
  await s.getByRole("button", { name: "Uygula" }).click();
  await expect(btn).toHaveAttribute("data-active", "");
  await expect(btn).toBeFocused();
  await expect(s.locator(".dg-filter-chip")).toContainText("Tutar ≥ 15.000");
  const amounts = await s.locator('tbody td[data-key="tutar"]').allInnerTexts();
  for (const a of amounts) expect(Number(a.replace(/[^\d,]/g, "").replace(",", "."))).toBeGreaterThanOrEqual(15000);
  await s.locator('th[data-key="durum"] .dg-colfilter').click();
  await s.locator(".dg-cf-list label", { hasText: "Taslak" }).click();
  await s.getByRole("button", { name: "Uygula" }).click();
  for (const t of await s.locator('tbody td[data-key="durum"]').allInnerTexts()) expect(t).toBe("Taslak");
  await s.getByRole("button", { name: "Filtreleri temizle" }).click();
  await expect(s.locator(".dg-filter-chip")).toHaveCount(0);
  await expect(s.locator(".dg-info")).toHaveText("1–10 / 240 kayıt");
});

test("client: Esc closes the panel and returns focus", async ({ page }) => {
  const s = page.locator("#kolon-filtresi");
  const btn = s.locator('th[data-key="ad"] .dg-colfilter');
  await btn.click();
  await expect(s.locator(".dg-cf-input")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(s.locator(".dg-colfilter-panel")).toBeHidden();
  await expect(btn).toBeFocused();
});

test("server: yajra receives ColumnControl params and filters", async ({ page }) => {
  const s = page.locator("#kolon-filtresi-sunucu");
  await ready(page, "kolon-filtresi-sunucu");
  await s.locator('th[data-key="birim"] .dg-colfilter').click();
  await s.locator(".dg-cf-input").fill("bravo");
  await s.getByRole("button", { name: "Uygula" }).click();
  await expect(s.locator(".demo-log")).toContainText('"birim":{"op":"contains","value":"bravo"}');
  await expect(s.locator('tbody tr:first-child td[data-key="birim"]')).toContainText("Bravo");
  for (const t of await s.locator('tbody td[data-key="birim"]').allInnerTexts()) expect(t).toContain("Bravo");
  const mod = `/@fs${process.cwd()}/src/data/server.ts`;
  const wire = await page.evaluate(async (mod) => {
    const { sspParams } = await import(/* @vite-ignore */ mod);
    const g = (window as any).grids.kolonFiltresiSunucu;
    return JSON.stringify(sspParams(g.query(), 1, {}).columns[2]);
  }, mod);
  expect(wire).toContain('"columnControl":{"search":{"value":"bravo","logic":"contains","type":"text"}}');
});

test("axe: filter header and panel", async ({ page }) => {
  await axe(page, "#kolon-filtresi .dg");
  await page.locator('#kolon-filtresi th[data-key="durum"] .dg-colfilter').click();
  await axe(page, "#kolon-filtresi .dg-colfilter-panel");
});

test("client: an empty number box applies no filter; re-applying a decimal value keeps it", async ({ page }) => {
  const s = page.locator("#kolon-filtresi");
  const btn = s.locator('th[data-key="tutar"] .dg-colfilter');
  await btn.click();
  await s.locator(".dg-cf-op").selectOption("gt");
  await s.locator(".dg-cf-input").fill("");
  await s.getByRole("button", { name: "Uygula" }).click();
  await expect(btn).not.toHaveAttribute("data-active", /.*/);
  await btn.click();
  await s.locator(".dg-cf-op").selectOption("gt");
  await s.locator(".dg-cf-input").fill("1234,5");
  await s.getByRole("button", { name: "Uygula" }).click();
  await expect(s.locator(".dg-filter-chip")).toContainText("1.234,5");
  await btn.click();
  await s.getByRole("button", { name: "Uygula" }).click();
  await expect(s.locator(".dg-filter-chip")).toContainText("1.234,5");
});
