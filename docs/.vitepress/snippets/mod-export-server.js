import { Datagrid, column, serverSide, yajra, excel, csv } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const out = document.querySelector("#mod-export-server-out");

new Datagrid("#mod-export-server", {
  label: "Field agents (server export)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  pageSize: 10,
  maxPageSize: 200,
  host: { notify: (kind, message) => (out.textContent = `${kind}: ${message}`) },
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    excel({ scope: "all" }),
    csv({ scope: "all" }),
  ],
});
