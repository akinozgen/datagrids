// Row selection + persistent bulk bar.
import { Datagrid, arraySource, column, serverSide, yajra } from "@/index";
import type { Row } from "@/index";
import "@/styles/selection.css";
import { selection, type SelectionApi, type SelectionPayload } from "@/modules/selection";
import { people, durumLabels, durumTones } from "../data";
import { section, table, tools, log, baseColumns } from "../shared";

const show = (p: SelectionPayload) =>
  p.all
    ? `{ all: true, except: ${JSON.stringify(p.except)}, query: ${JSON.stringify(p.query)} }`
    : `{ all: false, keys: ${JSON.stringify(p.keys)} }`;

/* ---------------- istemci ---------------- */
{
  const card = section(
    "secim",
    "Satır seçimi + toplu işlem",
    "column.select() + .use(selection(...)). Seçim sayfalar arasında korunur (anahtar: rowKey/id), başlık kutusu sayfa için üç durumlu, Shift+tık aralık seçer. Toplu işlem çubuğu kalıcı: 0'da sönük, seçimde sayaç + aksiyonlar. Sayfa tamamen seçilince “Filtre sonucunun tümünü seç”. Arama/filtre değişince “tümü” sıfırlanır, tek tek seçimler kalır.",
    "Modüller",
  );
  let write: (l: string) => void = () => {};
  const t = table(card, "g-secim");
  const grid = (window.grids.secim = new Datagrid(t, {
    name: "secim",
    label: "Seçimli görev listesi",
    pageSize: 10,
    columns: [column.select(), ...baseColumns()],
    use: [
      arraySource(people(120, 13) as unknown as Row[]),
      selection({
        label: (row) => `${row.kayit} ${row.ad}`,
        bulk: {
          actions: [
            { id: "sms", label: "SMS gönder", icon: "send", onClick: (p) => write(`SMS gönder → ${show(p)}`) },
            {
              id: "sil",
              label: "Sil",
              icon: "trash",
              tone: "danger",
              onClick: (p, g, sel) => {
                write(`Sil → ${show(p)}`);
                if (!p.all) {
                  for (const k of p.keys) g.removeRow(k);
                  sel.clear();
                }
              },
            },
          ],
        },
      }),
    ],
  }));
  const sel = () => grid.module(selection) as SelectionApi;
  card.prepend(
    tools(card, {
      "select(['1118','1117'])": () => sel().select(["1118", "1117"]),
      "selectPage()": () => sel().selectPage(),
      "clear()": () => sel().clear(),
      "get() → log": () => write(`get(): ${sel().get().map((r) => r.kayit).join(", ") || "—"}`),
    }),
  );
  write = log(card);
  grid.on("selectionchange", (d: { count: number; all: boolean }) => write(`selectionchange → count=${d.count} all=${d.all}`));
}

/* ---------------- sunucu: filtre sonucunun tümü ---------------- */
{
  const card = section(
    "secim-sunucu",
    "Sunucu modunda “tümünü seç”",
    "yajra kaynağı (1000 satır). Sayfayı seçip “Filtre sonucunun tümünü seç” → payload {all:true, except, query}: sunucu aynı sorguyu kendisi çalıştırır, istemci yalnız hariç tutulanları bilir. Sayfa boyutu ya da sıralama “tümü”nü bozmaz; arama bozar.",
    "Modüller",
  );
  let write: (l: string) => void = () => {};
  const t = table(card, "g-secim-sunucu");
  window.grids.secimSunucu = new Datagrid(t, {
    name: "secimSunucu",
    label: "Sunucu seçim listesi",
    pageSize: 10,
    sort: [["tarih", "desc"]],
    columns: [
      column.select(),
      column.text("kayit", { title: "Kayıt" }),
      column.text("ad", { title: "Personel" }),
      column.text("birim", { title: "Birim" }),
      column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
      column.money("tutar", { title: "Tutar" }),
    ],
    use: [
      serverSide({ url: "/api/yajra/gorevler", protocol: yajra(), csrf: true }),
      selection({
        bulk: {
          actions: [
            { id: "disa", label: "Seçilileri dışa aktar", icon: "download", onClick: (p) => write(`dışa aktar → ${show(p)}`) },
            { id: "arsiv", label: "Arşivle", tone: "danger", onClick: (p) => write(`arşivle → ${show(p)}`) },
          ],
        },
      }),
    ],
  });
  write = log(card);
}
