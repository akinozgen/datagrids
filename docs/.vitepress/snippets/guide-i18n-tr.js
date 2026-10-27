import { Datagrid, column, tr } from "@akinozgen17/datagrids";
import { turkishRecords } from "./data.js";

// Turkish UI + Turkish collation and search folding: try searching "isik" or "ISIK"
new Datagrid("#guide-i18n-tr", {
  label: "Görev kayıtları",
  locale: "tr",
  messages: tr, // optional: "tr*" locales pick the Turkish pack automatically
  pageSize: 5,
  columns: [
    column.text("kayit", { title: "Kayıt" }),
    column.text("ad", { title: "Personel" }),
    column.text("mekan", { title: "Mekân" }),
    column.money("tutar", { title: "Tutar" }), // tr-TR, TRY
    column.date("tarih", { title: "Tarih" }),
  ],
  data: turkishRecords(60, 3),
});
