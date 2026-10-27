import { preset, upgrade, reload, fetchAll, colVis, button } from "@akinozgen17/datagrids";

const log = (line) => (document.querySelector("#guide-upgrade-log").textContent += line + "\n");

// the module list for every <table data-datagrid="agent-list">
preset("agent-list", (table) => [fetchAll({ url: table.dataset.url }), colVis(), button.reload()]);

log(`upgrade() → ${upgrade().length} grid(s) created`);

document.querySelector("#guide-upgrade-again").addEventListener("click", () => {
  log(`upgrade() → ${upgrade().length} grid(s) created (idempotent)`);
});
document.querySelector("#guide-upgrade-reload").addEventListener("click", () => {
  log(`reload("upgraded") → ${reload("upgraded")}`);
});
