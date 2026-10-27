import { test, expect, type Page } from "@playwright/test";
import { axe } from "./helpers";

const money = (s: string) => Number(s.replace(/[^\d,-]/g, "").replace(",", "."));
const ready = (page: Page, id: string) => expect(page.locator(`#${id} .dg`).first()).toHaveAttribute("data-state", "ready");

test.describe("filterPanel + urlSync + softDeletes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#filtre-paneli");
    await ready(page, "filtre-paneli");
  });

  test("select / multi-select / text / checkbox travel as params and reload from page 1", async ({ page }) => {
    const s = page.locator("#filtre-paneli");
    const log = s.locator(".demo-log");
    await expect(log).toContainText('durum= birim=[] gorev="" eksi=0 _deleted=(yok)');
    await s.locator('[data-go="next"]').click();
    await expect(log).toContainText("start=10 length=10");

    await page.selectOption("#lf-durum", "iptal");
    await expect(log).toContainText('durum=iptal birim=[] gorev="" eksi=0 _deleted=(yok) search="" start=0');
    await expect(s.locator(".dg-pager-input")).toHaveValue("1");
    for (const t of await s.locator('tbody td[data-key="durum"]').allInnerTexts()) expect(t).toBe("İptal");

    await page.selectOption("#lf-durum", "");
    await page.selectOption("#lf-birim", ["R.P.D.", "Sivil"]);
    await expect(log).toContainText('birim=["R.P.D.","Sivil"]');
    for (const t of await s.locator('tbody td[data-key="birim"]').allInnerTexts()) expect(["R.P.D.", "Sivil"]).toContain(t);

    await page.selectOption("#lf-birim", []);
    await page.fill("#lf-gorev", "devriye");
    await expect(log).toContainText('birim=[] gorev="devriye"');
    for (const t of await s.locator('tbody td[data-key="gorev"]').allInnerTexts()) expect(t.toLowerCase()).toContain("devriye");

    await page.fill("#lf-gorev", "");
    await page.check("#lf-eksi");
    await expect(log).toContainText('gorev="" eksi=1');
    await expect(s.locator('tbody tr').first().locator(".dg-money")).toHaveAttribute("data-sign", "neg");
    expect(await s.locator('tbody td[data-key="tutar"] .dg-money:not([data-sign="neg"])').count()).toBe(0);
  });

  test("state goes to the URL and a reload restores it", async ({ page }) => {
    const s = page.locator("#filtre-paneli");
    await page.selectOption("#lf-durum", "tamam");
    await s.locator(".dg-search-input").fill("Valentine");
    await expect(page).toHaveURL(/[?&]q=Valentine/);
    await expect(page).toHaveURL(/[?&]f\.durum=tamam/);
    await s.locator('th[data-key="ad"] .dg-sort').click();
    await expect(page).toHaveURL(/[?&]sort=ad/);

    await page.goto("/?q=Chris&f.durum=acik&sort=-tutar&page=2#filtre-paneli");
    await ready(page, "filtre-paneli");
    await expect(s.locator(".dg-search-input")).toHaveValue("Chris");
    await expect(page.locator("#lf-durum")).toHaveValue("acik");
    await expect(s.locator('th[data-key="tutar"]')).toHaveAttribute("aria-sort", "descending");
    await expect(s.locator(".demo-log")).toContainText('durum=acik birim=[] gorev="" eksi=0 _deleted=(yok) search="Chris"');
    await expect(page).toHaveURL(/[?&]q=Chris/);
  });

  test("page from the URL is restored with a single request", async ({ page }) => {
    await page.goto("/?page=3#filtre-paneli");
    const s = page.locator("#filtre-paneli");
    await expect(s.locator(".dg-pager-input")).toHaveValue("3");
    await expect(s.locator(".demo-log")).toContainText("start=20 length=10");
    await expect(s.locator(".dg-info")).toContainText("21–30");
    await expect(s.locator(".demo-log")).not.toContainText("start=0 ");
  });

  test("soft-delete toggle adds _deleted=1 and mutes deleted rows", async ({ page }) => {
    const s = page.locator("#filtre-paneli");
    const toggle = s.getByRole("button", { name: "Silinenleri göster" });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(s.locator('tbody tr[data-tone="muted"]')).toHaveCount(0);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(s.locator(".demo-log")).toContainText("_deleted=1");
    await expect(s.locator('tbody tr[data-tone="muted"]').first()).toBeVisible();
    await expect(s.locator(".dg-count")).toContainText("240");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(s.locator('tbody tr[data-tone="muted"]')).toHaveCount(0);
  });

  test("axe", async ({ page }) => {
    await axe(page, "#filtre-paneli");
  });
});

test.describe("footer + metaBind", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#ozet");
    await ready(page, "ozet");
  });

  test("footer sum matches the visible rows, also after paging", async ({ page }) => {
    const g = page.locator("#g-ozet-istemci");
    const root = page.locator("#ozet .dg").first();
    const check = async () => {
      const cells = await g.locator('tbody td[data-key="tutar"]').allInnerTexts();
      const want = Math.round(cells.reduce((a, t) => a + money(t), 0) * 100) / 100;
      const foot = g.locator('tfoot td[data-key="tutar"]');
      await expect(foot.locator(".dg-money")).toBeVisible();
      expect(money(await foot.innerText())).toBeCloseTo(want, 2);
      expect(money(await page.locator("#kpi-c-sayfa").innerText())).toBeCloseTo(want, 2);
    };
    await expect(g.locator("tfoot th[data-col=label]")).toHaveText("Sayfa toplamı");
    await expect(g.locator("tfoot th[data-col=label]")).toHaveAttribute("colspan", "6");
    await check();
    await root.locator('[data-go="next"]').click();
    await expect(root.locator(".dg-pager-input")).toHaveValue("2");
    await check();
    await root.locator('[data-go="last"]').click();
    await expect(g.locator("tbody tr")).toHaveCount(7);
    await check();
  });

  test("metaBind writes response values and follows reloads", async ({ page }) => {
    const root = page.locator("#ozet .dg").nth(1);
    const kpi = page.locator("#kpi-toplam");
    const expected = () =>
      page.evaluate(() => {
        const v = (window as any).grids.ozetSunucu.lastResponse().summary.toplam as number;
        return `${new Intl.NumberFormat("tr", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} ₺`;
      });
    await expect(kpi).not.toHaveText("—");
    await expect(kpi).toHaveText(await expected());
    const before = await kpi.innerText();
    await root.locator(".dg-search-input").fill("Valentine");
    await expect(page.locator("#kpi-kayit")).not.toHaveText("221");
    await expect(kpi).not.toHaveText(before);
    await expect(kpi).toHaveText(await expected());
    // footer(scope: "response") shows the same server total
    expect(money(await root.locator('tfoot td[data-key="tutar"]').innerText())).toBe(money(await kpi.innerText()));
  });

  test("axe", async ({ page }) => {
    await axe(page, "#ozet");
  });
});
