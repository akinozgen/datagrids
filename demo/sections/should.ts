// Should features: rowReorder, cursorPaginate (laravelPaginator), filterPresets.
import "@/styles/row-reorder.css";
import "@/styles/filter-presets.css";
import { Datagrid, arraySource, column, serverSide, yajra, dgp, laravelPaginator } from "@/index";
import type { ColumnDef, Row } from "@/index";
import { rowReorder, reorderColumn, type RowReorderEnd } from "@/modules/row-reorder";
import { filterPresets, type FilterPresetsApi } from "@/modules/filter-presets";
import { filterPanel, type FilterPanelApi } from "@/modules/filter-panel";
import { urlSync } from "@/modules/url-sync";
import { createEmulator, type EmuRow } from "../../tests/fixtures/server/emulator";
import { people, durumLabels, durumTones } from "../data";
import { section, table, tools, log } from "../shared";

/* demo chrome only */
const style = document.createElement("style");
style.textContent = `
.sh-form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px 16px; margin: 0 0 14px; padding: 12px 14px; border: 1px solid var(--page-line); border-radius: 10px; background: var(--page-bg); font-size: 13px; }
.sh-field { display: grid; gap: 4px; color: var(--page-muted); font-weight: 600; font-size: 12px; }
.sh-field select { font: 13px/1.3 inherit; font-family: inherit; color: var(--page-fg); padding: 5px 8px; min-width: 160px; border: 1px solid var(--page-line); border-radius: 6px; background: var(--page-card); }
.sh-check { display: inline-flex; align-items: center; gap: 6px; padding: 6px 0; color: var(--page-fg); font-size: 13px; cursor: pointer; }
.sh-check input { width: 16px; height: 16px; margin: 0; cursor: pointer; }
.sh-sub { margin: 18px 0 8px; font-size: 13px; font-weight: 650; }
`;
document.head.append(style);

/** cursor → «id 1047 →» (the emulator's cursor is base64url JSON of the edge row) */
const short = (c: unknown) => {
  if (typeof c !== "string" || !c) return "null";
  try {
    const bin = atob(c.replace(/-/g, "+").replace(/_/g, "/"));
    const o = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    return `«id ${o.id} ${o._pointsToNextItems ? "→" : "←"}»`;
  } catch {
    return `${c.slice(0, 8)}…`;
  }
};
const brief = (e: RowReorderEnd) =>
  `onEnd → key=${e.key} from=${e.from} to=${e.to} offset=${e.offset} prevKey=${e.prevKey ?? "null"} nextKey=${e.nextKey ?? "null"}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- in-memory servers for these sections ---------- */
const reorderRows = people(36, 71).map((p, i) => ({ ...p, sira: i + 1 })) as unknown as EmuRow[];
const cursorRows = people(57, 83) as unknown as EmuRow[];
const presetRows = people(120, 97) as unknown as EmuRow[];
const say: Record<string, (l: string) => void> = {};
const emuReorder = createEmulator({
  rows: () => reorderRows,
  latency: 80,
  onLog: (e) => {
    const p = e.params as Record<string, any>;
    say.reorder?.(`POST ${e.url} → ${e.status} · order=${JSON.stringify(p.order ?? [])} start=${p.start} length=${p.length}`);
  },
});
const emuCursor = createEmulator({
  rows: () => cursorRows,
  latency: 80,
  onLog: (e) => {
    const r = (e.response ?? {}) as Record<string, any>;
    const meta = r.meta ?? r;
    const url = decodeURIComponent(e.url).replace(/cursor=([^&]*)/, (_m, c: string) => `cursor=${short(c)}`);
    say.cursor?.(`GET ${url} → ${e.status} · ${Array.isArray(r.data) ? r.data.length : 0} satır · next_cursor=${short(meta.next_cursor)} prev_cursor=${short(meta.prev_cursor)}`);
  },
});
const emuPreset = createEmulator({
  rows: () => presetRows,
  latency: 80,
  onLog: (e) => {
    const p = e.params as Record<string, any>;
    say.preset?.(`POST ${e.url} → ${e.status} · filters=${JSON.stringify(p.filters ?? {})} page=${JSON.stringify(p.page)}`);
  },
});
const prevFetch = window.fetch;
window.fetch = (input, init) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  if (url.pathname === "/api/should/satir") return emuReorder.handle(input, init);
  if (url.pathname.startsWith("/api/should/cursor/")) return emuCursor.handle(input, init);
  if (url.pathname.startsWith("/api/should/dgp/")) return emuPreset.handle(input, init);
  return prevFetch(input, init);
};
(window as unknown as { emuCursor: typeof emuCursor }).emuCursor = emuCursor;

const reorderCols = (): ColumnDef[] => [
  reorderColumn(),
  column.number("sira", { title: "Sıra" }),
  column.text("ad", { title: "Personel" }),
  column.text("birim", { title: "Birim" }),
  column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
  column.money("tutar", { title: "Tutar" }),
];
const cols = (): ColumnDef[] => [
  column.text("kayit", { title: "Kayıt" }),
  column.text("ad", { title: "Personel" }),
  column.text("birim", { title: "Birim" }),
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

/* ---------------- satır sırası ---------------- */
{
  const card = section(
    "satir-sirasi",
    "Satır sırası (rowReorder)",
    "Her satırdaki ⋮⋮ tutamağı tutup sürükleyin (fare ve dokunmatik); mavi çizgi bırakılacak yeri gösterir, Esc vazgeçer. Klavyede tutamağa gelip Boşluk ile tutun, oklarla taşıyın, Boşluk ile bırakın. Tablo “Sıra” dışında bir kolona göre sıralıysa tutamaklar soluklaşır, sebebi üzerine gelince yazar. İstemci tablosunda yeni sıra veriye yazılır; sunucu tablosunda onEnd kaydeder, tablo aynı sayfada yeniden yüklenir. Kayıt hata verirse satır eski yerine döner.",
    "Modüller",
  );

  card.append(el("div", { class: "sh-sub" }, "İstemci: sıra veriye yazılır"));
  const writeC = (l: string) => say.reorderClient?.(l);
  const t1 = table(card, "g-satir-istemci");
  window.grids.satirIstemci = new Datagrid(t1, {
    name: "satirIstemci",
    label: "Satır sırası (istemci)",
    columns: reorderCols(),
    sort: [["sira", "asc"]],
    pageSize: 8,
    search: false,
    use: [
      arraySource(people(12, 71).map((p, i) => ({ ...p, sira: i + 1 })) as unknown as Row[]),
      rowReorder({ orderKey: "sira", label: (r) => String(r.ad), onEnd: (e) => writeC(brief(e)) }),
    ],
  });
  say.reorderClient = log(card);

  card.append(el("div", { class: "sh-sub" }, "Sunucu: onEnd kaydeder, sayfa korunarak yeniden yüklenir"));
  let failNext = false;
  const t2 = table(card, "g-satir-sunucu");
  const server = (window.grids.satirSunucu = new Datagrid(t2, {
    name: "satirSunucu",
    label: "Satır sırası (sunucu)",
    columns: reorderCols(),
    sort: [["sira", "asc"]],
    pageSize: 10,
    use: [
      serverSide({ url: "/api/should/satir", protocol: yajra(), csrf: true }),
      rowReorder({
        orderKey: "sira",
        label: (r) => String(r.ad),
        async onEnd(e) {
          say.reorder?.(brief(e));
          await sleep(250);
          if (failNext) {
            failNext = false;
            throw new Error("sunucu 500 döndü");
          }
          // the controller: move between prevKey and nextKey, renumber
          const list = reorderRows.slice().sort((a, b) => Number(a.sira) - Number(b.sira));
          const moved = list.splice(list.findIndex((r) => String(r.id) === e.key), 1)[0]!;
          const at = e.prevKey != null ? list.findIndex((r) => String(r.id) === e.prevKey) + 1 : list.findIndex((r) => String(r.id) === e.nextKey);
          list.splice(at, 0, moved);
          list.forEach((r, i) => (r.sira = i + 1));
        },
      }),
    ],
  }));
  const box = tools(card, {
    "Sonraki kayıt hata versin": () => {
      failNext = true;
      say.reorder?.("(sonraki onEnd reddedilecek)");
    },
    "Tutara göre sırala": () => server.sort([["tutar", "desc"]]),
    "Sıra'ya dön": () => server.sort([["sira", "asc"]]),
  });
  card.insertBefore(box, t2.closest(".dg"));
  say.reorder = log(card);
}

/* ---------------- cursor sayfalama ---------------- */
{
  const card = section(
    "cursor-sayfalama",
    "Cursor sayfalama (cursorPaginate)",
    "laravelPaginator() yanıtta next_cursor görünce cursor kipine geçer: toplam bilinmez, sonraki sayfanın cursor'ı bir önceki yanıttan öğrenilir ve sayfa → cursor eşlemesi tutulur, geri gitmek yeni istek ama aynı cursor'la. Henüz görülmemiş bir sayfaya atlamak bilinen en uzak sayfaya götürür; “Son sayfa” ancak sona varılınca açılır ve o anda toplam da yazılır. Düz cursorPaginate() JSON'u da JsonResource biçimi de tanınır.",
    "Veri kaynakları",
  );
  tools(card, {
    "Düz JSON": () => {
      emuCursor.faults.resource = false;
      void grid.reload();
    },
    "JsonResource": () => {
      emuCursor.faults.resource = true;
      void grid.reload();
    },
  });
  const t = table(card, "g-cursor");
  const grid = (window.grids.cursor = new Datagrid(t, {
    name: "cursor",
    label: "Cursor sayfalama",
    columns: cols(),
    sort: [["tarih", "desc"]],
    pageSize: 10,
    use: [serverSide({ url: "/api/should/cursor/gorevler", protocol: laravelPaginator() })],
  }));
  say.cursor = log(card);
}

/* ---------------- hazır filtreler ---------------- */
{
  const card = section(
    "hazir-filtreler",
    "Hazır filtreler (filterPresets)",
    "Adlı filtre setleri araç çubuğunda: tıklayınca değerler tek seferde uygulanır ve tablo bir kez yüklenir. Üstteki tablo filtre panelini sürer (kontroller de değişir), elle yapılan değişiklik bir hazır filtreyle eşleşmezse hiçbiri seçili görünmez. Değerler adres satırına yazılır; sayfa yenilenince aynı hazır filtre seçili gelir. Alttaki tablo grid.filters() ile sunucuya tipli filtre gönderir.",
    "Modüller",
  );
  const option = (value: string, text: string) => el("option", { value }, text);
  const durum = el("select", { id: "fp-durum" }, option("", "Tümü"), ...Object.entries(durumLabels).map(([k, v]) => option(k, v)));
  const eksi = el("input", { id: "fp-eksi", type: "checkbox" });
  const form = el(
    "form",
    { class: "sh-form", "aria-label": "Hazır filtre paneli" },
    el("label", { class: "sh-field" }, "Durum", durum),
    el("label", { class: "sh-check" }, eksi, "Yalnız eksi tutar"),
  );
  form.addEventListener("submit", (e) => e.preventDefault());
  card.append(form);

  const t1 = table(card, "g-onayar");
  const g1 = (window.grids.onayar = new Datagrid(t1, {
    name: "onayar",
    label: "Hazır filtreler (panel)",
    columns: cols(),
    pageSize: 8,
    use: [
      arraySource(people(64, 97) as unknown as Row[]),
      filterPanel({
        fields: {
          durum: "#fp-durum",
          eksi: { el: "#fp-eksi", format: (v) => (v ? (_x: unknown, r: Row) => Number(r.tutar) < 0 : null) },
        },
      }),
      filterPresets({
        presets: [
          { id: "tumu", label: "Tümü", values: {}, default: true },
          { id: "acik", label: "Açık işler", values: { durum: "acik" } },
          { id: "bekleyen", label: "Beklemede", values: { durum: "bekliyor" } },
          { id: "eksi", label: "Eksi tutar", values: { eksi: true } },
          { id: "acik-eksi", label: "Açık + eksi", values: { durum: "acik", eksi: true } },
        ],
      }),
      urlSync({ namespace: true }),
    ],
  }));
  const write = log(card);
  const panel = g1.module(filterPanel) as FilterPanelApi;
  const presets = g1.module(filterPresets) as FilterPresetsApi;
  g1.on("load", () => write(`active() = ${JSON.stringify(presets.active())} · filterPanel.raw() = ${JSON.stringify(panel.raw())} · URL ${location.search || "(parametresiz)"}`));

  card.append(el("div", { class: "sh-sub" }, "Sunucu (dgp): grid.filters() → tipli filtre"));
  const t2 = table(card, "g-onayar-sunucu");
  window.grids.onayarSunucu = new Datagrid(t2, {
    name: "onayarSunucu",
    label: "Hazır filtreler (sunucu)",
    columns: cols(),
    sort: [["tarih", "desc"]],
    pageSize: 8,
    use: [
      serverSide({ url: "/api/should/dgp/gorevler", protocol: dgp() }),
      filterPresets({
        target: "grid",
        label: "Görünüm",
        presets: [
          { id: "tumu", label: "Tümü", values: {}, default: true },
          { id: "acik", label: "Açık", values: { durum: "acik" } },
          { id: "sirada", label: "Beklemede + taslak", values: { durum: ["bekliyor", "taslak"] } },
          { id: "eksi", label: "Eksi tutar", values: { tutar: { op: "lt", value: 0 } } },
        ],
      }),
    ],
  });
  say.preset = log(card);
}
