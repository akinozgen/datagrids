import { test, expect } from "@playwright/test";
import { ready, axe } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page, "secim");
});

test("selection persists across pages; header is tri-state per page", async ({ page }) => {
  const s = page.locator("#secim");
  const head = s.locator("thead .dg-check-input");
  const rows = s.locator("tbody tr");
  const bar = s.locator(".dg-bulk");
  await expect(bar).not.toHaveAttribute("data-active", "");
  await expect(bar.locator(".dg-bulk-count")).toHaveText("0");
  await expect(bar.getByRole("button", { name: "Sil" })).toBeDisabled();

  await rows.nth(1).locator(".dg-check-input").check();
  await rows.nth(4).locator(".dg-check-input").check();
  await expect(rows.nth(1)).toHaveAttribute("data-selected", "");
  await expect(head).toHaveJSProperty("indeterminate", true);
  await expect(bar).toHaveAttribute("data-active", "");
  await expect(bar.locator(".dg-bulk-count")).toHaveText("2");
  await expect(bar.getByRole("button", { name: "Sil" })).toBeEnabled();

  await s.locator('[data-go="next"]').click();
  await expect(s.locator(".dg-info")).toHaveText(/^11–20/);
  await expect(head).toHaveJSProperty("indeterminate", false);
  await expect(head).not.toBeChecked();
  await expect(bar).toContainText("2 tanesi görünmüyor");
  await rows.nth(0).locator(".dg-check-input").check();
  await expect(bar.locator(".dg-bulk-count")).toHaveText("3");

  await s.locator('[data-go="prev"]').click();
  await expect(rows.nth(1).locator(".dg-check-input")).toBeChecked();
  await expect(rows.nth(4).locator(".dg-check-input")).toBeChecked();
  await expect(rows.nth(0).locator(".dg-check-input")).not.toBeChecked();

  await head.check(); // mixed → whole page
  await expect(head).toHaveJSProperty("indeterminate", false);
  await expect(s.locator("tbody tr[data-selected]")).toHaveCount(10);
  await head.uncheck();
  await expect(s.locator("tbody tr[data-selected]")).toHaveCount(0);
  await expect(bar.locator(".dg-bulk-count")).toHaveText("1");
});

test("select all matching → all + except; search resets it", async ({ page }) => {
  const s = page.locator("#secim");
  const bar = s.locator(".dg-bulk");
  await s.locator("thead .dg-check-input").check();
  const all = bar.getByRole("button", { name: "Filtre sonucunun tümünü seç (120)" });
  await all.click();
  await expect(bar).toContainText("Filtre sonucunun tümü seçili.");
  await expect(bar.locator(".dg-bulk-count")).toHaveText("120");
  // focus moved to the button that replaced the clicked one
  await expect(bar.getByRole("button", { name: "Seçimi temizle" })).toBeFocused();
  await s.locator("tbody tr").nth(2).locator(".dg-check-input").uncheck();
  await expect(bar.locator(".dg-bulk-count")).toHaveText("119");
  await s.locator('[data-go="last"]').click();
  await expect(s.locator("tbody tr[data-selected]")).toHaveCount(10);

  await bar.getByRole("button", { name: "Sil" }).click();
  const log = s.locator(".demo-log");
  await expect(log).toContainText('Sil → { all: true, except: ["1118"], query: {"search":"","sort":[],"filters":{},"params":{}} }');

  await s.locator(".dg-search-input").fill("jill");
  await expect(s.locator(".dg-info")).toHaveText(/\/ 5 kayıt/);
  await expect(bar.locator(".dg-bulk-count")).toHaveText("0");
  await expect(s.locator("tbody tr[data-selected]")).toHaveCount(0);
});

test("bulk action receives the keys payload", async ({ page }) => {
  const s = page.locator("#secim");
  await s.locator("tbody tr").nth(0).locator(".dg-check-input").check();
  await s.locator("tbody tr").nth(2).locator(".dg-check-input").check();
  await s.locator(".dg-bulk").getByRole("button", { name: "SMS gönder" }).click();
  await expect(s.locator(".demo-log")).toContainText('SMS gönder → { all: false, keys: ["1120","1118"] }');
});

test("keyboard: Space toggles the focused checkbox, Shift+click selects a range", async ({ page }) => {
  const s = page.locator("#secim");
  const first = s.locator("tbody tr").nth(0).locator(".dg-check-input");
  await first.focus();
  await page.keyboard.press("Space");
  await expect(first).toBeChecked();
  await expect(s.locator("tbody tr").nth(0)).toHaveAttribute("data-selected", "");
  await page.keyboard.press("Space");
  await expect(first).not.toBeChecked();

  await first.click();
  await s.locator("tbody tr").nth(4).locator(".dg-check-input").click({ modifiers: ["Shift"] });
  await expect(s.locator("tbody tr[data-selected]")).toHaveCount(5);
});

test("row checkboxes are named after the row; axe clean (idle and active)", async ({ page }) => {
  const s = page.locator("#secim");
  await expect(s.getByRole("checkbox", { name: "Sayfadaki tümünü seç" })).toBeVisible();
  await expect(s.getByRole("checkbox", { name: "Seç: RPD-2611 Jill Valentine" })).toBeVisible();
  await axe(page, "#secim .dg");
  await s.locator("thead .dg-check-input").check();
  await s.locator("tbody tr").nth(1).locator(".dg-check-input").uncheck();
  await axe(page, "#secim .dg");
});

test("server mode: all-matching payload carries except + query", async ({ page }) => {
  const s = page.locator("#secim-sunucu");
  await ready(page, "secim-sunucu");
  await expect(s.locator("tbody tr")).toHaveCount(10);
  await s.locator("thead .dg-check-input").check();
  await s.locator(".dg-bulk").getByRole("button", { name: "Filtre sonucunun tümünü seç (1.000)" }).click();
  await s.locator("tbody tr").nth(0).locator(".dg-check-input").uncheck();
  await s.locator('[data-go="next"]').click();
  await expect(s.locator(".dg-info")).toHaveText(/^11–20/);
  await expect(s.locator("tbody tr[data-selected]")).toHaveCount(10);
  await s.locator(".dg-bulk").getByRole("button", { name: "Seçilileri dışa aktar" }).click();
  await expect(s.locator(".demo-log")).toContainText(/dışa aktar → \{ all: true, except: \["\d+"\], query: \{"search":"","sort":\[\{"key":"tarih","dir":"desc"\}\],"filters":\{\},"params":\{\}\} \}/);
  await expect(s.locator(".dg-bulk-count")).toHaveText("999");
  await axe(page, "#secim-sunucu .dg");
});
