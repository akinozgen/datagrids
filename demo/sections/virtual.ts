import "@/styles/keyboard-grid.css";
import { Datagrid, arraySource, keyboardGrid } from "@/index";
import type { Row } from "@/index";
import { people } from "../data";
import { section, table, tools, baseColumns } from "../shared";

/* Otomatik sanal satır: sayfa ≥300 satırsa grid kendi kabında kayar. */
{
  const card = section(
    "sanal",
    "Büyük sayfa: otomatik sanal satır",
    "5.000 satır, sayfa boyu 1000. Sayfa ≥300 satır olduğunda grid kendi kabında (70vh) kayar ve yalnız görünen satırları çizer. Başlık yapışık kalır, kolon genişlikleri kilitlenir, aria-rowcount/rowindex basılır, yazdırmada tüm satırlar çizilir. virtual:false ile kapanır. 25'e düşünce normal render'a döner. keyboardGrid açık: hücreye tıklayıp ok tuşlarıyla aşağı inin, pencere değişse de odak satırda kalır.",
    "Performans",
  );
  const t = table(card, "g-sanal");
  const grid = (window.grids.sanal = new Datagrid(t, {
    name: "sanal",
    label: "Sanal satırlı büyük liste",
    pageSize: 1000,
    pageSizes: [25, 100, 500, 1000],
    columns: baseColumns(),
    use: [arraySource(people(5000, 77) as unknown as Row[]), keyboardGrid()],
    sort: [["tarih", "desc"]],
    count: true,
  }));
  const box = tools(card, {
    "Aşağı kaydır (~800. satır)": () => {
      const sc = grid.root.querySelector(".dg-scroll") as HTMLElement;
      sc.scrollTop = 800 * 51;
    },
  });
  card.prepend(box);
}
