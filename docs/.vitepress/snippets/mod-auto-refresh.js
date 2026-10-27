import { Datagrid, column, serverSide, yajra, autoRefresh } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#mod-auto-refresh", {
  label: "Field agents (auto refresh)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
  ],
  pageSize: 5,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    autoRefresh({ every: 5000 }),
  ],
});

const out = document.querySelector("#mod-auto-refresh-out");
grid.on("load", () => (out.textContent = `Last loaded ${new Date().toLocaleTimeString("en-US")}`));
