// "Show deleted" toggle (`?deleted=1` → `_deleted = 1` request param).
import type { DatagridApi, ModuleDef, Row } from "../core/types";
import { frag, getPath, h } from "../core/util";
import { icons } from "../dom/icons";

export interface SoftDeletesMessages {
  label: string;
}
const tr: SoftDeletesMessages = { label: "Silinenleri göster" };
const en: SoftDeletesMessages = { label: "Show deleted" };

export interface SoftDeletesOptions {
  /** request parameter sent while on (default "_deleted") */
  param?: string;
  /** its value (default 1) */
  value?: unknown;
  /** row field marking a deleted row (default: `deleted` or `deleted_at`) */
  field?: string;
  /** visible text / accessible name */
  label?: string;
  /** start switched on (e.g. from `request('deleted')`) */
  initial?: boolean;
  messages?: Partial<SoftDeletesMessages>;
  slot?: "start" | "end";
  order?: number;
  /** permission flag */
  can?: boolean;
}

export interface SoftDeletesApi {
  /** true while deleted rows are shown */
  active(): boolean;
  /** switches (or sets) the mode and reloads */
  toggle(on?: boolean): void;
}

const isServer = (grid: DatagridApi) => (grid as unknown as { source?: { mode?: string } }).source?.mode === "server";

export function softDeletes(opts: SoftDeletesOptions = {}): ModuleDef<"softDeletes", SoftDeletesApi> {
  return Object.freeze<ModuleDef<"softDeletes", SoftDeletesApi>>({
    name: "softDeletes" as const,
    kind: "toolbar" as const,
    can: opts.can,
    setup(ctx) {
      const { grid } = ctx;
      const m = { ...(ctx.locale.startsWith("tr") ? tr : en), ...opts.messages };
      const label = opts.label ?? m.label;
      const param = opts.param ?? "_deleted";
      const deleted = (r: Row) => !!(opts.field ? getPath(r, opts.field) : r.deleted || r.deleted_at);
      let on = !!opts.initial;

      // a real toggle button; the box is the permanent on/off indicator.
      // The label is a bare text node: `.dg-btn-text` hides on narrow roots and a lone box means nothing
      const box = h("span", { class: "dg-check-box" });
      box.append(frag(icons.check));
      const btn = h("button", { type: "button", class: "dg-btn", "aria-pressed": String(on) }, h("span", { class: "dg-check", "aria-hidden": "true" }, box), label);
      ctx.toolbar({ slot: opts.slot ?? "end", order: opts.order ?? -10, el: btn });

      ctx.request((req, next) => {
        if (on) req.params[param] = opts.value ?? 1;
        return next(req);
      });
      // rows we muted (host rows of a DOM table too, on any page): destroy takes the tone back off
      const muted = new Set<HTMLTableRowElement>();
      ctx.row((tr, row) => {
        if (deleted(row)) {
          if (!tr.hasAttribute("data-tone")) muted.add(tr);
          tr.setAttribute("data-tone", "muted");
        } else if (muted.delete(tr)) tr.removeAttribute("data-tone");
      });
      // client mode: a predicate in the core filter state (functions never reach the wire)
      const filter = () => grid.filters({ [param]: on ? null : (_v: unknown, r: Row) => !deleted(r) });
      ctx.ready(() => !isServer(grid) && filter());

      const toggle = (v = !on) => {
        if (v === on) return;
        on = v;
        btn.setAttribute("aria-pressed", String(on));
        if (isServer(grid)) void grid.reload();
        else filter();
      };
      btn.addEventListener("click", () => toggle());

      return {
        api: { active: () => on, toggle },
        destroy() {
          btn.remove();
          for (const tr of muted) if (tr.getAttribute("data-tone") === "muted") tr.removeAttribute("data-tone");
          muted.clear();
        },
      };
    },
  });
}
softDeletes.moduleName = "softDeletes";
