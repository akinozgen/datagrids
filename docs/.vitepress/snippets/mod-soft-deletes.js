import { Datagrid, column, serverSide, yajra, softDeletes } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-soft-deletes", {
  label: "Field agents (soft deletes)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.date("deleted_at", { title: "Deleted", time: true }),
  ],
  sort: [["deleted_at", "desc"]],
  pageSize: 10,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    softDeletes(),
  ],
});
