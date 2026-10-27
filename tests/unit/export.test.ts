import { describe, expect, it } from "vitest";
import { inflateRawSync, crc32 as zcrc } from "node:zlib";
import { Datagrid, arraySource, column } from "../../src/index";
import type { ColumnDef, ResolvedColumn, Row } from "../../src/index";
import { excel, csv, print } from "../../src/modules/export";
import type { CsvApi, ExcelApi } from "../../src/modules/export";
import { buildSheet, exportCell, type Sheet } from "../../src/modules/export/values";
import { colName, serial, toXlsx } from "../../src/modules/export/xlsx";
import { zip } from "../../src/modules/export/zip";
import { toCsv } from "../../src/modules/export/csv";
import { printHtml } from "../../src/modules/export/print";

const flush = () => new Promise((r) => setTimeout(r, 0));

/** Minimal unzip (central directory → entries) for assertions. */
function unzip(buf: Uint8Array): Record<string, string> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = buf.length - 22;
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  expect(eocd).toBeGreaterThanOrEqual(0);
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out: Record<string, string> = {};
  const dec = new TextDecoder();
  for (let i = 0; i < count; i++) {
    expect(dv.getUint32(p, true)).toBe(0x02014b50);
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nlen));
    expect(dv.getUint32(off, true)).toBe(0x04034b50);
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const raw = buf.subarray(start, start + csize);
    const data = method === 8 ? new Uint8Array(inflateRawSync(raw)) : raw;
    expect(data.length).toBe(usize);
    expect(zcrc(data)).toBe(crc);
    out[name] = dec.decode(data);
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

const resolve = (defs: ColumnDef[]): ResolvedColumn[] =>
  defs.map((d, index) => ({
    ...d,
    index,
    title: d.title ?? d.key,
    sortable: true,
    searchable: true,
    visible: d.visible ?? true,
    hideable: true,
    exportable: d.exportable ?? !d.col,
  })) as ResolvedColumn[];

const COLS = resolve([
  column.text("ad", { title: "Ad" }),
  column.money("tutar", { title: "Tutar", source: "tr" }),
  column.date("tarih", { title: "Tarih", source: "local", time: true }),
  column.html("not", { title: "Not" }),
  { key: "birim", title: "Birim" }, // untyped (yajra-style HTML cell)
  column.badge("durum", { title: "Durum", labels: { acik: "Açık" } }),
  { key: "aktif", title: "Aktif" },
  column.text("gizli", { title: "Gizli", visible: false }),
  column.text("ic", { title: "İç", exportable: false }),
  column.actions(),
]);

const ROWS: Row[] = [
  {
    ad: '<Şemsiye A.Ş.> & "İç"',
    tutar: "-403,00",
    tarih: "2026-09-01 10:30:00",
    not: '<b>Acil</b> teslim <span class="sr-only">gizli</span><ul class="dropdown-menu"><li>Sil</li></ul><a data-export-ignore>x</a>',
    birim: "S.T.A.R.S. &amp; R.P.D.",
    durum: "acik",
    aktif: true,
    gizli: "no",
    ic: "no",
  },
  { ad: "=1+1", tutar: "1.234,56", tarih: "2026-10-27", not: "", birim: "<i>Işık Kulesi</i>", durum: "x", aktif: false },
];

describe("value pipeline", () => {
  const sheet = buildSheet(COLS, ROWS);
  it("keeps visible, exportable, non-special columns", () => {
    expect(sheet.columns.map((c) => c.key)).toEqual(["ad", "tutar", "tarih", "not", "birim", "durum", "aktif"]);
    expect(sheet.columns.map((c) => c.type)).toEqual(["string", "money", "date", "string", "string", "string", "boolean"]);
  });
  it("parses TR money, dates, strips noise, decodes yajra HTML", () => {
    const [r0, r1] = sheet.rows;
    expect(r0![0]).toBe('<Şemsiye A.Ş.> & "İç"'); // text column: literal, never parsed as HTML
    expect(r0![1]).toBe(-403);
    expect(r1![1]).toBe(1234.56);
    expect(r0![2]).toEqual(new Date(2026, 8, 1, 10, 30));
    expect(r0![3]).toBe("Acil teslim");
    // untyped column of a text source: exported as shown (literal)
    expect(r0![4]).toBe("S.T.A.R.S. &amp; R.P.D.");
    expect(r1![4]).toBe("<i>Işık Kulesi</i>");
    // the same column under an HTML-default source (yajra): decoded and stripped, as rendered
    const yajraSheet = buildSheet(COLS, ROWS, null, true);
    expect(yajraSheet.rows[0]![4]).toBe("S.T.A.R.S. & R.P.D.");
    expect(yajraSheet.rows[1]![4]).toBe("Işık Kulesi");
    expect(r0![5]).toBe("Açık");
    expect(r0![6]).toBe(true);
    expect(r1![3]).toBeNull();
  });
  it("exportValue wins; number type parses strings", () => {
    const [c] = resolve([{ key: "x", exportType: "number", exportValue: (r: Row) => `${r.x} adet` }]);
    expect(exportCell(c!, { x: "1.250" })).toBe(1250);
  });
});

describe("zip", () => {
  it.each([true, false])("round-trips (compress=%s)", async (compress) => {
    const files: Array<[string, string]> = [["a.txt", "Işık ".repeat(200)], ["dir/b.xml", "<x/>"]];
    const out = unzip(await zip(files, compress));
    expect(out["a.txt"]).toBe("Işık ".repeat(200));
    expect(out["dir/b.xml"]).toBe("<x/>");
  });
});

describe("xlsx", () => {
  it("column names", () => {
    expect([0, 25, 26, 701, 702].map(colName)).toEqual(["A", "Z", "AA", "ZZ", "AAA"]);
  });

  it("writes a valid package with numbers, serial dates and escaped strings", async () => {
    const sheet = buildSheet(COLS, ROWS);
    const files = unzip(await toXlsx(sheet, { sheetName: "Görevler" }));
    expect(Object.keys(files).sort()).toEqual(
      ["[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml"].sort(),
    );
    for (const [name, xml] of Object.entries(files)) {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      expect(doc.getElementsByTagName("parsererror").length, name).toBe(0);
    }
    const ws = files["xl/worksheets/sheet1.xml"]!;
    expect(ws).toMatch(/<c r="B2" s="\d+"><v>-403<\/v><\/c>/);
    expect(ws).toMatch(/<c r="B3" s="\d+"><v>1234.56<\/v><\/c>/);
    const d = serial(new Date(2026, 8, 1, 10, 30));
    expect(d).toBe(46266.4375);
    expect(ws).toContain(`<c r="C2" s="`);
    expect(ws).toContain(`<v>${d}</v>`);
    expect(ws).toContain("&lt;Şemsiye A.Ş.&gt; &amp; &quot;İç&quot;");
    expect(ws).toContain('<c r="G2" t="b"><v>1</v></c>');
    expect(ws).toContain('<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>');
    expect(ws).toContain('<autoFilter ref="A1:G3"/>');
    expect(ws).not.toContain("gizli");
    const styles = files["xl/styles.xml"]!;
    expect(styles).toContain('formatCode="#,##0.00\\ &quot;₺&quot;"');
    expect(styles).toContain('formatCode="dd\\.mm\\.yyyy\\ hh:mm"');
    expect(styles).toContain("<b/>");
    expect(files["xl/workbook.xml"]).toContain('<sheet name="Görevler"');
    expect(files["xl/workbook.xml"]).toContain("'Görevler'!$A$1:$G$3</definedName>");
  });

  it("footer rows are bold and outside the autoFilter range", async () => {
    const tfoot = document.createElement("tfoot");
    tfoot.innerHTML = '<tr><td>Toplam</td><td data-key="tutar">831,56 ₺</td></tr>';
    const sheet = buildSheet(COLS, ROWS, tfoot);
    expect(sheet.footer).toEqual([["Toplam", 831.56, null, null, null, null, null]]);
    const ws = unzip(await toXlsx(sheet))["xl/worksheets/sheet1.xml"]!;
    expect(ws).toMatch(/<row r="4"><c r="A4" t="inlineStr" s="1">/);
    expect(ws).toContain('<autoFilter ref="A1:G3"/>');
  });

  it("empty sheet stays valid", async () => {
    const files = unzip(await toXlsx({ columns: [], rows: [] }));
    expect(new DOMParser().parseFromString(files["xl/worksheets/sheet1.xml"]!, "application/xml").getElementsByTagName("parsererror").length).toBe(0);
  });
});

describe("csv", () => {
  const sheet: Sheet = {
    columns: [
      { key: "a", title: "Ad", type: "string" },
      { key: "t", title: "Tutar", type: "money", format: '#,##0.00 "₺"' },
      { key: "d", title: "Tarih", type: "date", format: "dd.mm.yyyy" },
      { key: "b", title: "Aktif", type: "boolean" },
    ],
    rows: [
      ['Şemsiye; "A.Ş."', -403, new Date(2026, 8, 1), true],
      ["=1+1", 1234.5, null, false],
      ["-5 adet", 0, null, null],
      ["@x", 1, null, null],
      ["satır\nsonu", 2, null, null],
      ["+90 532", 3, null, null],
    ],
  };
  const f = { delimiter: ";", decimal: ",", locale: "tr", yes: "Evet", no: "Hayır" };
  it("quotes, guards formulas, keeps numbers", () => {
    const lines = toCsv(sheet, { ...f, bom: true }).split("\r\n");
    expect(lines[0]).toBe("﻿Ad;Tutar;Tarih;Aktif");
    expect(lines[1]).toBe('"Şemsiye; ""A.Ş.""";-403,00;01.09.2026;Evet');
    expect(lines[2]).toBe("'=1+1;1234,50;;Hayır");
    expect(lines[3]).toBe("'-5 adet;0,00;;");
    expect(lines[4]).toBe("'@x;1,00;;");
    expect(lines[5]).toBe('"satır\nsonu";2,00;;'); // embedded newline stays inside quotes
    expect(lines[6]).toBe("'+90 532;3,00;;");
  });
  it("comma delimiter + dot decimal for other locales", () => {
    const out = toCsv(sheet, { delimiter: ",", decimal: ".", locale: "en", yes: "Yes", no: "No" });
    expect(out.startsWith("Ad,")).toBe(true);
    expect(out).toContain('"Şemsiye; ""A.Ş.""",-403.00,2026-09-01,Yes');
  });
});

describe("print document", () => {
  it("escapes values and right-aligns numbers", () => {
    const html = printHtml(buildSheet(COLS, ROWS), { title: "<Liste>", meta: "2 kayıt", lang: "tr", dir: "ltr", yes: "Evet", no: "Hayır", locale: "tr-TR" });
    expect(html).toContain("<title>&lt;Liste&gt;</title>");
    expect(html).toContain("<td>&lt;Şemsiye A.Ş.&gt; &amp; &quot;İç&quot;</td>");
    expect(html).toContain('<td class="n">-403,00 ₺</td>');
    expect(html).toContain('<td class="s">01.09.2026 10:30</td>');
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("gizli");
  });
});

describe("export modules on a grid", () => {
  const data = (n: number): Row[] => Array.from({ length: n }, (_, i) => ({ id: i + 1, ad: `Kişi ${i + 1}`, tutar: i * 10.5 }));
  const mk = (use: unknown[], n = 12) => {
    document.body.innerHTML = "<table id=t></table>";
    return new Datagrid("#t", {
      label: "Liste",
      pageSize: 5,
      columns: [column.text("ad", { title: "Ad" }), column.money("tutar", { title: "Tutar" })],
      use: [arraySource(data(n)), ...(use as never[])],
    });
  };

  it("shares one toolbar menu, items ordered excel → csv → print", async () => {
    const g = mk([print(), csv(), excel()]);
    await flush();
    const btns = g.root.querySelectorAll('.dg-slot[data-slot="start"] .dg-btn[aria-haspopup="menu"]');
    expect(btns.length).toBe(1);
    const items = Array.from(g.root.querySelectorAll('.dg-panel[role="menu"] [role="menuitem"]'));
    expect(items.map((x) => x.textContent)).toEqual(["Excel (.xlsx)", "CSV", "Yazdır"]);
    expect(btns[0]!.textContent).toContain("Dışa aktar");
  });

  it("keyboard: opens into the menu, arrows move, Escape returns focus", async () => {
    const g = mk([excel(), csv()]);
    await flush();
    const btn = g.root.querySelector<HTMLButtonElement>('.dg-btn[aria-haspopup="menu"]')!;
    btn.click();
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    const items = g.root.querySelectorAll<HTMLElement>('[role="menuitem"]');
    expect(document.activeElement).toBe(items[0]);
    items[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    expect(document.activeElement).toBe(items[1]);
    items[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(btn);
  });

  it("client mode exports every filtered row by default; scope page = view", async () => {
    const g = mk([csv(), excel({ scope: "page" })]);
    await flush();
    const text = await (g as unknown as { csv: CsvApi }).csv.text();
    const lines = text.trim().split("\r\n");
    expect(lines.length).toBe(13);
    expect(lines[0]).toBe("Ad;Tutar");
    expect(lines[3]).toBe("Kişi 3;21,00");
    g.search("Kişi 1");
    await flush();
    const n = g.status().filtered!;
    expect(n).toBeGreaterThan(5);
    expect(n).toBeLessThan(12);
    const filtered = (await (g as unknown as { csv: CsvApi }).csv.text()).trim().split("\r\n");
    expect(filtered.length).toBe(1 + n);
    const blob = await (g as unknown as { excel: ExcelApi }).excel.blob();
    expect(blob.type).toContain("spreadsheetml");
    const ws = unzip(new Uint8Array(await blob.arrayBuffer()))["xl/worksheets/sheet1.xml"]!;
    expect(ws.match(/<row /g)!.length).toBe(1 + 5); // scope "page": header + the 5 visible rows
  });

  it("can:false contributes nothing", async () => {
    const g = mk([excel({ can: false }), csv({ can: false })]);
    await flush();
    expect(g.root.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it("destroy removes the menu", async () => {
    const g = mk([excel(), csv()]);
    await flush();
    const root = g.root;
    g.destroy();
    expect(root.querySelector(".dg-panel")).toBeNull();
    expect(document.querySelector("#t")).not.toBeNull();
  });
});

describe("export review fixes", () => {
  it("plain text keeps '<…>' and 'a<b'; html columns are still stripped", async () => {
    const { buildSheet } = await import("../../src/modules/export/values");
    const cols = [
      { key: "ad", title: "Ad", index: 0, sortable: true, searchable: true, visible: true, hideable: true, exportable: true, defaultVisible: true },
      { key: "h", title: "H", html: true, index: 1, sortable: true, searchable: true, visible: true, hideable: true, exportable: true, defaultVisible: true },
    ];
    const sheet = buildSheet(cols as never, [{ ad: "Jill Valentine <jill@stars.example>", h: "<b>a</b> b" }, { ad: "a<b ve c", h: "x" }]);
    expect(sheet.rows.map((r) => r[0])).toEqual(["Jill Valentine <jill@stars.example>", "a<b ve c"]);
    expect(sheet.rows[0]![1]).toBe("a b");
  });

  it("a server 'all' export with an error body fails instead of producing an empty file", async () => {
    const { Datagrid, column, customSource } = await import("../../src/index");
    document.body.innerHTML = "<table id='t'></table>";
    let first = true;
    const g = new Datagrid("#t", {
      columns: [column.text("ad")],
      use: [customSource({ mode: "server", load: async () => {
        if (first) { first = false; return { rows: [{ id: 1, ad: "x" }], total: 1, filtered: 1 }; }
        return { rows: [], total: 0, filtered: 0, error: { kind: "server", status: 200, message: "boom", retryable: true } };
      } })],
    });
    await new Promise((r) => setTimeout(r, 0));
    await expect(g.exportRows("all")).rejects.toMatchObject({ message: "boom" });
    g.destroy();
  });
});

describe("export menu placement", () => {
  it("the first export module's slot/order places the shared menu", async () => {
    const { Datagrid, column, arraySource, excel, csv } = await import("../../src/index");
    document.body.innerHTML = "<table id='t'></table>";
    const g = new Datagrid("#t", { columns: [column.text("ad")], use: [arraySource([{ id: 1, ad: "x" }]), excel({ slot: "end", order: 5 }), csv()] });
    await new Promise((r) => setTimeout(r, 0));
    const btn = g.root.querySelector('.dg-btn[aria-haspopup="menu"]')!;
    expect(btn.closest(".dg-slot")!.getAttribute("data-slot")).toBe("end");
    g.destroy();
  });
});
