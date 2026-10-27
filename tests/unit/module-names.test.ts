import { describe, expect, it } from "vitest";
import * as dg from "../../src/index";

// grid.module(factory) must keep working when a minifier renames the factory functions
describe("module factories carry a stable moduleName", () => {
  const samples: Array<[string, () => { name: string }]> = [
    ["actions", () => dg.actions({ items: [] } as never) as never],
    ["columnFilters", () => dg.columnFilters() as never],
    ["colVis", () => dg.colVis() as never],
    ["stateSave", () => dg.stateSave() as never],
    ["selection", () => dg.selection() as never],
    ["excel", () => dg.excel() as never],
    ["csv", () => dg.csv() as never],
    ["print", () => dg.print() as never],
    ["filterPanel", () => dg.filterPanel({ fields: {} }) as never],
    ["urlSync", () => dg.urlSync() as never],
    ["softDeletes", () => dg.softDeletes() as never],
    ["metaBind", () => dg.metaBind({ fields: {} } as never) as never],
    ["footer", () => dg.footer({ cols: {} }) as never],
    ["colReorder", () => dg.colReorder() as never],
    ["responsive", () => dg.responsive() as never],
    ["lazyColumns", () => dg.lazyColumns() as never],
    ["stickyHeader", () => dg.stickyHeader() as never],
    ["keyboardGrid", () => dg.keyboardGrid() as never],
    ["rowReorder", () => dg.rowReorder({ onEnd() {} }) as never],
    ["filterPresets", () => dg.filterPresets({ presets: [] }) as never],
    ["autoRefresh", () => dg.autoRefresh() as never],
    ["multiSort", () => dg.multiSort() as never],
  ];
  for (const [fn, make] of samples) {
    it(fn, () => {
      const f = (dg as unknown as Record<string, { moduleName?: string }>)[fn]!;
      expect(f.moduleName, `${fn}.moduleName`).toBe(make().name);
    });
  }
});
