import { Datagrid, column, filterPanel, urlSync } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#mod-url-sync", {
  label: "Field agents (URL sync)",
  columns: [
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  data: agents(120),
  pageSize: 10,
  use: [
    filterPanel({ fields: { unit: "#mod-url-sync-unit" } }),
    urlSync({ namespace: "agents" }),
  ],
});

const out = document.querySelector("#mod-url-sync-out");
grid.on("load", () => (out.textContent = decodeURIComponent(new URL(grid.urlSync.link()).search) || "(no query)"));
