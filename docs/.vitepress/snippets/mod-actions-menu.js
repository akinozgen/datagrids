import { Datagrid, column, serverSide, yajra, actions } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const out = document.querySelector("#mod-actions-menu-out");

const grid = new Datagrid("#mod-actions-menu", {
  label: "Field agents (row actions)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.actions({ title: "Actions" }),
  ],
  pageSize: 10,
  host: { notify: (kind, message) => (out.textContent = `${kind}: ${message}`) },
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    actions({
      rowLabel: (row) => row.name,
      items: [
        {
          id: "approve", label: "Approve", icon: "check", primary: true,
          disabled: (row) => row.status === "done" && "Already done",
          request: { url: "/api/action/agents/{id}/approve" },
        },
        { id: "remind", label: "Send reminder", icon: "send", request: { url: "/api/action/agents/{id}/remind" }, success: "Reminder sent to {name}." },
        { id: "open", label: "Open record", icon: "eye", group: "View", handler: (row) => (out.textContent = `open ${row.ref}`) },
        {
          id: "delete", label: "Delete", icon: "trash", tone: "danger",
          can: (row) => row.status !== "done",
          confirm: "Delete this record? This cannot be undone.",
          request: { url: "/api/action/agents/{id}", method: "DELETE" },
        },
      ],
    }),
  ],
});

grid.on("actionerror", ({ id, error }) => console.info(`${id} failed`, error));
