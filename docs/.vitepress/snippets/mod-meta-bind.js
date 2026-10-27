import { Datagrid, column, serverSide, yajra, metaBind } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

new Datagrid("#mod-meta-bind", {
  label: "Field agents (bound summary)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  pageSize: 10,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    metaBind({
      "#mod-meta-bind-filtered": { value: "recordsFiltered", format: "number" },
      "#mod-meta-bind-total": { value: "recordsTotal", format: "number" },
      "#mod-meta-bind-amount": { value: "summary.total", format: (v) => usd.format(v) },
    }),
  ],
});
