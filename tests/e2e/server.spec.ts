import { test, expect } from "@playwright/test";
import { ready, axe } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page, "yajra");
});

test("yajra: wire order index, csrf, search and paging requests", async ({ page }) => {
  const s = page.locator("#yajra");
  const log = s.locator(".demo-log");
  await expect(log).toContainText('order=[{"column":"6","dir":"desc"}]');
  await expect(log).toContainText("_token=✓");
  await expect(log).toContainText("X-CSRF-TOKEN=✓ X-Requested-With=XMLHttpRequest");
  await s.locator('th[data-key="ad"] .dg-sort').click();
  await expect(log).toContainText('order=[{"column":"2","dir":"asc"}]');
  await expect(s.locator('tbody tr:first-child td[data-key="ad"]')).toHaveText(/^A/);
  await s.locator(".dg-search-input").fill("jill");
  await expect(log).toContainText('search="jill"');
  await expect(s.locator(".dg-info")).toHaveText(/\/ \d+ kayıt \(toplam 1\.000\)/);
  await s.locator(".dg-search-clear").click();
  await s.locator('[data-go="next"]').click();
  await expect(log).toContainText("start=25 length=25");
  await expect(s.locator(".dg-info")).toHaveText("26–50 / 1.000 kayıt");
});

test("yajra: server HTML cells render, debug keys stripped", async ({ page }) => {
  const s = page.locator("#yajra");
  await expect(s.locator('tbody td[data-key="durum_html"] .dg-chip').first()).toBeVisible();
  const raw = await page.evaluate(() => JSON.stringify((window as any).grids.yajra.lastResponse()));
  expect(raw).not.toContain("queries");
  expect(raw).toContain("summary");
});

test("yajra: 500 → non-blocking banner + retry", async ({ page }) => {
  const s = page.locator("#yajra");
  await s.getByRole("button", { name: "HTTP 500" }).click();
  const banner = s.locator(".dg-banner");
  await expect(banner).toContainText("Sunucu bir hata döndürdü (500)");
  await expect(s.locator("tbody tr")).toHaveCount(25);
  await banner.getByRole("button", { name: "Yeniden dene" }).click();
  await expect(banner).toHaveCount(0);
});

test("yajra: 419 → session banner without retry + sessionexpired", async ({ page }) => {
  const s = page.locator("#yajra");
  await s.getByRole("button", { name: "419 oturum" }).click();
  const banner = s.locator(".dg-banner");
  await expect(banner).toHaveAttribute("data-tone", "warn");
  await expect(banner).toContainText("Oturumunuz sona erdi");
  await expect(banner.getByRole("button", { name: "Yeniden dene" })).toHaveCount(0);
  await expect(s.locator(".demo-log")).toContainText("sessionexpired event");
});

test("yajra: 302 HTML → forbidden; 200+error keeps SQL out of the UI", async ({ page }) => {
  const s = page.locator("#yajra");
  await s.getByRole("button", { name: "302 yetki" }).click();
  await expect(s.locator(".dg-banner")).toContainText("yetkiniz yok");
  await s.getByRole("button", { name: "200 + error" }).click();
  await expect(s.locator(".demo-log")).toContainText("kind=server");
  await expect(s.locator(".dg-banner")).not.toContainText("SQLSTATE");
});

test("yajra: page filter param travels with the request", async ({ page }) => {
  const s = page.locator("#yajra");
  await s.getByLabel("Durum filtresi").selectOption("iptal");
  await expect(s.locator(".demo-log")).toContainText("durum=iptal");
  const texts = await s.locator('tbody td[data-key="durum_html"]').allInnerTexts();
  for (const t of texts) expect(t).toBe("İptal");
});

test("dgp: typed filter, count none → total unknown", async ({ page }) => {
  const s = page.locator("#dgp");
  await expect(s.locator(".dg")).toHaveAttribute("data-state", "ready");
  await s.getByRole("button", { name: "filtre: durum ∈ {açık, beklemede}" }).click();
  await expect(s.locator(".demo-log")).toContainText('"filters":{"durum":{"op":"in","value":["acik","bekliyor"]}}');
  const states = await s.locator('tbody td[data-key="durum"]').allInnerTexts();
  for (const t of states) expect(["Açık", "Beklemede"]).toContain(t);
  await s.getByRole("button", { name: "sayım: none" }).click();
  await expect(s.locator(".dg-info")).toContainText("toplam bilinmiyor");
  await expect(s.locator('[data-go="last"]')).toBeDisabled();
  await expect(s.locator('[data-go="next"]')).toBeEnabled();
  await s.getByRole("button", { name: "sayım: exact" }).click();
  await s.getByRole("button", { name: "HTTP 422" }).click();
  await expect(s.locator(".dg-banner")).toContainText("Tarih aralığı geçersiz");
});

test("paginator: paginate vs simplePaginate", async ({ page }) => {
  const s = page.locator("#paginator");
  await expect(s.locator(".dg-info")).toHaveText("1–10 / 1.000 kayıt");
  await s.getByRole("button", { name: "simplePaginate()", exact: true }).click();
  await expect(s.locator(".dg-info")).toContainText("toplam bilinmiyor");
  await s.locator('[data-go="next"]').click();
  await expect(s.locator(".dg-info")).toContainText("11–20");
  await expect(s.locator(".demo-log")).toContainText("page=2&per_page=10&sort=-tarih");
  await s.getByRole("button", { name: "paginate()", exact: true }).click();
});

test("axe: server sections", async ({ page }) => {
  await ready(page, "paginator");
  await axe(page, "#yajra .dg");
  await axe(page, "#dgp .dg");
  await axe(page, "#paginator .dg");
});
