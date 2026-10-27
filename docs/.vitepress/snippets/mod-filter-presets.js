import { Datagrid, column, serverSide, yajra, filterPanel, filterPresets } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-filter-presets", {
  label: "Field agents (filter presets)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
  ],
  pageSize: 8,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    filterPanel({ fields: { unit: "#mod-fps-unit", status: "#mod-fps-status" } }),
    filterPresets({
      presets: [
        { id: "all", label: "All", values: {}, default: true },
        { id: "open", label: "Open", values: { status: "open" } },
        { id: "pending", label: "Waiting", values: { status: "pending" } },
        { id: "rpd-open", label: "R.P.D. open", values: { unit: "R.P.D.", status: "open" } },
      ],
    }),
  ],
});
