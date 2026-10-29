// Responsive columns: when the table is wider than its frame, the least important columns collapse and each
// row gets an expand button that shows them in a detail row. colVis choices are not touched.
import type { ModuleDef, ResolvedColumn } from "../core/types";
import { frag, h, nextId, setTip } from "../core/util";
import { icons } from "../dom/icons";

export interface ResponsiveMessages {
  show: string;
  hide: string;
}
const tr: ResponsiveMessages = { show: "Gizli kolonları göster", hide: "Gizli kolonları kapat" };
const en: ResponsiveMessages = { show: "Show hidden columns", hide: "Hide hidden columns" };

export interface ResponsiveOptions {
  /** lower = kept longer (default: definition order, the last column collapses first) */
  priority?: Record<string, number>;
  /** columns that never collapse (the first data column never does: it carries the expand button) */
  keep?: string[];
  /** detail rows with the collapsed values (default true) */
  details?: boolean;
  messages?: Partial<ResponsiveMessages>;
  /** permission flag */
  can?: boolean;
}

/** `grid.on("collapse", ({ columns }) => …)` fires when the set of collapsed columns changes. */
export interface ResponsiveApi {
  /** keys of the columns collapsed right now */
  collapsed(): string[];
  /** re-measure (after a host layout change the frame did not notice) */
  refit(): void;
  /** opens / closes a row's detail */
  toggle(rowKey: string, open?: boolean): void;
}

const CELLS = ":scope > :is(thead, tbody, tfoot) > tr:not(.dg-detail-row) > [data-key]";

export function responsive(opts: ResponsiveOptions = {}): ModuleDef<"responsive", ResponsiveApi> {
  return Object.freeze<ModuleDef<"responsive", ResponsiveApi>>({
    name: "responsive" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid, table, root } = ctx;
      const m: ResponsiveMessages = { ...(ctx.locale.startsWith("tr") ? tr : en), ...opts.messages };
      const details = opts.details !== false;
      const keep = new Set(opts.keep ?? []);
      const collapsed = new Set<string>();
      const open = new Set<string>();
      const frame = table.closest<HTMLElement>(".dg-scroll") ?? table.parentElement!;
      const tbody = table.tBodies[0]!;

      const dataCols = () => grid.columns().filter((c) => c.visible && !c.col);
      const anchorKey = () => dataCols().find((c) => !c.sticky)?.key;
      const candidates = (): ResolvedColumn[] => {
        const first = anchorKey();
        const pri = (c: ResolvedColumn, i: number) => opts.priority?.[c.key] ?? 1000 + i;
        return dataCols()
          .map((c, i) => ({ c, p: pri(c, i) }))
          .filter(({ c }) => c.key !== first && !c.sticky && !keep.has(c.key))
          .sort((a, b) => b.p - a.p)
          .map(({ c }) => c);
      };

      const mark = (key: string, on: boolean) => {
        for (const cell of Array.from(table.querySelectorAll<HTMLElement>(CELLS)))
          if (cell.getAttribute("data-key") === key) cell.toggleAttribute("data-dg-collapsed", on);
      };
      const markAll = () => {
        for (const cell of Array.from(table.querySelectorAll<HTMLElement>(CELLS)))
          cell.toggleAttribute("data-dg-collapsed", collapsed.has(cell.getAttribute("data-key")!));
      };

      const overflowing = () => frame.scrollWidth > frame.clientWidth + 1;

      /* ---------- detail rows ---------- */
      const keyOf = (row: HTMLTableRowElement) => row.getAttribute("data-key");
      const rowEl = (key: string) =>
        Array.from(tbody.rows).find((r) => !r.classList.contains("dg-detail-row") && keyOf(r) === key) ?? null;

      const buildDetail = (row: HTMLTableRowElement, key: string): HTMLTableRowElement => {
        const dl = h("dl", { class: "dg-detail" });
        for (const c of grid.columns()) {
          if (!collapsed.has(c.key) || !c.visible) continue;
          const cell = row.querySelector<HTMLElement>(`:scope > [data-key="${CSS.escape(c.key)}"]`);
          const dd = h("dd");
          if (cell) dd.append(...Array.from(cell.childNodes).map((n) => n.cloneNode(true)));
          dl.append(h("div", { "data-key": c.key }, h("dt", null, c.title), dd));
        }
        const id = row.querySelector(".dg-expand")?.getAttribute("aria-controls") ?? nextId("dg-detail");
        const td = h("td", { id, colspan: String(Math.max(1, grid.columns().filter((c) => c.visible && !collapsed.has(c.key)).length)) }, dl);
        const out = h("tr", { class: "dg-detail-row", "data-detail-for": key }, td) as HTMLTableRowElement;
        return out;
      };

      const syncRow = (row: HTMLTableRowElement) => {
        const key = keyOf(row);
        if (key === null || row.classList.contains("dg-detail-row") || row.classList.contains("dg-state-row")) return;
        const next = row.nextElementSibling;
        const old = next?.classList.contains("dg-detail-row") ? next : null;
        const anchor = anchorKey();
        const host = anchor ? row.querySelector<HTMLElement>(`:scope > [data-key="${CSS.escape(anchor)}"]`) : null;
        let btn = row.querySelector<HTMLButtonElement>(":scope > td > .dg-expand");
        const want = details && collapsed.size > 0 && !!host;
        if (btn && (!want || btn.parentElement !== host)) {
          btn.remove();
          btn = null;
        }
        if (want && !btn) {
          btn = h("button", { type: "button", class: "dg-expand", "aria-expanded": "false", "aria-controls": nextId("dg-detail") }) as HTMLButtonElement;
          btn.append(frag(icons.chevron));
          // keyboardGrid owns the tab order (one tab stop): its arrows reach the button
          if (table.getAttribute("role") === "grid") btn.tabIndex = -1;
          host!.prepend(btn);
        }
        const isOpen = want && open.has(key);
        if (btn) {
          btn.setAttribute("aria-expanded", String(isOpen));
          btn.setAttribute("aria-label", isOpen ? m.hide : m.show);
          setTip(btn, isOpen ? m.hide : m.show);
        }
        if (isOpen) {
          const fresh = buildDetail(row, key);
          if (old) old.replaceWith(fresh);
          else row.after(fresh);
        } else old?.remove();
      };
      const syncAll = () => {
        for (const r of Array.from(tbody.querySelectorAll<HTMLElement>(":scope > tr.dg-detail-row"))) {
          const prev = r.previousElementSibling;
          if (!prev || keyOf(prev as HTMLTableRowElement) !== r.getAttribute("data-detail-for")) r.remove();
        }
        for (const r of Array.from(tbody.rows)) syncRow(r);
      };

      /* ---------- fitting ---------- */
      let virtual = false;
      const fit = () => {
        if (virtual || !root.isConnected) return;
        const before = [...collapsed].join();
        collapsed.clear();
        markAll();
        if (frame.clientWidth > 0 && overflowing()) {
          for (const c of candidates()) {
            collapsed.add(c.key);
            mark(c.key, true);
            if (!overflowing()) break;
          }
        }
        root.toggleAttribute("data-dg-collapsing", collapsed.size > 0);
        const changed = [...collapsed].join() !== before;
        if (changed || details) syncAll();
        if (changed) (grid.emit as (t: string, d: unknown) => void)("collapse", { columns: [...collapsed] });
      };

      let raf = 0;
      const schedule = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(fit);
      };

      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
      ro?.observe(frame);

      ctx.on("render", () => {
        virtual = root.hasAttribute("data-dg-virtual");
        if (virtual && collapsed.size) {
          collapsed.clear();
          markAll();
          root.removeAttribute("data-dg-collapsing");
          syncAll(); // no stale expand buttons or detail rows
          (grid.emit as (t: string, d: unknown) => void)("collapse", { columns: [] });
        }
        fit();
      });
      ctx.on("columnchange", () => fit());
      ctx.on("headrender" as never, (() => markAll()) as never);

      tbody.addEventListener(
        "click",
        (e) => {
          const btn = (e.target as Element).closest<HTMLButtonElement>(".dg-expand");
          if (!btn || !tbody.contains(btn)) return;
          const row = btn.closest("tr")!;
          const key = keyOf(row);
          if (key === null) return;
          api.toggle(key);
        },
        { signal: ctx.signal },
      );

      const api: ResponsiveApi = {
        collapsed: () => [...collapsed],
        refit: fit,
        toggle(key, want) {
          const next = want ?? !open.has(key);
          if (next) open.add(key);
          else open.delete(key);
          const row = rowEl(key);
          if (row) syncRow(row);
        },
      };

      return {
        api,
        destroy() {
          cancelAnimationFrame(raf);
          ro?.disconnect();
          for (const el of Array.from(table.querySelectorAll(".dg-detail-row, .dg-expand"))) el.remove();
          for (const el of Array.from(table.querySelectorAll("[data-dg-collapsed]"))) el.removeAttribute("data-dg-collapsed");
          root.removeAttribute("data-dg-collapsing");
        },
      };
    },
  });
}

// stable name for grid.module(responsive) after minification
responsive.moduleName = "responsive";
