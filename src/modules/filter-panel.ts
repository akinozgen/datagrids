// Page-level filter form → request params (server) or grid.filters() (client).
import { notice } from "../core/warn";
import type { DatagridApi, ModuleDef } from "../core/types";
import { debounce } from "../core/util";

/** A control value with jQuery `.val()` semantics: string, array (multi-select) or null (nothing to read). */
export type FieldValue = string | string[] | null;

export interface FilterField {
  /** the control (or a container of it): selector, read on every request, or element */
  el: string | Element;
  /** checkbox: value when checked (default "1") */
  value?: string;
  /** checkbox: value when unchecked (server default "0"; client default: no filter) */
  unchecked?: string | null;
  /** maps the control value to what is sent / filtered; null or undefined = left out */
  format?(v: FieldValue, el: Element | null): unknown;
  /** non-native change events (`apply.daterangepicker`): call notify() when the value changed */
  subscribe?(el: Element, notify: () => void): void | (() => void);
}

export interface FilterPanelOptions {
  /** request parameter (server) / filter key (client) → control */
  fields: Record<string, string | Element | FilterField>;
  /** reload when a control changes (default true) */
  auto?: boolean;
  /** typing debounce for text controls in ms (default 250) */
  debounce?: number;
  /** permission flag */
  can?: boolean;
}

export interface FilterPanelApi {
  /** values as they are sent (format applied, null/undefined left out) */
  values(): Record<string, unknown>;
  /** control values before `format` */
  raw(): Record<string, FieldValue>;
  /** writes control values (raw form) and reloads unless `{ reload: false }` */
  set(patch: Record<string, FieldValue | boolean | number>, o?: { reload?: boolean }): void;
  /** restores the values the controls had at init and reloads */
  reset(): void;
  /** applies the current values now (a "Filter" button with `auto: false`) */
  apply(): void;
}

const isServer = (grid: DatagridApi) => (grid as unknown as { source?: { mode?: string } }).source?.mode === "server";

const textLike = (el: Element) =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement && !/^(checkbox|radio|button|submit|reset|file|image|color|range)$/.test(el.type));

const radios = (el: HTMLInputElement) =>
  Array.from((el.form ?? el.ownerDocument).querySelectorAll<HTMLInputElement>("input[type=radio]")).filter(
    (r) => r === el || (!!el.name && r.name === el.name),
  );

/** Reads a control like jQuery `.val()` (checkbox/radio read their checked state). Exported for tests. */
export function readControl(el: Element | null, f: Pick<FilterField, "value" | "unchecked"> = {}, client = false): FieldValue {
  if (!el) return null;
  if (el instanceof HTMLSelectElement) {
    if (el.multiple) return Array.from(el.selectedOptions, (o) => o.value);
    return el.selectedIndex < 0 ? null : el.value;
  }
  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox") return el.checked ? f.value ?? "1" : f.unchecked !== undefined ? f.unchecked : client ? null : "0";
    if (el.type === "radio") return radios(el).find((r) => r.checked)?.value ?? null;
  }
  return "value" in el ? String((el as HTMLInputElement).value ?? "") : null;
}

function writeControl(el: Element, v: FieldValue | boolean | number, f: FilterField): void {
  const list = Array.isArray(v) ? v.map(String) : v == null || v === false ? [] : [String(v)];
  if (el instanceof HTMLSelectElement) {
    for (const o of Array.from(el.options)) o.selected = list.includes(o.value);
  } else if (el instanceof HTMLInputElement && el.type === "checkbox") {
    el.checked = v === true || list[0] === (f.value ?? "1");
  } else if (el instanceof HTMLInputElement && el.type === "radio") {
    for (const r of radios(el)) r.checked = r.value === list[0];
  } else if ("value" in el) (el as HTMLInputElement).value = list.join(",");
}

export function filterPanel(opts: FilterPanelOptions): ModuleDef<"filterPanel", FilterPanelApi> {
  return Object.freeze<ModuleDef<"filterPanel", FilterPanelApi>>({
    name: "filterPanel" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid } = ctx;
      const fields = Object.entries(opts.fields).map(([key, spec]) => {
        const def: FilterField = typeof spec === "string" || spec instanceof Element ? { el: spec } : spec;
        const get = () => (typeof def.el === "string" ? document.querySelector(def.el) : def.el);
        return { key, def, get };
      });
      let muted = 0;
      let last = "";

      const raw = (): Record<string, FieldValue> => {
        const client = !isServer(grid);
        const out: Record<string, FieldValue> = {};
        for (const f of fields) out[f.key] = readControl(f.get(), f.def, client);
        return out;
      };
      const formatted = (all = false): Record<string, unknown> => {
        const r = raw();
        const out: Record<string, unknown> = {};
        for (const f of fields) {
          const v = f.def.format ? f.def.format(r[f.key]!, f.get()) : r[f.key];
          if (all || v != null) out[f.key] = v;
        }
        return out;
      };
      const sig = () => JSON.stringify(raw());

      const apply = (force = true) => {
        const s = sig();
        if (!force && s === last) return;
        last = s;
        if (isServer(grid)) void grid.reload();
        else grid.filters(formatted(true));
      };
      const run = debounce(() => !muted && apply(false), opts.debounce ?? 250);
      const notify = (typed: boolean) => {
        if (muted || opts.auto === false) return;
        if (typed) run();
        else {
          run.cancel();
          apply(false);
        }
      };

      // server: values are read when the request is built (same moment `ajax.data` ran)
      ctx.request((req, next) => {
        last = sig();
        Object.assign(req.params, formatted());
        return next(req);
      });

      // one delegated listener pair: survives controls the host re-renders
      const owner = (t: EventTarget | null) => {
        const el = t as Element | null;
        if (!el?.closest) return null;
        return fields.find((f) => (typeof f.def.el === "string" ? !!el.closest(f.def.el) : f.def.el === el || f.def.el.contains(el))) ?? null;
      };
      const sig2 = { signal: ctx.signal };
      document.addEventListener("change", (e) => owner(e.target) && notify(false), sig2);
      document.addEventListener("input", (e) => owner(e.target) && textLike(e.target as Element) && notify(true), sig2);

      const unsubs: Array<() => void> = [];
      for (const f of fields) {
        const el = f.get();
        if (!el) {
          notice("filterPanel", `no element for "${f.key}".`);
          continue;
        }
        const off = f.def.subscribe?.(el, () => notify(false));
        if (typeof off === "function") unsubs.push(off);
      }
      const initial = raw();

      // client: the values live in the core filter state (the first load uses them)
      ctx.ready(() => {
        last = sig();
        if (!isServer(grid)) grid.filters(formatted(true));
      });

      const set: FilterPanelApi["set"] = (patch, o = {}) => {
        muted++;
        try {
          for (const f of fields) {
            const el = f.get();
            if (!el || !(f.key in patch)) continue;
            writeControl(el, patch[f.key]!, f.def);
            // host widgets (selectable, select2…) follow native change events
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        } finally {
          muted--;
        }
        if (o.reload !== false) apply();
        else {
          if (!isServer(grid)) grid.filters(formatted(true));
          // the controls now show what the grid uses: a later change back is a real change
          last = sig();
        }
      };

      // stateSave({ include: ["filters"] }) keeps the controls themselves, whatever the module order
      ctx.state({
        key: "filterPanel",
        part: "filters",
        save: () => raw(),
        load: (v) => {
          if (v && typeof v === "object" && !Array.isArray(v)) set(v as Record<string, FieldValue>, { reload: false });
        },
      });

      return {
        api: {
          values: () => formatted(),
          raw,
          set,
          reset: () => set(initial),
          apply: () => apply(),
        },
        destroy() {
          run.cancel();
          for (const off of unsubs) off();
        },
      };
    },
  });
}
filterPanel.moduleName = "filterPanel";
