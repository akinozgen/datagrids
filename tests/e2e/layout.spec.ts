import { test, expect } from "@playwright/test";

test("phone width: no section widens the page (absolute host markup stays inside the scroller)", async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await page.goto("/");
  await expect(page.locator("#export .dg")).toHaveAttribute("data-state", /ready/);
  await expect(page.locator("#export .sr-only").first()).toBeAttached();
  const wide = await page.evaluate(() =>
    [...document.querySelectorAll("section.demo")].filter((s) => s.scrollWidth > s.clientWidth + 1).map((s) => s.id),
  );
  expect(wide).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("host prose CSS (`.x table { display: block }`, same specificity, loaded later) cannot reshape the grid", async ({ page }) => {
  await page.goto("/#kolonlar");
  await expect(page.locator("#kolonlar .dg")).toHaveAttribute("data-state", /ready/);
  await page.addStyleTag({ content: ".demo-card table { display: block; margin: 20px 0; border-collapse: collapse; }" });
  const css = await page.locator("#g-kolonlar").evaluate((t) => {
    const s = getComputedStyle(t);
    return [s.display, s.marginTop, s.borderCollapse];
  });
  expect(css).toEqual(["table", "0px", "separate"]);
});

test("closed reason notes take no space; actions header is labelled", async ({ page }) => {
  await page.goto("/#aksiyonlar");
  await expect(page.locator("#aksiyonlar .dg")).toHaveAttribute("data-state", /ready/);
  const hidden = await page.locator(".dg-note").evaluateAll((ns) => ns.every((n) => getComputedStyle(n).display === "none"));
  expect(hidden).toBe(true);
  await expect(page.locator("#aksiyonlar th[data-col=actions]")).toHaveText(/\S/);
});

test("RTL: a Latin text cell (dir=auto) aligns to the table's start like its header", async ({ page }) => {
  await page.goto("/#rtl");
  await expect(page.locator("#rtl .dg")).toHaveAttribute("data-state", /ready/);
  const gap = await page.locator('#rtl tbody tr:first-child td[data-key="gorev"]').evaluate((td) => {
    const r = document.createRange();
    r.selectNodeContents(td);
    return td.getBoundingClientRect().right - r.getBoundingClientRect().right;
  });
  // text ends at the cell's right padding, not at its left
  expect(gap).toBeLessThan(20);
});

for (const [theme, dir] of [["light", "ltr"], ["dark", "ltr"], ["light", "rtl"]] as const) {
  test(`whole demo page passes axe (${theme}, ${dir})`, async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#liste .dg")).toHaveAttribute("data-state", /ready/);
    await expect(page.locator("#ozet .dg").first()).toHaveAttribute("data-state", /ready/);
    await page.selectOption("#ctl-theme", theme);
    await page.selectOption("#ctl-dir", dir);
    const { default: AxeBuilder } = await import("@axe-core/playwright");
    const r = await new AxeBuilder({ page }).include("main").analyze();
    const v = r.violations.map((x) => `${x.id}: ${x.nodes.length} — ${x.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(v, v.join("\n")).toEqual([]);
  });
}
