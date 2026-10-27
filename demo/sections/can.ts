// Smaller extras: boolean column, autoRefresh.
import "@/styles/light-modules.css";
import "@/styles/multi-sort.css";
import { Datagrid, arraySource, column, serverSide, yajra } from "@/index";
import type { ColumnDef, Row } from "@/index";
import { autoRefresh, type AutoRefreshApi } from "@/modules/auto-refresh";
import { multiSort } from "@/modules/multi-sort";
import { createEmulator, type EmuRow } from "../../tests/fixtures/server/emulator";
import { people } from "../data";
import { section, table, tools, log } from "../shared";

/* ---------------- boolean column ---------------- */
{
  const card = section(
    "evet-hayir",
    "Evet/Hayır kolonu (column.boolean)",
    "1/0, true/false, \"evet\"/\"hayır\" gibi değerleri okur; ikon + metin birlikte durur (renk tek başına anlam taşımaz). Sıralanır, “evet” diye aranır, Excel'e metin olarak gider. showFalse:false ile yalnız olumlu değer görünür.",
    "Ekstra",
  );
  const t = table(card, "g-evet-hayir");
  const rows = (people(30, 5) as unknown as Row[]).map((r, i) => ({ ...r, aktif: i % 3 ? 1 : 0, sertifika: ["true", "false", "evet", ""][i % 4], vip: i % 5 === 0 }));
  const columns: ColumnDef[] = [
    column.text("kayit", { title: "Kayıt" }),
    column.text("ad", { title: "Personel" }),
    column.boolean("aktif", { title: "Aktif" }),
    column.boolean("sertifika", { title: "Sertifika", labels: { true: "Var", false: "Yok" } }),
    column.boolean("vip", { title: "Öncelikli", showFalse: false }),
  ];
  window.grids.evetHayir = new Datagrid(t, { name: "evet-hayir", label: "Evet/Hayır", columns, pageSize: 8, use: [arraySource(rows)] });
}

/* ---------------- autoRefresh ---------------- */
{
  const card = section(
    "otomatik-yenile",
    "Otomatik yenileme (autoRefresh)",
    "Belirli aralıkla sessizce yeniden yükler, sayfa korunur. Sekme arka plandayken, bir yükleme sürerken, panel/menü açıkken ya da tablonun arama kutusuna yazılırken atlar; sekme geri gelince bekleyen yenileme hemen yapılır. Araç çubuğundaki kutulu buton açar/kapatır. Demo aralığı 5 sn; tutarlar her istekte değişir.",
    "Ekstra",
  );
  let n = 0;
  const data = people(40, 33) as unknown as EmuRow[];
  const emu = createEmulator({ rows: () => data.map((r, i) => ({ ...r, tutar: Math.round((Number(r.tutar) + n * 37 + i) * 100) / 100 })) });
  const prevFetch = window.fetch;
  let say: (l: string) => void = () => {};
  window.fetch = (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
    if (url.pathname !== "/api/can/canli") return prevFetch(input, init);
    n++;
    say(`${new Date().toLocaleTimeString("tr-TR")} · istek #${n}`);
    return emu.handle(input, init);
  };
  let grid: Datagrid;
  const api = () => (grid as unknown as { autoRefresh: AutoRefreshApi }).autoRefresh;
  tools(card, { "Şimdi yenile": () => api().tick() });
  const t = table(card, "g-otomatik");
  say = log(card);
  grid = new Datagrid(t, {
    name: "otomatik",
    label: "Canlı liste",
    pageSize: 5,
    columns: [column.text("kayit", { title: "Kayıt" }), column.text("ad", { title: "Personel" }), column.money("tutar", { title: "Tutar" })],
    use: [serverSide({ url: "/api/can/canli", protocol: yajra(), csrf: true }), autoRefresh({ every: 5_000 })],
  });
  window.grids.otomatik = grid;
}

/* ---------------- multiSort ---------------- */
{
  const card = section(
    "coklu-siralama",
    "Çoklu kolon sıralama (multiSort)",
    "Başlığa Shift+tık (klavyede Shift+Enter) ek sıralama ölçütü ekler; tekrar Shift+tık yönünü çevirir, üçüncüsü çıkarır. Sıra numarası başlıkta görünür; normal tık tek kolona döner. En fazla 3 ölçüt. Sunucuya order[0..n] olarak gider.",
    "Ekstra",
  );
  const say = (() => { let w: (l: string) => void = () => {}; return { set: (f: typeof w) => (w = f), log: (l: string) => w(l) }; })();
  tools(card, {
    "Birim ↑, Tutar ↓": () => window.grids.coklu!.sort([["birim", "asc"], ["tutar", "desc"]]),
    "Sıralamayı temizle": () => window.grids.coklu!.sort([]),
  });
  const t = table(card, "g-coklu");
  say.set(log(card));
  const grid = new Datagrid(t, {
    name: "coklu",
    label: "Çoklu sıralama",
    pageSize: 8,
    sort: [["birim", "asc"]],
    columns: [column.text("kayit", { title: "Kayıt" }), column.text("ad", { title: "Personel" }), column.text("birim", { title: "Birim" }), column.money("tutar", { title: "Tutar" }), column.date("tarih", { title: "Tarih" })],
    use: [arraySource(people(40, 21) as unknown as Row[]), multiSort()],
  });
  grid.on("sort", ({ sort }) => say.log(`sort() = ${JSON.stringify(sort)}`));
  window.grids.coklu = grid;
}
