import { Datagrid, serverSide, yajra } from "@akinozgen17/datagrids";

const out = document.querySelector("#guide-errors-log");
const log = (line) => (out.textContent = line + "\n" + out.textContent);

const grid = new Datagrid("#guide-errors", {
  label: "Agents",
  pageSize: 5,
  columns: [{ key: "ref", title: "Ref" }, { key: "name", title: "Name" }, { key: "unit", title: "Unit" }],
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true })],
});

grid.on("error", ({ error }) => log(`error → kind=${error.kind} status=${error.status} retryable=${error.retryable}`));
grid.on("sessionexpired", () => log("sessionexpired → send the user to the login page"));
grid.on("loadingchange", ({ loading }) => loading && log("loading…"));
