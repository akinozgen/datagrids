// Top-layer panels (column menu, export menu, action menu, filter panel, notes).
// Popover API first; panels stay children of the grid root so token inheritance holds.
import { h } from "../core/util";

export interface PanelOptions {
  /** align the panel's inline-start (default) or inline-end with the trigger */
  align?: "start" | "end";
  /** called after the panel closed (focus already returned to the trigger) */
  onClose?: () => void;
  /** do not return focus to the trigger on close */
  noFocusReturn?: boolean;
}

export interface Panel {
  readonly el: HTMLElement;
  readonly open: boolean;
  show(trigger: HTMLElement, o?: PanelOptions): void;
  hide(returnFocus?: boolean): void;
  toggle(trigger: HTMLElement, o?: PanelOptions): void;
  reposition(): void;
  destroy(): void;
}

const supportsPopover = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;
let openPanels: Panel[] = [];

/** Creates a panel element mounted into `host` (normally the grid root). */
export function createPanel(host: HTMLElement, attrs: Record<string, string> = {}): Panel {
  const el = h("div", { class: "dg-panel", ...attrs });
  if (supportsPopover) el.setAttribute("popover", "manual");
  else el.hidden = true;
  host.append(el);
  let trigger: HTMLElement | null = null;
  let opts: PanelOptions = {};
  let isOpen = false;
  const ac = new AbortController();

  const position = () => {
    if (!trigger || !isOpen) return;
    const r = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const pw = el.offsetWidth;
    const ph = el.offsetHeight;
    const gap = 6;
    const rtl = getComputedStyle(trigger).direction === "rtl";
    const alignEnd = (opts.align === "end") !== rtl;
    let left = alignEnd ? r.right - pw : r.left;
    left = Math.max(8, Math.min(left, vw - pw - 8));
    let top = r.bottom + gap;
    let placement = "bottom";
    if (top + ph > vh - 8 && r.top - gap - ph >= 8) {
      top = r.top - gap - ph;
      placement = "top";
    }
    el.style.position = "fixed";
    el.style.margin = "0";
    el.style.insetInlineStart = "auto";
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(Math.max(8, top))}px`;
    el.setAttribute("data-placement", placement);
  };

  const onDoc = (e: Event) => {
    if (!isOpen) return;
    const t = e.target as Node;
    if (el.contains(t) || trigger?.contains(t)) return;
    api.hide(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (isOpen && e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      api.hide(true);
    }
  };
  document.addEventListener("pointerdown", onDoc, { capture: true, signal: ac.signal });
  el.addEventListener("keydown", onKey, { signal: ac.signal });
  window.addEventListener("resize", position, { signal: ac.signal });
  window.addEventListener("scroll", () => isOpen && position(), { capture: true, passive: true, signal: ac.signal });

  const api: Panel = {
    el,
    get open() {
      return isOpen;
    },
    show(t, o = {}) {
      for (const p of openPanels) if (p !== api) p.hide(false);
      // re-anchored while open: the previous trigger is no longer expanded
      if (isOpen && trigger && trigger !== t) trigger.setAttribute("aria-expanded", "false");
      trigger = t;
      opts = o;
      isOpen = true;
      openPanels.push(api);
      el.setAttribute("data-state", "open");
      if (supportsPopover) {
        try {
          (el as HTMLElement & { showPopover(): void }).showPopover();
        } catch {
          /* already open */
        }
      } else el.hidden = false;
      t.setAttribute("aria-expanded", "true");
      position();
      requestAnimationFrame(position);
    },
    hide(returnFocus = true) {
      if (!isOpen) return;
      isOpen = false;
      openPanels = openPanels.filter((p) => p !== api);
      el.setAttribute("data-state", "closed");
      if (supportsPopover) {
        try {
          (el as HTMLElement & { hidePopover(): void }).hidePopover();
        } catch {
          /* already closed */
        }
      } else el.hidden = true;
      trigger?.setAttribute("aria-expanded", "false");
      if (returnFocus && !opts.noFocusReturn) trigger?.focus();
      opts.onClose?.();
    },
    toggle(t, o) {
      if (isOpen && trigger === t) api.hide(true);
      else api.show(t, o);
    },
    reposition: position,
    destroy() {
      api.hide(false);
      ac.abort();
      el.remove();
    },
  };
  return api;
}

/** Toolbar button: `.dg-btn` with optional icon, text and caret. */
export function toolbarButton(o: {
  label: string;
  icon?: string;
  caret?: boolean;
  iconOnly?: boolean;
  badge?: string;
  variant?: "primary" | "ghost";
}): HTMLButtonElement {
  const b = h("button", {
    type: "button",
    class: "dg-btn",
    "data-variant": o.variant ?? null,
    "data-icon-only": o.iconOnly ?? false,
    "aria-label": o.iconOnly ? o.label : null,
    title: o.iconOnly ? o.label : null,
  });
  if (o.icon) b.insertAdjacentHTML("beforeend", o.icon);
  if (!o.iconOnly) b.append(h("span", { class: "dg-btn-text" }, o.label));
  if (o.badge !== undefined) b.append(h("span", { class: "dg-btn-badge" }, o.badge));
  if (o.caret) {
    b.setAttribute("aria-expanded", "false");
    b.insertAdjacentHTML(
      "beforeend",
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" class="dg-btn-caret"><path d="m4.5 6.5 3.5 3.5 3.5-3.5"/></svg>',
    );
  }
  return b;
}

/** Arrow-key navigation inside a panel (menu items / checkboxes). */
export function rovingKeys(panel: HTMLElement, selector: string): void {
  panel.addEventListener("keydown", (e) => {
    const items = Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter((x) => !x.hidden);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let n = -1;
    if (e.key === "ArrowDown") n = (i + 1) % items.length;
    else if (e.key === "ArrowUp") n = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = items.length - 1;
    if (n >= 0) {
      e.preventDefault();
      items[n]!.focus();
    }
  });
}
