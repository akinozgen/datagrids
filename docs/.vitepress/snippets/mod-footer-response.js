import { Datagrid, column, serverSide, yajra, footer } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-footer-response", {
  label: "Field agents (server total)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  pageSize: 10,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    footer({
      scope: "response",
      label: "All matching records",
      cols: { amount: (rows, raw) => raw?.summary?.total },
    }),
  ],
});
