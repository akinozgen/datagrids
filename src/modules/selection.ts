// Row selection + persistent bulk bar.
import { notice } from "../core/warn";
import type { DatagridApi, ModuleDef, Query, Row, SortSpec } from "../core/types";
import { config } from "../core/config";
import { decodeEntities, frag, getPath, h, htmlToText, setTip, toggleAttr } from "../core/util";
import { icons, type IconName } from "../dom/icons";

export interface SelectionMessages {
  /** word after the count: "3 seçili" */
  selected: string;
  /** muted hint while nothing is selected */
  idle: string;
  selectAll: (n: string) => string;
  allSelected: string;
  clear: string;
  /** selected rows that are not on the current page / view */
  hidden: (n: string) => string;
  /** row checkbox name */
  row: (label: string) => string;
  /** header checkbox name */
  page: string;
  /** header text in single mode (no page checkbox) */
  column: string;
  /** bulk bar group name */
  bar: string;
  announce: (n: string) => string;
  announceAll: (n: string) => string;
  cleared: string;
  /** the query changed while "all matching" was selected */
  reset: string;
}

const tr: SelectionMessages = {
  selected: "seçili",
  idle: "Seçim yapınca işlemler etkinleşir",
  selectAll: (n) => `Filtre sonucunun tümünü seç (${n})`,
  allSelected: "Filtre sonucunun tümü seçili.",
  clear: "Seçimi temizle",
  hidden: (n) => `${n} tanesi görünmüyor`,
  row: (l) => `Seç: ${l}`,
  page: "Sayfadaki tümünü seç",
  column: "Seç",
  bar: "Seçim",
  announce: (n) => `${n} satır seçildi`,
  announceAll: (n) => `Filtre sonucunun tümü seçildi: ${n} satır`,
  cleared: "Seçim temizlendi",
  reset: "Filtre değişti, tümünü seçme kaldırıldı",
};
const en: SelectionMessages = {
  selected: "selected",
  idle: "Select rows to enable actions",
  selectAll: (n) => `Select all ${n} matching`,
  allSelected: "All matching records are selected.",
  clear: "Clear selection",
  hidden: (n) => `${n} not shown`,
  row: (l) => `Select: ${l}`,
  page: "Select all on this page",
  column: "Select",
  bar: "Selection",
  announce: (n) => `${n} rows selected`,
  announceAll: (n) => `All ${n} matching rows selected`,
  cleared: "Selection cleared",
  reset: "The filter changed; select-all was cleared",
};

/** The query an "all matching" selection stands for (paging and column objects stripped). */
export interface SelectionQuery {
  search: string;
  sort: SortSpec[];
  filters: Record<string, unknown>;
  /** page parameters of the list (filter panel, toggles) — the server needs them to rebuild "all matching" */
  params?: Record<string, unknown>;
}

/** What a bulk action sends to the server. */
export type SelectionPayload =
  | { all: false; keys: string[] }
  | { all: true; except: string[]; query: SelectionQuery };

export interface SelectionChange {
  count: number;
  keys: string[];
  all: boolean;
}

export interface BulkAction {
  id: string;
  label: string;
  /** icon name from the built-in set or a trusted SVG string */
  icon?: IconName | string;
  tone?: "danger";
  /** permission flag: false → the button does not exist */
  can?: boolean;
  /** a returned promise keeps the bar's actions disabled until it settles */
  onClick(payload: SelectionPayload, grid: DatagridApi, selection: SelectionApi): void | Promise<unknown>;
}

export interface SelectionOptions {
  mode?: "multi" | "single";
  /** keep selections across pages (default true); false → a page change drops off-page keys */
  acrossPages?: boolean;
  /** offer "select all N matching" once the page is fully selected (default true) */
  selectAllMatching?: boolean;
  /** row checkbox accessible name; default: first text column value */
  label?: (row: Row) => string;
  /** persistent bulk bar; false → no bar */
  bulk?: false | { actions?: BulkAction[] };
  messages?: Partial<SelectionMessages>;
  /** permission flag */
  can?: boolean;
}

export interface SelectionApi {
  /** selected rows known to the grid (all mode: the loaded ones; client mode: every matching row) */
  get(): Row[];
  /** selected keys (all mode: only the loaded ones — use payload()) */
  keys(): string[];
  payload(): SelectionPayload;
  count(): number;
  /** true while "all matching" is selected */
  isAll(): boolean;
  isSelected(key: string): boolean;
  select(keys: string | readonly string[]): void;
  deselect(keys: string | readonly string[]): void;
  toggle(key: string): void;
  clear(): void;
  selectPage(): void;
  deselectPage(): void;
  selectAllMatching(): void;
}

const signature = (q: Pick<Query, "search" | "filters">): string =>
  JSON.stringify([q.search, Object.keys(q.filters).sort().map((k) => [k, q.filters[k]])]);

/**
 * Pure selection state. Keys are strings and live in Sets, so "7" and 7 are one key and a row can't be
 * pushed twice.
 */
export class SelectionModel {
  all = false;
  readonly keys = new Set<string>();
  readonly except = new Set<string>();
  /** query signature + matching count captured when "all" was chosen */
  sig = "";
  total: number | null = null;
  /** row copies by key (rows on other pages stay reachable) */
  readonly rows = new Map<string, Row>();

  has(key: string): boolean {
    return this.all ? !this.except.has(key) : this.keys.has(key);
  }

  add(key: string, row?: Row): void {
    if (this.all) this.except.delete(key);
    else this.keys.add(key);
    if (row) this.rows.set(key, row);
  }

  remove(key: string): void {
    if (this.all) this.except.add(key);
    else this.keys.delete(key);
    this.rows.delete(key);
  }

  clear(): void {
    this.all = false;
    this.keys.clear();
    this.except.clear();
    this.rows.clear();
    this.sig = "";
    this.total = null;
  }

  selectAll(query: Pick<Query, "search" | "filters">, total: number | null): void {
    this.clear();
    this.all = true;
    this.sig = signature(query);
    this.total = total;
  }

  count(filtered?: number | null): number {
    if (!this.all) return this.keys.size;
    return Math.max(0, (filtered ?? this.total ?? 0) - this.except.size);
  }

  /** "all" no longer stands for the same rows: the search/filters or the matching count changed */
  stale(query: Pick<Query, "search" | "filters">, filtered?: number | null): boolean {
    if (!this.all) return false;
    if (signature(query) !== this.sig) return true;
    return filtered != null && this.total != null && filtered !== this.total;
  }

  payload(query: SelectionQuery): SelectionPayload {
    return this.all ? { all: true, except: [...this.except], query } : { all: false, keys: [...this.keys] };
  }
}

const SELECT_KEY = "__select";
const ROW_CELL = `:scope > td[data-key="${SELECT_KEY}"]`;

function checkbox(label: string): HTMLSpanElement {
  const input = h("input", { type: "checkbox", class: "dg-check-input", "aria-label": label });
  const box = h("span", { class: "dg-check-box" });
  box.append(frag(icons.check), frag(icons.minus));
  return h("span", { class: "dg-check" }, input, box);
}

const modeOf = (grid: DatagridApi): string => grid.mode;

const toList = (k: string | readonly string[]): string[] => (typeof k === "string" ? [k] : k.map(String));

export function selection(opts: SelectionOptions = {}): ModuleDef<"selection", SelectionApi> {
  return Object.freeze<ModuleDef<"selection", SelectionApi>>({
    name: "selection" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid } = ctx;
      const m: SelectionMessages = { ...(ctx.locale.startsWith("tr") ? tr : en), ...opts.messages };
      const single = opts.mode === "single";
      const across = opts.acrossPages !== false;
      const offerAll = !single && across && opts.selectAllMatching !== false;
      const nf = new Intl.NumberFormat(ctx.locale);
      const fmt = (n: number) => nf.format(n);
      const model = new SelectionModel();
      let headInput: HTMLInputElement | null = null;
      let anchor: string | null = null;
      let warnedKey = false;

      const filtered = () => grid.status().filtered;
      const viewKeys = () => grid.viewRows().map((r) => grid.keyOf(r));
      // page parameters of the request behind the rows on screen when "all matching" was chosen (not the
      // form's current, maybe unapplied, values); params that only add columns (lazyColumns) do not count
      let allParams: Record<string, unknown> = {};
      let allParamsSig = "{}";
      const rowParams = (): Record<string, unknown> => {
        const p = grid.lastRequestParams();
        const lazy = (grid as unknown as { lazyColumns?: { param?: string } }).lazyColumns?.param;
        if (lazy) delete p[lazy];
        return p;
      };
      const currentQuery = (): SelectionQuery => {
        const q = grid.query();
        return { search: q.search, sort: q.sort, filters: q.filters, params: { ...allParams } };
      };

      const firstText = () => grid.columns().find((c) => c.type === "text" && !c.col);
      const labelFor = (row: Row, key: string): string => {
        if (opts.label) return opts.label(row);
        const c = firstText();
        const v = c ? (c.value ? c.value(row) : getPath(row, c.data ?? c.key)) : undefined;
        if (v == null || v === "") return key;
        const s = String(v);
        return (s.includes("<") ? htmlToText(s) : decodeEntities(s)).trim() || key;
      };

      /* ---------- DOM sync ---------- */

      const syncRow = (tr: HTMLTableRowElement, key: string) => {
        const input = tr.querySelector<HTMLInputElement>(`${ROW_CELL} .dg-check-input`);
        const on = model.has(key);
        if (input && input.checked !== on) input.checked = on;
        toggleAttr(tr, "data-selected", on);
      };

      const syncRows = () => {
        for (const tr of Array.from(ctx.table.tBodies[0]?.rows ?? [])) {
          const key = tr.getAttribute("data-key");
          if (key !== null && !tr.classList.contains("dg-state-row")) syncRow(tr, key);
        }
      };

      const pageState = () => {
        const keys = viewKeys();
        const n = keys.filter((k) => model.has(k)).length;
        return { keys, n, full: keys.length > 0 && n === keys.length };
      };

      const syncHead = () => {
        if (!headInput) return;
        const { keys, n, full } = pageState();
        headInput.checked = full;
        headInput.indeterminate = n > 0 && !full;
        headInput.disabled = keys.length === 0;
      };

      /* ---------- bulk bar ---------- */

      const bar = opts.bulk === false ? null : h("div", { class: "dg-bulk", role: "group", "aria-label": m.bar });
      const countNum = h("span", { class: "dg-bulk-count" }, "0");
      const status = h("span", { class: "dg-bulk-status" }, countNum, ` ${m.selected}`);
      const sep = h("span", { class: "dg-bulk-sep", "aria-hidden": "true" });
      const idle = h("span", { class: "dg-bulk-hint" }, m.idle);
      const hiddenNote = h("span", { class: "dg-bulk-hint" });
      const allText = h("span", null, m.allSelected);
      const allBtn = h("button", { type: "button", class: "dg-textbtn" });
      const clearBtn = h("button", { type: "button", class: "dg-textbtn" }, m.clear);
      const actionsBox = h("div", { class: "dg-bulk-actions" });
      let busy = false;
      const actionBtns: Array<{ btn: HTMLButtonElement; a: BulkAction }> = [];
      const actions = (opts.bulk ? opts.bulk.actions ?? [] : []).filter((a) => a.can !== false);
      for (const a of actions) {
        const btn = h("button", { type: "button", class: "dg-btn", "data-action": a.id, disabled: true });
        const svg = a.icon ? (a.icon.trimStart().startsWith("<") ? a.icon : icons[a.icon as IconName]) : null;
        if (svg) {
          btn.append(frag(svg), h("span", { class: "dg-btn-text" }, a.label));
          // the text hides on narrow roots; keep the name
          btn.setAttribute("aria-label", a.label);
          setTip(btn, a.label);
        } else btn.textContent = a.label;
        btn.addEventListener("click", () => {
          if (btn.disabled || busy) return;
          const out = a.onClick(api.payload(), grid, api);
          if (out && typeof (out as Promise<unknown>).then === "function") {
            busy = true;
            btn.setAttribute("aria-busy", "true");
            syncBar();
            void (out as Promise<unknown>).catch(() => {}).finally(() => {
              busy = false;
              btn.removeAttribute("aria-busy");
              syncBar();
            });
          }
        });
        actionBtns.push({ btn, a });
        actionsBox.append(btn);
      }

      const place = (nodes: Node[]) => {
        if (!bar) return;
        const cur = Array.from(bar.childNodes);
        if (cur.length === nodes.length && cur.every((n, i) => n === nodes[i])) return;
        const active = document.activeElement as HTMLElement | null;
        const had = active && bar.contains(active) ? active : null;
        bar.replaceChildren(...nodes);
        if (!had) return;
        if (bar.contains(had)) had.focus();
        else {
          // the focused text button was swapped (select all ↔ clear): keep focus nearby
          const next = nodes.find((n): n is HTMLButtonElement => n instanceof HTMLButtonElement);
          (next ?? headInput ?? ctx.table.querySelector<HTMLElement>(`tbody .dg-check-input`))?.focus();
        }
      };

      const syncBar = () => {
        if (!bar) return;
        const n = api.count();
        countNum.textContent = fmt(n);
        toggleAttr(bar, "data-active", n > 0);
        for (const { btn, a } of actionBtns) {
          const off = n === 0 || busy;
          btn.disabled = off;
          // a disabled danger button reads as disabled, not as a red call to action
          toggleAttr(btn, "data-tone", a.tone === "danger", "bad");
        }
        const nodes: Node[] = [status, sep];
        if (n === 0) nodes.push(idle);
        else if (model.all) nodes.push(allText, clearBtn);
        else {
          const page = pageState();
          const onPage = new Set(page.keys);
          const off = [...model.keys].filter((k) => !onPage.has(k)).length;
          if (off > 0) {
            hiddenNote.textContent = m.hidden(fmt(off));
            nodes.push(hiddenNote);
          }
          const total = filtered();
          if (offerAll && page.full && total != null && total > page.keys.length) {
            allBtn.textContent = m.selectAll(fmt(total));
            nodes.push(allBtn);
          }
          nodes.push(clearBtn);
        }
        if (actionBtns.length) nodes.push(actionsBox);
        place(nodes);
      };

      const changed = (announce = true) => {
        syncRows();
        syncHead();
        syncBar();
        const n = api.count();
        grid.emit("selectionchange", { count: n, keys: api.keys(), all: model.all } satisfies SelectionChange);
        if (announce) ctx.announce(n === 0 ? m.cleared : model.all ? m.announceAll(fmt(n)) : m.announce(fmt(n)));
      };

      /* ---------- mutations ---------- */

      const addKey = (k: string) => {
        if (single) {
          model.clear();
        }
        model.add(k, grid.rowByKey(k));
      };

      const setPage = (on: boolean) => {
        for (const r of grid.viewRows()) {
          const k = grid.keyOf(r);
          if (on) model.add(k, r);
          else model.remove(k);
        }
      };

      const api: SelectionApi = {
        get() {
          if (model.all) return [...model.rows].filter(([k]) => model.has(k)).map(([, r]) => r);
          const out: Row[] = [];
          for (const k of model.keys) {
            const r = model.rows.get(k) ?? grid.rowByKey(k);
            if (r) out.push(r);
          }
          return out;
        },
        keys() {
          return model.all ? [...model.rows.keys()].filter((k) => model.has(k)) : [...model.keys];
        },
        payload() {
          return model.payload(currentQuery());
        },
        count() {
          return model.count(filtered());
        },
        isAll() {
          return model.all;
        },
        isSelected(key) {
          return model.has(String(key));
        },
        select(keys) {
          const list = toList(keys);
          for (const k of single ? list.slice(-1) : list) addKey(k);
          changed();
        },
        deselect(keys) {
          for (const k of toList(keys)) model.remove(k);
          changed();
        },
        toggle(key) {
          const k = String(key);
          if (model.has(k)) model.remove(k);
          else addKey(k);
          changed();
        },
        clear() {
          model.clear();
          anchor = null;
          changed();
        },
        selectPage() {
          if (single) return;
          setPage(true);
          changed();
        },
        deselectPage() {
          setPage(false);
          changed();
        },
        selectAllMatching() {
          if (single) return;
          const q = grid.query();
          model.selectAll(q, filtered());
          allParams = rowParams();
          allParamsSig = JSON.stringify(allParams);
          for (const r of grid.viewRows()) model.rows.set(grid.keyOf(r), r);
          // client mode: every matching row is in memory → get() returns all of them
          if (modeOf(grid) === "client") {
            const at = model.sig;
            void grid.exportRows("all").then((rows) => {
              if (!model.all || model.sig !== at) return;
              for (const r of rows) {
                const k = grid.keyOf(r);
                if (model.has(k)) model.rows.set(k, r);
              }
            });
          }
          changed();
        },
      };

      /* ---------- events ---------- */

      const sig = { signal: ctx.signal };
      /** The whole select cell is the hit target, not only the 32px box; it is not a row click. */
      const widen = (cell: HTMLTableCellElement) =>
        cell.addEventListener("click", (e) => {
          const input = cell.querySelector<HTMLInputElement>(":scope > .dg-check > .dg-check-input");
          if (e.target !== cell || !input || input.disabled) return;
          e.stopPropagation();
          input.click();
        }, sig);

      ctx.row((tr, row, key) => {
        const cell = tr.querySelector<HTMLTableCellElement>(ROW_CELL);
        if (!cell) return;
        if (!warnedKey && key.startsWith("__i") && config.warnings !== false) {
          warnedKey = true;
          notice("selection()", "rows have no key (rowKey / id / DT_RowId); selections will not survive paging.");
        }
        let input = cell.querySelector<HTMLInputElement>(".dg-check-input");
        if (!input) {
          const box = checkbox("");
          cell.append(box);
          input = box.firstElementChild as HTMLInputElement;
          widen(cell);
        }
        input.setAttribute("aria-label", m.row(labelFor(row, key)));
        if (model.has(key)) model.rows.set(key, row);
        syncRow(tr, key);
      });

      ctx.on("headrender" as never, ((d: { tr: HTMLTableRowElement }) => {
        const th = d.tr.querySelector<HTMLTableCellElement>(`th[data-key="${SELECT_KEY}"]`);
        headInput = null;
        if (!th) return;
        if (single) {
          th.append(h("span", { class: "dg-offscreen" }, m.column));
          return;
        }
        const box = checkbox(m.page);
        th.append(box);
        widen(th);
        headInput = box.firstElementChild as HTMLInputElement;
        syncHead();
      }) as never);

      const checkQuery = (q: Pick<Query, "search" | "filters">, count?: number | null) => {
        if (!model.stale(q, count)) return false;
        model.clear();
        anchor = null;
        ctx.announce(m.reset);
        return true;
      };

      ctx.on("beforeLoad", ({ query }) => {
        if (checkQuery(query)) changed(false);
      });
      // the set behind "all" changed (filter panel, toggles): drop "all" once the new rows are in
      ctx.on("load", () => {
        if (!model.all || JSON.stringify(rowParams()) === allParamsSig) return;
        model.clear();
        anchor = null;
        ctx.announce(m.reset);
        changed(false);
      });

      ctx.on("render", () => {
        let dirty = checkQuery(grid.query(), filtered());
        if (!model.all) {
          const inView = new Set(viewKeys());
          const client = modeOf(grid) === "client";
          for (const k of Array.from(model.keys)) {
            if (!across && !inView.has(k)) {
              model.remove(k);
              dirty = true;
              continue;
            }
            if (client) {
              // client mode knows every row: drop removed ones, refresh replaced copies
              const r = grid.rowByKey(k);
              if (!r) {
                model.remove(k);
                dirty = true;
              } else model.rows.set(k, r);
            }
          }
        }
        if (dirty) changed(false);
        else {
          syncHead();
          syncBar();
        }
      });

      ctx.table.addEventListener("click", (e) => {
        const t = e.target as Element | null;
        if (!t?.closest) return;
        const input = t.closest<HTMLInputElement>("input.dg-check-input");
        if (input && input.closest("table") === ctx.table) {
          if (input === headInput) {
            setPage(!pageState().full);
            changed();
            return;
          }
          const tr = input.closest("tr");
          const key = tr?.getAttribute("data-key");
          if (!tr || key == null || !input.closest(`td[data-key="${SELECT_KEY}"]`)) return;
          const on = input.checked;
          const keys = viewKeys();
          const a = anchor !== null ? keys.indexOf(anchor) : -1;
          const b = keys.indexOf(key);
          if (!single && (e as MouseEvent).shiftKey && a >= 0 && b >= 0 && a !== b) {
            // shift+click: apply this row's new state to the range from the last clicked row
            for (const k of keys.slice(Math.min(a, b), Math.max(a, b) + 1)) {
              if (on) model.add(k, grid.rowByKey(k));
              else model.remove(k);
            }
          } else if (on) addKey(key);
          else model.remove(key);
          anchor = key;
          changed();
        }
      }, sig);

      allBtn.addEventListener("click", () => api.selectAllMatching());
      clearBtn.addEventListener("click", () => api.clear());

      if (bar) {
        ctx.above(bar);
        syncBar();
      }

      ctx.ready(() => {
        if (!grid.columns().some((c) => c.col === "select") && config.warnings !== false)
          notice("selection()", "add `column.select()` to the columns to place the checkbox column.");
      });

      return {
        api,
        destroy() {
          bar?.remove();
          // adopted host rows (DOM source) keep their identity: take our marks back off
          for (const el of Array.from(ctx.table.querySelectorAll(`td[data-key="${SELECT_KEY}"] > .dg-check`))) el.remove();
          for (const tr of Array.from(ctx.table.querySelectorAll("tr[data-selected]"))) tr.removeAttribute("data-selected");
        },
      };
    },
  });
}
selection.moduleName = "selection";
