// Page-level sticky header demo: a wide table that scrolls sideways inside its frame.
import "@/styles/sticky-header.css";
import { Datagrid, arraySource, column } from "@/index";
import type { ColumnDef, Row } from "@/index";
import { stickyHeader } from "@/modules/sticky-header";
import { people, durumLabels, durumTones } from "../data";
import { section, table } from "../shared";

// wide enough to scroll sideways at any viewport (demo chrome)
const style = document.createElement("style");
style.textContent = "#g-yapisik { min-inline-size: 1500px; }";
document.head.append(style);

{
  const card = section(
    "yapisik-baslik",
    "Sayfayla yapışan başlık (stickyHeader)",
    "Geniş tablo kendi kabında yana kayar; CSS sticky bu kabın dışına çıkamaz. Sayfayı aşağı kaydırın: başlığın kopyası üstte kalır, yatay kaydırmayı izler, sıralama tıklaması gerçek başlığa gider. Klavye gerçek başlığı kullanır (kopya ekran okuyucudan gizli).",
    "Görünüm",
  );
  const t = table(card, "g-yapisik");
  const columns: ColumnDef[] = [
    column.index(),
    column.text("kayit", { title: "Kayıt" }),
    column.text("ad", { title: "Personel" }),
    column.text("birim", { title: "Birim" }),
    column.text("gorev", { title: "Görev" }),
    column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
    column.money("tutar", { title: "Tutar" }),
    column.date("tarih", { title: "Tarih", time: true }),
    column.text("mekan", { title: "Mekân" }),
    column.phone("telefon", { title: "Telefon" }),
    column.text("eposta", { title: "E-posta", data: "ad", render: (v) => `${String(v).toLowerCase().replace(/[^a-z]+/g, ".")}@rpd.example` }),
  ];
  window.grids.yapisik = new Datagrid(t, {
    name: "yapisik",
    label: "Yapışan başlık",
    columns,
    pageSize: 25,
    use: [arraySource(people(60, 91) as unknown as Row[]), stickyHeader()],
  });
}
