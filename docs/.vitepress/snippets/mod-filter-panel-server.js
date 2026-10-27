import { Datagrid, column, serverSide, yajra, filterPanel } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#mod-filter-panel-server", {
  label: "Field agents (filter panel)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    { key: "place", title: "Place" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
  ],
  pageSize: 10,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    filterPanel({
      fields: {
        unit: "#mod-fp-unit",
        status: "#mod-fp-status",
        name: "#mod-fp-name",
        place: { el: "#mod-fp-rc", value: "Raccoon City", unchecked: null },
      },
    }),
  ],
});

document.querySelector("#mod-fp-reset").addEventListener("click", () => grid.filterPanel.reset());
