import { test, expect, type Page } from "@playwright/test";
import { ready, axe } from "./helpers";

const S = "#duyarli";
const width = (page: Page, w: string) => page.locator(`${S} .rs-box`).evaluate((el, v) => ((el as HTMLElement).style.inlineSize = v), w);
const noOverflow = (page: Page) => page.locator(`${S} .dg-scroll`).evaluate((el) => el.scrollWidth <= el.clientWidth + 1);

test.beforeEach(async ({ page }) => {
  await page.goto("/#duyarli");
  await ready(page, "duyarli");
});

test.describe("responsive", () => {
  test("narrow box collapses low-priority columns first and never overflows", async ({ page }) => {
    await width(page, "360px");
    await expect(page.locator(`${S} thead th[data-dg-collapsed]`)).toHaveCount(6);
    expect(await noOverflow(page)).toBe(true);
    // kept: Kayıt (anchor), Personel (keep), Tutar (priority 1)
    await expect(page.locator(`${S} thead th:not([data-dg-collapsed])`)).toHaveText([/Kayıt/i, /Personel/i, /Tutar/i]);
    await expect(page.locator(`${S} .demo-log`)).toContainText('collapse → ["telefon","mekan","tarih","gorev","birim","durum"]');
  });

  test("expand button opens a detail row with the collapsed values; keyboard works", async ({ page }) => {
    await width(page, "360px");
    const btn = page.locator(`${S} tbody tr:first-child .dg-expand`);
    await expect(btn).toHaveAttribute("aria-expanded", "false");
    await btn.focus();
    await page.keyboard.press("Enter");
    await expect(btn).toHaveAttribute("aria-expanded", "true");
    const detail = page.locator(`${S} tbody tr.dg-detail-row`);
    await expect(detail).toHaveCount(1);
    await expect(detail.locator("dt")).toHaveText(["Birim", "Görev", "Durum", "Tarih", "Mekân", "Telefon"]);
    const id = await btn.getAttribute("aria-controls");
    await expect(detail.locator("td")).toHaveAttribute("id", id!);
    await axe(page, S);
    await page.keyboard.press("Space");
    await expect(detail).toHaveCount(0);
  });

  test("open details follow paging back and widening removes buttons", async ({ page }) => {
    await width(page, "360px");
    await page.locator(`${S} tbody tr:first-child .dg-expand`).click();
    await expect(page.locator(`${S} tbody tr.dg-detail-row`)).toHaveCount(1);
    await page.locator(`${S} .dg-pager [data-go="next"]`).click();
    await expect(page.locator(`${S} tbody tr.dg-detail-row`)).toHaveCount(0);
    await page.locator(`${S} .dg-pager [data-go="prev"]`).click();
    await expect(page.locator(`${S} tbody tr.dg-detail-row`)).toHaveCount(1);
    // wide enough for every column with any font set (CI fonts run wider than local ones)
    await page.locator(`${S} .rs-box`).evaluate((el) => ((el as HTMLElement).style.maxInlineSize = "none"));
    await width(page, "3000px");
    await expect(page.locator(`${S} thead th[data-dg-collapsed]`)).toHaveCount(0);
    await expect(page.locator(`${S} .dg-expand`)).toHaveCount(0);
    await expect(page.locator(`${S} tbody tr.dg-detail-row`)).toHaveCount(0);
  });

  test("axe", async ({ page }) => {
    await axe(page, S);
  });
});
