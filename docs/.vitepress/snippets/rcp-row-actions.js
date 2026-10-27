import { Datagrid, column, serverSide, yajra, actions } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const table = document.querySelector("#rcp-row-actions");
const can = JSON.parse(table.dataset.can); // permissions rendered by Blade
const note = document.querySelector("#rcp-row-actions-note");

new Datagrid(table, {
  label: "Field agents (row actions)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.actions({ title: "Actions" }),
  ],
  pageSize: 5,
  // demo only: show notifications on the page (usually configure({ notify }) once, see below)
  host: { notify: (kind, message) => (note.textContent = `${kind}: ${message}`) },
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    actions({
      items: [
        { id: "view", label: "View", icon: "eye", primary: true, href: "#agent-{id}" },
        {
          id: "approve", label: "Approve", icon: "check", can: can.approve,
          request: { url: "/api/action/agents/{id}/approve" }, // POST + CSRF → notify → reload
          disabled: (row) =>
            row.status === "done" ? "Already approved." :
            row.status === "cancelled" ? "Cancelled records can't be approved." : false,
        },
        {
          id: "delete", label: "Delete", icon: "trash", tone: "danger", can: can.delete,
          confirm: "Delete {name}? This cannot be undone.",
          request: { url: "/api/action/agents/{id}", method: "DELETE" },
        },
      ],
    }),
  ],
});
