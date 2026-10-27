import { Datagrid, column, stickyHeader } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-sticky-header", {
  label: "Field agents (sticky header)",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.text("task", { title: "Task" }),
    column.text("place", { title: "Place" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  data: agents(80),
  pageSize: 25,
  // this site has a 64px fixed top bar
  use: [stickyHeader({ offset: 64 })],
});
