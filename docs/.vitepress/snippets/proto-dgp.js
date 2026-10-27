import { Datagrid, column, serverSide, dgp, columnFilters, metaBind } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

new Datagrid("#proto-dgp", {
  label: "Agents (datagrids protocol v1)",
  columns: [
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date" }),
  ],
  sort: [["amount", "desc"]],
  pageSize: 5,
  use: [
    serverSide({ url: "/api/dgp/agents", protocol: dgp({ count: "exact" }), csrf: true }),
    columnFilters(), // typed filters → filters: { key: { op, value } }
    metaBind({ "#proto-dgp-sum": { value: "meta.aggregates.amount.sum", format: (v) => usd.format(v) } }),
  ],
});
