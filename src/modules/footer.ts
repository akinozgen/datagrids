// Summary row in <tfoot> (footer-callback style totals).
import { warn } from "../core/warn";
import type { CellContext, DatagridApi, ModuleDef, ResolvedColumn, Row } from "../core/types";
import { parseNumber } from "../core/collate";
import { cellValue } from "../data/client";
import { h } from "../core/util";

export type FooterAgg = "sum" | "avg" | "count" | ((rows: Row[], raw: any, grid: DatagridApi) => unknown);

export interface FooterMessages {
  page: string;
  total: string;
}
const tr: FooterMessages = { page: "Sayfa toplamı", total: "Toplam" };
const en: FooterMessages = { page: "Page total", total: "Total" };

export interface FooterOptions {
  /** column key → aggregate */
  cols: Record<string, FooterAgg>;
  /** label in the first visible column (default by scope: "Sayfa toplamı" / "Toplam") */
  label?: string;
  /** "page" (default): the current page rows; "response": every filtered row (client) / the response (server) */
  scope?: "page" | "response";
  messages?: Partial<FooterMessages>;
  /** permission flag */
  can?: boolean;
}

export interface FooterApi {
  /** last computed values by column key */
  values(): Record<string, unknown>;
  refresh(): void;
}

const isServer = (grid: DatagridApi) => (grid as unknown as { source?: { mode?: string } }).source?.mode === "server";

/** sum / avg / count of a column (numbers read like export: `exportValue`, TR strings). Exported for tests. */
export function aggregate(rows: Row[], col: ResolvedColumn, agg: "sum" | "avg" | "count"): number | null {
  if (agg === "count") return rows.filter((r) => {
    const v = cellValue(col, r);
    return v != null && v !== "";
  }).length;
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const x = parseNumber(col.exportValue ? col.exportValue(r) : cellValue(col, r));
    if (x != null) {
      sum += x;
      n++;
    }
  }
  const v = agg === "sum" ? sum : n ? sum / n : null;
  return v == null ? null : Math.round(v * 1e8) / 1e8; // float noise (0.1 + 0.2) and -0
}

export function footer(opts: FooterOptions): ModuleDef<"footer", FooterApi> {
  return Object.freeze<ModuleDef<"footer", FooterApi>>({
    name: "footer" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid, table } = ctx;
      const m = { ...(ctx.locale.startsWith("tr") ? tr : en), ...opts.messages };
      const label = opts.label ?? (opts.scope === "response" ? m.total : m.page);
      const host = table.tFoot;
      const saved = host ? { nodes: Array.from(host.childNodes), hidden: host.hidden } : null;
      const tfoot = host ?? table.createTFoot();
      tfoot.hidden = true;
      // exports compare this with their own scope before copying the totals
      const prevScope = tfoot.getAttribute("data-dg-scope");
      tfoot.setAttribute("data-dg-scope", opts.scope ?? "page");
      const nf = new Intl.NumberFormat(ctx.locale, { maximumFractionDigits: 2 });
      let values: Record<string, unknown> = {};
      let seq = 0;
      const warned = new Set<string>();

      const show = (c: ResolvedColumn, v: unknown, agg: FooterAgg, td: HTMLTableCellElement): Node | string | null => {
        if (v == null || v === "" || (typeof v === "number" && !Number.isFinite(v))) return null;
        if (v instanceof Node) return v;
        if (typeof v !== "number") return String(v);
        // same render as the cells: ₺, decimals and tabular figures line up
        if (agg !== "count" && c.render && (c.type === "money" || c.type === "number")) {
          const row: Row = { [c.data ?? c.key]: v };
          const out = c.render(v, row, { row, key: c.key, index: -1, position: -1, td } as CellContext);
          if (out != null) return out instanceof Node ? out : String(out);
        }
        return h("span", { class: "dg-num", "data-sign": v < 0 ? "neg" : null }, nf.format(v));
      };

      const paint = (rows: Row[]) => {
        const cols = grid.columns();
        const raw = grid.lastResponse();
        const vals: Record<string, unknown> = {};
        for (const [k, agg] of Object.entries(opts.cols)) {
          const c = cols.find((x) => x.key === k);
          if (!c) {
            if (!warned.has(k)) warn("DG004", { name: k });
            warned.add(k);
            continue;
          }
          try {
            vals[k] = typeof agg === "function" ? agg(rows, raw, grid) : aggregate(rows, c, agg);
          } catch (e) {
            console.error(e);
          }
        }
        values = vals;
        // the label spans the leading visible columns that carry no value
        let end = cols.findIndex((c) => c.visible && c.key in vals);
        if (end < 0) end = cols.length;
        const lead = cols.slice(0, end).filter((c) => c.visible);
        const tr = document.createElement("tr");
        cols.forEach((c, i) => {
          if (i < end && c.visible) {
            if (c !== lead[0]) return;
            tr.append(h("th", {
              scope: "row",
              colspan: lead.length > 1 ? lead.length : null,
              "data-key": c.key,
              "data-col": "label",
              "data-sticky": lead.length === 1 ? c.sticky ?? null : null,
            }, label));
            return;
          }
          const td = h("td", {
            "data-key": c.key,
            "data-col": c.col ?? null,
            "data-align": c.align && c.align !== "start" ? c.align : null,
            "data-sticky": c.sticky ?? null,
            class: c.className ?? null,
          });
          td.hidden = !c.visible;
          const agg = opts.cols[c.key];
          if (agg && c.key in vals) {
            const out = show(c, vals[c.key], agg, td);
            if (out != null) td.append(out);
          }
          tr.append(td);
        });
        tfoot.replaceChildren(tr);
        tfoot.hidden = !grid.viewRows().length;
      };

      const refresh = () => {
        const run = ++seq;
        if (opts.scope === "response" && !isServer(grid)) void grid.exportRows("all").then((rows) => run === seq && paint(rows));
        else paint(grid.viewRows());
      };

      const offs = [ctx.on("render", refresh), ctx.on("columnchange", refresh)];
      const api: FooterApi = { values: () => ({ ...values }), refresh };
      return {
        api,
        destroy() {
          seq++;
          for (const off of offs) off();
          if (saved) {
            tfoot.replaceChildren(...saved.nodes);
            tfoot.hidden = saved.hidden;
            if (prevScope === null) tfoot.removeAttribute("data-dg-scope");
            else tfoot.setAttribute("data-dg-scope", prevScope);
          } else tfoot.remove();
        },
      };
    },
  });
}
footer.moduleName = "footer";
