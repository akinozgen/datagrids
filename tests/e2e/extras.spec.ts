import { test, expect } from "@playwright/test";
import { ready, axe } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page, "butonlar");
});

test("custom button runs, group menu works by keyboard, can:false item hidden", async ({ page }) => {
  const s = page.locator("#butonlar");
  await s.getByRole("button", { name: "Bugünün kayıtları" }).click();
  await expect(s.locator(".dg-search-input")).toHaveValue("26.10.2026");
  await expect(s.locator(".demo-log")).toContainText("filtre ön ayarı: bugün");
  const grp = s.getByRole("button", { name: "Diğer" });
  await grp.focus();
  await page.keyboard.press("ArrowDown");
  const menu = s.locator(".dg-panel[role=menu]").filter({ hasText: "Yardım" });
  await expect(menu.getByRole("menuitem", { name: "Yardım" })).toBeFocused();
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(s.locator(".demo-log")).toContainText("tam ekran");
  await expect(grp).toBeFocused();
});

test("custom button disabled state follows the response", async ({ page }) => {
  const s = page.locator("#butonlar");
  await expect(s.getByRole("button", { name: "Toplu onay" })).toBeEnabled();
  await page.evaluate(() => (window as any).grids.butonlar.search("zzz-yok"));
  await expect(s.getByRole("button", { name: "Toplu onay" })).toBeDisabled();
});

test("phone column: tel: and WhatsApp links", async ({ page }) => {
  const cell = page.locator('#butonlar tbody tr:first-child td[data-key="telefon"]');
  await expect(cell.locator("a").first()).toHaveAttribute("href", /^tel:\+905\d{9}$/);
  await expect(cell.locator(".dg-phone-wa")).toHaveAttribute("href", /^https:\/\/wa\.me\/905\d{9}$/);
});

test("axe: extras", async ({ page }) => {
  await axe(page, "#butonlar .dg");
});
