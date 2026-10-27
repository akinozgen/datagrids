import { test, expect } from "@playwright/test";
import { ready, axe } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page, "aksiyonlar");
});

test("menu button: keyboard opens, arrows move, Esc returns focus", async ({ page }) => {
  const s = page.locator("#aksiyonlar");
  const trig = s.locator("tbody tr").nth(1).locator(".dg-actions-trigger");
  await expect(trig).toHaveAttribute("aria-haspopup", "menu");
  await expect(trig).toHaveAttribute("aria-label", /Diğer işlemler: RPD-/);
  await trig.focus();
  await page.keyboard.press("ArrowDown");
  const menu = s.locator(".dg-actions-menu");
  await expect(menu).toBeVisible();
  await expect(trig).toHaveAttribute("aria-expanded", "true");
  const items = menu.locator("[role=menuitem]");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(items.last()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trig).toBeFocused();
});

test("disabled item is focusable, shows its reason and does nothing", async ({ page }) => {
  const s = page.locator("#aksiyonlar");
  // row 2 is "İptal" → approve disabled with a reason
  await s.locator("tbody tr").nth(1).locator(".dg-actions-trigger").click();
  const item = page.locator('.dg-actions-menu [data-action="approve"]');
  await expect(item).toHaveAttribute("aria-disabled", "true");
  await expect(item).toContainText("İptal edilmiş kayıt onaylanamaz.");
  await item.click({ force: true });
  await expect(page.locator(".dg-dialog")).toHaveCount(0);
});

test("delete: confirm dialog (cancel focused), request with CSRF, row gone, page kept", async ({ page }) => {
  const s = page.locator("#aksiyonlar");
  const row = s.locator("tbody tr").nth(1);
  const kayit = await row.locator('td[data-key="kayit"]').innerText();
  await row.locator(".dg-actions-trigger").click();
  await page.locator('.dg-actions-menu [data-action="delete"]').click();
  const dlg = page.locator("dialog.dg-dialog");
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText(`${kayit}`);
  await expect(dlg.getByRole("button", { name: "Vazgeç" })).toBeFocused();
  await dlg.getByRole("button", { name: "Sil" }).click();
  await expect(dlg).toHaveCount(0);
  await expect(s.locator(`tbody td[data-key="kayit"]:text-is("${kayit}")`)).toHaveCount(0);
  await expect(s.locator(".demo-log")).toContainText("action → delete");
  await expect(s.locator(".dg-live")).toContainText(`${kayit} silindi.`);
  // focus lands on the actions of the row now in its place, not on the page body
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("#aksiyonlar td[data-col=actions]"))).toBe(true);
});

test("can:false hides the action (permission), toggled at runtime", async ({ page }) => {
  const s = page.locator("#aksiyonlar");
  await s.getByRole("button", { name: "Yetki: sil aç/kapa" }).click();
  await s.locator("tbody tr").nth(1).locator(".dg-actions-trigger").click();
  await expect(page.locator('.dg-actions-menu [data-action="delete"]')).toHaveCount(0);
});

test("server failure: row returns to normal, error notified", async ({ page }) => {
  const s = page.locator("#aksiyonlar");
  await s.getByRole("button", { name: "Sonraki aksiyon 500 versin" }).click();
  const row = s.locator("tbody tr").nth(1); // İptal → delete allowed
  const kayit = await row.locator('td[data-key="kayit"]').innerText();
  await row.locator(".dg-actions-trigger").click();
  await s.locator('.dg-actions-menu [data-action="delete"]').click();
  await page.locator("dialog.dg-dialog").getByRole("button", { name: "Sil" }).click();
  await expect(s.locator(".dg-banner")).toContainText("Sunucu bir hata döndürdü (500)");
  await expect(s.locator(".demo-log")).toContainText("actionerror → delete");
  await expect(s.locator(`tbody td[data-key="kayit"]:text-is("${kayit}")`)).toHaveCount(1);
  await expect(s.locator("tbody tr").nth(1)).not.toHaveAttribute("aria-busy", "true");
});

test("inline disabled action opens its reason note", async ({ page }) => {
  const s = page.locator("#aksiyon-inline");
  await ready(page, "aksiyon-inline");
  const btn = s.locator('tbody tr').first().locator('[data-action="send"]');
  await expect(btn).toHaveAttribute("aria-disabled", "true");
  await btn.click({ force: true });
  await expect(s.locator(".dg-note")).toContainText("Telefon numarası doğrulanmamış");
});

test("axe: actions grid and open menu", async ({ page }) => {
  await axe(page, "#aksiyonlar .dg");
  await page.locator("#aksiyonlar tbody tr").nth(1).locator(".dg-actions-trigger").click();
  await axe(page, "#aksiyonlar .dg-actions-menu");
});
