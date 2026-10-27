import { Datagrid, column, selection } from "@akinozgen17/datagrids";
import { agents } from "./data.js";

const grid = new Datagrid("#mod-selection-single", {
  label: "Field agents (single selection)",
  columns: [
    column.select(),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.text("place", { title: "Place" }),
  ],
  data: agents(40),
  pageSize: 6,
  use: [selection({ mode: "single", bulk: false })],
});

const out = document.querySelector("#mod-selection-single-out");
grid.on("selectionchange", () => {
  const [row] = grid.selection.get();
  out.textContent = row ? `Assigned to: ${row.name} (${row.unit})` : "Nobody selected.";
});
