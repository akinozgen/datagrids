import { test, expect, type Page } from "@playwright/test";
import { ready, axe } from "./helpers";

const KEY = "dg:1:state:/";
const stored = (page: Page, key = KEY) => page.evaluate((k) => localStorage.getItem(k), key);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page, "kolonlar");
  await ready(page, "state");
});

test.describe("colVis", () => {
  test("opens with focus inside, toggles th + td, updates the badge", async ({ page }) => {
    const grid = page.locator("#kolonlar .dg");
    const trigger = grid.locator('.dg-btn[aria-haspopup="dialog"]');
    await expect(trigger.locator(".dg-btn-badge")).toHaveText("9/14");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    const panel = grid.locator(".dg-colvis");
    await expect(panel).toBeVisible();
    await expect(panel).toHaveAttribute("role", "dialog");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(panel.locator(".dg-colvis-search-input")).toBeFocused(); // 14 columns > 12
    // the special # column is not listed
    await expect(panel.locator(".dg-check-input")).toHaveCount(14);

    await panel.locator("label", { hasText: "Birim" }).click();
    await expect(grid.locator('th[data-key="birim"]')).toHaveAttribute("hidden", "");
    await expect(grid.locator('tbody tr:first-child td[data-key="birim"]')).toHaveAttribute("hidden", "");
    await expect(trigger.locator(".dg-btn-badge")).toHaveText("8/14");

    await panel.locator("label", { hasText: "Telefon" }).click();
    await expect(grid.locator('th[data-key="telefon"]')).not.toHaveAttribute("hidden", /.*/);
    await expect(trigger.locator(".dg-btn-badge")).toHaveText("9/14");
  });

  test("locked column cannot be unchecked; reset and show all", async ({ page }) => {
    const grid = page.locator("#kolonlar .dg");
    const trigger = grid.locator('.dg-btn[aria-haspopup="dialog"]');
    await trigger.click();
    const panel = grid.locator(".dg-colvis");
    const locked = panel.locator('.dg-check-input[value="kayit"]');
    await expect(locked).toBeChecked();
    await expect(locked).toBeDisabled();
    await expect(panel.locator('label[data-locked] > svg')).toHaveCount(1);
    await panel.locator("label[data-locked]").click({ force: true });
    await expect(locked).toBeChecked();
    await expect(grid.locator('th[data-key="kayit"]')).not.toHaveAttribute("hidden", /.*/);

    await panel.getByRole("button", { name: "Tümünü göster" }).click();
    await expect(trigger.locator(".dg-btn-badge")).toHaveText("14/14");
    await panel.getByRole("button", { name: "Varsayılana dön" }).click();
    await expect(trigger.locator(".dg-btn-badge")).toHaveText("9/14");
    await expect(grid.locator('th[data-key="eposta"]')).toHaveAttribute("hidden", "");
  });

  test("search filters rows; Esc clears search, then closes and returns focus", async ({ page }) => {
    const grid = page.locator("#kolonlar .dg");
    const trigger = grid.locator('.dg-btn[aria-haspopup="dialog"]');
    await trigger.click();
    const panel = grid.locator(".dg-colvis");
    await panel.locator(".dg-colvis-search-input").fill("isik");
    await expect(panel.locator(".dg-colvis-list > label:not([hidden])")).toHaveCount(0);
    await expect(panel.locator(".dg-colvis-empty")).toHaveText("Eşleşen kolon yok");
    await panel.locator(".dg-colvis-search-input").fill("tari");
    await expect(panel.locator(".dg-colvis-list > label:not([hidden])")).toHaveText(["Tarih"]);
    await page.keyboard.press("Escape");
    await expect(panel.locator(".dg-colvis-search-input")).toHaveValue("");
    await expect(panel).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(panel.locator('.dg-check-input[value="ad"]')).toBeFocused();
    await page.keyboard.press("Space");
    await expect(grid.locator('th[data-key="ad"]')).toHaveAttribute("hidden", "");
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  test("axe: grid and the open panel", async ({ page }) => {
    await axe(page, "#kolonlar");
    await page.locator('#kolonlar .dg-btn[aria-haspopup="dialog"]').click();
    await expect(page.locator("#kolonlar .dg-colvis")).toBeVisible();
    await axe(page, "#kolonlar");
    await page.locator('#state .dg-btn[aria-haspopup="dialog"]').click();
    await expect(page.locator("#state .dg-colvis")).toBeVisible();
    await axe(page, "#state");
  });
});

test.describe("stateSave", () => {
  test("sort, hidden columns and page size survive a reload; search does not", async ({ page }) => {
    const grid = page.locator("#state .dg");
    await grid.locator('th[data-key="tutar"] .dg-sort').click();
    await expect(grid.locator('th[data-key="tutar"]')).toHaveAttribute("aria-sort", "ascending");
    await grid.locator('.dg-btn[aria-haspopup="dialog"]').click();
    await grid.locator(".dg-colvis label", { hasText: "Görev" }).click();
    await page.keyboard.press("Escape");
    await grid.locator(".dg-pagesize").selectOption("50");
    await expect(grid.locator("tbody tr")).toHaveCount(50);
    await grid.locator(".dg-search-input").fill("Jill");
    await expect(grid.locator(".dg-info")).toContainText("toplam 120");
    await expect.poll(async () => JSON.parse((await stored(page)) ?? "null")?.core?.pageSize).toBe(50);
    const saved = JSON.parse((await stored(page))!);
    expect(saved.core.sort).toEqual([{ key: "tutar", dir: "asc" }]);
    expect(saved.core.hidden).toEqual(["gorev"]);
    expect(saved.core.search).toBeUndefined();

    await page.reload();
    await ready(page, "state");
    const g = page.locator("#state .dg");
    await expect(g.locator('th[data-key="tutar"]')).toHaveAttribute("aria-sort", "ascending");
    await expect(g.locator('th[data-key="tarih"]')).not.toHaveAttribute("aria-sort", /.*/);
    await expect(g.locator('th[data-key="gorev"]')).toHaveAttribute("hidden", "");
    await expect(g.locator(".dg-pagesize")).toHaveValue("50");
    await expect(g.locator("tbody tr")).toHaveCount(50);
    await expect(g.locator(".dg-search-input")).toHaveValue("");
    await expect(g.locator(".dg-info")).toHaveText("1–50 / 120 kayıt");
    await expect(g.locator(".dg-btn-badge")).toHaveText("5/6");
  });

  test("filters are restored when included", async ({ page }) => {
    const grid = page.locator("#state .dg");
    await page.locator("#state-durum").selectOption("acik");
    await expect(grid.locator(".dg-info")).toContainText("toplam 120");
    await expect.poll(async () => JSON.parse((await stored(page)) ?? "null")?.core?.filters).toEqual({ durum: "acik" });
    await page.reload();
    await ready(page, "state");
    await expect(page.locator("#state-durum")).toHaveValue("acik");
    await expect(page.locator("#state .dg .dg-info")).toContainText("toplam 120");
  });

  test("resetState clears the storage and restores defaults without a page reload", async ({ page }) => {
    const grid = page.locator("#state .dg");
    await grid.locator('th[data-key="tutar"] .dg-sort').click();
    await grid.locator(".dg-pagesize").selectOption("10");
    await page.locator("#state-durum").selectOption("iptal");
    await expect.poll(async () => JSON.parse((await stored(page)) ?? "null")?.core?.pageSize).toBe(10);
    await page.evaluate(() => ((window as unknown as { __marker: number }).__marker = 1));

    await grid.getByRole("button", { name: "Sıfırla" }).click();
    await expect(grid.locator('th[data-key="tarih"]')).toHaveAttribute("aria-sort", "descending");
    await expect(grid.locator(".dg-pagesize")).toHaveValue("25");
    await expect(grid.locator(".dg-info")).toHaveText("1–25 / 120 kayıt");
    await expect(page.locator("#state-durum")).toHaveValue("");
    expect(await stored(page)).toBeNull();
    // same document: no location.reload()
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
  });

  test("reload button reloads and keeps the page", async ({ page }) => {
    const grid = page.locator("#kolonlar .dg");
    await grid.locator('[data-go="next"]').click();
    await expect(grid.locator(".dg-info")).toHaveText("11–20 / 60 kayıt");
    await page.evaluate(() => {
      const w = window as unknown as { __loads: number; grids: Record<string, { on(t: string, f: () => void): void }> };
      w.__loads = 0;
      w.grids.kolonlar!.on("load", () => w.__loads++);
    });
    const btn = grid.getByRole("button", { name: "Yenile" });
    await expect(btn).toHaveAttribute("data-dg-tip", "Yenile");
    await btn.click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __loads: number }).__loads)).toBe(1);
    await expect(grid.locator(".dg-info")).toHaveText("11–20 / 60 kayıt");
  });
});
