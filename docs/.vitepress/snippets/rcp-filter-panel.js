import { Datagrid, column, serverSide, yajra, filterPanel, urlSync } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#rcp-filter-panel", {
  label: "Field agents (filter panel)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    { key: "task", title: "Task" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
  ],
  pageSize: 5,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    // request parameter → form control; read on every request, reload on change
    filterPanel({
      fields: {
        status: "#rcp-fp-status",
        unit: "#rcp-fp-unit", // <select multiple> → unit[]=…&unit[]=…
        name: "#rcp-fp-name", // typing is debounced
      },
    }),
    urlSync(), // ?q=…&sort=…&f.status=open — a shareable link of this view
  ],
});

document.querySelector("#rcp-fp-reset").addEventListener("click", () => grid.filterPanel.reset());
