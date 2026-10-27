import { Datagrid, column, serverSide, yajra, selection } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const out = document.querySelector("#rcp-bulk-payload");
const note = document.querySelector("#rcp-bulk-note");

const grid = new Datagrid("#rcp-bulk", {
  label: "Field agents (bulk)",
  columns: [
    column.select(),
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
  ],
  pageSize: 5,
  // demo only: show notifications on the page (usually configure({ notify }) once, see Row actions)
  host: { notify: (kind, message) => (note.textContent = `${kind}: ${message}`) },
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    selection({
      bulk: {
        actions: [
          {
            id: "remind",
            label: "Send reminder",
            icon: "send",
            // the returned promise keeps the button busy until the request settles
            onClick: async (payload, grid, sel) => {
              const result = await grid.action("/api/action/agents/bulk/remind", {
                body: payload, // { all: false, keys } or { all: true, except, query }
                confirm: `Send a reminder to ${sel.count()} agents?`,
                success: "Reminders queued.",
                reload: false, // nothing in the list changed
              });
              if (result !== undefined) sel.clear(); // undefined = the user cancelled
            },
          },
        ],
      },
    }),
  ],
});

grid.on("selectionchange", () => (out.textContent = JSON.stringify(grid.selection.payload(), null, 2)));
