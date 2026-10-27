import { test, expect } from "@playwright/test";
import { ready, axe } from "./helpers";

const S = "#tembel-kolonlar";

test.beforeEach(async ({ page }) => {
  await page.goto("/#tembel-kolonlar");
  await ready(page, "tembel-kolonlar");
});

test("showing a lazy column reloads the same page with its name; hiding sends nothing", async ({ page }) => {
  const log = page.locator(`${S} .demo-log`);
  await expect(log).toContainText("ek_sutunlar=[] · start=0");
  await page.locator(`${S} .dg-pager [data-go="next"]`).click();
  await expect(log).toContainText("ek_sutunlar=[] · start=10");
  // through the colVis panel, like a user would
  await page.locator(`${S} .dg-btn[aria-haspopup="dialog"]`).click();
  await page.locator(`${S} .dg-panel-item[data-key="vergi_no"]`).click();
  await expect(log).toContainText('ek_sutunlar=["vergi_no"] · start=10');
  await expect(page.locator(`${S} tbody tr:first-child td[data-key="vergi_no"]`)).toHaveText(/^\d{10}$/);
  const lines = await log.evaluate((el) => el.textContent!.split("POST").length);
  await page.locator(`${S} .dg-panel-item[data-key="vergi_no"]`).click();
  await expect(page.locator(`${S} th[data-key="vergi_no"]`)).toBeHidden();
  expect(await log.evaluate((el) => el.textContent!.split("POST").length)).toBe(lines);
  await axe(page, S);
});
