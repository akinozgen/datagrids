import { Datagrid, column, serverSide, yajra, columnFilters } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-column-filters-yajra", {
  label: "Field agents (column filters, yajra)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  sort: [["amount", "desc"]],
  pageSize: 10,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    columnFilters({ columns: ["name", "unit", "status", "amount"] }),
  ],
});
