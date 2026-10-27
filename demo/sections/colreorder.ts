// Column reorder demo: header drag + colVis move buttons; the request keeps the definition order.
import "@/styles/colvis.css";
import "@/styles/col-reorder.css";
import { Datagrid, column, serverSide, yajra } from "@/index";
import type { ColumnDef } from "@/index";
import { colVis } from "@/modules/colvis";
import { colReorder, type ColReorderApi } from "@/modules/col-reorder";
import { stateSave } from "@/modules/state-save";
import { reload, resetState } from "@/modules/buttons";
import { excel } from "@/modules/export";
import { createEmulator, type EmuRow } from "../../tests/fixtures/server/emulator";
import { people, durumLabels, durumTones } from "../data";
import { section, table, tools, log } from "../shared";

const data = people(180, 63) as unknown as EmuRow[];
let say: (l: string) => void = () => {};
const emu = createEmulator({
  rows: () => data,
  onLog: (e) => {
    const p = e.params as Record<string, any>;
    const cols = (p.columns ?? []).map((c: { data: string }) => c.data).join(",");
    const ord = (p.order ?? []).map((o: { column: string; dir: string }) => `${o.column}:${o.dir}`).join(",");
    say(`POST ${e.url.split("?")[0]} → ${e.status} · columns=[${cols}] order=[${ord}] start=${p.start}`);
  },
});
const prevFetch = window.fetch;
window.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  return url.pathname === "/api/sira/gorevler" ? emu.handle(input, init) : prevFetch(input, init);
};

{
  const card = section(
    "kolon-sirasi",
    "Kolon sırası (colReorder)",
    "Başlığı tutup sürükleyin (⋮⋮ tutamağı her taşınabilir başlıkta durur; Esc iptal eder). Klavye ve tek tıkla taşıma için “Kolonlar” menüsündeki ↑/↓ butonları. Sıra bu tarayıcıda saklanır, Excel çıktısı ekrandaki sırayı izler. İstek ise tanım sırasında kalır: aşağıdaki günlükte columns[] hiç değişmez, sıralama index'i de aynı kolonu gösterir.",
    "Modüller",
  );
  let grid: Datagrid;
  const api = () => (grid as unknown as { colReorder: ColReorderApi }).colReorder;
  tools(card, {
    "Tutar'ı başa al": () => api().move("tutar", 0),
    "Tanım sırasına dön": () => api().reset(),
    "order() → günlük": () => write(`order() = ${JSON.stringify(api().order())}`),
  });
  const t = table(card, "g-sira");
  const write = log(card);
  const columns: ColumnDef[] = [
    column.index(),
    column.text("kayit", { title: "Kayıt", hideable: false }),
    column.text("ad", { title: "Personel" }),
    column.text("birim", { title: "Birim" }),
    column.text("gorev", { title: "Görev" }),
    column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
    column.money("tutar", { title: "Tutar" }),
    column.date("tarih", { title: "Tarih" }),
  ];
  grid = new Datagrid(t, {
    name: "sira",
    label: "Kolon sırası",
    columns,
    pageSize: 10,
    sort: [["tarih", "desc"]],
    use: [
      serverSide({ url: "/api/sira/gorevler", protocol: yajra(), csrf: true }),
      colVis(),
      colReorder(),
      reload(),
      excel({ filename: "kolon-sirasi" }),
      stateSave(),
      resetState(),
    ],
  });
  window.grids.sira = grid;
  say = write;
}
