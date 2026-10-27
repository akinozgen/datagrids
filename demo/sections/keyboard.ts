// Keyboard grid demo (APG grid navigation, opt-in).
import "@/styles/selection.css";
import "@/styles/keyboard-grid.css";
import { Datagrid, arraySource, column } from "@/index";
import { h } from "@/core/util";
import type { ColumnDef, Row } from "@/index";
import { keyboardGrid, type KeyboardGridApi } from "@/modules/keyboard-grid";
import { selection } from "@/modules/selection";
import { people, durumLabels, durumTones } from "../data";
import { section, table, log } from "../shared";

{
  const card = section(
    "klavye",
    "Klavyeyle hücre gezinme (keyboardGrid)",
    "Tablo tek sekme durağıdır: Tab ile girin, ok tuşlarıyla hücreler arasında gezinin (RTL'de yatay oklar aynalanır). Home/End satır başı/sonu, Ctrl+Home/End köşeler, PageUp/PageDown sayfa değiştirir. Tek kontrollü hücrede odak kontrole gider (sıralama butonu, onay kutusu, bağlantı); iki butonlu hücrede Enter içeri girer, Esc hücreye döner.",
    "Görünüm",
  );
  const t = table(card, "g-klavye");
  const write = log(card);
  const columns: ColumnDef[] = [
    column.select(),
    column.text("kayit", { title: "Kayıt" }),
    column.link("ad", { title: "Personel", href: "#klavye-{id}" }),
    column.text("birim", { title: "Birim" }),
    column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
    column.money("tutar", { title: "Tutar" }),
    column.text("islem", {
      title: "İşlem",
      sortable: false,
      searchable: false,
      exportable: false,
      render: (_v, row) =>
        h("span", { class: "kg-btns" },
          h("button", { type: "button", class: "dg-cellbtn", "data-act": "ac" }, "Aç"),
          " ",
          h("button", { type: "button", class: "dg-cellbtn", "data-act": "not" }, "Not ekle")),
    }),
  ];
  const grid = new Datagrid(t, {
    name: "klavye",
    label: "Klavye ızgarası",
    columns,
    pageSize: 5,
    use: [arraySource(people(23, 17) as unknown as Row[]), selection(), keyboardGrid()],
  });
  window.grids.klavye = grid;
  grid.delegate("click", "[data-act]", (e, c) => write(`${(e.target as HTMLElement).textContent} → ${c.row.ad}`));
  t.addEventListener("focusin", () => {
    const p = (grid as unknown as { keyboardGrid: KeyboardGridApi }).keyboardGrid.position();
    write(`odak: satır ${p.row}, kolon ${p.col} · ${(document.activeElement as HTMLElement).tagName.toLowerCase()}`);
  });
}
