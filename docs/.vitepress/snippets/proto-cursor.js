import { Datagrid, column, serverSide, laravelPaginator } from "@akinozgen17/datagrids";

new Datagrid("#proto-cursor", {
  label: "Agents (cursorPaginate)",
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.date("date", { title: "Date", time: true }),
  ],
  sort: [["date", "desc"]],
  pageSize: 5,
  use: [serverSide({ url: "/api/cursor/agents", protocol: laravelPaginator() })],
});
