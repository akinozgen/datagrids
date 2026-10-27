import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export async function ready(page: Page, section: string) {
  await expect(page.locator(`#${section} .dg`).first()).toHaveAttribute("data-state", /ready|empty|idle|error/);
}

export async function axe(page: Page, include: string) {
  const r = await new AxeBuilder({ page }).include(include).analyze();
  const v = r.violations.map((x) => `${x.id}: ${x.nodes.length} — ${x.help} — ${x.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
  expect(v, v.join("\n")).toEqual([]);
}
