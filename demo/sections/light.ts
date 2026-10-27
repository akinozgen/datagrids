// Light modules: filterPanel, urlSync, softDeletes, metaBind, footer.
import "@/styles/light-modules.css";
import { Datagrid, arraySource, column, serverSide, yajra } from "@/index";
import type { ColumnDef, Row } from "@/index";
import { filterPanel, type FilterPanelApi } from "@/modules/filter-panel";
import { urlSync, type UrlSyncApi } from "@/modules/url-sync";
import { softDeletes } from "@/modules/soft-deletes";
import { metaBind } from "@/modules/meta-bind";
import { footer } from "@/modules/footer";
import { createEmulator, parsePhp, type EmuRow } from "../../tests/fixtures/server/emulator";
import { people, durumLabels, durumTones } from "../data";
import { section, table, tools, log } from "../shared";

/* demo chrome only */
const style = document.createElement("style");
style.textContent = `
.lf-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 16px; margin: 0 0 14px; padding: 12px 14px; border: 1px solid var(--page-line); border-radius: 10px; background: var(--page-sunken); font-size: 13px; }
.lf-field { display: grid; gap: 4px; color: var(--page-muted); font-weight: 600; font-size: 12px; }
.lf-field select, .lf-field input { font: 13px/1.3 inherit; font-family: inherit; color: var(--page-fg); padding: 5px 8px; min-width: 160px; border: 1px solid var(--page-line); border-radius: 6px; background: var(--page-card); }
.lf-field select[multiple] { padding: 2px; min-width: 180px; }
.lf-check { display: inline-flex; align-items: center; gap: 6px; padding: 6px 0; color: var(--page-fg); font-size: 13px; cursor: pointer; }
.lf-check input { width: 16px; height: 16px; margin: 0; cursor: pointer; }
.lf-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin: 0 0 14px; }
.lf-kpi { padding: 10px 14px; border: 1px solid var(--page-line); border-radius: 10px; background: var(--page-sunken); }
.lf-kpi-label { font-size: 12px; color: var(--page-muted); }
.lf-kpi-value { margin-top: 2px; font-size: 20px; font-weight: 650; font-variant-numeric: tabular-nums; color: var(--page-fg); white-space: nowrap; }
.lf-sub { margin: 18px 0 8px; font-size: 13px; font-weight: 650; }
`;
document.head.append(style);

const fold = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "").replace(/ı/g, "i");
const sum = (rows: Row[]) => rows.reduce((s, r) => s + (Number(r.tutar) || 0), 0);

/* ---------- in-memory server for these sections (some rows are soft-deleted) ---------- */
const data = people(240, 41).map((p, i) => ({ ...p, deleted: i % 13 === 5 })) as unknown as EmuRow[];
let page: Record<string, any> = {};
const logs: Record<string, (l: string) => void> = {};
// the controller's `->when($request->birim, …)` filters; durum and _deleted are handled by the emulator
const pageFiltered = () =>
  data.filter((r) => {
    const birim = ([] as string[]).concat(page.birim ?? []);
    if (birim.length && !birim.includes(String(r.birim))) return false;
    if (page.gorev && !fold(String(r.gorev)).includes(fold(String(page.gorev)))) return false;
    if (page.eksi === "1" && !(Number(r.tutar) < 0)) return false;
    return true;
  });
const onLog = (key: string) => (e: { method: string; url: string; status: number; params: unknown }) => {
  const p = e.params as Record<string, any>;
  const filters = key === "filtre" ? ` durum=${p.durum ?? ""} birim=${JSON.stringify(p.birim ?? [])} gorev=${JSON.stringify(p.gorev ?? "")} eksi=${p.eksi ?? ""} _deleted=${p._deleted ?? "(yok)"}` : "";
  logs[key]?.(`${e.method} ${e.url.split("?")[0]} → ${e.status} ·${filters} search=${JSON.stringify(p.search?.value ?? "")} start=${p.start} length=${p.length}`);
};
const emuFilter = createEmulator({ rows: pageFiltered, onLog: onLog("filtre") });
const emuSummary = createEmulator({ rows: () => data, onLog: onLog("ozet") });
const prevFetch = window.fetch;
window.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.pathname === "/api/light/gorevler") {
    page = parsePhp(String(init?.body ?? ""));
    return emuFilter.handle(input, init);
  }
  if (url.pathname === "/api/light/ozet") return emuSummary.handle(input, init);
  return prevFetch(input, init);
};

const cols = (): ColumnDef[] => [
  column.index(),
  column.text("kayit", { title: "Kayıt" }),
  column.text("ad", { title: "Personel" }),
  column.text("birim", { title: "Birim" }),
  column.text("gorev", { title: "Görev" }),
  column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
  column.money("tutar", { title: "Tutar" }),
  column.date("tarih", { title: "Tarih" }),
];

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Array<Node | string>) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
};
const option = (value: string, text: string) => el("option", { value }, text);

/* ---------------- filtre paneli + URL + silinenler ---------------- */
{
  const card = section(
    "filtre-paneli",
    "Filtre paneli, URL senkronu, silinenler",
    "Tablonun dışındaki form istek parametresine bağlanır (eski ajax.data + $('#x').val()); değişince 1. sayfadan yeniden yüklenir, metin 250 ms bekler. Arama, sıralama, sayfa ve filtreler adres satırına yazılır: bağlantı paylaşılabilir, sayfa yenilenince geri gelir. “Silinenleri göster” isteğe _deleted=1 ekler; silinmiş satırlar soluk görünür.",
    "Modüller",
  );
  const birimler = [...new Set(data.map((r) => String(r.birim)))].sort((a, b) => a.localeCompare(b, "tr"));
  const durum = el("select", { id: "lf-durum" }, option("", "Tümü"), ...Object.entries(durumLabels).map(([k, v]) => option(k, v)));
  const birim = el("select", { id: "lf-birim", multiple: "", size: "4" }, ...birimler.map((b) => option(b, b)));
  const gorev = el("input", { id: "lf-gorev", type: "search", placeholder: "ör. devriye", autocomplete: "off" });
  const eksi = el("input", { id: "lf-eksi", type: "checkbox" });
  const form = el(
    "form",
    { class: "lf-form", "aria-label": "Görev filtreleri" },
    el("label", { class: "lf-field" }, "Durum", durum),
    el("label", { class: "lf-field" }, "Birim", birim),
    el("label", { class: "lf-field" }, "Görev içerir", gorev),
    el("label", { class: "lf-check" }, eksi, "Yalnız eksi tutar"),
  );
  form.addEventListener("submit", (e) => e.preventDefault());
  card.append(form);

  const t = table(card, "g-filtre");
  const grid = (window.grids.filtre = new Datagrid(t, {
    name: "filtre",
    label: "Görevler (filtre paneli)",
    columns: cols(),
    sort: [["tarih", "desc"]],
    pageSize: 10,
    count: true,
    use: [
      serverSide({ url: "/api/light/gorevler", protocol: yajra(), csrf: true }),
      filterPanel({ fields: { durum: "#lf-durum", birim: "#lf-birim", gorev: "#lf-gorev", eksi: "#lf-eksi" } }),
      softDeletes(),
      urlSync(),
    ],
  }));
  const write = log(card);
  logs.filtre = write;
  const panel = grid.module(filterPanel) as FilterPanelApi;
  const box = tools(card, {
    "Filtreleri temizle": () => panel.reset(),
    "Bağlantıyı göster": () => write(`link → ${(grid.module(urlSync) as UrlSyncApi).link()}`),
  });
  card.insertBefore(box, t.closest(".dg"));
  grid.on("load", () => write(`URL → ${location.search || "(parametresiz)"} · filterPanel.values() = ${JSON.stringify(panel.values())}`));
}

/* ---------------- özet: footer + metaBind ---------------- */
{
  const card = section(
    "ozet",
    "Özet satırı ve KPI kartları",
    "footer() tabloya <tfoot> ekler: etiket ilk görünür kolonda, değer kendi kolonunun biçimiyle (₺, hizalı rakamlar). metaBind() yanıttaki alanları (yajra ->with('summary')) ya da hesaplanan değerleri sayfadaki elemanlara yazar.",
    "Modüller",
  );
  const kpi = (id: string, label: string) => el("div", { class: "lf-kpi" }, el("div", { class: "lf-kpi-label" }, label), el("div", { class: "lf-kpi-value", id }, "—"));

  // client grid: values computed from the rows
  card.append(el("div", { class: "lf-sub" }, "İstemci: sayfa toplamı + hesaplanan KPI'lar"));
  card.append(el("div", { class: "lf-kpis" }, kpi("kpi-c-kayit", "Kayıt (filtreli)"), kpi("kpi-c-toplam", "Toplam tutar (filtreli)"), kpi("kpi-c-sayfa", "Bu sayfa"), kpi("kpi-c-eksi", "Eksi tutarlı")));
  const t1 = table(card, "g-ozet-istemci");
  window.grids.ozetIstemci = new Datagrid(t1, {
    name: "ozetIstemci",
    label: "Özet (istemci)",
    columns: cols(),
    pageSize: 10,
    use: [
      arraySource(people(57, 31) as unknown as Row[]),
      footer({ cols: { tutar: "sum" } }),
      metaBind(
        {
          "#kpi-c-kayit": { value: (_r, g) => g.status().filtered, format: "number" },
          "#kpi-c-toplam": (_r, g) => g.exportRows("all").then(sum),
          "#kpi-c-sayfa": (_r, g) => sum(g.viewRows()),
          "#kpi-c-eksi": { value: (_r, g) => g.exportRows("all").then((rows) => rows.filter((r) => Number(r.tutar) < 0).length), format: "number" },
        },
        { format: "money" },
      ),
    ],
  });

  // server grid: values from the response
  card.append(el("div", { class: "lf-sub" }, "Sunucu: yanıttaki özet (summary.toplam)"));
  card.append(el("div", { class: "lf-kpis" }, kpi("kpi-kayit", "Kayıt (recordsFiltered)"), kpi("kpi-toplam", "Toplam tutar (summary.toplam)")));
  const t2 = table(card, "g-ozet-sunucu");
  window.grids.ozetSunucu = new Datagrid(t2, {
    name: "ozetSunucu",
    label: "Özet (sunucu)",
    columns: cols(),
    sort: [["tarih", "desc"]],
    pageSize: 10,
    use: [
      serverSide({ url: "/api/light/ozet", protocol: yajra(), csrf: true }),
      metaBind({ "#kpi-toplam": "summary.toplam", "#kpi-kayit": { value: "recordsFiltered", format: "number" } }, { format: "money" }),
      footer({ scope: "response", cols: { tutar: (_rows, raw) => raw?.summary?.toplam } }),
    ],
  });
  logs.ozet = log(card);
}
