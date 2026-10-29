// Response side-channel → host elements (`json.summary` → KPI cards).
import type { DatagridApi, ModuleDef } from "../core/types";
import { parseNumber } from "../core/collate";
import { getPath } from "../core/util";

export type MetaValue = string | number | Node | null | undefined;
export type MetaFormat = "money" | "number" | "text" | ((v: unknown) => MetaValue);
export type MetaSource = string | ((raw: any, grid: DatagridApi) => unknown);
export type MetaBinding = MetaSource | { value: MetaSource; format?: MetaFormat };

export interface MetaBindOptions {
  /** default format for every binding (default "text") */
  format?: MetaFormat;
  /** ISO currency for "money" (default TRY) */
  currency?: string;
  /** decimals for "money" (default 2) */
  decimals?: number;
  /** text for missing values (default "—") */
  empty?: string;
  /** where selectors are resolved (default document) */
  root?: ParentNode;
  /** permission flag */
  can?: boolean;
}

export interface MetaBindApi {
  /** re-reads the last response and writes every binding */
  refresh(): void;
}

const CUR: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };

/** Formats a bound value (number formats accept TR strings: "1.234,50"). Exported for tests. */
export function formatMeta(v: unknown, fmt: MetaFormat | undefined, locale: string, o: Pick<MetaBindOptions, "currency" | "decimals"> = {}): MetaValue {
  if (v == null || v === "" || v instanceof Node) return v as MetaValue;
  if (typeof fmt === "function") return fmt(v);
  if (fmt === "money" || fmt === "number") {
    // only numbers and numeric strings ("1.234,50"); other text passes through as is
    const n = typeof v === "number" || /^\s*[-+]?[\d.,\s]*\d[\d.,\s]*$/.test(String(v)) ? parseNumber(v) : null;
    if (n == null) return String(v);
    const d = o.decimals ?? 2;
    const s = new Intl.NumberFormat(locale, fmt === "money" ? { minimumFractionDigits: d, maximumFractionDigits: d } : { maximumFractionDigits: 2 }).format(n);
    if (fmt === "number") return s;
    const cur = o.currency ?? "TRY";
    return `${s} ${CUR[cur] ?? cur}`;
  }
  return String(v);
}

export function metaBind(bindings: Record<string, MetaBinding>, opts: MetaBindOptions = {}): ModuleDef<"metaBind", MetaBindApi> {
  return Object.freeze<ModuleDef<"metaBind", MetaBindApi>>({
    name: "metaBind" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid } = ctx;
      const root = opts.root ?? document;
      const original = new Map<Element, Node[]>();
      let seq = 0;

      const put = (sel: string, v: MetaValue) => {
        root.querySelectorAll(sel).forEach((el, i) => {
          if (!original.has(el)) original.set(el, Array.from(el.childNodes));
          if (v instanceof Node) el.replaceChildren(i ? v.cloneNode(true) : v);
          else el.textContent = v == null || v === "" ? opts.empty ?? "—" : String(v);
        });
      };

      const refresh = () => {
        const raw = grid.lastResponse();
        const run = ++seq;
        for (const [sel, b] of Object.entries(bindings)) {
          const src = typeof b === "object" ? b.value : b;
          const fmt = (typeof b === "object" ? b.format : undefined) ?? opts.format;
          let v: unknown;
          try {
            v = typeof src === "function" ? src(raw, grid) : getPath(raw, src);
          } catch (e) {
            console.error(e);
            continue;
          }
          const write = (x: unknown) => run === seq && put(sel, formatMeta(x, fmt, ctx.locale, opts));
          // async values (client grids: `grid.exportRows("all")`); a newer refresh wins
          if (v && typeof (v as PromiseLike<unknown>).then === "function") void Promise.resolve(v).then(write, (e) => console.error(e));
          else write(v);
        }
      };

      // render fires after every data change; lastResponse() is already updated by then
      const off = ctx.on("render", refresh);
      return {
        api: { refresh },
        destroy() {
          off();
          seq++;
          for (const [el, nodes] of original) el.replaceChildren(...nodes);
        },
      };
    },
  });
}
metaBind.moduleName = "metaBind";
