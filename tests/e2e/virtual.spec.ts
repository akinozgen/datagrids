import { test, expect } from "@playwright/test";
import { ready, axe } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page, "sanal");
});

test("≥300 rows: windowed DOM, aria-rowcount, sticky head, locked widths", async ({ page }) => {
  const g = page.locator("#sanal .dg");
  await expect(g).toHaveAttribute("data-dg-virtual", "");
  await expect(g.locator("table")).toHaveAttribute("aria-rowcount", "1001");
  const rendered = await g.locator("tbody tr:not(.dg-spacer)").count();
  expect(rendered).toBeGreaterThan(10);
  expect(rendered).toBeLessThan(120);
  await expect(g.locator("tbody tr:not(.dg-spacer)").first()).toHaveAttribute("aria-rowindex", "2");
  await expect(g.locator("colgroup.dg-cols col")).toHaveCount(7);
  const t0 = Date.now();
  await g.locator(".dg-scroll").evaluate((el) => (el.scrollTop = 30000));
  await expect.poll(async () => Number(await g.locator("tbody tr:not(.dg-spacer)").first().getAttribute("aria-rowindex"))).toBeGreaterThan(400);
  expect(Date.now() - t0).toBeLessThan(2000);
  const th = g.locator("thead th").first();
  const box = await th.boundingBox();
  const sc = await g.locator(".dg-scroll").boundingBox();
  expect(Math.abs(box!.y - sc!.y)).toBeLessThan(2); // header stuck to the top of the scroller
});

test("small page turns virtual mode off and restores the table", async ({ page }) => {
  const g = page.locator("#sanal .dg");
  await g.locator(".dg-pagesize").selectOption("25");
  await expect(g).not.toHaveAttribute("data-dg-virtual", "");
  await expect(g.locator("colgroup.dg-cols")).toHaveCount(0);
  await expect(g.locator("tbody tr")).toHaveCount(25);
  await expect(g.locator("table")).not.toHaveAttribute("aria-rowcount", /.*/);
});

test("print renders every row, then windows again", async ({ page }) => {
  const g = page.locator("#sanal .dg");
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await expect(g.locator("tbody tr")).toHaveCount(1000);
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect.poll(() => g.locator("tbody tr:not(.dg-spacer)").count()).toBeLessThan(120);
});

test("search inside a virtual page keeps working", async ({ page }) => {
  const g = page.locator("#sanal .dg");
  await g.locator(".dg-search-input").fill("Işık Kulesi devriyesi");
  await expect(g.locator(".dg-info")).toHaveText(/\/ \d+ kayıt \(toplam 5\.000\)/);
});

test("axe: virtual grid", async ({ page }) => {
  await axe(page, "#sanal .dg");
});

test("keyboardGrid keeps the focus while virtual windows swap rows", async ({ page }) => {
  await page.goto("/#sanal");
  const s = page.locator("#sanal");
  await expect(s.locator(".dg")).toHaveAttribute("data-dg-virtual", "");
  await s.locator("tbody tr:not(.dg-spacer)").first().locator('td[data-key="kayit"]').click();
  for (let i = 0; i < 60; i++) await page.keyboard.press("ArrowDown");
  const where = await page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    const tr = a.closest("tr");
    return { inTable: !!a.closest("#sanal table"), index: tr ? Number(tr.getAttribute("aria-rowindex")) : null };
  });
  expect(where.inTable).toBe(true);
  // aria-rowindex counts the header row as 1
  expect(where.index).toBe(62);
});
