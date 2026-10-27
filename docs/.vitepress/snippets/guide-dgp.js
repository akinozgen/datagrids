import { Datagrid, column, serverSide, dgp } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#guide-dgp", {
  label: "Agents (datagrids protocol)",
  pageSize: 5,
  sort: [["amount", "desc"]],
  columns: [
    column.text("name", { title: "Name" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date" }),
  ],
  use: [serverSide({ url: "/api/dgp/agents", protocol: dgp(), csrf: true })],
});

// typed filters travel as { key: { op, value } }
document.querySelector("#guide-dgp-open").addEventListener("click", () =>
  grid.filters({ status: { op: "in", value: ["open", "pending"] } }));
document.querySelector("#guide-dgp-big").addEventListener("click", () =>
  grid.filters({ amount: { op: "gte", value: 15000 } }));
document.querySelector("#guide-dgp-clear").addEventListener("click", () =>
  grid.filters({ status: null, amount: null }));
