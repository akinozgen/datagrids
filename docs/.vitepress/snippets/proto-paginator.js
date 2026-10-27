import { Datagrid, column, serverSide, laravelPaginator } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#proto-paginator", {
  label: "Agents (Laravel paginator)",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date" }),
  ],
  sort: [["date", "desc"]],
  pageSize: 5,
  use: [serverSide({ url: "/api/paginator/agents", protocol: laravelPaginator() })],
});
