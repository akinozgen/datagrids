import { Datagrid, column, serverSide, yajra, selection } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const out = document.querySelector("#mod-selection-bulk-out");

// POST the selection payload; grid.action adds the CSRF header, notifies and reloads
const bulk = (verb) => (payload, grid) => {
  out.textContent = `POST /api/action/agents/bulk/${verb}\n${JSON.stringify(payload)}`;
  return grid.action(`/api/action/agents/bulk/${verb}`, { body: payload });
};

new Datagrid("#mod-selection-bulk", {
  label: "Field agents (bulk actions)",
  columns: [
    column.select(),
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
  ],
  pageSize: 10,
  host: { notify: (kind, message) => (out.textContent += `\n→ ${kind}: ${message}`) },
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    selection({
      bulk: {
        actions: [
          { id: "approve", label: "Approve", icon: "check", onClick: bulk("approve") },
          {
            id: "archive", label: "Archive", icon: "trash", tone: "danger",
            onClick: async (payload, grid, sel) => {
              const ok = await grid.confirm(`Archive ${sel.count()} records?`, { tone: "danger", confirmLabel: "Archive" });
              if (!ok) return;
              await bulk("archive")(payload, grid);
              sel.clear();
            },
          },
        ],
      },
    }),
  ],
});
