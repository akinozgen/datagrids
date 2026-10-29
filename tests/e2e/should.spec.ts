import { test, expect, type Locator, type Page } from "@playwright/test";
import { axe } from "./helpers";

const ready = (l: Locator) => expect(l).toHaveAttribute("data-state", "ready");
const names = (g: Locator) => g.locator('tbody td[data-key="ad"]').allInnerTexts();

/** Pointer drag of a row handle to the lower part of a target row (mouse); `hold` keeps the button down. */
async function dragRow(page: Page, g: Locator, from: number, to: number, o: { hold?: boolean } = {}) {
  const rows = g.locator("tbody tr");
  await rows.nth(Math.max(from, to)).scrollIntoViewIfNeeded();
  const h = (await rows.nth(from).locator(".dg-reorder").boundingBox())!;
  const t = (await rows.nth(to).boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 + 8, { steps: 2 });
  await page.mouse.move(h.x + h.width / 2, t.y + t.height * 0.8, { steps: 6 });
  if (!o.hold) await page.mouse.up();
}

test.describe("rowReorder", () => {
  const S = "#satir-sirasi";
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${S}`);
    await ready(page.locator(`${S} .dg`).nth(0));
    await ready(page.locator(`${S} .dg`).nth(1));
  });

  test("pointer drag on the client grid: drop line, Esc cancels, drop renumbers the order column", async ({ page }) => {
    const g = page.locator(`${S} .dg`).nth(0);
    await expect(g.locator("tbody .dg-reorder")).toHaveCount(8);
    await expect(g.locator("tbody tr").first().locator(".dg-reorder")).toHaveCSS("cursor", "grab");

    await dragRow(page, g, 0, 2, { hold: true });
    await expect(g.locator(".dg-drop-line")).toBeVisible();
    await expect(g.locator("tbody tr").first()).toHaveAttribute("data-state", "dragging");
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(g.locator(".dg-drop-line")).toBeHidden();
    await expect(g.locator('tbody tr[data-state="dragging"]')).toHaveCount(0);
    expect((await names(g))[0]).toBe("Jill Valentine");

    await dragRow(page, g, 0, 2);
    await expect.poll(() => names(g)).toEqual(["Chris Redfield", "Leon S. Kennedy", "Jill Valentine", "Claire Redfield", "Albert Wesker", "Rebecca Chambers", "Barry Burton", "Ada Wong"]);
    expect(await g.locator('tbody td[data-key="sira"]').allInnerTexts()).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
    await expect(page.locator(`${S} .demo-log`).first()).toContainText("onEnd → key=1012 from=0 to=2 offset=0 prevKey=1010 nextKey=1009");
    await expect(g.locator(".dg-drop-line")).toBeHidden();
  });

  test("keyboard on the server grid: Space grabs, arrows move, Space drops → onEnd, one reload on the same page", async ({ page }) => {
    const g = page.locator(`${S} .dg`).nth(1);
    const log = page.locator(`${S} .demo-log`).nth(1);
    await g.locator('[data-go="next"]').click();
    await expect(g.locator(".dg-pager-input")).toHaveValue("2");
    await expect(log).toContainText("start=10");
    await expect(g.locator("tbody tr").nth(1)).toHaveAttribute("data-key", "1025");
    const h = g.locator('tbody tr[data-key="1025"] .dg-reorder');
    await expect(h).toHaveAccessibleName("Taşı: Sherry Birkin");
    await expect(h).toHaveAccessibleDescription(/Boşluk ya da Enter ile tutun/);
    await h.focus();
    await page.keyboard.press("Space");
    await expect(h).toHaveAttribute("aria-pressed", "true");
    await expect(g.locator(".dg-live")).toHaveText("Sherry Birkin tutuldu, konum 2 / 10.");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(h).toBeFocused();
    await expect(g.locator(".dg-live")).toHaveText("Sherry Birkin: konum 4 / 10.");
    await page.keyboard.press("Space");
    await expect(log).toContainText("onEnd → key=1025 from=1 to=3 offset=10 prevKey=1023 nextKey=1022");
    await expect.poll(async () => (await log.textContent())!.split("\n")[0]).toContain("start=10 length=10");
    await expect(g.locator("tbody tr").nth(3).locator('td[data-key="ad"]')).toHaveText("Sherry Birkin");
    await expect(g.locator("tbody tr").nth(3).locator('td[data-key="sira"]')).toHaveText("14");
    await expect(g.locator(".dg-pager-input")).toHaveValue("2");
    await expect(g.locator("tbody tr").nth(3).locator(".dg-reorder")).toBeFocused();
  });

  test("a failed save puts the row back and shows the error", async ({ page }) => {
    const g = page.locator(`${S} .dg`).nth(1);
    await page.getByRole("button", { name: "Sonraki kayıt hata versin" }).click();
    const h = g.locator("tbody tr").first().locator(".dg-reorder");
    await h.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await expect(g.locator('.dg-banner[data-kind="error"]')).toContainText("Sıra kaydedilemedi: sunucu 500 döndü");
    await expect.poll(async () => (await names(g))[0]).toBe("Jill Valentine");
    await expect(g.locator("tbody tr[aria-busy]")).toHaveCount(0);
  });

  test("sorted by another column: handles stay visible but disabled, with the reason", async ({ page }) => {
    const g = page.locator(`${S} .dg`).nth(1);
    await page.getByRole("button", { name: "Tutara göre sırala" }).click();
    await expect(g.locator('th[data-key="tutar"]')).toHaveAttribute("aria-sort", "descending");
    const h = g.locator("tbody tr").first().locator(".dg-reorder");
    await expect(h).toBeVisible();
    await expect(h).toHaveAttribute("aria-disabled", "true");
    await expect(h).toHaveAttribute("data-dg-tip", "Taşımak için “Sıra” sıralamasına dönün");
    await expect(h).toHaveAccessibleDescription("Taşımak için “Sıra” sıralamasına dönün");
    await expect(h).toHaveCSS("cursor", "not-allowed");
    await h.focus();
    await page.keyboard.press("Space");
    await expect(h).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "Sıra'ya dön" }).click();
    await expect(g.locator("tbody tr").first().locator(".dg-reorder")).not.toHaveAttribute("aria-disabled", /.*/);
  });

  test("axe: idle and while a row is held", async ({ page }) => {
    await axe(page, S);
    const h = page.locator(`${S} .dg`).nth(0).locator("tbody tr").nth(2).locator(".dg-reorder");
    await h.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowUp");
    await axe(page, S);
  });
});

test.describe("cursorPaginate (laravelPaginator)", () => {
  const S = "#cursor-sayfalama";
  const info = (page: Page) => page.locator(`${S} .dg-info`);
  const input = (page: Page) => page.locator(`${S} .dg-pager-input`);
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${S}`);
    await ready(page.locator(`${S} .dg`));
  });

  test("unknown total; next uses the learned cursor, back returns to it", async ({ page }) => {
    const log = page.locator(`${S} .demo-log`);
    await expect(log).toContainText("GET /api/should/cursor/gorevler?page=1&per_page=10&sort=-tarih → 200 · 10 satır · next_cursor=«id");
    await expect(info(page)).toContainText("1–10 gösteriliyor · toplam bilinmiyor");
    await expect(page.locator(`${S} [data-go="last"]`)).toBeDisabled();
    await page.locator(`${S} [data-go="next"]`).click();
    await expect(input(page)).toHaveValue("2");
    await expect(info(page)).toContainText("11–20");
    await expect(log).toContainText(/\?cursor=«id \d+ →»&per_page=10&sort=-tarih → 200 · 10 satır · next_cursor=«id \d+ →» prev_cursor=«id \d+ ←»/);
    await page.locator(`${S} [data-go="prev"]`).click();
    await expect(input(page)).toHaveValue("1");
    await expect(log).toContainText("GET /api/should/cursor/gorevler?per_page=10&sort=-tarih → 200");
  });

  test("a jump past the known cursors lands on the furthest known page", async ({ page }) => {
    await input(page).fill("5");
    await input(page).press("Enter");
    await expect(input(page)).toHaveValue("2");
    await expect(info(page)).toContainText("11–20");
  });

  test("reaching the end reveals the count and enables “last”", async ({ page }) => {
    for (let p = 2; p <= 6; p++) {
      await page.locator(`${S} [data-go="next"]`).click();
      await expect(input(page)).toHaveValue(String(p));
    }
    await expect(info(page)).toContainText("51–57 / 57 kayıt");
    await expect(page.locator(`${S} [data-go="next"]`)).toBeDisabled();
    await page.locator(`${S} [data-go="prev"]`).click();
    await expect(info(page)).toContainText("41–50 / 57 kayıt");
    await expect(page.locator(`${S} .dg-pager-total`)).toContainText("6");
    await page.locator(`${S} [data-go="last"]`).click();
    await expect(input(page)).toHaveValue("6");
    await expect(page.locator(`${S} tbody tr`)).toHaveCount(7);
  });

  test("JsonResource shape is detected too; sorting starts a new cursor chain", async ({ page }) => {
    await page.getByRole("button", { name: "JsonResource", exact: true }).click();
    await page.locator(`${S} [data-go="next"]`).click();
    await expect(input(page)).toHaveValue("2");
    await expect(page.locator(`${S} .demo-log`)).toContainText(/cursor=«id \d+ →»&per_page=10/);
    await page.locator(`${S} th[data-key="ad"] .dg-sort`).click();
    await expect(input(page)).toHaveValue("1");
    await expect(page.locator(`${S} .demo-log`)).toContainText("?per_page=10&sort=ad → 200");
    await axe(page, `${S} .dg`);
  });
});

test.describe("filterPresets", () => {
  const S = "#hazir-filtreler";
  const g1 = (page: Page) => page.locator(`${S} .dg`).nth(0);
  const g2 = (page: Page) => page.locator(`${S} .dg`).nth(1);
  const pressed = (g: Locator) => g.locator('.dg-preset[aria-pressed="true"]');
  test.beforeEach(async ({ page }) => {
    await page.goto(`/${S}`);
    await ready(g1(page));
    await ready(g2(page));
  });

  test("chips: permanent indicator, default active, click applies through the panel", async ({ page }) => {
    const chip = g1(page).getByRole("button", { name: "Açık + eksi" });
    await expect(chip.locator(".dg-preset-dot")).toBeVisible();
    await expect(chip).toHaveCSS("cursor", "pointer");
    await expect(pressed(g1(page))).toHaveText("Tümü");
    await expect(g1(page).getByRole("group", { name: "Hazır filtreler" })).toBeVisible();
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await expect(pressed(g1(page))).toHaveCount(1);
    await expect(page.locator("#fp-durum")).toHaveValue("acik");
    await expect(page.locator("#fp-eksi")).toBeChecked();
    await expect(page.locator(`${S} .demo-log`).first()).toContainText('active() = "acik-eksi"');
    for (const t of await g1(page).locator('tbody td[data-key="durum"]').allInnerTexts()) expect(t).toBe("Açık");
    expect(await g1(page).locator('tbody td[data-key="tutar"] .dg-money:not([data-sign="neg"])').count()).toBe(0);
    await expect(page).toHaveURL(/onayar\.f\.durum=acik/);
  });

  test("manual changes: a matching preset lights up, a custom mix shows none", async ({ page }) => {
    await page.selectOption("#fp-durum", "bekliyor");
    await expect(pressed(g1(page))).toHaveText("Beklemede");
    await page.check("#fp-eksi");
    await expect(pressed(g1(page))).toHaveCount(0);
    await g1(page).getByRole("button", { name: "Tümü" }).click();
    await expect(page.locator("#fp-durum")).toHaveValue("");
    await expect(page.locator("#fp-eksi")).not.toBeChecked();
    await expect(pressed(g1(page))).toHaveText("Tümü");
  });

  test("the URL restores the preset after a reload", async ({ page }) => {
    await g1(page).getByRole("button", { name: "Açık işler" }).click();
    await expect(page).toHaveURL(/onayar\.f\.durum=acik/);
    await page.reload();
    await ready(g1(page));
    await expect(pressed(g1(page))).toHaveText("Açık işler");
    await expect(page.locator("#fp-durum")).toHaveValue("acik");
  });

  test("grid target on the server: one request with the typed filter", async ({ page }) => {
    const log = page.locator(`${S} .demo-log`).nth(1);
    await expect(log).toContainText("filters={}");
    await g2(page).getByRole("button", { name: "Eksi tutar" }).click();
    await expect(log).toContainText('filters={"tutar":{"op":"lt","value":0}} page={"size":8,"number":1}');
    await expect(pressed(g2(page))).toHaveText("Eksi tutar");
    expect((await log.textContent())!.split("\n").filter((l) => l.includes('"op":"lt"'))).toHaveLength(1);
    expect(await g2(page).locator('tbody td[data-key="tutar"] .dg-money:not([data-sign="neg"])').count()).toBe(0);
    await g2(page).getByRole("button", { name: "Beklemede + taslak" }).click();
    await expect(log).toContainText('filters={"durum":{"op":"in","value":["bekliyor","taslak"]}}');
  });

  test("axe", async ({ page }) => {
    await axe(page, S);
  });
});
