import { Datagrid } from "@akinozgen17/datagrids";

// no columns, no data: <thead> becomes the columns, the existing <tr>s are adopted
const init = () => new Datagrid("#guide-dom", { pageSize: 5 });
init();

document.querySelector("#guide-dom-destroy").addEventListener("click", () => {
  Datagrid.get("#guide-dom")?.destroy(); // the original table is back, byte for byte
});
document.querySelector("#guide-dom-init").addEventListener("click", () => {
  if (!Datagrid.get("#guide-dom")) init(); // get() returns null; it never creates a grid
});
