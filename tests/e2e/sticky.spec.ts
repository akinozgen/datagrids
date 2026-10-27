import { test, expect, type Page } from "@playwright/test";
import { ready, axe } from "./helpers";

const S = "#yapisik-baslik";
const bar = (page: Page) => page.locator(`${S} .dg-sticky-bar`);
const scrollToRow = (page: Page, n: number) =>
  page.locator(`${S} tbody tr:nth-child(${n})`).evaluate((el) => scrollTo(0, el.getBoundingClientRect().top + scrollY));

test.beforeEach(async ({ page }) => {
  await page.goto("/#yapisik-baslik");
  await ready(page, "yapisik-baslik");
});

test("the cloned header follows the page and the frame's sideways scroll", async ({ page }) => {
  await page.evaluate(() => scrollTo(0, 0));
  await expect(bar(page)).toBeHidden();
  await scrollToRow(page, 8);
  await expect(bar(page)).toBeVisible();
  await expect(bar(page)).toHaveAttribute("aria-hidden", "true");
  await expect(page.locator(`${S} .dg`)).toHaveAttribute("data-dg-header-stuck", "");
  const real = await page.locator(`${S} .dg-scroll thead th`).allTextContents();
  expect(await bar(page).locator("th").allTextContents()).toEqual(real);
  // pinned to the viewport top, as wide as the frame
  const box = await bar(page).boundingBox();
  const frame = await page.locator(`${S} .dg-scroll`).boundingBox();
  expect(Math.round(box!.y)).toBe(0);
  expect(Math.abs(box!.x - frame!.x)).toBeLessThan(2);
  await page.locator(`${S} .dg-scroll`).evaluate((el) => (el.scrollLeft = 260));
  await expect.poll(() => bar(page).locator(".dg-sticky-inner").evaluate((el) => el.scrollLeft)).toBe(260);
  // not focusable: keyboard users stay on the real header
  expect(await bar(page).locator("button").evaluateAll((bs) => bs.every((b) => (b as HTMLElement).tabIndex === -1))).toBe(true);
  await axe(page, S);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(bar(page)).toBeHidden();
});

test("a sort click on the clone sorts the real header", async ({ page }) => {
  await scrollToRow(page, 8);
  await page.locator(`${S} .dg-scroll`).evaluate((el) => (el.scrollLeft = 300));
  await bar(page).locator('th[data-key="tutar"] .dg-sort').click();
  await expect(page.locator(`${S} .dg-scroll thead th[data-key="tutar"]`)).toHaveAttribute("aria-sort", "ascending");
  await expect(bar(page).locator('th[data-key="tutar"]')).toHaveAttribute("aria-sort", "ascending");
});
