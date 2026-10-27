import { Datagrid, column, excel, csv, print, footer } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-export-menu", {
  label: "Field agents",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date", time: true }),
  ],
  data: agents(120),
  pageSize: 10,
  use: [
    footer({ cols: { amount: "sum" }, scope: "response" }),
    excel({ filename: "field-agents", footer: true }),
    csv(),
    print({ footer: true }),
  ],
});
