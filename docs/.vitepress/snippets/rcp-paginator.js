import { Datagrid, column, serverSide, laravelPaginator } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#rcp-paginator", {
  label: "Field agents (paginator)",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date" }),
  ],
  sort: [["date", "desc"]],
  pageSize: 10,
  use: [
    serverSide({
      url: "/api/paginator/agents",
      protocol: laravelPaginator(), // ?page=2&per_page=10&sort=-date&search=jill
    }),
  ],
});
