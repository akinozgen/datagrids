import { Datagrid, column, customSource } from "@akinozgen17/datagrids";
import { agents } from "./data.js";

const columns = [column.text("ref", { title: "Ref" }), column.text("name", { title: "Name" }), column.text("unit", { title: "Unit" })];

// loading: a source that never answers
new Datagrid("#guide-state-loading", {
  label: "Loading",
  columns,
  use: [customSource({ mode: "server", load: () => new Promise(() => {}) })],
});

// empty: no rows at all
new Datagrid("#guide-state-empty", { label: "Empty", columns, data: [] });

// error: the first load fails with a retryable error, "Retry" succeeds
let fail = true;
new Datagrid("#guide-state-error", {
  label: "Error",
  columns,
  pageSize: 3,
  use: [
    customSource({
      mode: "server",
      async load() {
        if (fail) {
          fail = false;
          throw { kind: "http", status: 500, message: "The server returned an error (500).", detail: "SQLSTATE[42S22]: Column not found", retryable: true };
        }
        const rows = agents(3);
        return { rows, total: 3, filtered: 3 };
      },
    }),
  ],
});
