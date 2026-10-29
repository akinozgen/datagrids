import { resolve } from "node:path";
import { test, expect, type Page } from "@playwright/test";

const entry = `/@fs${resolve("src/index.ts")}`;

async function mount(page: Page) {
  await page.route("**/kisi/**", (r) => r.fulfill({ contentType: "text/html", body: "<!doctype html><title>Kişi</title><h1>Kişi</h1>" }));
  await page.goto("/");
  await page.evaluate(async (src) => {
    document.documentElement.lang = "tr";
    const lib = await import(src);
    // a host stylesheet that colours and underlines every link (Bootstrap-like)
    const css = document.createElement("style");
    css.textContent = "a{color:#007bff} a:hover{color:#0056b3;text-decoration:underline} a:visited{color:purple}";
    document.head.append(css);
    document.body.innerHTML = "<main style='padding:16px;max-width:760px'><table id='al'></table><table id='am'></table></main>";
    const crew = [{ id: 1, ad: "Jill Valentine", durum: "aktif" }, { id: 2, ad: "Albert Wesker", durum: "pasif" }];
    new lib.Datagrid("#al", {
      label: "Satır içi",
      columns: [lib.column.text("ad", { title: "Ad" }), lib.column.actions()],
      use: [lib.arraySource(crew), lib.actions({ items: [
        { id: "detay", label: "Detay", icon: "eye", href: "/kisi/{id}" },
        { id: "rapor", label: "Rapor", href: "/kisi/{id}/rapor", target: "_blank", confirm: "Rapor açılsın mı?", disabled: (r: { durum: string }) => (r.durum === "pasif" ? "Pasif kayıt" : null) },
      ] })],
    });
    new lib.Datagrid("#am", {
      label: "Menü",
      columns: [lib.column.text("ad", { title: "Ad" }), lib.column.actions()],
      use: [lib.arraySource(crew), lib.actions({ items: [
        { id: "detay", label: "Detay", href: "/kisi/{id}", primary: true },
        { id: "duzenle", label: "Düzenle", href: "/kisi/{id}/duzenle" },
        { id: "sil", label: "Sil", tone: "danger", handler: () => {} },
      ] })],
    });
  }, entry);
}

test("href actions are real links (inline and in the menu); disabled ones stay buttons; host link styles do not leak in", async ({ page }) => {
  await mount(page);
  const g = page.locator(".dg").first();
  const detay = g.locator("tbody tr").first().locator('[data-action="detay"]');
  await expect(detay).toHaveJSProperty("tagName", "A");
  await expect(detay).toHaveAttribute("href", "/kisi/1");
  const rapor = g.locator("tbody tr").first().locator('[data-action="rapor"]');
  await expect(rapor).toHaveAttribute("target", "_blank");
  await expect(rapor).toHaveAttribute("rel", "noopener");
  // disabled (reason) → a button that explains itself
  await expect(g.locator("tbody tr").nth(1).locator('[data-action="rapor"]')).toHaveJSProperty("tagName", "BUTTON");
  await detay.hover();
  await expect(detay).toHaveCSS("text-decoration-line", "none");
  const fg = await g.locator("tbody td").first().evaluate((td) => getComputedStyle(td).color);
  await expect(detay).toHaveCSS("color", fg);
  if (process.env.DG_SHOT) await page.locator("main").screenshot({ path: process.env.DG_SHOT });
  const m = page.locator(".dg").nth(1);
  await m.locator("tbody tr").first().locator(".dg-actions-trigger").click();
  const item = page.locator('.dg-actions-menu [role="menuitem"][data-action="duzenle"]');
  await expect(item).toHaveJSProperty("tagName", "A");
  await expect(item).toHaveAttribute("href", "/kisi/1/duzenle");
  await expect(item).toBeFocused();
  await item.hover();
  await expect(item).toHaveCSS("text-decoration-line", "none");
  if (process.env.DG_SHOT) await page.screenshot({ path: process.env.DG_SHOT.replace(/\.png$/, "-menu.png") });
  await expect(page.locator('.dg-actions-menu [role="menuitem"][data-action="sil"]')).toHaveJSProperty("tagName", "BUTTON");
  // keyboard: Enter on the focused link item navigates
  await Promise.all([page.waitForURL("**/kisi/1/duzenle"), page.keyboard.press("Enter")]);
});

test("a plain click goes through confirm; a ctrl-click opens a new tab natively", async ({ page, context }) => {
  await mount(page);
  const g = page.locator(".dg").first();
  const rapor = g.locator("tbody tr").first().locator('[data-action="rapor"]');
  await rapor.click();
  const dlg = page.locator("dialog.dg-dialog");
  await expect(dlg).toBeVisible();
  await expect(dlg).toContainText("Rapor açılsın mı?");
  await dlg.getByRole("button", { name: /Vazgeç|İptal/ }).click();
  await expect(dlg).toBeHidden();
  expect(page.url()).not.toContain("/kisi/");
  const detay = g.locator("tbody tr").first().locator('[data-action="detay"]');
  const [tab] = await Promise.all([context.waitForEvent("page"), detay.click({ modifiers: ["ControlOrMeta"] })]);
  await tab.waitForLoadState();
  expect(tab.url()).toContain("/kisi/1");
  expect(page.url()).not.toContain("/kisi/");
  await Promise.all([page.waitForURL("**/kisi/1"), detay.click()]);
});
