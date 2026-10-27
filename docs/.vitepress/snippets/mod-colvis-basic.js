import { Datagrid, column, colVis } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-colvis-basic", {
  label: "Field agents (column menu)",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name", hideable: false }),
    column.text("unit", { title: "Unit" }),
    column.text("task", { title: "Task", visible: false }),
    column.text("place", { title: "Place", visible: false }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date" }),
  ],
  data: agents(60),
  pageSize: 10,
  use: [colVis()],
});
