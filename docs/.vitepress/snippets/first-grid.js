import { Datagrid, column } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

new Datagrid("#first-grid", {
  label: "Field agents",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date" }),
  ],
  data: agents(120),
  sort: [["date", "desc"]],
  pageSize: 10,
});
