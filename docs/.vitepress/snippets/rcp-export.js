import { Datagrid, column, serverSide, yajra, excel, csv, print } from "@akinozgen17/datagrids";
import { statusLabels, statusTones } from "./data.js";

const today = () => new Date().toISOString().slice(0, 10);

const grid = new Datagrid("#rcp-export", {
  label: "Field agents (export)",
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    column.date("date", { title: "Date" }),
  ],
  sort: [["date", "desc"]],
  pageSize: 10,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    excel({ scope: "all", filename: () => `agents-${today()}` }), // every filtered row, one request
    csv({ scope: "all", filename: () => `agents-${today()}` }),
    print(), // the current page
  ],
});

// Too many rows for the browser? Let the server build the file for the current query.
const out = document.querySelector("#rcp-export-url");
grid.on("load", () => {
  const { search, sort, filters } = grid.query();
  const params = new URLSearchParams({
    ...grid.lastRequestParams(), // page parameters as last sent (none in this demo)
    ...filters,
    search,
    sort: sort.map((s) => (s.dir === "desc" ? "-" : "") + s.key).join(","),
  });
  out.textContent = `/agents/export.csv?${params}`;
});
