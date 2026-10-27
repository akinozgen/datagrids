import { Datagrid, column, button } from "@akinozgen17/datagrids";
import { agents } from "./data.js";

const out = document.querySelector("#mod-buttons-custom-out");
let next = 1001;

new Datagrid("#mod-buttons-custom", {
  label: "Field agents (custom buttons)",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
  ],
  data: agents(12),
  pageSize: 5,
  use: [
    button.custom({
      name: "addButton",
      label: "Add agent",
      variant: "primary",
      onClick: (grid) => grid.addRows([{ id: next, ref: `AG-${next++}`, name: "Rebecca Chambers", unit: "S.T.A.R.S. Bravo" }]),
    }),
    button.group({
      label: "More",
      icon: "more",
      items: [
        { id: "copy", label: "Copy names", icon: "copy", onClick: (grid) => (out.textContent = grid.viewRows().map((r) => r.name).join(", ")) },
        { id: "count", label: "Count rows", onClick: (grid) => (out.textContent = `${grid.rows().length} rows`) },
      ],
    }),
  ],
});
