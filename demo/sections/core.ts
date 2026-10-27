import { Datagrid, arraySource, customSource, en } from "@/index";
import type { Row } from "@/index";
import { people } from "../data";
import { section, table, baseColumns } from "../shared";

/* ---------------- 1. Ev standardı liste ---------------- */
{
  const card = section("liste", "Ev standardı liste", "İstemci modu (dizi kaynağı): tipli kolonlar, arama (TR katlama: “isik” → Işık), sıralama, sayfalama, kayıt sayacı.", "Temel");
  const t = table(card, "g-liste");
  window.grids.liste = new Datagrid(t, {
    name: "liste",
    label: "Ev standardı liste",
    columns: baseColumns(),
    use: [arraySource(people(240) as unknown as Row[])],
    sort: [["tarih", "desc"]],
    count: true,
  });
}

/* ---------------- 2. Kart yüzey ---------------- */
{
  const card = section("kart", "Kart yüzey + sentence başlık + zebra", "data-dg-surface=card: başlık, açıklama ve sayaç grid'in içinde. Başlık stili sentence, zebra açık.", "Temel");
  card.style.background = "transparent";
  card.style.border = "0";
  card.style.padding = "0";
  const t = table(card, "g-kart");
  window.grids.kart = new Datagrid(t, {
    name: "kart",
    surface: "card",
    title: "Görev kayıtları",
    description: "Birimlere atanan görevler ve harcama tutarları",
    head: "sentence",
    striped: true,
    count: true,
    pageSize: 10,
    columns: baseColumns(),
    use: [arraySource(people(57, 3) as unknown as Row[])],
  });
}

/* ---------------- 3. Progressive enhancement ---------------- */
{
  const card = section("dom", "Mevcut tabloyu güçlendirme", "Sunucunun bastığı <table> yerinde güçlendirilir; satırlar (tr) benimsenir, hücre HTML'i korunur. destroy() tabloyu birebir geri verir.", "Temel");
  const tools = document.createElement("div");
  tools.className = "demo-tools";
  tools.innerHTML = `<button type="button" id="dom-destroy">destroy()</button><button type="button" id="dom-init">yeniden kur</button>`;
  card.append(tools);
  const tpl = document.getElementById("dom-table-tpl") as HTMLTemplateElement;
  card.append(tpl.content.cloneNode(true));
  const init = () => (window.grids.dom = new Datagrid("#dom-table", { name: "dom", pageSize: 5 }));
  init();
  tools.querySelector("#dom-destroy")!.addEventListener("click", () => window.grids.dom?.destroy());
  tools.querySelector("#dom-init")!.addEventListener("click", () => {
    if (!Datagrid.get("#dom-table")) init();
  });
}

/* ---------------- 4. Durumlar ---------------- */
{
  const card = section("durumlar", "Durumlar", "Yükleniyor (ortada kart), boş, eşleşme yok, hata (+Yeniden dene, dev modda ayrıntı), manuel yükleme.", "Temel");
  card.classList.add("demo-row");
  card.style.display = "grid";
  const mk = (id: string) => {
    const box = document.createElement("div");
    card.append(box);
    return table(box, id);
  };
  window.grids.loading = new Datagrid(mk("g-loading"), {
    name: "loading",
    label: "Yükleniyor",
    columns: baseColumns().slice(1, 5),
    use: [customSource({ mode: "server", load: () => new Promise(() => {}) })],
  });
  window.grids.empty = new Datagrid(mk("g-empty"), { name: "empty", label: "Boş", columns: baseColumns().slice(1, 5), data: [] });
  let fails = true;
  window.grids.error = new Datagrid(mk("g-error"), {
    name: "error",
    label: "Hata",
    columns: baseColumns().slice(1, 5),
    use: [
      customSource({
        mode: "server",
        load: async () => {
          if (fails) {
            fails = false;
            throw { kind: "server", status: 500, message: "Sunucu yanıt vermedi (500).", detail: "SQLSTATE[42S22]: Column not found: 'birimm'", retryable: true };
          }
          return { rows: people(5, 9) as unknown as Row[], total: 5, filtered: 5 };
        },
      }),
    ],
  });
  window.grids.manual = new Datagrid(mk("g-manual"), {
    name: "manual",
    label: "Manuel",
    load: "manual",
    columns: baseColumns().slice(1, 5),
    data: people(12, 4) as unknown as Row[],
  });
}

/* ---------------- 5. Tema / yoğunluk / boyut ---------------- */
{
  const card = section("tema", "Tema, yoğunluk, boyut", "Koyu tema host'un color-scheme'ini izler (aşağıdaki koyu bölge). compact yoğunluk + sm boyut. Accent tek token: --dg-accent.", "Görünüm");
  card.classList.add("dark-zone");
  card.style.setProperty("--dg-accent", "#16a34a");
  const t = table(card, "g-dark");
  window.grids.dark = new Datagrid(t, {
    name: "dark",
    label: "Koyu tema",
    density: "compact",
    size: "sm",
    pageSize: 10,
    columns: baseColumns(),
    data: people(30, 11) as unknown as Row[],
  });
}

/* ---------------- 6. RTL + İngilizce ---------------- */
{
  const card = section("rtl", "RTL ve İngilizce mesajlar", "dir=rtl kapsayıcıda mantıksal yerleşim, aynalanan pager; Latin veri bidi kaymadan (dir=auto). messages: en.", "Görünüm");
  const box = document.createElement("div");
  box.dir = "rtl";
  card.append(box);
  const t = table(box, "g-rtl");
  window.grids.rtl = new Datagrid(t, {
    name: "rtl",
    label: "RTL",
    locale: "en",
    messages: en,
    pageSize: 5,
    columns: baseColumns().slice(1),
    data: people(18, 5) as unknown as Row[],
  });
}

