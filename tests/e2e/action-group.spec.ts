import { resolve } from "node:path";
import { test, expect, type Page } from "@playwright/test";

const entry = `/@fs${resolve("src/index.ts")}`;

async function mount(page: Page, extra: Record<string, unknown>, width = "760px") {
  await page.goto("/");
  await page.evaluate(async ([src, extra, width]) => {
    document.documentElement.lang = "tr";
    const lib = await import(src as string);
    document.body.innerHTML = `<main style='padding:16px;max-width:${width}'><table id='ag'></table></main>`;
    const crew = ["Jill Valentine", "Chris Redfield", "Leon S. Kennedy", "Claire Redfield"].map((ad, i) => ({ id: i + 1, ad, durum: i % 2 ? "iptal" : "aktif" }));
    new lib.Datagrid("#ag", {
      label: "Grup",
      columns: [lib.column.text("ad", { title: "Ad" }), lib.column.actions()],
      use: [lib.arraySource(crew), lib.actions({
        items: [
          { id: "detay", label: "Detay", icon: "eye", href: "#k-{id}" },
          { id: "rapor", label: "Rapor", href: "#r-{id}", disabled: (r: { durum: string }) => (r.durum === "iptal" ? "İptal edilmiş kaydın raporu yok" : null) },
        ],
        ...(extra as object),
      })],
    });
  }, [entry, extra, width]);
  await expect(page.locator(".dg tbody tr")).toHaveCount(4);
}

const boxes = (page: Page) =>
  page.locator("td[data-col=actions] .dg-actions").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.left)}:${Math.round(r.width)}`; }));

test("inline actions are one joined group by default and line up from row to row", async ({ page }) => {
  await mount(page, {});
  await expect(page.locator(".dg-actions").first()).toHaveAttribute("data-group", "");
  expect(new Set(await boxes(page)).size).toBe(1);
  const [a, b] = await page.locator("tbody tr").first().locator(".dg-cellbtn").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  expect(Math.round(b!.left)).toBe(Math.round(a!.right) - 1); // shared border
  if (process.env.DG_SHOT) await page.locator("main").screenshot({ path: process.env.DG_SHOT });
});

test("buttonGroup: false keeps separate buttons", async ({ page }) => {
  await mount(page, { buttonGroup: false });
  await expect(page.locator(".dg-actions").first()).not.toHaveAttribute("data-group", "");
  await expect(page.locator(".dg-why-slot")).toHaveCount(0);
  const [a, b] = await page.locator("tbody tr").first().locator(".dg-cellbtn").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  expect(b!.left - a!.right).toBeGreaterThan(2);
});

test("narrow root: icon buttons shrink to the icon and keep their name; icon-less ones keep their text", async ({ page }) => {
  await mount(page, {}, "360px");
  await expect(page.locator(".dg")).toHaveAttribute("data-bp", "xs");
  const row = page.locator("tbody tr").first();
  await expect(row.getByRole("link", { name: "Detay" })).toBeVisible();
  await expect(row.locator('[data-action="detay"] > span')).toBeHidden();
  await expect(row.locator('[data-action="rapor"]')).toHaveText("Rapor");
  await expect(row.locator('[data-action="rapor"] > span').first()).toBeVisible();
});
