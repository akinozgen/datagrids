import { Datagrid } from "./datagrids";
import { configure, config } from "./core/config";
import { byName, byTable } from "./core/registry";
import { warn } from "./core/warn";
import type { DatagridOptions, ModuleInput } from "./core/types";

export { Datagrid } from "./datagrids";
export * as column from "./columns/index";
export { arraySource, domSource, customSource, sourceModule, fetchAll, type FetchAllOptions } from "./data/sources";
export { serverSide, ssp, yajra, dgp, laravelPaginator, type Protocol, type ServerSideOptions, type SspOptions, type DgpOptions, type PaginatorOptions } from "./data/server";
export { en, tr, type Messages } from "./core/i18n";
export { actions, type ActionItem, type ActionsOptions } from "./modules/actions";
export { colVis, type ColVisApi } from "./modules/colvis";
export { stateSave, type StateApi, type StateSaveOptions } from "./modules/state-save";
export * as button from "./modules/buttons";
export { selection, type SelectionApi, type SelectionPayload, type SelectionOptions, type BulkAction, SelectionModel } from "./modules/selection";
export { excel, csv, print } from "./modules/export/index";
export { configure } from "./core/config";
export type * from "./core/types";

const presets = new Map<string, (table: HTMLTableElement) => ModuleInput[]>();

/** Name-based access (cross-tab reloads). Never creates a grid. */
export function find(name: string): Datagrid | null {
  return (byName.get(name) as Datagrid | undefined) ?? null;
}

/** Reloads a grid by name; false (+ warning) when it does not exist. */
export function reload(name: string, o?: { keepPage?: boolean; silent?: boolean }): boolean {
  const g = find(name);
  if (!g) {
    warn("DG006", { name });
    return false;
  }
  void g.reload(o);
  return true;
}

export function get(target: Element | string | null): Datagrid | null {
  return Datagrid.get(target);
}

/** Registers a named preset for `table[data-datagrid="name"]`. */
export function preset(name: string, factory: (table: HTMLTableElement) => ModuleInput[]): void {
  presets.set(name, factory);
}

/** Idempotent declarative init: enhances every `table[data-datagrid]` under root. */
export function upgrade(root: ParentNode = document): Datagrid[] {
  const out: Datagrid[] = [];
  root.querySelectorAll<HTMLTableElement>("table[data-datagrid]").forEach((t) => {
    if (byTable.has(t)) return;
    const d = t.dataset;
    const opts: DatagridOptions = {};
    if (d.dgName) opts.name = d.dgName;
    if (d.dgLabel) opts.label = d.dgLabel;
    if (d.dgLoad) opts.load = d.dgLoad as DatagridOptions["load"];
    if (d.dgPageSize) opts.pageSize = Number(d.dgPageSize);
    if (d.dgSort) {
      const [k, dir] = d.dgSort.split(":");
      opts.sort = [[k!, dir === "desc" ? "desc" : "asc"]];
    }
    if (d.dgTheme) opts.theme = d.dgTheme as DatagridOptions["theme"];
    if (d.dgSize) opts.size = d.dgSize as DatagridOptions["size"];
    if (d.dgDensity) opts.density = d.dgDensity as DatagridOptions["density"];
    const p = d.datagrid ? presets.get(d.datagrid) : undefined;
    if (p) opts.use = p(t);
    out.push(new Datagrid(t, opts));
  });
  return out;
}

export const VERSION = "0.1.1";
export { config };
export { columnFilters, type ColumnFilterValue, type FilterOp } from "./modules/column-filters";
export { filterPanel } from "./modules/filter-panel";
export { urlSync } from "./modules/url-sync";
export { softDeletes } from "./modules/soft-deletes";
export { metaBind } from "./modules/meta-bind";
export { footer } from "./modules/footer";
export { colReorder, type ColReorderApi, type ColReorderOptions } from "./modules/col-reorder";
export { responsive, type ResponsiveApi, type ResponsiveOptions } from "./modules/responsive";
export { lazyColumns, type LazyColumnsApi, type LazyColumnsOptions } from "./modules/lazy-columns";
export { stickyHeader, type StickyHeaderApi, type StickyHeaderOptions } from "./modules/sticky-header";
export { keyboardGrid, type KeyboardGridApi, type KeyboardGridOptions } from "./modules/keyboard-grid";
export { rowReorder, reorderColumn, REORDER_KEY, type RowReorderOptions, type RowReorderEnd, type RowReorderApi } from "./modules/row-reorder";
export { multiSort, type MultiSortApi, type MultiSortOptions } from "./modules/multi-sort";
export { autoRefresh, type AutoRefreshApi, type AutoRefreshOptions } from "./modules/auto-refresh";
export { filterPresets, type FilterPresetsOptions, type FilterPresetsApi, type FilterPreset } from "./modules/filter-presets";
