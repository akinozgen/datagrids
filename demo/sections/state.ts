// Column visibility, stateSave and toolbar button demos.
import "@/styles/colvis.css";
import { Datagrid, arraySource, column } from "@/index";
import type { ColumnDef, Row } from "@/index";
import { colVis } from "@/modules/colvis";
import { stateSave } from "@/modules/state-save";
import { reload, resetState } from "@/modules/buttons";
import { people, durumLabels, durumTones } from "../data";
import { section, table, baseColumns, log } from "../shared";

const SHIFTS = ["Gündüz", "Gece", "Nöbet"];
const LEVELS = ["Çaylak", "Kıdemli", "Uzman", "Komuta"];
const GEAR = ["Işıldak", "Telsiz", "Yeşil Ot", "Mürekkep Şeridi", "İlk Yardım Spreyi"];

/** People rows widened with a few derived fields so the menu passes 12 columns. */
const wide = (n: number): Row[] =>
  people(n, 11).map((p, i) => ({
    ...p,
    eposta: `${p.ad.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@rpd.example`,
    vardiya: SHIFTS[i % SHIFTS.length],
    seviye: LEVELS[(i * 7) % LEVELS.length],
    ekipman: GEAR[(i * 3) % GEAR.length],
    puan: (i * 37) % 100,
  }));

/* ---------------- 1. Kolon görünürlüğü ---------------- */
{
  const card = section(
    "kolonlar",
    "Kolon görünürlüğü",
    "“Kolonlar” menüsü: 14 kolon, 12'yi aştığı için panelde arama var. “Kayıt” kilitli (gizlenemez), “Telefon”, “E-posta”, “Seviye”, “Ekipman” ve “Puan” varsayılan gizli. Seçimler bu tarayıcıda saklanır (stateSave). Yenile butonu yükleme sırasında döner.",
    "Modüller",
  );
  const t = table(card, "g-kolonlar");
  const columns: ColumnDef[] = [
    column.index(),
    column.text("kayit", { title: "Kayıt", hideable: false }),
    column.text("ad", { title: "Personel" }),
    column.text("birim", { title: "Birim" }),
    column.text("gorev", { title: "Görev" }),
    column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
    column.money("tutar", { title: "Tutar" }),
    column.date("tarih", { title: "Tarih" }),
    column.text("telefon", { title: "Telefon", visible: false }),
    column.text("eposta", { title: "E-posta", visible: false }),
    column.text("mekan", { title: "Mekân" }),
    column.text("vardiya", { title: "Vardiya" }),
    column.text("seviye", { title: "Seviye", visible: false }),
    column.text("ekipman", { title: "Ekipman", visible: false }),
    column.number("puan", { title: "Puan", visible: false }),
  ];
  window.grids.kolonlar = new Datagrid(t, {
    name: "kolonlar",
    label: "Kolon görünürlüğü",
    columns,
    pageSize: 10,
    use: [arraySource(wide(60)), colVis(), reload(), stateSave()],
  });
}

/* ---------------- 2. State kaydı ---------------- */
{
  const card = section(
    "state",
    "Görünüm kaydı (stateSave)",
    "Sıralamayı, kolonları, sayfa boyunu ve Durum filtresini değiştirip sayfayı yenileyin: hepsi geri gelir. Arama ve sayfa numarası kaydedilmez. “Sıfırla” kaydı siler ve varsayılan görünüme döner (sayfa yenilenmez). Kayıt 90 gün saklanır.",
    "Modüller",
  );
  const tools = document.createElement("div");
  tools.className = "demo-tools";
  const label = document.createElement("label");
  label.textContent = "Durum filtresi ";
  const sel = document.createElement("select");
  sel.id = "state-durum";
  sel.append(new Option("Tümü", ""));
  for (const [k, v] of Object.entries(durumLabels)) sel.append(new Option(v, k));
  label.append(sel);
  tools.append(label);
  card.append(tools);
  const t = table(card, "g-state");
  const grid = new Datagrid(t, {
    name: "state",
    label: "Görünüm kaydı",
    columns: baseColumns(),
    sort: [["tarih", "desc"]],
    count: true,
    use: [arraySource(people(120, 5) as unknown as Row[]), colVis(), reload(), stateSave({ include: ["filters"] }), resetState()],
  });
  window.grids.state = grid;
  const write = log(card);
  // the host widget reflects restored filters (stateSave applies them before the first load)
  const syncSel = () => (sel.value = String(grid.filters().durum ?? ""));
  syncSel();
  sel.addEventListener("change", () => grid.filters({ durum: sel.value || null }));
  grid.on("load", syncSel);
  const st = (grid as unknown as { state: { key: string; read(): { core: unknown } | null } }).state;
  const show = () => write(`${st.key} → ${JSON.stringify(st.read()?.core ?? null)}`);
  for (const ev of ["sort", "pagesize", "columnchange", "load"]) grid.on(ev, () => setTimeout(show, 300));
}
