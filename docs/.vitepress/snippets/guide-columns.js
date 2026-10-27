import { Datagrid, column } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const rows = agents(40).map((r) => ({
  ...r,
  // trusted markup from your own code; shown only through column.html()
  notes: r.status === "cancelled" ? "<strong>Cancelled</strong> by HQ" : "",
}));

// a render function may return a Node: build it with DOM APIs (no HTML parsing)
const person = (name, row) => {
  const wrap = document.createElement("div");
  wrap.className = "dg-user";
  const avatar = document.createElement("span");
  avatar.className = "dg-avatar";
  avatar.textContent = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const body = document.createElement("div");
  body.className = "dg-user-body";
  const link = document.createElement("a");
  link.className = "dg-link dg-user-name";
  link.href = `#agent-${row.id}`;
  link.textContent = name;
  const sub = document.createElement("span");
  sub.className = "dg-sub";
  sub.textContent = row.unit;
  body.append(link, sub);
  wrap.append(avatar, body);
  return wrap;
};

new Datagrid("#guide-columns", {
  label: "Column types",
  pageSize: 6,
  data: rows,
  columns: [
    column.index(),
    column.text("ref", { title: "Ref", render: (v) => Object.assign(document.createElement("span"), { className: "dg-id", textContent: v }) }),
    column.text("name", { title: "Agent", render: person, searchText: (v, row) => `${v} ${row.unit}` }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date", time: true }),
    column.link("place", { title: "Place", href: "/places/{place}" }),
    column.html("notes", { title: "Notes", sortable: false }),
  ],
});
