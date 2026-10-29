// Yenilikler: son sürümdeki her değişiklik için canlı bir örnek; sayfanın en üstünde durur.
import { Datagrid, actions, arraySource, column, reorderColumn, rowReorder, selection, serverSide, yajra } from "@/index";
import type { Row } from "@/index";
import { people } from "../data";
import { log, table, tools } from "../shared";

const VERSION = "0.1.1";

/** One JSON response, as a server would send it. */
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

/** The classic server-side wire on a local array (search, order, paging), plus `extra` filtering. */
function wire(rows: Row[], extra: (row: Row, p: URLSearchParams) => boolean = () => true) {
  return (_u: RequestInfo | URL, init?: RequestInit) => {
    const p = new URLSearchParams(String(init?.body ?? ""));
    const q = (p.get("search[value]") ?? "").toLocaleLowerCase("tr");
    const hits = rows.filter((r) => extra(r, p) && (!q || String(r.ad).toLocaleLowerCase("tr").includes(q)));
    const start = Number(p.get("start") ?? 0);
    const length = Number(p.get("length") ?? 10);
    return json({ draw: Number(p.get("draw")), recordsTotal: rows.length, recordsFiltered: hits.length, data: hits.slice(start, length < 0 ? undefined : start + length) });
  };
}

interface News {
  id: string;
  title: string;
  lead: string;
  build(card: HTMLElement): void;
}

const items: News[] = [
  {
    id: "yeni-locale",
    title: "Bozuk dil etiketi grid'i düşürmez",
    lead: "locale (ya da <html lang>) geçersiz bir değer taşıdığında grid artık kurulur: değer DG015 uyarısıyla atlanır, sıradaki aday kullanılır (sayfa dili → tarayıcı dili → en). Bu grid'e bilerek locale: \"tr_TR\" verildi; konsolda uyarıyı görürsünüz.",
    build(card) {
      const t = table(card, "n-locale");
      const write = log(card);
      const g = new Datagrid(t, {
        name: "n-locale",
        label: "Bozuk dil etiketi",
        locale: "tr_TR",
        pageSize: 5,
        columns: [column.text("ad", { title: "Personel" }), column.money("tutar", { title: "Tutar" }), column.date("tarih", { title: "Tarih" })],
        use: [arraySource(people(12, 5) as unknown as Row[])],
      });
      write(`locale: "tr_TR" → geçersiz, atlandı · kullanılan: grid.locale = "${g.locale}"`);
    },
  },
  {
    id: "yeni-ipucu",
    title: "Kendi ipucu: kontrollerde title yok",
    lead: "Pager, temizle, kolon, ⋯ gibi kontroller artık title taşımıyor; ipucu tek bir top-layer elemanda gösteriliyor (hover'da 0,5 sn sonra, klavye odağında hemen). Sayfa geneli bir [title] ipucu eklentisi (Bootstrap tooltip gibi) grid'e dokunamaz, pager yeniden çizilince ipucu asılı kalmaz. Eklentiyi açın, sonra pager'da ileri/geri tıklayın.",
    build(card) {
      let on = false;
      let tip: HTMLElement | null = null;
      // a page-wide [title] tooltip plugin: what used to leave orphans behind
      const over = (e: Event) => {
        const el = (e.target as Element).closest<HTMLElement>("[title]");
        if (!on || !el || !card.contains(el)) return;
        tip?.remove();
        tip = document.createElement("div");
        tip.className = "demo-host-tip";
        tip.textContent = `[title] eklentisi: ${el.title}`;
        const r = el.getBoundingClientRect();
        tip.style.left = `${r.left + window.scrollX}px`;
        tip.style.top = `${r.top + window.scrollY - 30}px`;
        document.body.append(tip);
        el.addEventListener("mouseleave", () => (tip?.remove(), (tip = null)), { once: true });
      };
      document.addEventListener("mouseover", over);
      const box = tools(card, {});
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = "[title] eklentisi: kapalı";
      toggle.addEventListener("click", () => {
        on = !on;
        toggle.textContent = `[title] eklentisi: ${on ? "açık" : "kapalı"}`;
      });
      const host = document.createElement("button");
      host.type = "button";
      host.title = "Host'un kendi düğmesi (eklenti bunu yakalar)";
      host.textContent = "Host düğmesi (title'lı)";
      box.append(toggle, host);
      card.prepend(box);
      const t = table(card, "n-ipucu");
      const write = log(card);
      const g = new Datagrid(t, {
        name: "n-ipucu",
        label: "İpucu örneği",
        pageSize: 5,
        columns: [column.text("ad", { title: "Personel" }), column.text("birim", { title: "Birim" }), column.phone("telefon", { title: "Telefon", whatsapp: true })],
        use: [arraySource(people(30, 9) as unknown as Row[])],
      });
      g.on("render", () => write(`yeniden çizildi · grid içinde [title] sayısı: ${g.root.querySelectorAll("[title]").length} · [data-dg-tip]: ${g.root.querySelectorAll("[data-dg-tip]").length}`));
    },
  },
  {
    id: "yeni-iserror",
    title: "action(): 200 içindeki hata (isError)",
    lead: "Bazı controller'lar hatayı 200 + { status: false, error } ile döner; eskiden bu \"İşlem tamamlandı\" sayılıp liste yenileniyordu. configure({ isError }) ya da grid'in host.isError kuralı gövdeyi denetler: hata bildirilir, reload olmaz. Tek id'li grupları silmeyi deneyin (sunucu reddeder), çift id'liler başarılı.",
    build(card) {
      const t = table(card, "n-iserror");
      const write = log(card);
      const groups = ["S.T.A.R.S. Alfa", "S.T.A.R.S. Bravo", "U.B.C.S.", "B.S.A.A."].map((ad, i) => ({ id: i + 1, ad, uye: 4 + i * 3 }));
      const g = new Datagrid(t, {
        name: "n-iserror",
        label: "Gruplar",
        columns: [column.text("ad", { title: "Grup" }), column.number("uye", { title: "Üye" }), column.actions()],
        host: {
          fetch: ((u: RequestInfo | URL) => {
            const id = Number(String(u).split("/").pop());
            return id % 2 ? json({ status: false, error: "Grup kullanımda, silinemez." }) : json({ status: true, message: "Grup silindi." });
          }) as typeof fetch,
          isError: (b) => (b as { status?: unknown; error?: string })?.status === false && ((b as { error?: string }).error ?? true),
        },
        use: [
          arraySource(groups),
          actions({ items: [{ id: "sil", label: "Sil", icon: "trash", tone: "danger", request: { url: "/n/grup/{id}", method: "DELETE" }, reload: false }] }),
        ],
      });
      g.on("action", ({ row }) => write(`✓ ${row.ad}: başarı (200, status: true)`));
      g.on("actionerror", ({ row, error }) => write(`✗ ${row.ad}: hata (200, status: false) → ${(error as { message?: string }).message}`));
    },
  },
  {
    id: "yeni-thenable",
    title: "Toplu işlem: catch'siz thenable",
    lead: "Bulk düğmesinin onClick'i yalnız then'i olan bir nesne dönerse (bazı onay penceresi kütüphaneleri böyle) düğme eskiden kalıcı meşgul kalıyordu. Şimdi her thenable beklenir. Birkaç satır seçip Onayla'ya basın: 1,5 sn meşgul, sonra yeniden kullanılabilir.",
    build(card) {
      const t = table(card, "n-thenable");
      const write = log(card);
      new Datagrid(t, {
        name: "n-thenable",
        label: "Toplu işlem",
        pageSize: 5,
        columns: [column.select(), column.text("ad", { title: "Personel" }), column.text("birim", { title: "Birim" })],
        use: [
          arraySource(people(10, 11) as unknown as Row[]),
          selection({
            bulk: {
              actions: [{
                id: "onayla",
                label: "Onayla",
                icon: "check",
                onClick: (p) => {
                  write(`onClick → { then } döndü (catch/finally yok) · ${p.all ? "tümü" : `${p.keys.length} satır`}`);
                  return { then: (ok: () => void) => void setTimeout(() => (write("thenable çözüldü → düğme yeniden etkin"), ok()), 1500) } as unknown as PromiseLike<void>;
                },
              }],
            },
          }),
        ],
      });
    },
  },
  {
    id: "yeni-reorder",
    title: "Satır taşıma süzülmüş listede kapanır",
    lead: "Arama ya da filtre satır gizlerken sıra kaydedilseydi gizli satırların yeri kaybolurdu. Aramaya \"Redfield\" yazın: tutamaklar pasifleşir, ipucu nedenini söyler. Aramayı temizleyince geri gelir.",
    build(card) {
      const t = table(card, "n-reorder");
      const write = log(card);
      const crew = ["Jill Valentine", "Chris Redfield", "Leon S. Kennedy", "Claire Redfield", "Rebecca Chambers", "Barry Burton"].map((ad, i) => ({ id: i + 1, sira: i + 1, ad }));
      new Datagrid(t, {
        name: "n-reorder",
        label: "Sıralı ekip",
        sort: [["sira", "asc"]],
        columns: [reorderColumn(), column.number("sira", { title: "Sıra" }), column.text("ad", { title: "Personel" })],
        use: [arraySource(crew), rowReorder({ orderKey: "sira", onEnd: (e) => void write(`kaydedildi: ${e.row.ad} → ${e.to + 1}. sıra`) })],
      });
    },
  },
  {
    id: "yeni-params",
    title: "lastRequestParams(): telde ne gittiyse",
    lead: "yajra({ data: fn }) ile eklenen filtreler (DataTables'taki ajax.data alışkanlığı) ve kolon dışı filters() anahtarları artık lastRequestParams()'ta ve \"filtre sonucunun tümü\" yükünde görünüyor; değişince \"tümü\" seçimi sıfırlanır. Birimi değiştirin, 'tümünü seç'i deneyin, Dışa aktar'a basın.",
    build(card) {
      const rows = people(60, 13) as unknown as Row[];
      const units = Array.from(new Set(rows.map((r) => String(r.birim))));
      const sel = document.createElement("select");
      sel.setAttribute("aria-label", "Birim (data fn)");
      sel.innerHTML = `<option value="">Birim: tümü</option>` + units.map((u) => `<option>${u}</option>`).join("");
      const t = table(card, "n-params");
      const write = log(card);
      const g = new Datagrid(t, {
        name: "n-params",
        label: "Telde giden parametreler",
        pageSize: 5,
        columns: [column.select(), column.text("ad", { title: "Personel" }), column.text("birim", { title: "Birim" })],
        host: { fetch: wire(rows, (r, p) => (!p.get("f_birim") || r.birim === p.get("f_birim")) && (p.get("durum") !== "acik" || r.durum === "acik")) as typeof fetch },
        use: [
          serverSide({ url: "/n/liste", protocol: yajra({ cells: "text", data: (d: Record<string, unknown>) => void (sel.value ? (d.f_birim = sel.value) : null) }) }),
          selection({ bulk: { actions: [{ id: "aktar", label: "Dışa aktar", icon: "download", onClick: (p) => write(`bulk yükü → all=${p.all} query.params=${JSON.stringify(p.all ? p.query?.params : undefined)}`) }] } }),
        ],
      });
      const box = tools(card, {
        "filters({ durum: 'acik' })": () => g.filters({ durum: "acik" }),
        "filtreyi kaldır": () => g.filters({ durum: null }),
      });
      sel.addEventListener("change", () => void g.reload());
      box.append(sel);
      card.prepend(box);
      g.on("load", () => write(`lastRequestParams() → ${JSON.stringify(g.lastRequestParams())}`));
    },
  },
  {
    id: "yeni-link",
    title: "href aksiyonları gerçek bağlantı",
    lead: "href'li satır aksiyonları artık <a href>: orta tık ve Ctrl+tık yeni sekmede açar, sağ tıkta \"Bağlantı adresini kopyala\" var, durum çubuğu adresi gösterir. Düz tık eskisi gibi onaydan ve beforeAction'dan geçer. Pasif (nedenli) öğe düğme olarak kalır.",
    build(card) {
      const t = table(card, "n-link");
      const write = log(card);
      const g = new Datagrid(t, {
        name: "n-link",
        label: "Bağlantılı aksiyonlar",
        pageSize: 5,
        columns: [column.text("ad", { title: "Personel" }), column.text("birim", { title: "Birim" }), column.actions()],
        use: [
          arraySource(people(8, 17) as unknown as Row[]),
          actions({
            items: [
              { id: "detay", label: "Detay", icon: "eye", href: "#kisi-{id}" },
              { id: "rapor", label: "Rapor", href: "?rapor={id}", target: "_blank", confirm: "{ad} raporu yeni sekmede açılsın mı?", disabled: (r) => (r.durum === "iptal" ? "İptal edilmiş kaydın raporu yok" : null) },
            ],
          }),
        ],
      });
      g.on("beforeAction", ({ id, row }) => (write(`beforeAction: ${id} · ${row.ad}`), true));
    },
  },
  {
    id: "yeni-text",
    title: "render içinde ctx.text(row, alan)",
    lead: "yajra her metni sunucuda kaçırır (&amp;). render'a gelen value çözülmüş gelir ama row'daki diğer alanlar ham kalır; ctx.text(row, \"alan\") onları metin olarak verir (row'un kendisi değişmez). Soldaki sütun row.ad'ı ham, sağdaki ctx.text ile basıyor.",
    build(card) {
      const t = table(card, "n-text");
      const names = ["Barry & Moira Burton", "Chris <Redfield>", "Jill \"Valentine\"", "Ada Wong & Leon"];
      const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      const rows = names.map((ad, i) => ({ id: i + 1, ad: esc(ad), birim: esc(["R&D", "S.T.A.R.S.", "R.P.D.", "Ar-Ge & Lab"][i]!) }));
      new Datagrid(t, {
        name: "n-text",
        label: "Kaçırılmış alanlar",
        columns: [
          { key: "ad", title: "Personel (value)" },
          column.text("ham", { title: "row.ad (ham)", sortable: false, render: (_v, row) => String(row.ad) }),
          column.text("metin", { title: "ctx.text(row, \"ad\") · birim", sortable: false, render: (_v, row, ctx) => `${ctx.text(row, "ad")} · ${ctx.text(row, "birim")}` }),
        ],
        host: { fetch: wire(rows) as typeof fetch },
        use: [serverSide({ url: "/n/kacis", protocol: yajra() })],
      });
    },
  },
];

/** The section on top of the page (above the overview) with one card per change. */
export function buildNews(): void {
  const main = document.getElementById("main")!;
  const nav = document.getElementById("nav")!;
  const s = document.createElement("section");
  s.className = "demo";
  s.id = "yenilikler";
  const h2 = document.createElement("h2");
  h2.textContent = `Yenilikler · ${VERSION}`;
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent = `${VERSION} sürümündeki değişikliklerin her biri için canlı bir örnek. Eski sürümde nasıl davrandığı her kartın açıklamasında.`;
  s.append(h2, lead);
  const list = document.createElement("div");
  list.className = "news-list";
  for (const it of items) {
    const box = document.createElement("article");
    box.className = "news-item";
    box.id = it.id;
    const h3 = document.createElement("h3");
    h3.textContent = it.title;
    const p = document.createElement("p");
    p.className = "lead";
    p.textContent = it.lead;
    const card = document.createElement("div");
    card.className = "demo-card";
    box.append(h3, p, card);
    list.append(box);
    it.build(card);
  }
  s.append(list);
  main.prepend(s);
  const g = document.createElement("div");
  g.className = "group";
  g.textContent = "Yeni";
  const a = document.createElement("a");
  a.href = "#yenilikler";
  a.textContent = `Yenilikler ${VERSION}`;
  const first = nav.querySelector(":scope > a, :scope > .group");
  nav.insertBefore(g, first);
  nav.insertBefore(a, first);
}
