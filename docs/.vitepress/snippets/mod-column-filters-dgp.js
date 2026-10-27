import { Datagrid, column, serverSide, dgp, columnFilters } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-column-filters-dgp", {
  label: "Field agents (column filters, datagrids protocol)",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  pageSize: 10,
  use: [
    serverSide({ url: "/api/dgp/agents", protocol: dgp() }),
    columnFilters(),
  ],
});
