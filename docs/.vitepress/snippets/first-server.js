import { Datagrid, column, serverSide, yajra } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

new Datagrid("#first-server", {
  label: "Field agents",
  columns: [
    column.index(),
    // plain columns follow the protocol: yajra escapes strings on the server, so they render as HTML
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date", time: true }),
  ],
  sort: [["date", "desc"]],
  pageSize: 10,
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true })],
});
