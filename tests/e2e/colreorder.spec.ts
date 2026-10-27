import { test, expect, type Page } from "@playwright/test";
import { ready, axe } from "./helpers";

const S = "#kolon-sirasi";
const heads = (page: Page) => page.locator(`${S} thead th`).evaluateAll((ths) => ths.filter((t) => !(t as HTMLElement).hidden).map((t) => t.getAttribute("data-key")));
const firstRow = (page: Page) => page.locator(`${S} tbody tr`).first().locator("td").evaluateAll((tds) => tds.filter((t) => !(t as HTMLElement).hidden).map((t) => t.getAttribute("data-key")));
const WIRE = "columns=[,kayit,ad,birim,gorev,durum,tutar,tarih]";

async function drag(page: Page, from: string, to: string, opts: { cancel?: boolean } = {}) {
  const a = await page.locator(`${S} th[data-key="${from}"]`).boundingBox();
  const b = await page.locator(`${S} th[data-key="${to}"]`).boundingBox();
  await page.mouse.move(a!.x + a!.width / 2, a!.y + a!.height / 2);
  await page.mouse.down();
  await page.mouse.move(a!.x + a!.width / 2 - 20, a!.y + a!.height / 2, { steps: 4 });
  await page.mouse.move(b!.x + 4, b!.y + b!.height / 2, { steps: 8 });
  await expect(page.locator(`${S} .dg-col-drop`)).toBeVisible();
  await expect(page.locator(`${S} th[data-key="${from}"]`)).toHaveAttribute("data-state", "dragging");
  if (opts.cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/#kolon-sirasi");
  await ready(page, "kolon-sirasi");
});

test.describe("colReorder", () => {
  test("every movable header shows a grip; special columns do not", async ({ page }) => {
    await expect(page.locator(`${S} th[data-dg-movable] .dg-col-grip`)).toHaveCount(7);
    await expect(page.locator(`${S} th[data-col="rownum"] .dg-col-grip`)).toHaveCount(0);
  });

  test("dragging a header moves the column; the request keeps the definition order", async ({ page }) => {
    await drag(page, "tutar", "ad");
    await expect.poll(() => heads(page)).toEqual(["__index", "kayit", "tutar", "ad", "birim", "gorev", "durum", "tarih"]);
    expect(await firstRow(page)).toEqual(["__index", "kayit", "tutar", "ad", "birim", "gorev", "durum", "tarih"]);
    await expect(page.locator(`${S} .dg-col-drop`)).toHaveCount(0);
    // the drag did not sort
    await expect(page.locator(`${S} th[data-key="tarih"]`)).toHaveAttribute("aria-sort", "descending");
    await expect(page.locator(`${S} th[data-key="tutar"]`)).not.toHaveAttribute("aria-sort", /.+/);
    // a sort after the move still sends the definition index
    await page.locator(`${S} th[data-key="tutar"] .dg-sort`).click();
    await expect(page.locator(`${S} .demo-log`)).toContainText(`${WIRE} order=[6:asc]`);
  });

  test("Esc cancels a drag", async ({ page }) => {
    await drag(page, "tutar", "ad", { cancel: true });
    await expect(page.locator(`${S} .dg-col-drop`)).toHaveCount(0);
    expect(await heads(page)).toEqual(["__index", "kayit", "ad", "birim", "gorev", "durum", "tutar", "tarih"]);
  });

  test("colVis move buttons: keyboard, focus stays, announced", async ({ page }) => {
    await page.locator(`${S} .dg-btn[aria-haspopup="dialog"]`).click();
    const up = page.locator(`${S} .dg-panel-row[data-key="durum"] .dg-move[data-dir="earlier"]`);
    await up.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(page.locator(`${S} .dg-panel-row[data-key="durum"] .dg-move[data-dir="earlier"]`)).toBeFocused();
    await expect.poll(() => heads(page)).toEqual(["__index", "kayit", "ad", "durum", "birim", "gorev", "tutar", "tarih"]);
    await expect(page.locator(`${S} .dg-live`)).toContainText("Durum kolonu 3. sıraya taşındı");
    // the first movable column cannot move earlier, the last cannot move later
    await expect(page.locator(`${S} .dg-panel-row[data-key="kayit"] .dg-move[data-dir="earlier"]`)).toBeDisabled();
    await expect(page.locator(`${S} .dg-panel-row[data-key="tarih"] .dg-move[data-dir="later"]`)).toBeDisabled();
    await axe(page, S);
  });

  test("order survives a reload (stateSave) and resetState restores it", async ({ page }) => {
    await page.getByRole("button", { name: "Tutar'ı başa al" }).click();
    await expect.poll(() => heads(page)).toEqual(["__index", "tutar", "kayit", "ad", "birim", "gorev", "durum", "tarih"]);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("dg:1:sira:/"))).toContain('"colReorder":["tutar"');
    await page.reload();
    await ready(page, "kolon-sirasi");
    await expect.poll(() => heads(page)).toEqual(["__index", "tutar", "kayit", "ad", "birim", "gorev", "durum", "tarih"]);
    await expect(page.locator(`${S} .demo-log`)).toContainText(WIRE);
    await page.locator(`${S} .dg-btn`, { hasText: "Sıfırla" }).click();
    await expect.poll(() => heads(page)).toEqual(["__index", "kayit", "ad", "birim", "gorev", "durum", "tutar", "tarih"]);
  });

  test("axe", async ({ page }) => {
    await axe(page, S);
  });
});
