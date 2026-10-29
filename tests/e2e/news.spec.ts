import { test, expect } from "@playwright/test";

test("demo: the what's-new section is on top and every example works", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#main > section").first()).toHaveId("yenilikler");
  await expect(page.locator("#yenilikler .news-item")).toHaveCount(9);
  await expect(page.locator("#yenilikler .dg")).toHaveCount(9);
  await expect(page.locator("#yeni-locale .demo-log")).toContainText('grid.locale = "tr"');
  // a control scrolled into view and hovered right away still gets its tooltip
  const next = page.locator('#yeni-ipucu .dg-pager-btn[data-go="next"]');
  await next.hover();
  await expect(page.locator("#yeni-ipucu .dg-tip")).toBeVisible();
  await expect(page.locator("#yeni-ipucu .dg-tip")).toHaveText("Sonraki sayfa");
  await expect(page.locator("#yeni-text tbody tr").first().locator("td")).toHaveText(["Barry & Moira Burton", "Barry &amp; Moira Burton", "Barry & Moira Burton · R&D"]);
  expect(errors).toEqual([]);
});
