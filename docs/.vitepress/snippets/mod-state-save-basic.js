import { Datagrid, column, stateSave, colVis, button } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#mod-state-save-basic", {
  label: "Field agents (saved view)",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.text("task", { title: "Task", visible: false }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  data: agents(80),
  pageSize: 10,
  use: [stateSave(), colVis(), button.resetState()],
});

const out = document.querySelector("#mod-state-save-out");
document.querySelector("#mod-state-save-show").addEventListener("click", () => {
  const saved = grid.state.read();
  out.textContent = saved ? `${grid.state.key}\n${JSON.stringify(saved)}` : "Nothing stored yet.";
});
