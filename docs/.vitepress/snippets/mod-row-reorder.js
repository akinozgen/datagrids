import { Datagrid, column, rowReorder, reorderColumn } from "@akinozgen17/datagrids";
import { agents } from "./data.js";

const rows = agents(12).map((r, i) => ({ ...r, position: i + 1 }));
const out = document.querySelector("#mod-row-reorder-out");

new Datagrid("#mod-row-reorder", {
  label: "Patrol order",
  columns: [
    reorderColumn(),
    column.number("position", { title: "#" }),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
  ],
  data: rows,
  sort: [["position", "asc"]],
  pageSize: 8,
  use: [
    rowReorder({
      orderKey: "position",
      onEnd: async ({ key, from, to, prevKey, nextKey }) => {
        out.textContent = `PATCH /patrols/${key}/order ${JSON.stringify({ from, to, prevKey, nextKey })}`;
        await new Promise((r) => setTimeout(r, 300)); // the save
      },
    }),
  ],
});
