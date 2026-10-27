import { Datagrid, column, colVis } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const $ = (sel) => document.querySelector(sel);

const grid = new Datagrid("#rcp-headless", {
  label: "Field agents (own controls)",
  data: agents(80),
  columns: [
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date" }),
  ],
  search: false, // no built-in search box
  sort: [["date", "desc"]],
  pageSize: 10,
  use: [colVis()],
});

// your controls → grid methods
let timer;
$("#rcp-hl-q").addEventListener("input", (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => grid.search(e.target.value), 250);
});
$("#rcp-hl-sort").addEventListener("change", (e) => grid.sort([e.target.value.split(":")]));
$("#rcp-hl-size").addEventListener("change", (e) => grid.pageSize(Number(e.target.value)));
$("#rcp-hl-cols").addEventListener("click", () => grid.colVis.open());

// grid events → your controls (a header click also sorts)
grid.on("sort", ({ sort }) => ($("#rcp-hl-sort").value = sort.map((s) => `${s.key}:${s.dir}`)[0] ?? ""));

const log = (line) => ($("#rcp-hl-log").textContent = `${line}\n${$("#rcp-hl-log").textContent}`);
grid.on("search", ({ search }) => log(`search "${search}"`));
grid.on("sort", ({ sort }) => log(`sort ${JSON.stringify(sort)}`));
grid.on("page", ({ page }) => log(`page ${page}`));
grid.on("pagesize", ({ pageSize }) => log(`pagesize ${pageSize}`));
grid.on("columnchange", ({ columns }) => log(`columnchange visible: ${columns.filter((c) => c.visible).map((c) => c.key)}`));
