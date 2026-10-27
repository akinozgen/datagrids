import { Datagrid, column, serverSide, yajra } from "@akinozgen17/datagrids";

const unit = document.querySelector("#rcp-yajra-unit");

const grid = new Datagrid("#rcp-yajra", {
  label: "Field agents (yajra)",
  columns: [
    // untyped columns follow the protocol default: yajra sends escaped text, so they render as HTML
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    // built by the controller with addColumn() + rawColumns()
    { key: "status_html", title: "Status", sortable: false, searchable: false },
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date" }),
  ],
  sort: [["date", "desc"]],
  pageSize: 10,
  use: [
    serverSide({
      url: "/api/agents",
      protocol: yajra(),
      csrf: true,
      params: () => ({ unit: unit.value }), // read on every request
    }),
  ],
});

unit.addEventListener("change", () => grid.reload());
