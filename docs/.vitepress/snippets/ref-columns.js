import { Datagrid, column, selection, actions } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const rows = agents(40).map((a) => ({
  ...a,
  hours: (a.id % 9) * 1.25,
  note: a.status === "done" ? "<strong>Closed</strong>" : "<em>In progress</em>",
}));
const out = document.querySelector("#ref-columns-out");

new Datagrid("#ref-columns", {
  label: "Column factories",
  columns: [
    column.select(),
    column.index(),
    column.link("ref", { title: "Ref", href: "#agent-{id}" }),
    column.text("name", { title: "Name" }),
    column.html("note", { title: "Note" }),
    column.number("hours", { title: "Hours", decimals: 1, locale: "en-US" }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date", time: true }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.actions(),
  ],
  data: rows,
  pageSize: 5,
  size: "sm",
  use: [
    selection({ bulk: false }),
    actions({ items: [{ id: "view", label: "View", icon: "eye", handler: (row) => (out.textContent = `View ${row.name}`) }] }),
  ],
});
