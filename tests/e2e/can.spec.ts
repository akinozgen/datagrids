import { test, expect } from "@playwright/test";
import { ready, axe } from "./helpers";

test("boolean column: icon + text, sortable", async ({ page }) => {
  await page.goto("/#evet-hayir");
  await ready(page, "evet-hayir");
  const s = page.locator("#evet-hayir");
  await expect(s.locator("tbody tr:first-child td[data-key=aktif]")).toHaveText("Hayır");
  await expect(s.locator("tbody tr:first-child td[data-key=aktif] .dg-bool svg")).toBeVisible();
  await s.locator('th[data-key="aktif"] .dg-sort').click();
  await expect(s.locator("tbody tr:first-child td[data-key=aktif]")).toHaveText("Hayır");
  await s.locator('th[data-key="aktif"] .dg-sort').click();
  await expect(s.locator("tbody tr:first-child td[data-key=aktif]")).toHaveText("Evet");
  await axe(page, "#evet-hayir");
});

test("autoRefresh: toggle is a pressed button; a tick reloads the same page silently", async ({ page }) => {
  await page.goto("/#otomatik-yenile");
  await ready(page, "otomatik-yenile");
  const s = page.locator("#otomatik-yenile");
  const toggle = s.locator(".dg-btn[aria-pressed]");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await s.locator(".dg-pager [data-go=next]").click();
  await expect(s.locator(".dg-pager-input")).toHaveValue("2");
  await s.getByRole("button", { name: "Şimdi yenile" }).click();
  await expect(s.locator(".demo-log")).toContainText("istek #3");
  await expect(s.locator(".dg-pager-input")).toHaveValue("2");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await axe(page, "#otomatik-yenile");
});

test("multiSort: Shift+click and Shift+Enter add keys; rank shows; plain click resets", async ({ page }) => {
  await page.goto("/#coklu-siralama");
  await ready(page, "coklu-siralama");
  const s = page.locator("#coklu-siralama");
  await s.locator('th[data-key="tutar"] .dg-sort').click({ modifiers: ["Shift"] });
  await expect(s.locator('th[data-key="tutar"] .dg-sort-rank')).toHaveText("2");
  await expect(s.locator(".demo-log")).toContainText('[{"key":"birim","dir":"asc"},{"key":"tutar","dir":"asc"}]');
  // keyboard: Shift+Enter on the focused header button
  await s.locator('th[data-key="tutar"] .dg-sort').focus();
  await page.keyboard.press("Shift+Enter");
  await expect(s.locator('th[data-key="tutar"]')).toHaveAttribute("data-sort-dir", "desc");
  // rows: birim asc, then tutar desc inside each birim
  const pairs = await s.locator("tbody tr").evaluateAll((trs) => trs.map((tr) => [tr.querySelector("[data-key=birim]")!.textContent, parseFloat(tr.querySelector("[data-key=tutar]")!.textContent!.replace(/\./g, "").replace(",", "."))]));
  for (let i = 1; i < pairs.length; i++) if (pairs[i]![0] === pairs[i - 1]![0]) expect(pairs[i]![1] as number).toBeLessThanOrEqual(pairs[i - 1]![1] as number);
  await axe(page, "#coklu-siralama");
  await s.locator('th[data-key="ad"] .dg-sort').click();
  await expect(s.locator(".dg-sort-rank")).toHaveCount(0);
  await expect(s.locator('th[data-key="ad"]')).toHaveAttribute("aria-sort", "ascending");
});
