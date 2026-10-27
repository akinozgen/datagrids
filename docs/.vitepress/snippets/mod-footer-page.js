import { Datagrid, column, footer } from "@akinozgen17/datagrids";
import { agents, statusLabels, statusTones } from "./data.js";

new Datagrid("#mod-footer-page", {
  label: "Field agents (page totals)",
  columns: [
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }),
    column.badge("status", { title: "Status", labels: statusLabels, tones: statusTones }),
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  data: agents(60),
  pageSize: 10,
  use: [
    footer({
      cols: {
        status: (rows) => `${rows.filter((r) => r.status === "open").length} open`,
        amount: "sum",
      },
    }),
  ],
});
