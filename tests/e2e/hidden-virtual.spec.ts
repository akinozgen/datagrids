import { test, expect } from "@playwright/test";

test("a virtual grid built inside a hidden container locks real column widths once shown", async ({ page }) => {
  await page.goto("/");
  const widths = await page.evaluate(async () => {
    const lib = await import("/@fs/home/ozgen/Masaüstü/datagrids/src/index.ts" as string);
    const box = document.createElement("div");
    box.style.display = "none";
    box.innerHTML = "<table id='hv'></table>";
    document.body.prepend(box);
    const rows = Array.from({ length: 400 }, (_, i) => ({ id: i + 1, kayit: `K-${i}`, ad: `Kişi ${i} uzun bir ad soyad`, tutar: i * 3 }));
    const g = new lib.Datagrid("#hv", { label: "gizli", paging: false, columns: [lib.column.text("kayit"), lib.column.text("ad"), lib.column.number("tutar")], use: [lib.arraySource(rows)] });
    await new Promise((r) => setTimeout(r, 50));
    box.style.display = "block";
    await new Promise((r) => setTimeout(r, 300));
    const cols = Array.from(document.querySelectorAll("#hv > colgroup col")).map((c) => (c as HTMLElement).style.inlineSize);
    const rendered = document.querySelectorAll("#hv tbody tr:not(.dg-spacer)").length;
    g.destroy();
    box.remove();
    return { cols, rendered };
  });
  expect(widths.cols.length).toBe(3);
  for (const w of widths.cols) expect(parseFloat(w)).toBeGreaterThan(20);
  expect(widths.rendered).toBeLessThan(200);
});
