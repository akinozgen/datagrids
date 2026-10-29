// One "Export ⌄" toolbar menu per grid, shared by every attached export module (excel/csv/print).
import type { DatagridApi, ModuleContext, Row } from "../../core/types";
import { createPanel, rovingKeys, toolbarButton, type Panel } from "../../dom/popover";
import { icons } from "../../dom/icons";
import { frag, h, nextId, setTip } from "../../core/util";
import { buildSheet, exportRows, gridMode, type Sheet } from "./values";

export interface ExportMessages {
  /** toolbar menu button */
  menu: string;
  excel: string;
  csv: string;
  print: string;
  yes: string;
  no: string;
  records: string;
  done: (n: string) => string;
  failed: string;
  truncated: (n: string, total: string) => string;
}

const en: ExportMessages = {
  menu: "Export",
  excel: "Excel (.xlsx)",
  csv: "CSV",
  print: "Print",
  yes: "Yes",
  no: "No",
  records: "records",
  done: (n) => `${n} records exported`,
  failed: "Export failed",
  truncated: (n, t) => `Only the first ${n} of ${t} records were exported`,
};

const tr: ExportMessages = {
  menu: "Dışa aktar",
  excel: "Excel (.xlsx)",
  csv: "CSV",
  print: "Yazdır",
  yes: "Evet",
  no: "Hayır",
  records: "kayıt",
  done: (n) => `${n} kayıt dışa aktarıldı`,
  failed: "Dışa aktarılamadı",
  truncated: (n, t) => `${t} kaydın yalnız ilk ${n} kaydı aktarıldı`,
};

export function exportMessages(locale: string, over?: Partial<ExportMessages>): ExportMessages {
  const out = { ...(locale.startsWith("tr") ? tr : en) } as Record<string, unknown>;
  for (const k in over) if ((over as Record<string, unknown>)[k] !== undefined) out[k] = (over as Record<string, unknown>)[k];
  return out as unknown as ExportMessages;
}

/** Options every export module shares. */
export interface ExportOptions {
  /** "page" = current view, "all" = every filtered row (server: one request ≤ maxPageSize). Default: client → all, server → page */
  scope?: "page" | "all";
  /** include `<tfoot>` rows (bold, after the data) */
  footer?: boolean;
  /** permission flag: false → the module does nothing */
  can?: boolean;
  /** menu item label */
  label?: string;
  messages?: Partial<ExportMessages>;
  /** where the shared "Export" menu sits; the first export module attached decides (default "start", 40) */
  slot?: "start" | "end";
  order?: number;
}

const svg = (body: string) => `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">${body}</svg>`;
export const exportIcons = {
  sheet: svg('<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M2.5 6.25h11M2.5 9.75h11M6.25 6.25v7.25"/>'),
  file: svg('<path d="M9.25 2.5H4.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V5.75z"/><path d="M9.25 2.5v3.25h3.25M5.75 8.75h4.5M5.75 11h4.5"/>'),
  print: icons.print,
};

/** Collects rows + sheet for an export and reports truncation of a server "all" export. */
export async function collect(ctx: ModuleContext, o: ExportOptions, m: ExportMessages): Promise<{ sheet: Sheet; rows: Row[] }> {
  const grid = ctx.grid;
  const rows = await exportRows(grid, o.scope);
  const filtered = grid.status().filtered;
  if (o.scope === "all" && gridMode(grid) === "server" && filtered != null && filtered > rows.length) {
    const fmt = new Intl.NumberFormat(ctx.locale);
    const msg = m.truncated(fmt.format(rows.length), fmt.format(filtered));
    ctx.host.notify?.("info", msg);
    ctx.announce(msg);
  }
  const escaped = (grid as unknown as { source?: { cells?: string } }).source?.cells === "html";
  // page totals under an "all rows" sheet would lie: copy the footer only when its scope matches
  const tfoot = ctx.table.tFoot;
  const footerScope = tfoot?.getAttribute("data-dg-scope") ?? "page";
  const allRows = o.scope === "all" && rows.length !== grid.viewRows().length;
  const useFooter = o.footer && tfoot && !(allRows && footerScope === "page");
  return { sheet: buildSheet(grid.columns(), rows, useFooter ? tfoot : null, escaped), rows };
}

/** Runs an export action: announces success, reports failure (notify + live region + console), rethrows. */
export async function runExport(ctx: ModuleContext, m: ExportMessages, fn: () => Promise<number>): Promise<void> {
  try {
    const n = await fn();
    ctx.announce(m.done(new Intl.NumberFormat(ctx.locale).format(n)));
  } catch (e) {
    console.error("[datagrids] export failed", e);
    ctx.host.notify?.("error", m.failed);
    ctx.announce(m.failed);
    throw e;
  }
}

interface Item {
  id: string;
  order: number;
  label: string;
  icon: string;
  run(): Promise<void>;
}

interface Menu {
  button: HTMLButtonElement;
  panel: Panel;
  items: Item[];
  busy: boolean;
}

const menus = new WeakMap<DatagridApi, Menu>();

function renderItems(menu: Menu): void {
  menu.panel.el.replaceChildren(
    ...menu.items.map((it) =>
      h(
        "button",
        { type: "button", role: "menuitem", class: "dg-panel-item", tabindex: "-1", "data-export": it.id },
        frag(it.icon),
        h("span", { class: "dg-panel-item-label" }, it.label),
      ),
    ),
  );
}

function createMenu(ctx: ModuleContext, m: ExportMessages, place?: Pick<ExportOptions, "slot" | "order">): Menu {
  const id = nextId("dg-export");
  const button = toolbarButton({ label: m.menu, icon: icons.download, caret: true });
  button.id = `${id}-btn`;
  // the text is hidden on narrow grids (data-bp=xs); keep the name
  button.setAttribute("aria-label", m.menu);
  setTip(button, m.menu);
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-controls", `${id}-menu`);
  const panel = createPanel(ctx.root, { role: "menu", id: `${id}-menu`, "aria-labelledby": button.id, "data-dg-menu": "export" });
  const menu: Menu = { button, panel, items: [], busy: false };
  rovingKeys(panel.el, '[role="menuitem"]');

  const focusItem = (which: "first" | "last") => {
    const list = panel.el.querySelectorAll<HTMLElement>('[role="menuitem"]');
    list[which === "first" ? 0 : list.length - 1]?.focus();
  };
  const open = (which: "first" | "last") => {
    panel.show(button);
    focusItem(which);
  };
  button.addEventListener("click", () => (panel.open ? panel.hide(true) : open("first")));
  button.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    open(e.key === "ArrowUp" ? "last" : "first");
  });
  // Tab leaves the menu: close and continue from the trigger (APG menu button)
  panel.el.addEventListener("keydown", (e) => e.key === "Tab" && panel.hide(true));
  panel.el.addEventListener("click", (e) => {
    const el = (e.target as Element).closest<HTMLElement>('[role="menuitem"]');
    const item = el && menu.items.find((x) => x.id === el.dataset.export);
    if (!item) return;
    panel.hide(true);
    if (menu.busy) return;
    menu.busy = true;
    button.setAttribute("aria-busy", "true");
    // the download icon turns into a spinner while rows are fetched / the file is built
    const icon = button.firstElementChild!;
    const spin = frag(icons.spinner).firstElementChild!;
    icon.replaceWith(spin);
    item
      .run()
      .catch(() => {})
      .finally(() => {
        menu.busy = false;
        button.removeAttribute("aria-busy");
        spin.replaceWith(icon);
      });
  });
  ctx.toolbar({ slot: place?.slot ?? "start", order: place?.order ?? 40, el: button });
  return menu;
}

/** Adds an item to the grid's shared export menu; returns its remover. */
export function addMenuItem(ctx: ModuleContext, m: ExportMessages, item: Item, place?: Pick<ExportOptions, "slot" | "order">): () => void {
  let menu = menus.get(ctx.grid);
  if (!menu) menus.set(ctx.grid, (menu = createMenu(ctx, m, place)));
  menu.items.push(item);
  menu.items.sort((a, b) => a.order - b.order);
  renderItems(menu);
  const own = menu;
  return () => {
    own.items = own.items.filter((x) => x !== item);
    if (own.items.length) return renderItems(own);
    own.panel.destroy();
    own.button.remove();
    menus.delete(ctx.grid);
  };
}
