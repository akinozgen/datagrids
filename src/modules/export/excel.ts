// excel(): XLSX export module.
import type { ModuleDef } from "../../core/types";
import { addMenuItem, collect, exportIcons, exportMessages, runExport, type ExportOptions } from "./menu";
import { fileName, saveBlob } from "./values";
import { toXlsx, XLSX_MIME } from "./xlsx";

export interface ExcelOptions extends ExportOptions {
  /** file name (extension added when missing); default `{grid name}-{yyyy-mm-dd}.xlsx` */
  filename?: string | (() => string);
  /** worksheet name (max 31 chars) */
  sheetName?: string | (() => string);
}

export interface ExcelApi {
  /** builds the workbook and downloads it */
  download(): Promise<void>;
  /** builds the workbook */
  blob(): Promise<Blob>;
}

export function excel(opts: ExcelOptions = {}): ModuleDef<"excel", ExcelApi> {
  return Object.freeze({
    name: "excel",
    kind: "export",
    can: opts.can,
    setup(ctx) {
      const m = exportMessages(ctx.locale, opts.messages);
      const build = async () => {
        const { sheet, rows } = await collect(ctx, opts, m);
        const name = typeof opts.sheetName === "function" ? opts.sheetName() : opts.sheetName;
        const bytes = await toXlsx(sheet, { sheetName: name ?? ctx.grid.name ?? "Sheet1" });
        return { blob: new Blob([bytes], { type: XLSX_MIME }), count: rows.length };
      };
      const download = () =>
        runExport(ctx, m, async () => {
          const r = await build();
          saveBlob(r.blob, fileName(opts.filename, ctx.grid, "xlsx"));
          return r.count;
        });
      const remove = addMenuItem(ctx, m, { id: "excel", order: 10, label: opts.label ?? m.excel, icon: exportIcons.sheet, run: download }, opts);
      return { api: { download, blob: async () => (await build()).blob }, destroy: remove };
    },
  } as ModuleDef<"excel", ExcelApi>);
}
// stable lookup name for grid.module(excel) (survives minification)
excel.moduleName = "excel";
