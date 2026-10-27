// Page-level sticky header for tables inside a horizontal scroll frame (CSS sticky cannot escape it):
// a cloned, aria-hidden header bar follows the page and the frame's horizontal scroll. Clicks are forwarded
// to the real header; keyboard users keep using the real one.
import type { ModuleDef } from "../core/types";
import { h } from "../core/util";

export interface StickyHeaderOptions {
  /** distance from the viewport top (a fixed app bar): px or a function read on every frame (default 0) */
  offset?: number | (() => number);
  /** permission flag */
  can?: boolean;
}

export interface StickyHeaderApi {
  /** is the cloned header showing */
  stuck(): boolean;
  /** re-clone and re-measure (after a host layout change) */
  refresh(): void;
}

export function stickyHeader(opts: StickyHeaderOptions = {}): ModuleDef<"stickyHeader", StickyHeaderApi> {
  return Object.freeze<ModuleDef<"stickyHeader", StickyHeaderApi>>({
    name: "stickyHeader" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { table, root } = ctx;
      const scroller = table.closest<HTMLElement>(".dg-scroll") ?? table.parentElement!;
      const offset = () => (typeof opts.offset === "function" ? opts.offset() : opts.offset ?? 0);
      const inner = h("div", { class: "dg-sticky-inner" });
      const bar = h("div", { class: "dg-sticky-bar", "aria-hidden": "true" }, inner);
      bar.hidden = true;
      ctx.layer(bar);
      let on = false;

      const build = () => {
        const head = table.tHead;
        if (!head) return;
        const t = document.createElement("table");
        t.className = table.className;
        t.setAttribute("role", "presentation");
        const copy = head.cloneNode(true) as HTMLTableSectionElement;
        for (const el of Array.from(copy.querySelectorAll("[id]"))) el.removeAttribute("id");
        for (const el of Array.from(copy.querySelectorAll<HTMLElement>("button, input, a, [tabindex]"))) el.tabIndex = -1;
        const real = Array.from(head.rows[0]?.cells ?? []);
        Array.from(copy.rows[0]?.cells ?? []).forEach((th, i) => {
          const w = real[i]?.getBoundingClientRect().width ?? 0;
          // the clone's widths copy the measured header (inline width only on this throwaway copy)
          th.style.inlineSize = th.style.minInlineSize = th.style.maxInlineSize = `${w}px`;
        });
        t.style.tableLayout = "fixed";
        t.style.inlineSize = `${table.getBoundingClientRect().width}px`;
        t.append(copy);
        inner.replaceChildren(t);
      };

      const place = () => {
        const head = table.tHead;
        if (!head || !root.isConnected) return;
        const top = offset();
        const r = table.getBoundingClientRect();
        const hh = head.getBoundingClientRect().height;
        const want = !root.hasAttribute("data-dg-sticky-head") && r.top < top && r.bottom - hh * 2 > top;
        if (want !== on) {
          on = want;
          bar.hidden = !on;
          root.toggleAttribute("data-dg-header-stuck", on);
          if (on) build();
        }
        if (!on) return;
        const f = scroller.getBoundingClientRect();
        bar.style.insetBlockStart = `${top}px`;
        bar.style.left = `${f.left + scroller.clientLeft}px`;
        bar.style.width = `${scroller.clientWidth}px`;
        inner.scrollLeft = scroller.scrollLeft;
      };

      let raf = 0;
      const schedule = () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          place();
        });
      };
      const rebuild = () => {
        if (on) build();
        schedule();
      };

      const sig = { signal: ctx.signal, passive: true } as AddEventListenerOptions;
      // any scroller on the way (an app shell with its own scrolling main) moves the header too
      document.addEventListener("scroll", schedule, { ...sig, capture: true });
      window.addEventListener("resize", rebuild, sig);
      scroller.addEventListener("scroll", () => (inner.scrollLeft = scroller.scrollLeft), sig);
      const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(rebuild) : null;
      ro?.observe(table);
      for (const ev of ["headrender", "sort", "columnchange", "render"]) ctx.on(ev as never, rebuild as never);

      // forward pointer clicks to the real header control
      bar.addEventListener(
        "click",
        (e) => {
          const t = e.target as Element;
          const th = t.closest("th");
          const key = th?.getAttribute("data-key");
          const real = key ? table.tHead?.querySelector<HTMLElement>(`th[data-key="${CSS.escape(key)}"]`) : null;
          if (!real) return;
          e.preventDefault();
          // the same control by position: the clone is a deep copy of the real header cell
          const CONTROLS = "button, input, a[href]";
          const hit = t.closest<HTMLElement>(CONTROLS);
          if (!hit || !th!.contains(hit)) return;
          const index = Array.from(th!.querySelectorAll(CONTROLS)).indexOf(hit);
          const target = real.querySelectorAll<HTMLElement>(CONTROLS)[index];
          if (!target) return;
          // panels anchor to the real control: bring it into view first (sorting needs no scroll)
          if (!target.matches(".dg-sort")) real.scrollIntoView({ block: "nearest" });
          // keep the modifiers (Shift+click adds a sort key with multiSort)
          const me = e as MouseEvent;
          target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, shiftKey: me.shiftKey, ctrlKey: me.ctrlKey, metaKey: me.metaKey, altKey: me.altKey }));
          rebuild();
        },
        { signal: ctx.signal },
      );

      return {
        api: { stuck: () => on, refresh: rebuild },
        destroy() {
          cancelAnimationFrame(raf);
          ro?.disconnect();
          bar.remove();
          root.removeAttribute("data-dg-header-stuck");
        },
      };
    },
  });
}

// stable name for grid.module(stickyHeader) after minification
stickyHeader.moduleName = "stickyHeader";
