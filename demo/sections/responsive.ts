// Responsive columns demo: a resizable box around the grid.
import "@/styles/responsive.css";
import { Datagrid, arraySource, column } from "@/index";
import type { ColumnDef, Row } from "@/index";
import { responsive, type ResponsiveApi } from "@/modules/responsive";
import { people, durumLabels, durumTones } from "../data";
import { section, table, tools, log } from "../shared";

const style = document.createElement("style");
style.textContent = `
.rs-box { inline-size: 640px; max-inline-size: 100%; min-inline-size: 280px; resize: horizontal; overflow: hidden; padding: 0 12px 0 0; border-inline-end: 3px double var(--page-line); }
`;
document.head.append(style);

{
  const card = section(
    "duyarli",
    "Dar ekran: kolon katlama (responsive)",
    "Tablo kabına sığmadığında önceliği düşük kolonlar katlanır; her satırın başındaki › butonu katlanan değerleri altta açar. Kutunun sağ alt köşesinden genişliği sürükleyin ya da hazır genişlikleri deneyin. Kolon menüsündeki seçimlere dokunulmaz; “Kayıt” ve “Personel” hiç katlanmaz, “Tutar” en son katlanır.",
    "Görünüm",
  );
  const box = document.createElement("div");
  box.className = "rs-box";
  let grid: Datagrid;
  const api = () => (grid as unknown as { responsive: ResponsiveApi }).responsive;
  const write = log(card);
  const widths: Record<string, () => void> = {};
  for (const w of [360, 640, 960]) widths[`${w}px`] = () => (box.style.inlineSize = `${w}px`);
  widths["Tam genişlik"] = () => (box.style.inlineSize = "100%");
  card.prepend(tools(card, { ...widths, "collapsed() → günlük": () => write(`collapsed() = ${JSON.stringify(api().collapsed())}`) }));
  card.insertBefore(box, card.querySelector(".demo-log"));
  const t = table(box, "g-duyarli");
  const columns: ColumnDef[] = [
    column.text("kayit", { title: "Kayıt" }),
    column.text("ad", { title: "Personel" }),
    column.text("birim", { title: "Birim" }),
    column.text("gorev", { title: "Görev" }),
    column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
    column.money("tutar", { title: "Tutar" }),
    column.date("tarih", { title: "Tarih", time: true }),
    column.text("mekan", { title: "Mekân" }),
    column.phone("telefon", { title: "Telefon" }),
  ];
  grid = new Datagrid(t, {
    name: "duyarli",
    label: "Dar ekran tablosu",
    columns,
    pageSize: 5,
    pageSizes: [5, 10, 25],
    use: [arraySource(people(40, 77) as unknown as Row[]), responsive({ keep: ["ad"], priority: { tutar: 1, durum: 2 } })],
  });
  window.grids.duyarli = grid;
  grid.on("collapse" as never, ((d: { columns: string[] }) => write(`collapse → ${JSON.stringify(d.columns)}`)) as never);
}
