import { Datagrid, column } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

/** A tiny module: puts one element into a toolbar slot. */
const toolbarItem = (name, slot, order, el) => ({
  name,
  kind: "toolbar",
  setup(ctx) {
    ctx.toolbar({ slot, order, el });
    return { api: { el } };
  },
});

const status = document.createElement("select");
status.className = "dg-select"; // the grid's own control style
status.setAttribute("aria-label", "Status");
status.append(new Option("Any status", ""), ...Object.entries(statusLabels).map(([v, l]) => new Option(l, v)));

const add = document.createElement("button");
add.type = "button";
add.className = "dg-btn";
add.dataset.variant = "primary";
add.textContent = "New agent";

const summary = document.createElement("span");

const grid = new Datagrid("#rcp-toolbar-slots", {
  label: "Field agents (toolbar slots)",
  data: agents(60),
  columns: [
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
  ],
  pageSize: 5,
  use: [
    toolbarItem("statusFilter", "start", 10, status), // after the search box
    toolbarItem("newAgent", "end", 10, add),
    toolbarItem("summary", "filters", 10, summary), // full-width row under the toolbar
  ],
});

status.addEventListener("change", () => grid.filters({ status: status.value || null }));
add.addEventListener("click", () => grid.addRows([{ id: Date.now(), name: "New agent", unit: "R.P.D.", status: "draft" }]));
grid.on("load", () => {
  const { filtered, total } = grid.status();
  summary.textContent = `${filtered} of ${total} agents${status.value ? ` · ${statusLabels[status.value]}` : ""}`;
});
