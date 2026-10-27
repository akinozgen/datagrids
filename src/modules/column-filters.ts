// Typed column filters: header filter icon → top-layer panel → grid.filters({ key: { op, value } }).
// Server: dgp sends typed filters; ssp/yajra sends DataTables ColumnControl (`columns[i][columnControl]`).
import { parseNumber } from "../core/collate";
import type { AnyModule, ModuleContext, ResolvedColumn } from "../core/types";
import { frag, h } from "../core/util";
import { icons } from "../dom/icons";
import { createPanel, toolbarButton } from "../dom/popover";

export type FilterOp =
  | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "between" | "in" | "notIn" | "contains" | "notContains" | "starts" | "ends" | "empty" | "notEmpty";

export interface ColumnFilterValue {
  op: FilterOp;
  value?: unknown;
}

export interface ColumnFiltersOptions {
  /** column keys to enable (default: every searchable typed column) */
  columns?: string[];
  /** fixed option lists for `in` filters (badge columns get theirs from labels) */
  options?: Record<string, Array<{ value: string; label: string }>>;
  messages?: Partial<CFMessages>;
  can?: boolean;
}

interface CFMessages {
  filter: (col: string) => string;
  apply: string;
  clear: string;
  clearAll: string;
  ops: Record<FilterOp, string>;
  value: string;
  and: string;
  active: (n: number) => string;
}

const OPS: Record<"tr" | "en", Record<FilterOp, string>> = {
  tr: { eq: "eşittir", ne: "eşit değil", gt: "büyüktür", gte: "büyük veya eşit", lt: "küçüktür", lte: "küçük veya eşit", between: "arasında", in: "şunlardan biri", notIn: "şunlardan biri değil", contains: "içerir", notContains: "içermez", starts: "ile başlar", ends: "ile biter", empty: "boş", notEmpty: "boş değil" },
  en: { eq: "equals", ne: "not equal", gt: "greater than", gte: "at least", lt: "less than", lte: "at most", between: "between", in: "is any of", notIn: "is none of", contains: "contains", notContains: "does not contain", starts: "starts with", ends: "ends with", empty: "is empty", notEmpty: "is not empty" },
};
const MSG: Record<"tr" | "en", Omit<CFMessages, "ops">> = {
  tr: { filter: (c) => `Filtre: ${c}`, apply: "Uygula", clear: "Temizle", clearAll: "Filtreleri temizle", value: "Değer", and: "ve", active: (n) => `${n} filtre` },
  en: { filter: (c) => `Filter: ${c}`, apply: "Apply", clear: "Clear", clearAll: "Clear filters", value: "Value", and: "and", active: (n) => `${n} filters` },
};

const SYM: Partial<Record<FilterOp, string>> = { eq: "=", ne: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤" };

export function opsFor(col: ResolvedColumn): FilterOp[] {
  switch (col.type) {
    case "number":
    case "money":
      return ["eq", "ne", "gt", "gte", "lt", "lte", "between", "empty", "notEmpty"];
    case "date":
      return ["eq", "gt", "lt", "between", "empty", "notEmpty"];
    case "badge":
      return ["in", "notIn"];
    default:
      return ["contains", "notContains", "starts", "ends", "eq", "ne", "empty", "notEmpty"];
  }
}

const isFilter = (v: unknown): v is ColumnFilterValue => !!v && typeof v === "object" && "op" in (v as object);

export function columnFilters(opts: ColumnFiltersOptions = {}): AnyModule {
  return Object.freeze({
    name: "columnFilters",
    kind: "feature" as const,
    can: opts.can,
    setup(ctx: ModuleContext) {
      const grid = ctx.grid;
      const lang = ctx.locale.startsWith("tr") ? "tr" : "en";
      const m: CFMessages = { ...MSG[lang], ops: OPS[lang], ...(opts.messages ?? {}) } as CFMessages;
      const panel = createPanel(ctx.root, { role: "dialog", class: "dg-panel dg-colfilter-panel" });
      // Tab out of the panel closes it (as the column menu does)
      panel.el.addEventListener(
        "focusout",
        (e) => {
          const to = e.relatedTarget as Node | null;
          if (to && !panel.el.contains(to) && !(to instanceof Element && to.closest(".dg-colfilter"))) panel.hide(false);
        },
        { signal: ctx.signal },
      );
      const chips = h("div", { class: "dg-filter-chips" });
      ctx.toolbar({ slot: "filters", el: chips, order: 100 });
      let current: ResolvedColumn | null = null;

      const enabled = (c: ResolvedColumn) =>
        !c.col && c.searchable && (opts.columns ? opts.columns.includes(c.key) : true);

      const choices = (c: ResolvedColumn): Array<{ value: string; label: string }> => {
        if (opts.options?.[c.key]) return opts.options[c.key]!;
        const labels = (c as unknown as { labels?: Record<string, string> }).labels;
        if (labels) return Object.entries(labels).map(([value, label]) => ({ value, label }));
        const seen = new Map<string, string>();
        for (const r of grid.rows()) {
          const v = r[c.data ?? c.key];
          if (v != null && v !== "" && seen.size < 50) seen.set(String(v), String(v));
        }
        return Array.from(seen, ([value, label]) => ({ value, label }));
      };

      const nf = new Intl.NumberFormat(ctx.locale);
      const fmtValue = (c: ResolvedColumn, f: ColumnFilterValue): string => {
        const num = (v: unknown) => (c.type === "number" || c.type === "money") && typeof v === "number" ? nf.format(v) : String(v);
        const lab = (v: unknown) => choices(c).find((o) => o.value === String(v))?.label ?? String(v);
        if (f.op === "empty" || f.op === "notEmpty") return m.ops[f.op];
        if (f.op === "in" || f.op === "notIn") return `${f.op === "notIn" ? "≠ " : ""}${(f.value as unknown[]).map(lab).join(", ")}`;
        if (f.op === "between") return `${num((f.value as unknown[])[0])} – ${num((f.value as unknown[])[1])}`;
        return `${SYM[f.op] ?? m.ops[f.op]} ${num(f.value)}`;
      };

      const syncHeader = () => {
        const filters = grid.filters();
        for (const th of Array.from(ctx.table.querySelectorAll<HTMLElement>(":scope > thead > tr > th[data-key]"))) {
          const btn = th.querySelector(".dg-colfilter");
          if (btn) btn.toggleAttribute("data-active", isFilter(filters[th.getAttribute("data-key")!]));
        }
        chips.replaceChildren();
        const active = grid.columns().filter((c) => isFilter(filters[c.key]));
        for (const c of active) {
          const f = filters[c.key] as ColumnFilterValue;
          const chip = h("span", { class: "dg-filter-chip" }, h("span", { class: "dg-filter-chip-col" }, c.title), " ", h("span", null, fmtValue(c, f)));
          const x = h("button", { type: "button", class: "dg-filter-chip-x", "aria-label": `${m.clear}: ${c.title}`, title: `${m.clear}: ${c.title}` });
          x.append(frag(icons.x));
          x.addEventListener("click", () => grid.filters({ [c.key]: null }));
          chip.append(x);
          chips.append(chip);
        }
        if (active.length > 1) {
          const all = h("button", { type: "button", class: "dg-textbtn" }, m.clearAll);
          all.addEventListener("click", () => grid.filters(Object.fromEntries(active.map((c) => [c.key, null]))));
          chips.append(all);
        }
        chips.hidden = active.length === 0;
      };

      const decorate = (tr: HTMLTableRowElement) => {
        for (const c of grid.columns()) {
          if (!enabled(c)) continue;
          const th = tr.querySelector<HTMLElement>(`th[data-key="${CSS.escape(c.key)}"]`);
          if (!th || th.querySelector(".dg-colfilter")) continue;
          const b = h("button", { type: "button", class: "dg-colfilter", "aria-haspopup": "dialog", "aria-expanded": "false", "aria-label": m.filter(c.title), title: m.filter(c.title) });
          b.append(frag(icons.filter));
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            open(c, b);
          });
          th.classList.add("dg-th-filterable");
          th.append(b);
        }
        syncHeader();
      };

      const open = (c: ResolvedColumn, trigger: HTMLElement) => {
        current = c;
        const existing = grid.filters()[c.key];
        const allowed = (grid as unknown as { source?: { protocol?: { filterOps?: readonly string[] } } }).source?.protocol?.filterOps;
        const ops = allowed ? opsFor(c).filter((o) => allowed.includes(o)) : opsFor(c);
        const f: ColumnFilterValue = isFilter(existing) && ops.includes(existing.op) ? existing : { op: ops[0]! };
        const form = h("form", { class: "dg-cf-form" });
        const titleId = `${c.key}-cf-title`;
        panel.el.setAttribute("aria-labelledby", titleId);
        form.append(h("div", { class: "dg-panel-label", id: titleId }, m.filter(c.title)));
        const opSel = h("select", { class: "dg-select dg-cf-op", "aria-label": "Operatör" });
        for (const op of ops) opSel.append(h("option", { value: op, selected: op === f.op }, m.ops[op]));
        const valueBox = h("div", { class: "dg-cf-values" });
        const inputType = c.type === "date" ? "date" : c.type === "number" || c.type === "money" ? "text" : "text";
        const renderValues = () => {
          const op = opSel.value as FilterOp;
          valueBox.replaceChildren();
          if (op === "empty" || op === "notEmpty") return;
          if (op === "in" || op === "notIn") {
            const sel = Array.isArray(f.value) ? (f.value as unknown[]).map(String) : [];
            const fs = h("fieldset", { class: "dg-cf-list" }, h("legend", { class: "dg-offscreen" }, m.value));
            for (const o of choices(c)) {
              const input = h("input", { type: "checkbox", class: "dg-check-input", value: o.value, checked: sel.includes(o.value) });
              const box = h("span", { class: "dg-check-box" });
              box.append(frag(icons.check), frag(icons.minus));
              fs.append(h("label", { class: "dg-panel-item" }, h("span", { class: "dg-check" }, input, box), h("span", { class: "dg-panel-item-label" }, o.label)));
            }
            valueBox.append(fs);
            return;
          }
          const mk = (val: unknown, label: string) => h("input", { class: "dg-cf-input", type: inputType, inputmode: c.type === "number" || c.type === "money" ? "decimal" : null, "aria-label": label, value: val == null ? "" : String(val) });
          if (op === "between") {
            const v = Array.isArray(f.value) ? (f.value as unknown[]) : [];
            valueBox.append(mk(v[0], `${m.value} 1`), h("span", { class: "dg-cf-and" }, m.and), mk(v[1], `${m.value} 2`));
          } else valueBox.append(mk(isFilter(existing) && existing.op === op ? f.value : f.value ?? "", m.value));
        };
        opSel.addEventListener("change", renderValues);
        renderValues();
        const apply = h("button", { type: "submit", class: "dg-btn", "data-variant": "primary" }, m.apply);
        const clear = h("button", { type: "button", class: "dg-btn", "data-variant": "ghost" }, m.clear);
        clear.addEventListener("click", () => {
          grid.filters({ [c.key]: null });
          panel.hide(true);
        });
        form.append(h("div", { class: "dg-cf-row" }, opSel), valueBox, h("div", { class: "dg-panel-foot" }, clear, apply));
        form.addEventListener("submit", (e) => {
          e.preventDefault();
          const op = opSel.value as FilterOp;
          // "1.234,5", "1234.5", "1,234.5" all read right; an empty box stays empty (never 0)
          const num = (s: string) => (c.type === "number" || c.type === "money" ? (s.trim() === "" ? "" : parseNumber(s) ?? NaN) : s);
          let value: unknown;
          if (op === "in" || op === "notIn") value = Array.from(valueBox.querySelectorAll<HTMLInputElement>("input:checked"), (i) => i.value);
          else if (op === "between") value = Array.from(valueBox.querySelectorAll<HTMLInputElement>("input"), (i) => num(i.value));
          else if (op !== "empty" && op !== "notEmpty") value = num(valueBox.querySelector<HTMLInputElement>("input")?.value ?? "");
          const bad = (x: unknown) => x === "" || (typeof x === "number" && Number.isNaN(x));
          const emptyValue = bad(value) || (Array.isArray(value) && (!value.length || value.some(bad)));
          grid.filters({ [c.key]: emptyValue && op !== "empty" && op !== "notEmpty" ? null : { op, value } });
          panel.hide(true);
        });
        panel.el.replaceChildren(form);
        panel.show(trigger, { align: "start" });
        (valueBox.querySelector<HTMLElement>("input") ?? opSel).focus();
      };

      ctx.on("headrender" as never, ((d: { tr: HTMLTableRowElement }) => decorate(d.tr)) as never);
      ctx.on("load", () => syncHeader());
      ctx.ready(() => {
        const tr = ctx.table.tHead?.rows[0];
        if (tr) decorate(tr);
      });
      return {
        api: {
          open: (key: string) => {
            const c = grid.columns().find((x) => x.key === key);
            const b = ctx.table.querySelector<HTMLElement>(`th[data-key="${CSS.escape(key)}"] .dg-colfilter`);
            if (c && b) open(c, b);
          },
          get current() {
            return current?.key ?? null;
          },
        },
        destroy() {
          panel.destroy();
        },
      };
    },
  });
}

/** Maps a typed filter to DataTables ColumnControl `search` params (yajra ≥12.7). */
export function toColumnControl(col: ResolvedColumn, f: ColumnFilterValue): Record<string, unknown> | null {
  const logic: Partial<Record<FilterOp, string>> = {
    eq: "equal", ne: "notEqual", gt: "greater", gte: "greaterOrEqual", lt: "less", lte: "lessOrEqual",
    contains: "contains", notContains: "notContains", starts: "starts", ends: "ends", empty: "empty", notEmpty: "notEmpty",
  };
  if (f.op === "in") return { list: (f.value as unknown[]).map(String) };
  const l = logic[f.op];
  if (!l) return null; // between / notIn have no ColumnControl equivalent
  const type = col.type === "number" || col.type === "money" ? "num" : col.type === "date" ? "date" : "text";
  return { search: { value: f.value == null ? "" : String(f.value), logic: l, type } };
}

export { toolbarButton };

// stable name for grid.module(columnFilters) after minification
columnFilters.moduleName = "columnFilters";
