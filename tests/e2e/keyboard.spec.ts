import { test, expect, type Page } from "@playwright/test";
import { ready, axe } from "./helpers";

const S = "#klavye";
const focused = (page: Page) =>
  page.evaluate(() => {
    const a = document.activeElement as HTMLElement;
    const cell = a.closest("td, th");
    return { tag: a.tagName.toLowerCase(), key: cell?.getAttribute("data-key") ?? null, row: (cell?.parentElement as HTMLTableRowElement | null)?.getAttribute("data-key") ?? (cell?.closest("thead") ? "head" : null) };
  });

test.beforeEach(async ({ page }) => {
  await page.goto("/#klavye");
  await ready(page, "klavye");
});

test("one tab stop; arrows, Home/End, Ctrl+End move between cells and widgets", async ({ page }) => {
  await expect(page.locator(`${S} table`)).toHaveAttribute("role", "grid");
  expect(await page.locator(`${S} table [tabindex="0"]`).count()).toBe(1);
  // the skip link sits right before the table
  await page.locator(`${S} .dg-skip`).focus();
  await page.keyboard.press("Tab");
  // the header select-all checkbox is the first cell's single widget
  expect(await focused(page)).toEqual({ tag: "input", key: "__select", row: "head" });
  await page.keyboard.press("ArrowRight");
  expect(await focused(page)).toEqual({ tag: "button", key: "kayit", row: "head" });
  await page.keyboard.press("ArrowDown");
  expect(await focused(page)).toMatchObject({ tag: "td", key: "kayit" });
  await page.keyboard.press("ArrowRight");
  expect(await focused(page)).toMatchObject({ tag: "a", key: "ad" });
  await page.keyboard.press("End");
  expect(await focused(page)).toMatchObject({ tag: "td", key: "islem" });
  // two widgets: Enter steps in, Esc comes back
  await page.keyboard.press("Enter");
  expect(await focused(page)).toMatchObject({ tag: "button", key: "islem" });
  await page.keyboard.press("Escape");
  expect(await focused(page)).toMatchObject({ tag: "td", key: "islem" });
  await page.keyboard.press("Home");
  expect(await focused(page)).toMatchObject({ tag: "input", key: "__select" });
  await page.keyboard.press("Space");
  await expect(page.locator(`${S} tbody tr`).first()).toHaveAttribute("data-selected", "");
  await page.keyboard.press("Control+End");
  expect(await focused(page)).toMatchObject({ key: "islem" });
  expect(await page.locator(`${S} table [tabindex="0"]`).count()).toBe(1);
  // Tab leaves the grid
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("table"))).toBe(false);
  await axe(page, S);
});

test("PageDown changes the page and keeps the column; RTL mirrors the horizontal arrows", async ({ page }) => {
  await page.locator(`${S} tbody tr:first-child td[data-key="birim"]`).click();
  expect(await focused(page)).toMatchObject({ tag: "td", key: "birim" });
  await page.keyboard.press("PageDown");
  await expect(page.locator(`${S} .dg-pager-input`)).toHaveValue("2");
  await expect.poll(async () => (await focused(page)).key).toBe("birim");
  const firstOnPage2 = await page.locator(`${S} tbody tr`).first().getAttribute("data-key");
  expect((await focused(page)).row).toBe(firstOnPage2);
  await page.selectOption("#ctl-dir", "rtl");
  await page.locator(`${S} tbody tr:first-child td[data-key="birim"]`).focus();
  await page.keyboard.press("ArrowLeft");
  expect(await focused(page)).toMatchObject({ key: "durum" });
});
