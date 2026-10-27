import { Datagrid, column, serverSide, yajra, button } from "@/index";
import { durumLabels, durumTones } from "../data";
import { section, table, log } from "../shared";

/* Özel ve gruplu toolbar butonları + telefon kolonu */
{
  const card = section(
    "butonlar",
    "Özel ve gruplu butonlar",
    "button.custom(): yanıttan türeyen pasif durumla (ör. toplam tutar eşiği). button.group(): 'Dışa aktar' benzeri açılır menü (APG menu). Telefon kolonu tel: ve WhatsApp bağlantısı üretir.",
    "Modüller",
  );
  const write = log(card);
  const t = table(card, "g-butonlar");
  window.grids.butonlar = new Datagrid(t, {
    name: "butonlar",
    label: "Özel butonlu liste",
    pageSize: 8,
    columns: [
      column.text("kayit", { title: "Kayıt" }),
      column.text("ad", { title: "Personel" }),
      column.phone("telefon", { title: "Telefon", whatsapp: true }),
      column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
      column.money("tutar", { title: "Tutar" }),
    ],
    use: [
      serverSide({ url: "/api/yajra/gorevler", protocol: yajra({ cells: "text" }), csrf: true }),
      button.custom({
        name: "bugun",
        label: "Bugünün kayıtları",
        icon: "eye",
        onClick: (g) => {
          g.search("26.10.2026");
          write("filtre ön ayarı: bugün");
        },
      }),
      button.custom({
        name: "toplu",
        label: "Toplu onay",
        icon: "check",
        disabled: (raw) => ((raw as { summary?: { toplam?: number } })?.summary?.toplam ?? 0) < 1_000_000,
        onClick: () => write("toplu onay çalıştı"),
      }),
      button.group({
        label: "Diğer",
        icon: "more",
        items: [
          { id: "yardim", label: "Yardım", icon: "info", onClick: () => write("yardım açıldı") },
          { id: "tam", label: "Tam ekran", icon: "eye", onClick: () => write("tam ekran") },
          { id: "gizli", label: "Yetkisiz", can: false, onClick: () => write("görünmemeli") },
        ],
      }),
    ],
  });
}
