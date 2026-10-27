import { Datagrid, column, actions } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

// a per-row permission map, as a server would send it
const rows = agents(30).map((r) => ({
  ...r,
  permissions: r.status === "cancelled" ? { delete: { disabled: "archived" } } : r.status === "draft" ? ["edit"] : true,
}));
const out = document.querySelector("#mod-actions-inline-out");

new Datagrid("#mod-actions-inline", {
  label: "Field agents (inline actions)",
  columns: [
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.actions({ title: "Actions" }),
  ],
  data: rows,
  pageSize: 8,
  use: [
    actions({
      field: "permissions",
      reasons: { archived: "Cancelled records are kept for the audit log." },
      items: [
        { id: "edit", label: "Edit", icon: "edit", handler: (row) => (out.textContent = `edit ${row.name}`) },
        {
          id: "delete", label: "Delete", icon: "trash", tone: "danger",
          confirm: { title: "Delete record", message: "Delete {name}?" },
          handler: (row, { grid, key }) => grid.removeRow(key),
        },
      ],
    }),
  ],
});
