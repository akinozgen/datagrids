// Opt-in APG grid navigation on the native table: one tab stop, arrow keys move between cells,
// Home/End within the row, Ctrl+Home/End to the corners, PageUp/PageDown change the page.
// A cell holding a single widget passes focus to the widget (sort button, checkbox, link).
import type { ModuleDef } from "../core/types";

export interface KeyboardGridOptions {
  /** permission flag */
  can?: boolean;
}

export interface KeyboardGridApi {
  /** active cell: row 0 is the header row, columns count visible cells */
  position(): { row: number; col: number };
  /** moves the active cell (and focus when the grid has it) */
  focus(row: number, col: number): void;
}

const WIDGETS = "a[href], button, input, select, textarea, [tabindex]:not(td):not(th)";
const TYPING = "input:not([type=checkbox]):not([type=radio]), select, textarea, [contenteditable]";

/* Keys: arrows (RTL aware) · Home/End · Ctrl+Home/End · PageUp/PageDown (page) · Enter/F2 into a multi-widget cell · Esc back */

export function keyboardGrid(opts: KeyboardGridOptions = {}): ModuleDef<"keyboardGrid", KeyboardGridApi> {
  return Object.freeze<ModuleDef<"keyboardGrid", KeyboardGridApi>>({
    name: "keyboardGrid" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid, table } = ctx;
      const tbody = table.tBodies[0]!;
      const origRole = table.getAttribute("role");
      table.setAttribute("role", "grid");
      let pos = { row: 0, col: 0 };
      let active: HTMLElement | null = null;
      let inside = false;
      let refocus = false;

      const rows = (): HTMLTableRowElement[] => {
        const head = table.tHead?.rows[0];
        const body = Array.from(tbody.rows).filter((r) => !r.classList.contains("dg-detail-row") && !r.classList.contains("dg-state-row") && !r.classList.contains("dg-spacer"));
        return head ? [head, ...body] : body;
      };
      const cells = (tr: HTMLTableRowElement) =>
        Array.from(tr.cells).filter((c) => !c.hidden && !c.hasAttribute("data-dg-collapsed"));
      const widgets = (cell: HTMLElement) =>
        Array.from(cell.querySelectorAll<HTMLElement>(WIDGETS)).filter((w) => !(w as HTMLButtonElement).disabled && !w.closest("[hidden]"));
      const targetOf = (cell: HTMLElement) => {
        const ws = widgets(cell);
        return ws.length === 1 ? ws[0]! : cell;
      };

      const clamp = () => {
        const rs = rows();
        pos.row = Math.max(0, Math.min(pos.row, rs.length - 1));
        const cs = rs[pos.row] ? cells(rs[pos.row]!) : [];
        pos.col = Math.max(0, Math.min(pos.col, cs.length - 1));
        return cs[pos.col] ?? null;
      };

      // every element whose tabindex we changed, with its original value (rows on other pages included)
      const touched = new Map<HTMLElement, string | null>();
      const setTab = (el: HTMLElement, v: number) => {
        if (!touched.has(el)) touched.set(el, el.getAttribute("tabindex"));
        el.tabIndex = v;
      };

      /** single tab stop: every widget and cell is -1, the active target is 0 */
      const sync = () => {
        for (const el of Array.from(table.querySelectorAll<HTMLElement>(`:scope > :is(thead, tbody) > tr > :is(td, th) :is(${WIDGETS})`))) setTab(el, -1);
        if (active && active.isConnected) setTab(active, -1);
        const cell = clamp();
        active = cell ? targetOf(cell) : null;
        if (active) setTab(active, 0);
      };

      // the active row by key: virtual windows and re-sorts move rows around
      let activeKey: string | null = null;
      const remember = () => {
        const tr = rows()[pos.row];
        activeKey = tr ? (tr.parentElement === tbody ? tr.getAttribute("data-key") : "head") : null;
      };
      const recall = () => {
        if (activeKey === null) return;
        const i = activeKey === "head" ? 0 : rows().findIndex((r) => r.parentElement === tbody && r.getAttribute("data-key") === activeKey);
        if (i >= 0) pos.row = i;
      };

      const go = (row: number, col: number, focus = true) => {
        pos = { row, col };
        sync();
        remember();
        if (focus && active) {
          active.focus();
          active.closest("td, th")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        }
      };

      const changePage = (delta: number) => {
        const before = grid.page();
        const next = grid.page(before + delta);
        if (next !== before) refocus = true;
      };

      table.addEventListener(
        "keydown",
        (e) => {
          const t = e.target as HTMLElement;
          if (!t.closest("thead, tbody") || t.closest(".dg-detail-row")) return;
          if (t.matches(TYPING) && !["PageUp", "PageDown"].includes(e.key)) return;
          const rtl = getComputedStyle(table).direction === "rtl";
          const rs = rows();
          const last = rs.length - 1;
          const width = rs[pos.row] ? cells(rs[pos.row]!).length - 1 : 0;
          let r = pos.row;
          let c = pos.col;
          switch (e.key) {
            case "ArrowDown": r++; break;
            case "ArrowUp": r--; break;
            case "ArrowRight": c += rtl ? -1 : 1; break;
            case "ArrowLeft": c += rtl ? 1 : -1; break;
            case "Home": if (e.ctrlKey) r = 0; c = 0; break;
            case "End": if (e.ctrlKey) r = last; c = width; break;
            case "Enter":
            case "F2": {
              // a cell with several widgets: step inside; Esc comes back
              const ws = t.matches("td, th") ? widgets(t) : [];
              if (!ws.length) return;
              e.preventDefault();
              ws[0]!.focus();
              return;
            }
            case "Escape": {
              const cell = t.closest<HTMLElement>("td, th");
              if (!cell || t === cell || active !== cell) return;
              e.preventDefault();
              cell.focus();
              return;
            }
            case "PageDown": e.preventDefault(); changePage(1); return;
            case "PageUp": e.preventDefault(); changePage(-1); return;
            default: return;
          }
          e.preventDefault();
          if (r < 0 || r > last || c < 0) return;
          go(r, c);
        },
        { signal: ctx.signal },
      );

      // clicks and Tab land anywhere: follow the focus
      table.addEventListener(
        "focusin",
        (e) => {
          inside = true;
          const cell = (e.target as Element).closest<HTMLTableCellElement>("td, th");
          const tr = cell?.parentElement as HTMLTableRowElement | undefined;
          if (!cell || !tr || tr.classList.contains("dg-detail-row")) return;
          const r = rows().indexOf(tr);
          const c = cells(tr).indexOf(cell);
          if (r < 0 || c < 0) return;
          if (r !== pos.row || c !== pos.col) {
            pos = { row: r, col: c };
            remember();
            if (active && active !== e.target) setTab(active, -1);
            active = targetOf(cell);
            if (active) setTab(active, 0);
          }
        },
        { signal: ctx.signal },
      );
      // a click on a cell (not on its widget) makes it the active cell, as in any grid
      table.addEventListener(
        "click",
        (e) => {
          const t = e.target as Element;
          if (t.closest(WIDGETS)) return;
          const cell = t.closest<HTMLTableCellElement>("td, th");
          const tr = cell?.parentElement as HTMLTableRowElement | undefined;
          if (!cell || !tr || tr.classList.contains("dg-detail-row")) return;
          const r = rows().indexOf(tr);
          const c = cells(tr).indexOf(cell);
          if (r >= 0 && c >= 0) go(r, c);
        },
        { signal: ctx.signal },
      );
      table.addEventListener(
        "focusout",
        (e) => {
          const to = e.relatedTarget as Node | null;
          if (to && !table.contains(to)) inside = false;
        },
        { signal: ctx.signal },
      );
      document.addEventListener("pointerdown", (e) => !table.contains(e.target as Node) && (inside = false), { signal: ctx.signal, capture: true });

      const afterRender = () => {
        // a page change from the keyboard lands on the first body row
        if (refocus) pos.row = Math.min(1, rows().length - 1);
        else recall();
        const had = refocus || (inside && (!document.activeElement || document.activeElement === document.body));
        refocus = false;
        sync();
        if (had && active) active.focus();
      };
      for (const ev of ["render", "headrender", "columnchange", "window", "collapse"]) ctx.on(ev as never, afterRender as never);
      ctx.ready(() => sync());

      return {
        api: { position: () => ({ ...pos }), focus: (row, col) => go(row, col) },
        destroy() {
          for (const [el, v] of touched) v === null ? el.removeAttribute("tabindex") : el.setAttribute("tabindex", v);
          touched.clear();
          if (origRole === null) table.removeAttribute("role");
          else table.setAttribute("role", origRole);
        },
      };
    },
  });
}

// stable name for grid.module(keyboardGrid) after minification
keyboardGrid.moduleName = "keyboardGrid";
