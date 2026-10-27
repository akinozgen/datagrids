import { Datagrid, column, serverSide, laravelPaginator } from "@akinozgen17/datagrids";

new Datagrid("#guide-paginator", {
  label: "Agents (Laravel paginator)",
  pageSize: 5,
  sort: [["date", "desc"]],
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("place", { title: "Place" }),
    column.date("date", { title: "Date" }),
  ],
  // GET /api/paginator/agents?page=1&per_page=5&sort=-date&search=…
  use: [serverSide({ url: "/api/paginator/agents", protocol: laravelPaginator() })],
});
