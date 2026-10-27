import { Datagrid, column, arraySource, fetchAll, colVis, button, preset, upgrade, reload as reloadByName } from "@/index";
import type { Row } from "@/index";
import { people, durumLabels, durumTones } from "../data";
import { section, table, tools, log, baseColumns } from "../shared";

/* Tıklanabilir satır + satır tonu */
{
  const card = section("satir-tik", "Tıklanabilir satır + satır tonu", "rowClick verilince satır sonunda kalıcı › göstergesi çıkar (hover-only değil). rowTone durum rengini satıra taşır: iptal → bad, bekliyor → warn, taslak → muted.", "Yaşam döngüsü");
  const write = log(card);
  const t = table(card, "g-satir-tik");
  window.grids.satirTik = new Datagrid(t, {
    name: "satirTik",
    label: "Tıklanabilir satırlar",
    pageSize: 8,
    columns: baseColumns().slice(1, 6),
    data: people(40, 13) as unknown as Row[],
    rowTone: (r) => (r.durum === "iptal" ? "bad" : r.durum === "bekliyor" ? "warn" : r.durum === "taslak" ? "muted" : null),
    rowClick: (r) => write(`rowClick → ${r.kayit} (${r.ad})`),
  });
}

/* Sekmede tembel yükleme */
{
  const card = section("sekme", "Sekme içinde tembel yükleme (load: 'visible')", "İkinci sekmedeki grid görünür olana kadar istek atmaz (IntersectionObserver). Kolon hizası ResizeObserver ile kendiliğinden düzelir; columns.adjust() çağrısı gerekmez.", "Yaşam döngüsü");
  const tabs = document.createElement("div");
  tabs.className = "demo-tools";
  tabs.setAttribute("role", "tablist");
  const panels: HTMLElement[] = [];
  ["Özet", "Liste (tembel)"].forEach((label, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "tab");
    b.textContent = label;
    b.setAttribute("aria-selected", String(i === 0));
    b.addEventListener("click", () => {
      tabs.querySelectorAll("button").forEach((x, j) => x.setAttribute("aria-selected", String(j === i)));
      panels.forEach((p, j) => (p.hidden = j !== i));
    });
    tabs.append(b);
  });
  card.append(tabs);
  const p1 = document.createElement("div");
  p1.textContent = "Bu sekmede grid yok. 'Liste (tembel)' sekmesine geçince yükleme başlar (aşağıdaki log'a bakın).";
  p1.style.cssText = "padding:24px 4px;color:var(--page-muted);font-size:13px";
  const p2 = document.createElement("div");
  p2.hidden = true;
  panels.push(p1, p2);
  card.append(p1, p2);
  const write = log(card);
  const t = table(p2, "g-sekme");
  const g = (window.grids.sekme = new Datagrid(t, {
    name: "sekme",
    label: "Tembel liste",
    load: "visible",
    pageSize: 10,
    columns: baseColumns().slice(1, 7),
    use: [fetchAll({ url: "/api/all/gorevler?limit=120" })],
  }));
  g.on("load", ({ result }) => write(`load → ${result.rows.length} satır (fetchAll, istemci modu)`));
  write("grid kuruldu, istek yok (görünür değil)");
}

/* Bildirimsel kurulum */
{
  const card = section("upgrade", "Bildirimsel kurulum: upgrade() + preset", "Blade'in bastığı <table data-datagrid=\"ev\"> + th data-dg-* attribute'ları. Datagrids.preset('ev', …) modül listesini verir; upgrade() idempotent kurar. JSON config yok.", "Yaşam döngüsü");
  const write = log(card);
  card.insertAdjacentHTML(
    "afterbegin",
    `<table data-datagrid="ev" data-dg-name="bildirimsel" data-dg-label="Bildirimsel liste" data-dg-page-size="5" data-dg-sort="tutar:desc" data-url="/api/all/gorevler?limit=40">
      <thead><tr>
        <th data-dg-key="kayit">Kayıt</th>
        <th data-dg-key="ad">Personel</th>
        <th data-dg-key="birim" data-dg-visible="false">Birim</th>
        <th data-dg-key="tutar" data-dg-type="money">Tutar</th>
        <th data-dg-key="tarih" data-dg-type="date">Tarih</th>
      </tr></thead><tbody></tbody></table>`,
  );
  preset("ev", (t) => [fetchAll({ url: t.dataset.url! }), colVis(), button.reload()]);
  const first = upgrade(card);
  const second = upgrade(card);
  write(`upgrade() → ${first.length} grid kuruldu; ikinci çağrı → ${second.length} (idempotent)`);
  tools(card, { "Datagrids.reload('bildirimsel')": () => write(`reload('bildirimsel') → ${reloadByName("bildirimsel")}`), "reload('yok')": () => write(`reload('yok') → ${reloadByName("yok")}`) });
}

/* setColumns / remount */
{
  const card = section("kolon-degistir", "Çalışma anında kolon değiştirme + remount", "setColumns() destroy gerekmeden kolon setini değiştirir (eski 'kolon sayısı uyuşmuyor' sorununun yerine). remount() aynı tanımlarla yeniden kurar (Livewire morph sonrası).", "Yaşam döngüsü");
  const t = table(card, "g-kolon-degistir");
  const rows = people(30, 17) as unknown as Row[];
  const setA = () => [column.text("kayit", { title: "Kayıt" }), column.text("ad", { title: "Personel" }), column.money("tutar", { title: "Tutar" })];
  const setB = () => [column.text("ad", { title: "Personel" }), column.text("birim", { title: "Birim" }), column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }), column.date("tarih", { title: "Tarih" }), column.text("mekan", { title: "Mekân" })];
  let g = (window.grids.kolonDegistir = new Datagrid(t, { name: "kolonDegistir", label: "Kolon değiştirme", pageSize: 5, columns: setA(), use: [arraySource(rows)] }));
  const box = tools(card, {
    "3 kolon": () => g.setColumns(setA()),
    "5 kolon": () => g.setColumns(setB()),
    "remount()": () => (g = window.grids.kolonDegistir = g.remount() as Datagrid),
  });
  card.prepend(box);
}

/* Sabit yükseklik + yapışık başlık */
{
  const card = section("sabit-yukseklik", "Sabit yükseklik + yapışık başlık (maxHeight)", "maxHeight: '320px' → gövde kendi kabında kayar, başlık yapışık kalır (dashboard widget'ı).", "Yaşam döngüsü");
  const t = table(card, "g-sabit");
  window.grids.sabit = new Datagrid(t, { name: "sabit", label: "Sabit yükseklikli liste", maxHeight: "320px", pageSize: 50, columns: baseColumns().slice(1, 6), data: people(80, 23) as unknown as Row[] });
}
