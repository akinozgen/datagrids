import { Datagrid, column, filterPanel } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#mod-filter-panel-client", {
  label: "Field agents (filter panel, in the browser)",
  columns: [
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  data: agents(120),
  pageSize: 10,
  use: [
    filterPanel({
      fields: {
        unit: "#mod-fpc-unit",
        amount: { el: "#mod-fpc-min", format: (v) => (v ? { op: "gte", value: Number(v) } : null) },
      },
    }),
  ],
});

const out = document.querySelector("#mod-fpc-out");
grid.on("load", () => (out.textContent = `grid.filters() → ${JSON.stringify(grid.filters())}`));
