import { Datagrid, column, serverSide, yajra, colVis, lazyColumns } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-lazy-columns", {
  label: "Field agents (lazy columns)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    // expensive on the server: computed only while visible
    { key: "task", title: "Task", lazy: true, visible: false },
    { key: "place", title: "Place", lazy: true, visible: false },
  ],
  pageSize: 8,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    colVis(),
    lazyColumns(),
  ],
});
