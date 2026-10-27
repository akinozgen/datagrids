import { Datagrid, column, serverSide, yajra, dgp, laravelPaginator } from "@/index";
import type { ColumnDef } from "@/index";
import { createEmulator, type EmuRow } from "../../tests/fixtures/server/emulator";
import { people, durumLabels, durumTones } from "../data";
import { section, table, tools, log } from "../shared";

const data = people(1000, 21) as unknown as EmuRow[];
const logLines: Record<string, (l: string) => void> = {};
const emu = createEmulator({
  rows: () => data,
  html: {
    // yajra addColumn: server-rendered HTML badge (raw column)
    durum_html: (r) => `<span class="dg-chip" data-tone="${durumTones[r.durum as keyof typeof durumTones]}">${durumLabels[r.durum as keyof typeof durumLabels]}</span>`,
  },
  onLog: (e) => {
    const p = e.params as Record<string, any>;
    const brief =
      e.url.startsWith("/api/yajra")
        ? `draw=${p.draw} start=${p.start} length=${p.length} order=${JSON.stringify(p.order ?? [])} search=${JSON.stringify(p.search?.value ?? "")} columns=${(p.columns ?? []).length} _token=${p._token ? "✓" : "–"} durum=${p.durum ?? ""}`
        : e.url.startsWith("/api/dgp")
          ? JSON.stringify({ page: p.page, sort: p.sort, q: p.q, filters: p.filters, count: p.count })
          : e.url;
    const key = e.url.split("/")[2] ?? "";
    logLines[key]?.(`${e.method} ${e.url.split("?")[0]} → ${e.status} · ${brief} · X-CSRF-TOKEN=${e.headers["x-csrf-token"] ? "✓" : "–"} X-Requested-With=${e.headers["x-requested-with"] ?? "–"}`);
  },
});
const realFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return new URL(url, location.href).pathname.startsWith("/api/") ? emu.handle(input, init) : realFetch(input, init);
};
(window as unknown as { emu: typeof emu }).emu = emu;

const cols = (html = false): ColumnDef[] => [
  column.index(),
  column.text("kayit", { title: "Kayıt" }),
  column.text("ad", { title: "Personel" }),
  column.text("birim", { title: "Birim" }),
  html
    ? { key: "durum_html", title: "Durum", searchable: false, sortable: false } // untyped → protocol default (yajra: HTML)
    : column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
  column.money("tutar", { title: "Tutar" }),
  column.date("tarih", { title: "Tarih", time: true }),
];

/* ---------------- yajra ---------------- */
{
  const card = section(
    "yajra",
    "Sunucu modu: yajra (DataTables teli)",
    "1000 satırlık sahte sunucu. POST form-encoded, CSRF (header + _token), X-Requested-With; columns[] tanım sırasında, order index'i, draw'a güvenilmez (istek sırası). Durum kolonu sunucudan HTML gelir (yajra preset'inde hücre varsayılanı HTML). Hata düğmeleri bir sonraki isteği bozar.",
    "Sunucu",
  );
  let durum = "";
  const t = table(card, "g-yajra");
  const src = serverSide({ url: "/api/yajra/gorevler", protocol: yajra(), csrf: true, params: () => (durum ? { durum } : {}) });
  const grid = (window.grids.yajra = new Datagrid(t, { name: "yajra", label: "yajra listesi", columns: cols(true), use: [src], sort: [["tarih", "desc"]], count: true }));
  const box = tools(card, {
    "HTTP 500": () => { emu.faults.next = "500"; void grid.reload({ keepPage: true }); },
    "419 oturum": () => { emu.faults.next = "419"; void grid.reload({ keepPage: true }); },
    "302 yetki": () => { emu.faults.next = "302"; void grid.reload({ keepPage: true }); },
    "200 + error": () => { emu.faults.next = "error200"; void grid.reload({ keepPage: true }); },
    "yavaş (2 sn)": () => { emu.faults.latency = 2000; void grid.reload({ keepPage: true }).finally(() => (emu.faults.latency = 120)); },
  });
  const sel = document.createElement("select");
  sel.innerHTML = `<option value="">Durum: tümü</option>` + Object.entries(durumLabels).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
  sel.setAttribute("aria-label", "Durum filtresi");
  sel.addEventListener("change", () => {
    durum = sel.value;
    void grid.reload();
  });
  box.append(sel);
  card.prepend(box);
  const write = log(card);
  logLines.yajra = write;
  grid.on("error", ({ error }) => write(`error event → kind=${error.kind} status=${error.status} message="${error.message}"`));
  grid.on("sessionexpired", () => write("sessionexpired event"));
}

/* ---------------- dgp ---------------- */
{
  const card = section(
    "dgp",
    "Kendi protokol: dgp v1",
    "POST JSON; anahtarla sıralama, tipli filtre ({op, value}), opsiyonel sayım. 'Sayımsız' modda pager toplamı bilmez (hasMore). Hata zarfı RFC 9457.",
    "Sunucu",
  );
  const t = table(card, "g-dgp");
  const grid = (window.grids.dgp = new Datagrid(t, { name: "dgp", label: "dgp listesi", columns: cols(), use: [serverSide({ url: "/api/dgp/gorevler", protocol: dgp(), csrf: true })], count: true }));
  const box = tools(card, {
    "sayım: none": () => { emu.faults.countMode = "none"; void grid.reload(); },
    "sayım: exact": () => { emu.faults.countMode = "exact"; void grid.reload(); },
    "filtre: durum ∈ {açık, beklemede}": () => grid.filters({ durum: { op: "in", value: ["acik", "bekliyor"] } }),
    "filtre: tutar ≥ 15.000": () => grid.filters({ tutar: { op: "gte", value: 15000 } }),
    "filtreleri temizle": () => grid.filters({ durum: null, tutar: null }),
    "HTTP 422": () => { emu.faults.next = "422"; void grid.reload({ keepPage: true }); },
  });
  card.prepend(box);
  logLines.dgp = log(card);
}

/* ---------------- Laravel paginator ---------------- */
{
  const card = section(
    "paginator",
    "Laravel paginator",
    "GET ?page=&per_page=&sort=-tarih&search=. paginate() (toplam var) ve simplePaginate() (toplam yok → 'toplam bilinmiyor', sonraki sayfa next_page_url'den).",
    "Sunucu",
  );
  const t = table(card, "g-paginator");
  const grid = (window.grids.paginator = new Datagrid(t, { name: "paginator", label: "paginator listesi", pageSize: 10, columns: cols(), use: [serverSide({ url: "/api/paginator/gorevler", protocol: laravelPaginator() })], sort: [["tarih", "desc"]] }));
  const box = tools(card, {
    "paginate()": () => { emu.faults.simple = false; void grid.reload(); },
    "simplePaginate()": () => { emu.faults.simple = true; void grid.reload(); },
  });
  card.prepend(box);
  logLines.paginator = log(card);
}
