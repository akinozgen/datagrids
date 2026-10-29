// Toolbar buttons: `button.reload()`, `button.resetState()`, `button.custom()`, `button.group()`.
import type { ModuleDef } from "../core/types";
import { icons } from "../dom/icons";
import { createPanel, rovingKeys, toolbarButton } from "../dom/popover";
import { setTip } from "../core/util";

export interface ButtonMessages {
  reload: string;
  resetState: string;
  resetStateTitle: string;
}

const tr: ButtonMessages = { reload: "Yenile", resetState: "Sıfırla", resetStateTitle: "Görünümü varsayılana döndür" };
const en: ButtonMessages = { reload: "Reload", resetState: "Reset", resetStateTitle: "Reset the view to its defaults" };

export interface ButtonOptions {
  /** visible text / accessible name */
  label?: string;
  messages?: Partial<ButtonMessages>;
  slot?: "start" | "end";
  order?: number;
  /** permission flag */
  can?: boolean;
}

export interface ReloadButtonOptions extends ButtonOptions {
  /** reload without the busy card (default false) */
  silent?: boolean;
}

const pick = (locale: string, o: ButtonOptions): ButtonMessages => ({ ...(locale.startsWith("tr") ? tr : en), ...o.messages });

/** Icon-only reload button; the icon spins while the grid loads. */
export function reload(opts: ReloadButtonOptions = {}): ModuleDef<"reloadButton", { el: HTMLButtonElement }> {
  return Object.freeze<ModuleDef<"reloadButton", { el: HTMLButtonElement }>>({
    name: "reloadButton" as const,
    kind: "toolbar" as const,
    can: opts.can,
    setup(ctx) {
      const label = opts.label ?? pick(ctx.locale, opts).reload;
      const btn = toolbarButton({ label, icon: icons.refresh, iconOnly: true });
      const icon = btn.querySelector("svg")!;
      btn.addEventListener("click", () => void ctx.grid.reload({ keepPage: true, silent: opts.silent }));
      const off = ctx.on("loadingchange", ({ loading }) => {
        icon.classList.toggle("dg-spin", loading);
        if (loading) btn.setAttribute("data-loading", "");
        else btn.removeAttribute("data-loading");
      });
      ctx.toolbar({ slot: opts.slot ?? "start", order: opts.order ?? 20, el: btn });
      return {
        api: { el: btn },
        destroy() {
          off();
          btn.remove();
        },
      };
    },
  });
}
reload.moduleName = "reloadButton";

// counter-clockwise arrow (refresh mirrored): "back to default"
const resetIcon =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8a5 5 0 1 0 1.46-3.54"/><path d="M3 3v2.5h2.5"/></svg>';

/** Clears the stored state and restores the initial view (`requires: ["state"]`). */
export function resetState(opts: ButtonOptions = {}): ModuleDef<"resetStateButton", { el: HTMLButtonElement }> {
  return Object.freeze<ModuleDef<"resetStateButton", { el: HTMLButtonElement }>>({
    name: "resetStateButton" as const,
    kind: "toolbar" as const,
    requires: ["state"],
    can: opts.can,
    setup(ctx) {
      const m = pick(ctx.locale, opts);
      const label = opts.label ?? m.resetState;
      const btn = toolbarButton({ label, icon: resetIcon });
      // the text is hidden on narrow roots: keep name + tooltip on the button itself
      btn.setAttribute("aria-label", label);
      setTip(btn, m.resetStateTitle, true);
      btn.addEventListener("click", () => {
        const state = (ctx.grid as unknown as { state?: { reset(): Promise<void> } }).state;
        void state?.reset();
      });
      ctx.toolbar({ slot: opts.slot ?? "start", order: opts.order ?? 30, el: btn });
      return {
        api: { el: btn },
        destroy() {
          btn.remove();
        },
      };
    },
  });
}
resetState.moduleName = "resetStateButton";

let customSeq = 0;

export interface CustomButtonOptions {
  /** module name / API namespace (unique per grid); default `button<N>` */
  name?: string;
  label: string;
  icon?: keyof typeof icons;
  iconOnly?: boolean;
  variant?: "primary" | "ghost";
  slot?: "start" | "end";
  order?: number;
  can?: boolean;
  onClick: (grid: import("../core/types").DatagridApi) => unknown;
  /** state derived from the last response (`json.hasInsufficientBalanceLogs` style); re-evaluated after each load */
  disabled?: (raw: unknown) => boolean;
}

/** A custom toolbar button (DataTables `buttons: [{ text, action }]`). */
export function custom(opts: CustomButtonOptions): ModuleDef<string, { el: HTMLButtonElement }> {
  const name = opts.name ?? `button${++customSeq}`;
  return Object.freeze<ModuleDef<string, { el: HTMLButtonElement }>>({
    name,
    kind: "toolbar" as const,
    can: opts.can,
    setup(ctx) {
      const btn = toolbarButton({ label: opts.label, icon: opts.icon ? icons[opts.icon] : undefined, iconOnly: opts.iconOnly, variant: opts.variant });
      btn.addEventListener("click", async () => {
        // a running handler is not started twice by a double click
        if (btn.getAttribute("aria-disabled") === "true" || btn.getAttribute("aria-busy") === "true") return;
        btn.setAttribute("aria-busy", "true");
        try {
          await opts.onClick(ctx.grid);
        } finally {
          btn.removeAttribute("aria-busy");
        }
      });
      const sync = () => {
        const raw = ctx.grid.lastResponse();
        // no response yet (setup, client sources): the handler is not asked about `null`
        if (!opts.disabled || raw == null) return;
        btn.disabled = !!opts.disabled(raw);
      };
      const offLoad = ctx.on("load", sync);
      sync();
      ctx.toolbar({ slot: opts.slot ?? "start", order: opts.order ?? 50, el: btn });
      return {
        api: { el: btn },
        destroy() {
          offLoad();
          btn.remove();
        },
      };
    },
  });
}

export interface GroupButtonOptions {
  name?: string;
  label: string;
  icon?: keyof typeof icons;
  slot?: "start" | "end";
  order?: number;
  can?: boolean;
  items: Array<{ id: string; label: string; icon?: keyof typeof icons; can?: boolean; onClick: (grid: import("../core/types").DatagridApi) => unknown }>;
}

/** A dropdown of actions in the toolbar (DataTables `collection`). */
export function group(opts: GroupButtonOptions): ModuleDef<string, { el: HTMLButtonElement }> {
  const name = opts.name ?? `buttonGroup${++customSeq}`;
  return Object.freeze<ModuleDef<string, { el: HTMLButtonElement }>>({
    name,
    kind: "toolbar" as const,
    can: opts.can,
    setup(ctx) {
      const btn = toolbarButton({ label: opts.label, icon: opts.icon ? icons[opts.icon] : undefined, caret: true });
      btn.setAttribute("aria-haspopup", "menu");
      const panel = createPanel(ctx.root, { role: "menu", "aria-label": opts.label });
      for (const it of opts.items) {
        if (it.can === false) continue;
        const item = document.createElement("button");
        item.type = "button";
        item.className = "dg-panel-item";
        item.setAttribute("role", "menuitem");
        item.tabIndex = -1;
        if (it.icon) item.insertAdjacentHTML("beforeend", icons[it.icon]);
        else item.append(Object.assign(document.createElement("span"), { className: "dg-slot-icon" }));
        item.append(Object.assign(document.createElement("span"), { className: "dg-panel-item-label", textContent: it.label }));
        item.addEventListener("click", () => {
          panel.hide(true);
          void it.onClick(ctx.grid);
        });
        panel.el.append(item);
      }
      rovingKeys(panel.el, "[role=menuitem]");
      const open = (focusLast = false) => {
        panel.show(btn);
        const items = Array.from(panel.el.querySelectorAll<HTMLElement>("[role=menuitem]"));
        (focusLast ? items[items.length - 1] : items[0])?.focus();
      };
      btn.addEventListener("click", () => (panel.open ? panel.hide(true) : open()));
      btn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          open(e.key === "ArrowUp");
        }
      });
      panel.el.addEventListener("keydown", (e) => {
        // focus goes back to the trigger first, so Tab continues from there
        if (e.key === "Tab") panel.hide(true);
      });
      ctx.toolbar({ slot: opts.slot ?? "start", order: opts.order ?? 60, el: btn });
      return {
        api: { el: btn },
        destroy() {
          panel.destroy();
          btn.remove();
        },
      };
    },
  });
}
