import { Datagrid, column, serverSide, yajra, filterPanel, metaBind } from "@akinozgen17/datagrids";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

new Datagrid("#proto-ssp", {
  label: "Agents (SSP wire)",
  columns: [
    column.index(),
    { key: "ref", title: "Ref" },
    { key: "name", title: "Name" },
    { key: "unit", title: "Unit", visible: false }, // hidden columns still travel in columns[]
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
    { key: "status_html", title: "Status", sortable: false, searchable: false }, // server HTML
  ],
  sort: [["amount", "desc"]],
  pageSize: 5,
  use: [
    serverSide({ url: "/api/agents", protocol: yajra(), csrf: true }),
    filterPanel({ fields: { status: "#proto-ssp-status" } }), // page filter → plain `status` parameter
    metaBind({ "#proto-ssp-sum": { value: "summary.total", format: (v) => usd.format(v) } }),
  ],
});
