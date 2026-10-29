// Column reordering: drag a header, or use the move buttons the colVis panel shows while this module is attached.
// Display order only — the request keeps the definition order (`columns[i]` index stays stable).
import type { ModuleDef, ResolvedColumn } from "../core/types";
import { icons } from "../dom/icons";
import { frag, h } from "../core/util";

export interface ColReorderMessages {
  earlier: (col: string) => string;
  later: (col: string) => string;
  moved: (col: string, pos: number, total: number) => string;
  hint: string;
}
const tr: ColReorderMessages = {
  earlier: (c) => `${c}: öne al`,
  later: (c) => `${c}: arkaya al`,
  moved: (c, p, n) => `${c} kolonu ${p}. sıraya taşındı (${n} kolon).`,
  hint: "Sürükleyerek taşıyın",
};
const en: ColReorderMessages = {
  earlier: (c) => `Move ${c} earlier`,
  later: (c) => `Move ${c} later`,
  moved: (c, p, n) => `${c} moved to position ${p} of ${n}.`,
  hint: "Drag to move",
};

export interface ColReorderOptions {
  /** header drag (default true); the colVis panel buttons stay available either way */
  drag?: boolean;
  messages?: Partial<ColReorderMessages>;
  /** permission flag */
  can?: boolean;
}

export interface ColReorderApi {
  /** current display order (keys) */
  order(): string[];
  /** moves a column before the column now at `to` among the movable ones (0-based) */
  move(key: string, to: number): void;
  /** back to the definition order */
  reset(): void;
  /** columns that can move (special and sticky columns keep their slots) */
  movable(): ResolvedColumn[];
  readonly messages: ColReorderMessages;
}

const isMovable = (c: ResolvedColumn) => !c.col && !c.sticky;

export function colReorder(opts: ColReorderOptions = {}): ModuleDef<"colReorder", ColReorderApi> {
  return Object.freeze<ModuleDef<"colReorder", ColReorderApi>>({
    name: "colReorder" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid, table } = ctx;
      const m: ColReorderMessages = { ...(ctx.locale.startsWith("tr") ? tr : en), ...opts.messages };
      const movable = () => grid.columns().filter(isMovable);

      const move = (key: string, to: number) => {
        const keys = movable().map((c) => c.key);
        const from = keys.indexOf(key);
        if (from < 0) return;
        const at = Math.max(0, Math.min(keys.length - 1, to));
        if (at === from) return;
        keys.splice(from, 1);
        keys.splice(at, 0, key);
        grid.columnOrder(keys);
        const c = grid.columns().find((x) => x.key === key);
        const vis = movable().filter((x) => x.visible);
        if (c) ctx.announce(m.moved(c.title, vis.findIndex((x) => x.key === key) + 1, vis.length));
      };

      const api: ColReorderApi = {
        order: () => grid.columnOrder(),
        move,
        reset: () => void grid.columnOrder([]),
        movable,
        messages: m,
      };

      ctx.state({
        key: "colReorder",
        save: () => movable().map((c) => c.key),
        load: (v) => {
          if (Array.isArray(v)) grid.columnOrder(v.filter((k): k is string => typeof k === "string"));
        },
      });

      /* ---------- header drag ---------- */
      if (opts.drag !== false) {
        const decorate = (row: HTMLTableRowElement) => {
          for (const th of Array.from(row.cells)) {
            const c = grid.columns().find((x) => x.key === th.getAttribute("data-key"));
            if (!c || !isMovable(c)) continue;
            th.setAttribute("data-dg-movable", "");
            const grip = h("span", { class: "dg-col-grip", "aria-hidden": "true", "data-dg-tip": m.hint });
            grip.append(frag(icons.grip));
            // inside the sort button the grip is one more flex item; plain headers get it before the text
            (th.querySelector<HTMLElement>(":scope > .dg-sort") ?? th).prepend(grip);
          }
        };
        ctx.on("headrender" as never, ((d: { tr: HTMLTableRowElement }) => decorate(d.tr)) as never);
        ctx.ready(() => {
          const row = table.tHead?.rows[0];
          if (row && !row.querySelector(".dg-col-grip")) decorate(row);
        });

        let drag: {
          key: string;
          th: HTMLTableCellElement;
          x: number;
          y: number;
          id: number;
          on: boolean;
          to: number;
          line: HTMLElement | null;
        } | null = null;

        const targets = () =>
          Array.from(table.tHead?.rows[0]?.cells ?? [])
            .filter((th) => th.hasAttribute("data-dg-movable") && !th.hidden && !th.hasAttribute("data-dg-collapsed"))
            .map((th) => ({ key: th.getAttribute("data-key")!, r: th.getBoundingClientRect() }));

        /** nearest gap between movable headers → index among the visible movable columns */
        const slot = (x: number) => {
          const ts = targets();
          const rtl = getComputedStyle(table).direction === "rtl";
          let best = 0;
          let dist = Infinity;
          for (let i = 0; i <= ts.length; i++) {
            const t = ts[Math.min(i, ts.length - 1)]!;
            const edge = i === ts.length ? (rtl ? t.r.left : t.r.right) : rtl ? t.r.right : t.r.left;
            const d = Math.abs(edge - x);
            if (d < dist) {
              dist = d;
              best = i;
            }
          }
          return { index: best, ts, rtl };
        };

        const place = (x: number) => {
          if (!drag) return;
          const { index, ts, rtl } = slot(x);
          drag.to = index;
          const t = ts[Math.min(index, ts.length - 1)];
          if (!t || !drag.line) return;
          const edge = index === ts.length ? (rtl ? t.r.left : t.r.right) : rtl ? t.r.right : t.r.left;
          const frame = table.parentElement!.getBoundingClientRect();
          const head = table.tHead!.getBoundingClientRect();
          drag.line.style.left = `${Math.round(Math.min(Math.max(edge, frame.left), frame.right) - 1)}px`;
          drag.line.style.top = `${Math.round(head.top)}px`;
          drag.line.style.height = `${Math.round(Math.min(frame.bottom, window.innerHeight) - head.top)}px`;
        };

        const end = (commit: boolean) => {
          if (!drag) return;
          const d = drag;
          drag = null;
          d.line?.remove();
          d.th.removeAttribute("data-state");
          ctx.root.removeAttribute("data-dg-dragging");
          if (d.th.hasPointerCapture?.(d.id)) d.th.releasePointerCapture(d.id);
          if (!commit || !d.on) return;
          // a drag is not a click: swallow the sort click that follows pointerup
          const swallow = (e: Event) => {
            e.stopPropagation();
            e.preventDefault();
          };
          table.addEventListener("click", swallow, { capture: true, once: true });
          setTimeout(() => table.removeEventListener("click", swallow, { capture: true }), 0);
          // map the gap among visible movable columns to an index among all movable ones
          const vis = targets().map((t) => t.key);
          const all = movable().map((c) => c.key);
          const from = vis.indexOf(d.key);
          let gap = d.to;
          if (gap > from) gap--;
          if (gap === from) return;
          const rest = vis.filter((k) => k !== d.key);
          const others = all.filter((k) => k !== d.key);
          const anchor = rest[gap];
          const to = anchor === undefined ? others.indexOf(rest[rest.length - 1]!) + 1 : others.indexOf(anchor);
          move(d.key, to);
        };

        const onDown = (e: PointerEvent) => {
          if (e.button !== 0 || drag) return;
          const th = (e.target as Element).closest<HTMLTableCellElement>("th[data-dg-movable]");
          if (!th || th.closest("table") !== table) return;
          // touch starts only from the grip, so the header can still scroll the table sideways
          if (e.pointerType === "touch" && !(e.target as Element).closest(".dg-col-grip")) return;
          if ((e.target as Element).closest(".dg-colfilter")) return;
          drag = { key: th.getAttribute("data-key")!, th, x: e.clientX, y: e.clientY, id: e.pointerId, on: false, to: 0, line: null };
        };
        const onMove = (e: PointerEvent) => {
          if (!drag || e.pointerId !== drag.id) return;
          if (!drag.on) {
            if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
            drag.on = true;
            drag.th.setPointerCapture?.(drag.id);
            drag.th.setAttribute("data-state", "dragging");
            ctx.root.setAttribute("data-dg-dragging", "");
            drag.line = h("div", { class: "dg-col-drop", "aria-hidden": "true" });
            ctx.layer(drag.line);
          }
          e.preventDefault();
          place(e.clientX);
        };
        const onUp = (e: PointerEvent) => drag && e.pointerId === drag.id && end(true);
        const onCancel = () => end(false);
        const onKey = (e: KeyboardEvent) => {
          if (e.key === "Escape" && drag?.on) {
            e.preventDefault();
            e.stopPropagation();
            end(false);
          }
        };
        const sig = { signal: ctx.signal };
        table.addEventListener("pointerdown", onDown, sig);
        table.addEventListener("pointermove", onMove, sig);
        table.addEventListener("pointerup", onUp, sig);
        table.addEventListener("pointercancel", onCancel, sig);
        document.addEventListener("keydown", onKey, { capture: true, signal: ctx.signal });
      }

      return {
        api,
        destroy() {
          for (const g of Array.from(table.querySelectorAll(":scope > thead .dg-col-grip"))) g.remove();
          for (const th of Array.from(table.querySelectorAll(":scope > thead th[data-dg-movable]"))) th.removeAttribute("data-dg-movable");
        },
      };
    },
  });
}

// stable name for grid.module(colReorder) after minification
colReorder.moduleName = "colReorder";
