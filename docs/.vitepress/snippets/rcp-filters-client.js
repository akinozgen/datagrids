import { Datagrid, column } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#rcp-filters-client", {
  label: "Field agents (client filters)",
  data: agents(60),
  columns: [
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  pageSize: 5,
});

const presets = {
  all: { status: null, amount: null }, // null removes a filter
  open: { status: "open", amount: null },
  late: { status: ["pending", "draft"], amount: null }, // array = any of
  negative: { status: null, amount: (value) => value < 0 }, // function = predicate
};

document.querySelector("#rcp-fc-buttons").addEventListener("click", (e) => {
  const preset = e.target.closest("button")?.dataset.preset;
  if (preset) grid.filters(presets[preset]);
});
