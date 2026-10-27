// Lazy server columns demo: the response carries a lazy field only when the request asks for it.
import "@/styles/colvis.css";
import { Datagrid, column, serverSide, yajra } from "@/index";
import type { ColumnDef } from "@/index";
import { colVis } from "@/modules/colvis";
import { lazyColumns } from "@/modules/lazy-columns";
import { createEmulator, parsePhp, type EmuRow } from "../../tests/fixtures/server/emulator";
import { people, durumLabels, durumTones } from "../data";
import { section, table, tools, log } from "../shared";

const LAZY = ["vergi_no", "son_giris"];
const data = (people(90, 88) as unknown as EmuRow[]).map((r, i) => ({
  ...r,
  vergi_no: String(1_000_000_000 + ((i * 7_919_113) % 8_999_999_999)).slice(0, 10),
  son_giris: `2026-10-${String(1 + (i % 26)).padStart(2, "0")} ${String(8 + (i % 12)).padStart(2, "0")}:${String((i * 13) % 60).padStart(2, "0")}:00`,
}));
let say: (l: string) => void = () => {};
const emu = createEmulator({ rows: () => data });
const prevFetch = window.fetch;
window.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.pathname !== "/api/lazy/musteriler") return prevFetch(input, init);
  const p = parsePhp(String(init?.body ?? "")) as Record<string, any>;
  const asked: string[] = [].concat(p.ek_sutunlar ?? []);
  const res = await emu.handle(input, init);
  const json = await res.json();
  // the expensive fields are computed only when asked for
  for (const row of json.data ?? []) for (const k of LAZY) if (!asked.includes(k)) delete row[k];
  say(`POST ${url.pathname} → ${res.status} · ek_sutunlar=${JSON.stringify(asked)} · start=${p.start}`);
  return new Response(JSON.stringify(json), { status: res.status, headers: { "Content-Type": "application/json" } });
};

{
  const card = section(
    "tembel-kolonlar",
    "Tembel sunucu kolonları (lazyColumns)",
    "“Vergi no” ve “Son giriş” sunucuda pahalı hesaplanıyor: varsayılan gizli, istekte yalnız görünürken adları gider (ek_sutunlar[]). Kolon menüsünden birini açınca aynı sayfa yeniden yüklenir; gizlemek istek atmaz.",
    "Modüller",
  );
  let grid: Datagrid;
  tools(card, {
    "Vergi no'yu göster": () => grid.setColumnVisible("vergi_no", true),
    "Vergi no'yu gizle": () => grid.setColumnVisible("vergi_no", false),
  });
  const t = table(card, "g-tembel");
  say = log(card);
  const columns: ColumnDef[] = [
    column.text("kayit", { title: "Kayıt" }),
    column.text("ad", { title: "Personel" }),
    column.text("birim", { title: "Birim" }),
    column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
    column.money("tutar", { title: "Tutar" }),
    column.text("vergi_no", { title: "Vergi no", visible: false, lazy: true }),
    column.date("son_giris", { title: "Son giriş", source: "local", time: true, visible: false, lazy: true }),
  ];
  grid = new Datagrid(t, {
    name: "tembel",
    label: "Tembel kolonlar",
    columns,
    pageSize: 10,
    use: [serverSide({ url: "/api/lazy/musteriler", protocol: yajra(), csrf: true }), colVis(), lazyColumns({ param: "ek_sutunlar" })],
  });
  window.grids.tembel = grid;
}
