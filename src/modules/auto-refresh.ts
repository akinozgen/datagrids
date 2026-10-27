// Periodic silent reload that keeps the page. Skips while the tab is hidden, a load is running, a panel or
// dialog is open, or the user is typing in the grid; a hidden tab catches up once it is visible again.
import type { ModuleDef } from "../core/types";
import { frag, h } from "../core/util";
import { icons } from "../dom/icons";

export interface AutoRefreshMessages {
  label: (seconds: number) => string;
}
const tr: AutoRefreshMessages = { label: (s) => `Otomatik yenile (${s} sn)` };
const en: AutoRefreshMessages = { label: (s) => `Auto refresh (${s}s)` };

export interface AutoRefreshOptions {
  /** interval in ms (default 30 000, minimum 5 000) */
  every?: number;
  /** starts running (default true) */
  initial?: boolean;
  /** toolbar toggle with a permanent on/off box (default true) */
  toggle?: boolean;
  slot?: "start" | "end";
  order?: number;
  messages?: Partial<AutoRefreshMessages>;
  /** permission flag */
  can?: boolean;
}

export interface AutoRefreshApi {
  running(): boolean;
  start(): void;
  stop(): void;
  /** reload now (same rules as a tick) and restart the countdown */
  tick(): void;
}

export function autoRefresh(opts: AutoRefreshOptions = {}): ModuleDef<"autoRefresh", AutoRefreshApi> {
  return Object.freeze<ModuleDef<"autoRefresh", AutoRefreshApi>>({
    name: "autoRefresh" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid, root } = ctx;
      const m: AutoRefreshMessages = { ...(ctx.locale.startsWith("tr") ? tr : en), ...opts.messages };
      const every = Math.max(5_000, opts.every ?? 30_000);
      let on = opts.initial !== false;
      let timer: ReturnType<typeof setInterval> | undefined;
      let overdue = false;

      const typing = () => {
        const a = document.activeElement as HTMLElement | null;
        return !!a && root.contains(a) && a.matches("input:not([type=checkbox]):not([type=radio]), textarea, select");
      };
      const layerOpen = () => {
        try {
          return !!root.querySelector(":popover-open, dialog[open]");
        } catch {
          return !!root.querySelector("dialog[open]");
        }
      };
      const busy = () => {
        const st = grid.status();
        // a manual / not-yet-visible grid is not refreshed into existence; neither is a drag or a save
        return !st.loaded || st.status === "loading" || st.status === "reloading" || root.hasAttribute("data-dg-dragging") || !!root.querySelector("tr[data-state=dragging], tbody > tr[aria-busy=true]") || layerOpen() || typing();
      };

      const run = () => {
        if (!on) return;
        if (document.hidden) {
          overdue = true;
          return;
        }
        if (busy()) return;
        overdue = false;
        void grid.reload({ keepPage: true, silent: true });
      };
      const arm = () => {
        clearInterval(timer);
        timer = on ? setInterval(run, every) : undefined;
      };

      let btn: HTMLButtonElement | null = null;
      if (opts.toggle !== false) {
        const box = h("span", { class: "dg-check-box" });
        box.append(frag(icons.check));
        btn = h("button", { type: "button", class: "dg-btn", "aria-pressed": String(on) }, h("span", { class: "dg-check", "aria-hidden": "true" }, box), m.label(Math.round(every / 1000))) as HTMLButtonElement;
        btn.addEventListener("click", () => (on ? api.stop() : api.start()));
        ctx.toolbar({ slot: opts.slot ?? "end", order: opts.order ?? -20, el: btn });
      }

      // a dead session will not come back by retrying
      ctx.on("sessionexpired", () => api.stop());
      document.addEventListener("visibilitychange", () => !document.hidden && overdue && run(), { signal: ctx.signal });

      const api: AutoRefreshApi = {
        running: () => on,
        start() {
          on = true;
          btn?.setAttribute("aria-pressed", "true");
          arm();
        },
        stop() {
          on = false;
          overdue = false;
          btn?.setAttribute("aria-pressed", "false");
          arm();
        },
        tick() {
          run();
          arm();
        },
      };
      ctx.ready(arm);

      return {
        api,
        destroy() {
          clearInterval(timer);
          btn?.remove();
        },
      };
    },
  });
}

// stable name for grid.module(autoRefresh) after minification
autoRefresh.moduleName = "autoRefresh";
