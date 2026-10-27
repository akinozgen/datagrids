import { Datagrid, column, serverSide, yajra, colVis, stateSave, button, excel, csv, print } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#home-grid", {
  label: "Field agents",
  columns: [
    // plain columns follow the protocol: yajra escapes strings on the server, so they render as HTML
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    { key: "task", title: "Task", visible: false },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date", time: true }),
  ],
  sort: [["date", "desc"]],
  pageSize: 10,
  count: true,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    colVis(),
    button.reload(),
    stateSave(),
    excel(),
    csv(),
    print(),
  ],
});
