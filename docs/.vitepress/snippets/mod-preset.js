import { Datagrid, column, serverSide, yajra, colVis, button, stateSave, excel, print } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

// one array = one house standard for every list page
const listPage = (url) => [
  serverSide({ url, protocol: yajra(), csrf: true }),
  colVis(),
  button.reload(),
  stateSave(),
  excel(),
  print(),
];

new Datagrid("#mod-preset", {
  label: "Field agents (preset)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  pageSize: 10,
  use: [listPage("/api/agents")],
});
