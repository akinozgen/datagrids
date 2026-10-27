import {
  Datagrid, column, serverSide, yajra, filterPanel, stateSave, colVis, button, excel, print,
} from "@akinozgen17/datagrids";

new Datagrid("#mig-after", {
  name: "mig-after",
  label: "Field agents",
  columns: [
    column.index(),
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    { key: "status_html", title: "Status", sortable: false, searchable: false },
  ],
  sort: [["amount", "desc"]],
  pageSize: 10,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    filterPanel({ fields: { unit: "#mig-after-unit" } }), // sent as `unit`, reloads on change
    stateSave(), // search and page are not saved by default
    colVis(),
    button.reload(),
    excel(),
    print(),
  ],
});
