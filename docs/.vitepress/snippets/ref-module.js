import { Datagrid, column, serverSide, yajra } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

// Toolbar module: a badge with the row count of the last load.
function rowBadge({ slot = "end", order = 5 } = {}) {
  return Object.freeze({
    name: "rowBadge",
    kind: "toolbar",
    setup(ctx) {
      const el = document.createElement("span");
      el.className = "dg-chip";
      el.dataset.tone = "info";
      ctx.toolbar({ slot, order, el });
      const off = ctx.on("load", ({ result }) => {
        el.textContent = `${result.rows.length} of ${result.filtered ?? "?"} rows`;
      });
      return { api: { el }, destroy: () => (off(), el.remove()) };
    },
  });
}
rowBadge.moduleName = "rowBadge";

// Request middleware module: tags every request this grid sends.
const clientTag = (client) =>
  Object.freeze({
    name: "clientTag",
    kind: "feature",
    setup(ctx) {
      ctx.request((req, next) => {
        req.headers["X-Client"] = client;
        req.params.client = client;
        return next(req);
      });
    },
  });

new Datagrid("#ref-module", {
  label: "Agents with a custom module",
  columns: [
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
  ],
  pageSize: 5,
  use: [serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }), rowBadge(), clientTag("docs")],
});
