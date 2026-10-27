// Export demos: Excel (.xlsx), CSV and the light print view share one toolbar menu.
import { Datagrid, arraySource, column } from "@/index";
import type { Row } from "@/index";
import { excel, csv, print, type CsvApi } from "@/modules/export";
import { people, durumLabels, durumTones } from "../data";
import { section, table, tools, log } from "../shared";

// server-style cell HTML: hidden helper text, a closed dropdown and an "ignore" link never reach the files
const SR = "position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%)";
const NOTES = [
  `<b>Acil</b> teslim <span class="sr-only" style="${SR}">(ekran okuyucu notu)</span>`,
  'Raf 3 <ul class="dropdown-menu" hidden><li>Düzenle</li><li>Sil</li></ul>',
  "Şemsiye A.Ş. &amp; ortakları",
  '<i>Kontrol edildi</i> <a class="dg-link" href="#export" data-export-ignore>ayrıntı</a>',
  "",
];

const rows = (): Row[] =>
  people(40, 5).map((p, i) => ({
    ...p,
    birim: i === 1 ? '<Şemsiye A.Ş.> & "İç"' : p.birim,
    gorev: i === 2 ? "+ Kırmızı Ot karışımı" : i === 3 ? "=Yeşil Ot stok" : p.gorev,
    not: NOTES[i % NOTES.length],
  }));

{
  const card = section(
    "export",
    "Dışa aktar",
    "Excel (.xlsx), CSV ve yazdırma tek “Dışa aktar” menüsünde. Excel'de para gerçek sayı (₺ biçimli), tarih gerçek tarih; HTML kolonundaki gizli metin ve menüler temizlenir; CSV'de = + - @ ile başlayan metinler formül olarak çalışmaz. İstemci modunda filtrelenmiş tüm satırlar aktarılır.",
    "Modüller",
  );
  let say: (line: string) => void = () => {};
  tools(card, {
    "CSV önizleme": () => {
      void (grid.module(csv) as CsvApi).text().then((s) => say(s.split("\r\n").slice(0, 4).join("\n")));
    },
  });
  const t = table(card, "g-export");
  say = log(card);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const grid = new Datagrid(t, {
    name: "export",
    label: "Görev dışa aktarım listesi",
    pageSize: 10,
    columns: [
      column.text("kayit", {
        title: "Kayıt",
        render: (v) => {
          const id = document.createElement("span");
          id.className = "dg-id";
          id.textContent = String(v);
          return id;
        },
      }),
      column.text("ad", { title: "Personel" }),
      column.text("birim", { title: "Birim" }),
      column.text("gorev", { title: "Görev" }),
      column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
      column.money("tutar", { title: "Tutar" }),
      column.date("tarih", { title: "Tarih", time: true }),
      column.html("not", { title: "Not", sortable: false }),
    ],
    use: [arraySource(rows()), excel({ filename: () => `gorevler-${today}` }), csv(), print({ title: "Görev listesi" })],
    sort: [["tarih", "desc"]],
  });
  window.grids.export = grid;
  grid.on("beforePrint", () => say("beforePrint: yazdırma belgesi hazır"));
}
