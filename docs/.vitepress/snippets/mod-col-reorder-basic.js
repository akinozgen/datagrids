import { Datagrid, column, colReorder, colVis, stateSave } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#mod-col-reorder-basic", {
  label: "Field agents (reorderable columns)",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  data: agents(60),
  pageSize: 8,
  use: [colReorder(), colVis(), stateSave()],
});

const out = document.querySelector("#mod-col-reorder-out");
grid.on("columnchange", () => (out.textContent = `grid.colReorder.order() → ${JSON.stringify(grid.colReorder.order())}`));
document.querySelector("#mod-col-reorder-reset").addEventListener("click", () => grid.colReorder.reset());
