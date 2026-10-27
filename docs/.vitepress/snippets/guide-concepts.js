import { Datagrid, column, colVis, stateSave, button } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const out = document.querySelector("#guide-concepts-log");
const log = (line) => (out.textContent = line + "\n" + out.textContent);

// columns: what to show and how
const columns = [
  column.text("name", { title: "Name" }),
  column.text("unit", { title: "Unit" }),
  column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
  column.date("date", { title: "Date" }),
];

// modules: immutable definitions, attached per grid
const grid = new Datagrid("#guide-concepts", {
  label: "Agents",
  columns,
  data: agents(80),
  pageSize: 5,
  use: [colVis(), button.reload(), stateSave()],
});

// events: react to what happened
grid.on("sort", ({ sort }) => log(`sort → ${sort.map((s) => s.key + " " + s.dir).join(", ")}`));
grid.on("search", ({ search }) => log(`search → "${search}"`));
grid.on("page", ({ page }) => log(`page → ${page}`));
grid.on("columnchange", ({ columns }) => log(`columnchange → ${columns.filter((c) => c.visible).length} visible`));
