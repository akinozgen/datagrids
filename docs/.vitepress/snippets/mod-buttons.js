import { Datagrid, column, serverSide, yajra, stateSave, colVis, button } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-buttons", {
  label: "Field agents (toolbar buttons)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    { key: "task", title: "Task", visible: false },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
  ],
  pageSize: 10,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    stateSave(),
    colVis(),
    button.reload(),
    button.resetState(),
  ],
});
