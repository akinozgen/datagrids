import { Datagrid, column, keyboardGrid } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#mod-keyboard-grid", {
  label: "Field agents (keyboard grid)",
  columns: [
    column.link("name", { title: "Name", href: "#agent-{id}" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  data: agents(40),
  pageSize: 6,
  use: [keyboardGrid()],
});

const out = document.querySelector("#mod-keyboard-grid-out");
grid.table.addEventListener("focusin", () => {
  const { row, col } = grid.keyboardGrid.position();
  out.textContent = `position() → row ${row}, col ${col}`;
});
