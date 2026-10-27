import { Datagrid, preset, upgrade, colVis, button } from "@akinozgen17/datagrids";

const wrap = document.querySelector("#rcp-reinit-wrap");
const table = document.querySelector("#rcp-reinit");
const out = document.querySelector("#rcp-reinit-log");
const log = (line) => (out.textContent = `${line}\n${out.textContent}`);

// One preset per kind of list; tables opt in with data-datagrid="rcp-inventory"
preset("rcp-inventory", () => [colVis(), button.reload()]);
upgrade(wrap); // idempotent: tables that already have a grid are skipped

const on = (id, fn) => document.querySelector(id).addEventListener("click", fn);
on("#rcp-reinit-get", () => log(`Datagrid.get(table) → ${Datagrid.get(table) ? "grid" : "null"}`));
on("#rcp-reinit-destroy", () => {
  Datagrid.get(table)?.destroy();
  log(`destroy() → plain table again: class="${table.className}", ${table.tBodies[0].rows.length} rows`);
});
on("#rcp-reinit-upgrade", () => log(`upgrade() → ${upgrade(wrap).length} new grid(s)`));
on("#rcp-reinit-remount", () => {
  const grid = Datagrid.get(table);
  if (!grid) return log("remount() needs a grid: press upgrade() first");
  grid.remount(); // destroy + new Datagrid(table, sameOptions)
  log("remount() → fresh grid, same options");
});
