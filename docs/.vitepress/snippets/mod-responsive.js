import { Datagrid, column, responsive } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#mod-responsive", {
  label: "Field agents (responsive)",
  columns: [
    column.text("name", { title: "Name" }),
    column.text("ref", { title: "Ref" }),
    column.text("unit", { title: "Unit" }),
    column.text("task", { title: "Task" }),
    column.text("place", { title: "Place" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date", time: true }),
  ],
  data: agents(40),
  pageSize: 6,
  use: [responsive({ priority: { name: 1, status: 2, amount: 3 } })],
});

const out = document.querySelector("#mod-responsive-out");
grid.on("collapse", ({ columns }) => (out.textContent = `collapsed: ${columns.join(", ") || "none"}`));
