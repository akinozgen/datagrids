// print(): light print view. A hidden iframe gets a plain-text table + ~1 KB CSS;
// no site CSS and no cell HTML are copied (copying everything is what used to crash tabs).
import type { ModuleDef } from "../../core/types";
import { addMenuItem, collect, exportIcons, exportMessages, runExport, type ExportOptions } from "./menu";
import { displayCell, esc, formatDate, type Cell, type Sheet } from "./values";

export interface PrintOptions extends ExportOptions {
  /** document title / heading; default: the grid's label, else `document.title` */
  title?: string | (() => string);
}

export interface PrintApi {
  /** builds the print document and opens the browser's print dialog */
  open(): Promise<void>;
}

const CSS =
  "@page{margin:12mm}*{box-sizing:border-box}" +
  "html{background:#fff;color:#000;font:9pt/1.35 system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
  "body{margin:0;padding:8mm}@media print{body{padding:0}}" +
  "h1{margin:0 0 2pt;font-size:13pt;font-weight:600}" +
  ".meta{margin:0 0 8pt;color:#555;font-size:8pt}" +
  "table{inline-size:100%;border-collapse:collapse}" +
  "th,td{padding:3pt 5pt;border-block-end:.5pt solid #bbb;text-align:start;vertical-align:top}" +
  "th{border-block-end:1pt solid #000;font-weight:600;white-space:nowrap}" +
  "thead{display:table-header-group}tfoot{display:table-footer-group}" +
  "tfoot td{border-block-start:1pt solid #000;border-block-end:0;font-weight:600}" +
  "tr{break-inside:avoid}" +
  ".n{text-align:end;font-variant-numeric:tabular-nums}.n,.s{white-space:nowrap}";

const numeric = (t: string) => t === "number" || t === "money";

/** Print document HTML (every value escaped; exported for tests). */
export function printHtml(sheet: Sheet, o: { title: string; meta: string; lang: string; dir: string; yes: string; no: string; locale: string }): string {
  const text = (cells: ReadonlyArray<Cell>) => sheet.columns.map((c, i) => displayCell(cells[i] ?? null, c, o.locale, o.yes, o.no));
  const body = sheet.rows.map(text);
  const foot = (sheet.footer ?? []).map(text);
  // numbers align end; short columns (ids, dates, states) never wrap
  const cls = sheet.columns.map((c, i) =>
    numeric(c.type) ? ' class="n"' : body.every((r) => r[i]!.length <= 16) ? ' class="s"' : "",
  );
  const row = (cells: string[]) => `<tr>${cells.map((v, i) => `<td${cls[i]}>${esc(v)}</td>`).join("")}</tr>`;
  const tfoot = foot.length ? `<tfoot>${foot.map(row).join("")}</tfoot>` : "";
  return (
    `<!doctype html><html lang="${esc(o.lang)}" dir="${o.dir === "rtl" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(o.title)}</title><style>${CSS}</style></head>` +
    `<body><h1>${esc(o.title)}</h1><p class="meta">${esc(o.meta)}</p><table><thead><tr>${sheet.columns
      .map((c, i) => `<th scope="col"${cls[i]}>${esc(c.title)}</th>`)
      .join("")}</tr></thead><tbody>${body.map(row).join("")}</tbody>${tfoot}</table></body></html>`
  );
}

/** Accessible name of the grid region (label / title / caption). */
function gridLabel(root: HTMLElement): string {
  const ids = root.querySelector(".dg-scroll")?.getAttribute("aria-labelledby");
  const el = ids ? document.getElementById(ids.split(" ")[0]!) : null;
  return el?.textContent?.trim() ?? "";
}

export function print(opts: PrintOptions = {}): ModuleDef<"print", PrintApi> {
  return Object.freeze({
    name: "print",
    kind: "export",
    can: opts.can,
    setup(ctx) {
      const m = exportMessages(ctx.locale, opts.messages);
      let frame: HTMLIFrameElement | null = null;

      const open = () =>
        runExport(ctx, m, async () => {
          const { sheet, rows } = await collect(ctx, opts, m);
          const title = (typeof opts.title === "function" ? opts.title() : opts.title) || gridLabel(ctx.root) || document.title;
          const count = new Intl.NumberFormat(ctx.locale).format(rows.length);
          const html = printHtml(sheet, {
            title,
            meta: `${count} ${m.records} · ${formatDate(new Date(), true, ctx.locale)}`,
            lang: ctx.locale,
            dir: getComputedStyle(ctx.root).direction,
            yes: m.yes,
            no: m.no,
            locale: ctx.locale,
          });
          frame?.remove();
          frame = document.createElement("iframe");
          frame.setAttribute("data-dg-print", ctx.grid.name ?? "");
          frame.setAttribute("aria-hidden", "true");
          frame.tabIndex = -1;
          frame.title = title;
          frame.style.cssText = "position:fixed;inset:auto 0 0 auto;inline-size:0;block-size:0;border:0;opacity:0;pointer-events:none";
          document.body.append(frame);
          const win = frame.contentWindow;
          const doc = frame.contentDocument;
          if (!win || !doc) throw new Error("print frame unavailable");
          doc.open();
          doc.write(html);
          doc.close();
          // cancellable hook: hosts can decorate `document` or skip the dialog (tests)
          if (ctx.grid.emit("beforePrint", { document: doc, window: win })) {
            win.focus();
            win.print();
          }
          return rows.length;
        });

      const remove = addMenuItem(ctx, m, { id: "print", order: 30, label: opts.label ?? m.print, icon: exportIcons.print, run: open }, opts);
      return {
        api: { open },
        destroy() {
          remove();
          frame?.remove();
          frame = null;
        },
      };
    },
  } as ModuleDef<"print", PrintApi>);
}
// stable lookup name for grid.module(print) (survives minification)
print.moduleName = "print";
