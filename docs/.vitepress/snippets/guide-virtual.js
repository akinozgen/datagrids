import { Datagrid, column } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const rows = agents(5000);
const t0 = performance.now();
const grid = new Datagrid("#guide-virtual", {
  label: "5,000 agents, one page",
  paging: false,          // every row in one view → virtual rows switch on (≥ 300)
  maxHeight: "420px",
  columns: [
    column.index(),
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("task", { title: "Task" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  data: rows,
});

grid.on("render", () => {
  const rendered = grid.table.tBodies[0].rows.length;
  document.querySelector("#guide-virtual-info").textContent =
    `${grid.viewRows().length} rows in view · ${rendered} <tr> in the DOM · first render ${Math.round(performance.now() - t0)} ms`;
});
