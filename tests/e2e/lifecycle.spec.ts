import { test, expect } from "@playwright/test";
import { ready, axe } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page, "satir-tik");
});

test("rowClick: permanent › cell, click reports the row; links inside do not trigger it", async ({ page }) => {
  const s = page.locator("#satir-tik");
  await expect(s.locator("tbody tr").first()).toHaveAttribute("data-clickable", "");
  await expect(s.locator('tbody tr:first-child td[data-col="go"] svg')).toBeVisible();
  await s.locator('tbody tr:nth-child(2) td[data-key="gorev"]').click();
  await expect(s.locator(".demo-log")).toContainText("rowClick → RPD-2610");
  await expect(s.locator("tbody tr:nth-child(2)")).toHaveAttribute("data-tone", "warn");
});

test("load:'visible' waits for the tab, then loads once (fetchAll)", async ({ page }) => {
  const s = page.locator("#sekme");
  await expect(s.locator(".demo-log")).toHaveText("grid kuruldu, istek yok (görünür değil)");
  await s.getByRole("tab", { name: "Liste (tembel)" }).click();
  await expect(s.locator(".demo-log")).toContainText("load → 120 satır");
  await expect(s.locator(".dg")).toHaveAttribute("data-state", "ready");
  await expect(s.locator(".dg")).not.toHaveAttribute("data-bp", "xs");
});

test("upgrade() is idempotent, preset applies, reload(name) reports", async ({ page }) => {
  const s = page.locator("#upgrade");
  await ready(page, "upgrade");
  await expect(s.locator(".demo-log")).toContainText("1 grid kuruldu; ikinci çağrı → 0");
  await expect(s.locator('th[data-key="tutar"]')).toHaveAttribute("aria-sort", "descending");
  await expect(s.locator('th[data-key="birim"]')).toHaveAttribute("hidden", "");
  await s.getByRole("button", { name: "Datagrids.reload('bildirimsel')" }).click();
  await expect(s.locator(".demo-log")).toContainText("reload('bildirimsel') → true");
  await s.getByRole("button", { name: "reload('yok')" }).click();
  await expect(s.locator(".demo-log")).toContainText("reload('yok') → false");
});

test("setColumns switches the column set without destroy; remount keeps the grid usable", async ({ page }) => {
  const s = page.locator("#kolon-degistir");
  await ready(page, "kolon-degistir");
  await expect(s.locator("thead th")).toHaveCount(3);
  await s.getByRole("button", { name: "5 kolon" }).click();
  await expect(s.locator("thead th")).toHaveCount(5);
  await expect(s.locator("tbody tr:first-child td")).toHaveCount(5);
  await s.getByRole("button", { name: "remount()" }).click();
  await expect(s.locator(".dg")).toHaveCount(1);
  await expect(s.locator(".dg")).toHaveAttribute("data-state", "ready");
  await s.locator('[data-go="next"]').click();
  await expect(s.locator(".dg-info")).toHaveText("6–10 / 30 kayıt");
});

test("maxHeight: body scrolls inside, header stays stuck", async ({ page }) => {
  const s = page.locator("#sabit-yukseklik .dg");
  await ready(page, "sabit-yukseklik");
  const sc = s.locator(".dg-scroll");
  expect((await sc.boundingBox())!.height).toBeLessThanOrEqual(321);
  await sc.evaluate((el) => (el.scrollTop = 900));
  const th = await s.locator("thead th").first().boundingBox();
  expect(Math.abs(th!.y - (await sc.boundingBox())!.y)).toBeLessThan(2);
});

test("axe: lifecycle sections", async ({ page }) => {
  await ready(page, "upgrade");
  for (const id of ["satir-tik", "upgrade", "kolon-degistir", "sabit-yukseklik"]) await axe(page, `#${id} .dg`);
});
