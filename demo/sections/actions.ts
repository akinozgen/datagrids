import { Datagrid, column, serverSide, yajra, actions } from "@/index";
import { durumLabels, durumTones } from "../data";
import { section, table, tools, log } from "../shared";

/* Satır aksiyonları: katalog frontend'de, backend yalnız veri gönderir. */
{
  const card = section(
    "aksiyonlar",
    "Satır aksiyonları (standart menü)",
    "Katalog .use(actions(...)) ile tanımlanır; backend markup göndermez. ≤2 aksiyon satırda buton, fazlası birincil + ⋯ menü (APG Menu Button). can:false gizler (yetki), disabled(row) sebebini gösterir (satır durumu). Onay native <dialog>; istek CSRF'li, sonra sayfa korunarak yenilenir.",
    "Modüller",
  );
  const yetki = { sil: true };
  const write = log(card);
  const t = table(card, "g-aksiyon");
  const grid = (window.grids.aksiyon = new Datagrid(t, {
    name: "aksiyon",
    label: "Aksiyonlu liste",
    pageSize: 10,
    sort: [["tarih", "desc"]],
    columns: [
      column.text("kayit", { title: "Kayıt" }),
      column.text("ad", { title: "Personel" }),
      column.text("birim", { title: "Birim" }),
      column.badge("durum", { title: "Durum", labels: durumLabels, tones: durumTones }),
      column.money("tutar", { title: "Tutar" }),
      column.date("tarih", { title: "Tarih" }),
      column.actions({ title: "İşlemler" }),
    ],
    use: [
      serverSide({ url: "/api/yajra/gorevler", protocol: yajra({ cells: "text" }), csrf: true }),
      actions({
        items: [
          { id: "edit", label: "Düzenle", icon: "edit", primary: true, group: "Kayıt", href: "#duzenle-{id}" },
          { id: "copy", label: "Kopyala", icon: "copy", group: "Kayıt", handler: (row) => write(`kopyalandı: ${row.kayit}`) },
          {
            id: "approve", label: "Onayla", icon: "check", group: "Kayıt",
            disabled: (row) => (row.durum === "tamam" ? "Kayıt zaten tamamlandı." : row.durum === "iptal" ? "İptal edilmiş kayıt onaylanamaz." : false),
            request: { url: "/api/action/gorevler/{id}/onayla", method: "POST" },
            confirm: { title: "Kayıt onaylansın mı?", message: "{kayit} tamamlandı olarak işaretlenecek." },
            success: "{kayit} onaylandı.",
          },
          {
            id: "sms", label: "SMS gönder", icon: "send", group: "Bildirim",
            disabled: (row) => (row.birim === "Sivil" ? "Sivil personelin doğrulanmış telefonu yok." : false),
            handler: (row, { grid }) => grid.notify("success", `${row.ad} için SMS kuyruğa alındı.`),
          },
          {
            id: "delete", label: "Sil", icon: "trash", tone: "danger",
            can: (row) => yetki.sil && row.durum !== "tamam",
            request: { url: "/api/action/gorevler/{id}", method: "DELETE" },
            confirm: { title: "Kayıt silinsin mi?", message: "{kayit} · {ad} kalıcı olarak silinecek." },
            success: "{kayit} silindi.",
          },
        ],
      }),
    ],
  }));
  grid.on("action" as never, ((d: { id: string; key: string }) => write(`action → ${d.id} (#${d.key})`)) as never);
  grid.on("actionerror" as never, ((d: { id: string; error: { message?: string } }) => write(`actionerror → ${d.id}: ${d.error?.message ?? d.error}`)) as never);
  const box = tools(card, {
    "Yetki: sil aç/kapa": () => {
      yetki.sil = !yetki.sil;
      write(`yetki.sil = ${yetki.sil}`);
      void grid.reload({ keepPage: true });
    },
    "Sonraki aksiyon 500 versin": () => {
      (window as unknown as { emu: { faults: { next: string | null } } }).emu.faults.next = "500";
    },
  });
  card.prepend(box);
}

/* İki aksiyon: satırda inline (eşik ≤2) */
{
  const card = section("aksiyon-inline", "Inline aksiyonlar (≤2)", "İki aksiyon satırda etiketli buton olarak durur; pasif olan yerinde kalır, ⓘ'ye tıklayınca sebep notu açılır.", "Modüller");
  const t = table(card, "g-aksiyon-inline");
  window.grids.aksiyonInline = new Datagrid(t, {
    name: "aksiyonInline",
    label: "Inline aksiyonlar",
    pageSize: 5,
    columns: [column.text("kayit", { title: "Kayıt" }), column.text("ad", { title: "Personel" }), column.text("birim", { title: "Birim" }), column.actions({ title: "İşlemler" })],
    use: [
      serverSide({ url: "/api/yajra/gorevler", protocol: yajra({ cells: "text" }), csrf: true }),
      actions({
        items: [
          { id: "edit", label: "Düzenle", icon: "edit", href: "#duzenle-{id}" },
          {
            id: "send", label: "Gönder", icon: "send",
            disabled: (row) => (row.birim === "R.P.D." || row.birim === "Sivil" ? "Telefon numarası doğrulanmamış. Önce numarayı doğrulayın." : false),
            handler: (row, { grid }) => grid.notify("success", `${row.ad}: gönderildi.`),
          },
        ],
      }),
    ],
  });
}
