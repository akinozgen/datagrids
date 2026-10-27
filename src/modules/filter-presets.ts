// Named filter presets: a chip group in the toolbar that applies a set of filter values in one load.
import { notice } from "../core/warn";
import type { ModuleDef } from "../core/types";
import { config } from "../core/config";
import { h, nextId } from "../core/util";

export interface FilterPreset {
  id: string;
  label: string;
  /** filter key → value. Panel target: raw control values (string, string[], boolean for checkboxes); grid target: `grid.filters()` values */
  values: Record<string, unknown>;
  /** applied at init when nothing else (URL, saved state) set the filters */
  default?: boolean;
}

export interface FilterPresetsMessages {
  /** group name (visible label and accessible name) */
  label: string;
  applied: (label: string) => string;
}
const tr: FilterPresetsMessages = { label: "Hazır filtreler", applied: (l) => `Hazır filtre uygulandı: ${l}` };
const en: FilterPresetsMessages = { label: "Presets", applied: (l) => `Preset applied: ${l}` };

export interface FilterPresetsOptions {
  presets: FilterPreset[];
  /** "panel": through `filterPanel` (controls follow); "grid": `grid.filters()`. Default: panel when attached */
  target?: "panel" | "grid";
  /** visible group label; false hides it (the group keeps its accessible name) */
  label?: string | false;
  messages?: Partial<FilterPresetsMessages>;
  slot?: "start" | "end" | "filters";
  order?: number;
  /** permission flag */
  can?: boolean;
}

export interface FilterPresetsApi {
  /** id of the preset the current filters match (null: none) */
  active(): string | null;
  /** applies a preset; one load unless `{ reload: false }` */
  apply(id: string, o?: { reload?: boolean }): void;
}

type Panel = {
  raw(): Record<string, unknown>;
  set(p: Record<string, unknown>, o?: { reload?: boolean }): void;
};

const isOff = (l: string[]) => !l.length || (l.length === 1 && (l[0] === "0" || l[0] === "false"));

/** Normalized comparable form: empty → [], arrays sorted, objects as JSON. */
function list(v: unknown): string[] {
  if (v == null || v === false || v === "") return [];
  if (Array.isArray(v)) return v.filter((x) => x != null && x !== "").map(String).sort();
  if (typeof v === "object") return [JSON.stringify(v)];
  return [String(v)];
}

/**
 * Does a current filter value satisfy a preset value? Exported for tests.
 * `true` = any "on" value (checked checkbox); null/false/"" = empty (an unchecked checkbox's "0" included).
 */
export function presetMatches(cur: unknown, want: unknown): boolean {
  if (typeof want === "function") return cur === want;
  const c = list(cur);
  if (want === true) return !isOff(c);
  const w = list(want);
  if (!w.length) return isOff(c);
  return c.length === w.length && c.every((x, i) => x === w[i]);
}

export function filterPresets(opts: FilterPresetsOptions): ModuleDef<"filterPresets", FilterPresetsApi> {
  return Object.freeze<ModuleDef<"filterPresets", FilterPresetsApi>>({
    name: "filterPresets" as const,
    kind: "toolbar" as const,
    can: opts.can,
    setup(ctx) {
      const { grid } = ctx;
      const m = { ...(ctx.locale.startsWith("tr") ? tr : en), ...opts.messages };
      const presets = opts.presets;
      // every key a preset manages: applying one clears the keys the others set
      const keys = Array.from(new Set(presets.flatMap((p) => Object.keys(p.values))));
      const byId = new Map(presets.map((p) => [p.id, p]));
      const def = presets.find((p) => p.default) ?? null;

      const panel = () => (grid as unknown as { filterPanel?: Panel }).filterPanel;
      let warned = false;
      const usePanel = () => {
        const p = panel();
        if (opts.target === "panel" && !p && !warned && config.warnings !== false) {
          warned = true;
          notice("filterPresets", "target \"panel\" needs the filterPanel module; using grid.filters().");
        }
        return opts.target !== "grid" && !!p;
      };
      const current = (): Record<string, unknown> => (usePanel() ? panel()!.raw() : grid.filters());
      const match = (): string | null => {
        const cur = current();
        return presets.find((p) => keys.every((k) => presetMatches(cur[k], p.values[k] ?? null)))?.id ?? null;
      };

      /* ---------- UI: chips with a permanent radio dot, aria-pressed ---------- */
      const labelId = nextId("dg-presets");
      const group = h("div", { class: "dg-presets", role: "group", "aria-labelledby": labelId });
      const caption = h("span", { class: "dg-presets-label", id: labelId }, opts.label === false ? m.label : opts.label ?? m.label);
      if (opts.label === false) caption.classList.add("dg-offscreen");
      group.append(caption);
      const chips = new Map<string, HTMLButtonElement>();
      for (const p of presets) {
        const b = h("button", { type: "button", class: "dg-btn dg-preset", "aria-pressed": "false", "data-preset": p.id },
          h("span", { class: "dg-preset-dot", "aria-hidden": "true" }), p.label);
        b.addEventListener("click", () => apply(p.id));
        chips.set(p.id, b);
        group.append(b);
      }
      ctx.toolbar({ slot: opts.slot ?? "filters", order: opts.order ?? -20, el: group });

      let active: string | null = def?.id ?? null;
      let touched = false;
      const paint = () => {
        for (const [id, b] of chips) b.setAttribute("aria-pressed", String(id === active));
        group.toggleAttribute("data-active", active != null);
      };
      const sync = () => {
        active = match();
        paint();
      };

      const apply = (id: string, o: { reload?: boolean } = {}) => {
        const p = byId.get(id);
        if (!p) {
          notice("filterPresets", `unknown preset "${id}".`);
          return;
        }
        touched = true;
        const patch: Record<string, unknown> = {};
        for (const k of keys) patch[k] = k in p.values ? p.values[k] : null;
        active = id;
        paint();
        const reload = o.reload !== false;
        if (usePanel()) panel()!.set(patch, { reload });
        else if (reload) grid.filters(patch);
        else grid.batch(() => grid.filters(patch));
        if (reload) ctx.announce(m.applied(p.label));
      };

      // saved state restores the preset (stateSave contribution); the URL restores the values themselves
      ctx.state({
        key: "filterPresets",
        save: () => active,
        load: (v) => {
          if (typeof v === "string" && byId.has(v)) apply(v, { reload: false });
        },
      });

      // the default fills empty filters only: values restored by urlSync / stateSave (any module order) win
      ctx.ready(() => {
        const cur = current();
        if (def && !touched && keys.every((k) => isOff(list(cur[k])))) apply(def.id, { reload: false });
        else sync();
      });

      const offs = [ctx.on("load", sync)];
      return {
        api: { active: () => active, apply: (id, o) => apply(id, o) },
        destroy() {
          for (const off of offs) off();
          group.remove();
        },
      };
    },
  });
}
filterPresets.moduleName = "filterPresets";
