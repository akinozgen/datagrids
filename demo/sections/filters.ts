import { Datagrid, column, arraySource, serverSide, yajra, columnFilters } from "@/index";
import type { Row } from "@/index";
import { people, durumLabels, durumTones } from "../data";
import { section, table, log } from "../shared";

const cols = () => [
  column.text("kayit", { title: "Kayıt" }),
  column.text("ad", { title: "Personel" }),
  column.text("birim", { title: "Birim" }),
  column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
  column.money("tutar", { title: "Tutar" }),
  column.date("tarih", { title: "Tarih", time: true }),
];

/* İstemci modu */
{
  const card = section(
    "kolon-filtresi",
    "Kolon filtresi (istemci)",
    "Başlıktaki kalıcı filtre ikonu tipine göre panel açar: metin (içerir/başlar…), sayı/para (≥, ≤, arasında), rozet (şunlardan biri). Aktif filtre ikonda dolu görünür ve toolbar'da chip olur.",
    "Filtreler",
  );
  const t = table(card, "g-kolon-filtresi");
  window.grids.kolonFiltresi = new Datagrid(t, {
    name: "kolonFiltresi",
    label: "Kolon filtreli liste",
    pageSize: 10,
    columns: cols(),
    use: [arraySource(people(240, 31) as unknown as Row[]), columnFilters()],
    sort: [["tarih", "desc"]],
    count: true,
  });
}

/* yajra: ColumnControl teli */
{
  const card = section(
    "kolon-filtresi-sunucu",
    "Kolon filtresi (yajra columnControl)",
    "Aynı panel sunucu modunda DataTables ColumnControl parametreleri üretir: columns[i][columnControl][search][value|logic|type] ve [list][]. yajra 12.7 bunları controller değişmeden uygular.",
    "Filtreler",
  );
  const write = log(card);
  const t = table(card, "g-kolon-filtresi-sunucu");
  const grid = (window.grids.kolonFiltresiSunucu = new Datagrid(t, {
    name: "kolonFiltresiSunucu",
    label: "Kolon filtreli sunucu listesi",
    pageSize: 10,
    columns: cols(),
    use: [serverSide({ url: "/api/yajra/gorevler", protocol: yajra({ cells: "text" }), csrf: true }), columnFilters()],
    sort: [["tarih", "desc"]],
    count: true,
  }));
  grid.on("beforeLoad", ({ query }) => {
    const f = Object.entries(query.filters);
    write(f.length ? `filters → ${JSON.stringify(Object.fromEntries(f))}` : "filters → {}");
  });
}
