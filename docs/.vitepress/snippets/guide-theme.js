import { Datagrid, column } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

const grid = new Datagrid("#guide-theme", {
  surface: "card",
  title: "Field assignments",
  description: "Open tasks by unit",
  count: true,
  striped: true,
  pageSize: 5,
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  data: agents(40),
});

// every appearance option is a root attribute or an inherited token — no re-render needed
const $ = (id) => document.querySelector(id);
$("#guide-theme-accent").addEventListener("input", (e) => $("#guide-theme-host").style.setProperty("--dg-accent", e.target.value));
$("#guide-theme-density").addEventListener("change", (e) => grid.root.setAttribute("data-density", e.target.value));
$("#guide-theme-size").addEventListener("change", (e) => grid.root.setAttribute("data-size", e.target.value));
$("#guide-theme-head").addEventListener("change", (e) =>
  e.target.value === "sentence" ? grid.root.setAttribute("data-dg-head", "sentence") : grid.root.removeAttribute("data-dg-head"));
$("#guide-theme-theme").addEventListener("change", (e) =>
  e.target.value ? grid.root.setAttribute("data-dg-theme", e.target.value) : grid.root.removeAttribute("data-dg-theme"));
