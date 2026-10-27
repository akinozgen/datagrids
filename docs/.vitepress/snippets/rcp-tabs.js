import { Datagrid, serverSide, yajra } from "@akinozgen17/datagrids";

const $ = (sel) => document.querySelector(sel);
const log = (line) => ($("#rcp-tabs-log").textContent += `\n${line}`);

const columns = [
  { key: "ref", title: "Ref" },
  { key: "name", title: "Name" },
  { key: "unit", title: "Unit" },
  { key: "status_html", title: "Status", sortable: false, searchable: false },
];

// In a tab: no request until the panel is shown
const inTab = new Datagrid("#rcp-tabs", {
  label: "Agents (tab)",
  columns,
  pageSize: 5,
  load: "visible",
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true })],
});

// In a dialog: you decide when the first request goes out
const inDialog = new Datagrid("#rcp-tabs-dialog-grid", {
  labelledBy: "rcp-tabs-dialog-title",
  columns,
  pageSize: 5,
  load: "manual",
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true, params: { status: "pending" } })],
});

inTab.on("load", () => log("tab grid: first page loaded"));
inDialog.on("load", () => log("dialog grid: first page loaded"));

// plain tabs: toggle `hidden` — the grid notices on its own
for (const tab of document.querySelectorAll("#rcp-tabs-list [role=tab]")) {
  tab.addEventListener("click", () => {
    for (const t of document.querySelectorAll("#rcp-tabs-list [role=tab]")) {
      t.setAttribute("aria-selected", String(t === tab));
      $(`#${t.getAttribute("aria-controls")}`).hidden = t !== tab;
    }
  });
}

$("#rcp-tabs-open").addEventListener("click", () => {
  $("#rcp-tabs-dialog").showModal();
  if (!inDialog.status().loaded) inDialog.load();
});
