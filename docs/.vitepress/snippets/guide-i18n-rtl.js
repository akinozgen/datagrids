import { Datagrid, column } from "@akinozgen17/datagrids";
import { agents } from "./data.js";

// the grid inherits dir="rtl" from its container: logical properties mirror the layout and the pager
new Datagrid("#guide-i18n-rtl", {
  label: "RTL layout",
  locale: "en",
  pageSize: 5,
  columns: [
    column.text("ref", { title: "Ref" }),
    column.text("name", { title: "Name" }),
    column.text("unit", { title: "Unit" }), // "S.T.A.R.S. Alpha" keeps its dots in place (dir="auto")
    column.money("amount", { title: "Amount", currency: "USD", locale: "en-US" }),
  ],
  data: agents(30),
});
