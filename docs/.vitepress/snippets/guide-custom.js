import { Datagrid, column, customSource } from "@akinozgen17/datagrids";
import { agents } from "./data.js";

const all = agents(300);

// a server-mode source: you receive the neutral query and return one page
const source = customSource({
  mode: "server",
  async load(query, { signal }) {
    await new Promise((r) => setTimeout(r, 200)); // pretend this is GraphQL / IndexedDB / a worker
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    let rows = all.filter((r) => r.name.toLowerCase().includes(query.search.toLowerCase()));
    const [s] = query.sort;
    if (s) rows = [...rows].sort((a, b) => (a[s.key] > b[s.key] ? 1 : -1) * (s.dir === "asc" ? 1 : -1));
    const start = (query.page - 1) * query.pageSize;
    return { rows: rows.slice(start, start + query.pageSize), total: all.length, filtered: rows.length };
  },
});

new Datagrid("#guide-custom", {
  label: "Custom source",
  pageSize: 5,
  columns: [column.text("ref", { title: "Ref" }), column.text("name", { title: "Name" }), column.text("place", { title: "Place" })],
  use: [source],
});
