import { Datagrid, column, fetchAll } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

// one GET, then search / sort / paging happen in the browser
new Datagrid("#guide-fetchall", {
  label: "Agents (fetched once)",
  pageSize: 5,
  columns: [
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  use: [fetchAll({ url: "/api/all/agents?limit=200" })],
});
