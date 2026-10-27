import { Datagrid, serverSide, yajra } from "@akinozgen17/datagrids";

const grid = new Datagrid("#guide-manual", {
  label: "Agents (manual load)",
  load: "manual", // no request until the user (or your code) asks
  pageSize: 5,
  columns: [{ key: "ref", title: "Ref" }, { key: "name", title: "Name" }, { key: "unit", title: "Unit" }],
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true })],
});

document.querySelector("#guide-manual-load").addEventListener("click", () => grid.load());
