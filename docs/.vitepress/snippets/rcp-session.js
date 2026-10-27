import { Datagrid, serverSide, yajra } from "@akinozgen17/datagrids";

const out = document.querySelector("#rcp-session-log");
const log = (line) => (out.textContent = `${line}\n${out.textContent}`);

const grid = new Datagrid("#rcp-session", {
  label: "Field agents (session)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    { key: "status_html", title: "Status", sortable: false, searchable: false },
  ],
  pageSize: 5,
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true })],
});

grid.on("error", ({ error }) => log(`error: kind=${error.kind}, status=${error.status}, "${error.message}"`));
grid.on("sessionexpired", ({ error }) => log(`sessionexpired (${error.status}): send the user to the login page`));
