// Tooltips of the grid's own controls (`data-dg-tip`), one element per grid in the top layer.
// No `title`: a page-wide [title] tooltip plugin would take the controls over and leave orphans
// behind when the grid re-renders or disables the control under the pointer.
import { h } from "../core/util";

const supportsPopover = typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;
const DELAY = 500;

// jsdom and old engines may not know a pseudo-class
const is = (el: Element, sel: string) => {
  try {
    return el.matches(sel);
  } catch {
    return false;
  }
};

export function installTips(root: HTMLElement, signal: AbortSignal): void {
  const el = h("div", { class: "dg-tip", "aria-hidden": "true" });
  if (supportsPopover) el.setAttribute("popover", "manual");
  else el.hidden = true;
  root.append(el);
  let owner: HTMLElement | null = null;
  let pending: HTMLElement | null = null;
  let timer = 0;
  let watch = 0;

  const target = (e: Event) => {
    const t = (e.target as Element | null)?.closest?.<HTMLElement>("[data-dg-tip]");
    return t && root.contains(t) && t !== el ? t : null;
  };

  const hide = () => {
    clearTimeout(timer);
    clearInterval(watch);
    pending = null;
    if (!owner) return;
    owner = null;
    if (!supportsPopover) el.hidden = true;
    else if (el.matches(":popover-open")) el.hidePopover();
  };

  const place = (t: HTMLElement) => {
    const r = t.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const gap = 6;
    const w = el.offsetWidth;
    const ht = el.offsetHeight;
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, vw - w - 8));
    const top = r.top - gap - ht >= 8 ? r.top - gap - ht : r.bottom + gap;
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  };

  const show = (t: HTMLElement) => {
    const text = t.getAttribute("data-dg-tip");
    if (!text || !t.isConnected) return;
    hide();
    owner = t;
    el.textContent = text;
    if (supportsPopover) el.showPopover();
    else el.hidden = false;
    place(t);
    // the control can vanish or turn disabled under a still pointer: no pointerout comes then
    watch = window.setInterval(() => {
      if (!t.isConnected || (!is(t, ":hover") && document.activeElement !== t)) hide();
    }, 250);
  };

  const opts = { signal };
  root.addEventListener("pointerover", (e) => {
    if (e.pointerType === "touch") return;
    const t = target(e);
    if (!t || t === owner || t === pending) return;
    if (owner) return show(t); // already showing one: move without the delay
    clearTimeout(timer);
    pending = t;
    timer = window.setTimeout(() => {
      pending = null;
      if (is(t, ":hover")) show(t);
    }, DELAY);
  }, opts);
  root.addEventListener("pointerout", (e) => {
    const t = owner ?? pending;
    if (t && !(e.relatedTarget instanceof Node && t.contains(e.relatedTarget))) hide();
  }, opts);
  root.addEventListener("focusin", (e) => {
    const t = target(e);
    if (t && is(t, ":focus-visible")) show(t);
  }, opts);
  root.addEventListener("focusout", (e) => {
    if (e.target === owner) hide();
  }, opts);
  root.addEventListener("pointerdown", hide, { ...opts, capture: true });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && owner) hide();
  }, opts);
  // a shown tip would detach from its control; a pending one checks :hover when it fires
  window.addEventListener("scroll", () => owner && hide(), { ...opts, capture: true, passive: true });
  signal.addEventListener("abort", hide);
}
