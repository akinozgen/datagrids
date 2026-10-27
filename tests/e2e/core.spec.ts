import { test, expect } from "@playwright/test";
import { ready, axe } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page, "liste");
});

test("house list: 25 rows, info, sorted by date desc", async ({ page }) => {
  const grid = page.locator("#liste .dg");
  await expect(grid.locator("tbody tr")).toHaveCount(25);
  await expect(grid.locator(".dg-info")).toHaveText("1–25 / 240 kayıt");
  await expect(grid.locator('th[data-key="tarih"]')).toHaveAttribute("aria-sort", "descending");
  await expect(grid.locator(".dg-count")).toContainText("240");
});

test("sort toggles by header button and announces", async ({ page }) => {
  const grid = page.locator("#liste .dg");
  const th = grid.locator('th[data-key="tutar"]');
  await th.locator(".dg-sort").click();
  await expect(th).toHaveAttribute("aria-sort", "ascending");
  await expect(grid.locator('th[data-key="tarih"]')).not.toHaveAttribute("aria-sort", /.*/);
  const first = await grid.locator('tbody tr:first-child td[data-key="tutar"]').innerText();
  expect(first).toContain("-");
  await th.locator(".dg-sort").click();
  await expect(th).toHaveAttribute("aria-sort", "descending");
  await expect(grid.locator(".dg-live")).toHaveText(/Sıralama: Tutar, azalan/);
});

test("search folds Turkish (isik → Işık) and clears", async ({ page }) => {
  const grid = page.locator("#liste .dg");
  await grid.locator(".dg-search-input").fill("isik");
  await expect(grid.locator(".dg-info")).toHaveText(/\/ \d+ kayıt \(toplam 240\)/);
  const texts = await grid.locator('tbody td[data-key="gorev"]').allInnerTexts();
  expect(texts.length).toBeGreaterThan(0);
  for (const t of texts) expect(t).toContain("Işık");
  await expect(grid.locator(".dg-live")).toHaveText(/kayıt bulundu/);
  await grid.locator(".dg-search-clear").click();
  await expect(grid.locator(".dg-info")).toHaveText("1–25 / 240 kayıt");
});

test("pager: next, jump, last, page size", async ({ page }) => {
  const grid = page.locator("#liste .dg");
  await grid.locator('[data-go="next"]').click();
  await expect(grid.locator(".dg-info")).toHaveText("26–50 / 240 kayıt");
  await expect(grid.locator('tbody tr:first-child td[data-col="rownum"]')).toHaveText("26");
  await expect(grid.locator('[data-go="next"]')).toBeFocused();
  await grid.locator(".dg-pager-input").fill("4");
  await grid.locator(".dg-pager-input").press("Enter");
  await expect(grid.locator(".dg-info")).toHaveText("76–100 / 240 kayıt");
  await grid.locator('[data-go="last"]').click();
  await expect(grid.locator(".dg-info")).toHaveText("226–240 / 240 kayıt");
  await expect(grid.locator('[data-go="next"]')).toBeDisabled();
  await grid.locator(".dg-pagesize").selectOption("50");
  await expect(grid.locator("tbody tr")).toHaveCount(50);
  await expect(grid.locator(".dg-info")).toHaveText("1–50 / 240 kayıt");
});

test("DOM table: adopt rows, sort, destroy restores, re-init", async ({ page }) => {
  const sec = page.locator("#dom");
  const before = await page.evaluate(() => ((document.getElementById("dom-table-tpl") as HTMLTemplateElement).content.querySelector("table") as HTMLElement).outerHTML);
  await expect(sec.locator(".dg .dg-info")).toHaveText("1–5 / 8 kayıt");
  await sec.locator('th[data-key="adet"] .dg-sort').click();
  await expect(sec.locator('tbody tr:first-child td[data-key="adet"]')).toHaveText("1");
  await sec.locator("#dom-destroy").click();
  await expect(sec.locator(".dg")).toHaveCount(0);
  const after = await page.evaluate(() => (document.querySelector("#dom-table") as HTMLElement).outerHTML);
  expect(after).toBe(before);
  await sec.locator("#dom-init").click();
  await expect(sec.locator(".dg")).toHaveAttribute("data-state", "ready");
});

test("states: loading card, empty, error → retry, manual → load", async ({ page }) => {
  const s = page.locator("#durumlar");
  await expect(s.locator(".dg:has(#g-loading)")).toHaveAttribute("data-state", "loading");
  await expect(s.locator('.dg-state[data-kind="loading"]')).toContainText("Yükleniyor");
  await expect(s.locator('.dg-state[data-kind="empty"]')).toContainText("Kayıt yok");
  const err = s.locator('.dg-state[data-kind="error"]');
  await expect(err).toContainText("Liste yüklenemedi");
  await err.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(s.locator("#g-error tbody tr")).toHaveCount(5);
  const manual = s.locator('.dg-state[data-kind="manual"]');
  await manual.getByRole("button", { name: "Yükle" }).click();
  await expect(s.locator("#g-manual tbody tr")).toHaveCount(12);
});

test("skip link focuses past the table", async ({ page }) => {
  const grid = page.locator("#liste .dg");
  await grid.locator(".dg-search-input").focus();
  await page.keyboard.press("Tab");
  await expect(grid.locator(".dg-skip")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(grid.locator(".dg-after")).toBeFocused();
});

test("axe: core sections are clean", async ({ page }) => {
  await ready(page, "rtl");
  for (const id of ["liste", "kart", "dom", "durumlar", "tema", "rtl"]) await axe(page, `#${id} .dg`);
});
