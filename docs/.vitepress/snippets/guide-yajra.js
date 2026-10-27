import { Datagrid, serverSide, yajra } from "@akinozgen17/datagrids";

new Datagrid("#guide-yajra", {
  label: "Agents (yajra)",
  pageSize: 5,
  sort: [["name", "asc"]],
  columns: [
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit" },
    // untyped columns follow the protocol default: yajra escapes values on the server and sends raw HTML columns
    { key: "status_html", title: "Status", sortable: false, searchable: false },
  ],
  use: [
    serverSide({
      url: "/api/agents",
      protocol: yajra(),
      csrf: true,
      params: () => ({ unit: document.querySelector("#guide-yajra-unit").value }), // ajax.data style extra parameter
    }),
  ],
});

document.querySelector("#guide-yajra-unit").addEventListener("change", () => {
  void Datagrid.get("#guide-yajra").reload();
});
