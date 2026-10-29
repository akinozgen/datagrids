// Definition-based row actions: catalog in the frontend, standard menu, sticky column.
import { notice } from "../core/warn";
import type { AnyModule, ConfirmOptions, DatagridApi, ModuleContext, Row } from "../core/types";
import { decodeEntities, frag, getPath, h } from "../core/util";
import { icons, type IconName } from "../dom/icons";
import { createPanel, type Panel } from "../dom/popover";

export interface ActionItem<R = Row> {
  id: string;
  label: string;
  icon?: IconName;
  tone?: "danger" | "warning" | "success";
  group?: string;
  /** shown as the labelled button next to `⋯` when there are more actions than `inline` */
  primary?: boolean;
  /** permission: false hides the action (Blade boolean or row closure). Backend still authorizes. */
  can?: boolean | ((row: R) => boolean);
  /** row-state reason: true or a reason string → visible but inactive */
  disabled?: (row: R) => boolean | string | null | undefined;
  /** one behaviour: href template, request (→ grid.action) or handler */
  href?: string;
  target?: string;
  request?: { url: string; method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: Record<string, unknown> | ((row: R) => Record<string, unknown>) };
  handler?: (row: R, ctx: { grid: DatagridApi; key: string }) => unknown;
  confirm?: string | { title?: string; message: string; confirmLabel?: string; cancelLabel?: string };
  success?: string | false;
  reload?: false | { keepPage?: boolean };
}

export interface ActionsOptions<R = Row> {
  items: ActionItem<R>[];
  /** how many actions render inline before switching to primary + ⋯ (default 2) */
  inline?: number;
  sticky?: "end" | false;
  /** optional server permission map field (only narrows); `{edit:true, delete:{disabled:"code"}, sms:false}` or `["edit"]` */
  field?: string;
  /** reason codes → text */
  reasons?: Record<string, string>;
  /** accessible row label for the trigger ("İşlemler: Jill Valentine") */
  rowLabel?: (row: R) => string;
  can?: boolean;
  messages?: Partial<ActionMessages>;
}

interface ActionMessages {
  actions: string;
  more: string;
  forRow: (label: string) => string;
}

const MSG: Record<"tr" | "en", ActionMessages> = {
  tr: { actions: "İşlemler", more: "Diğer işlemler", forRow: (l) => `İşlemler: ${l}` },
  en: { actions: "Actions", more: "More actions", forRow: (l) => `Actions: ${l}` },
};

/** `{path}` placeholders; `text` turns a stored value into text first (server-escaped sources). */
const fill = (tpl: string, row: unknown, encode: boolean, text: (v: string) => string = (v) => v) =>
  tpl.replace(/\{([\w.]+)\}/g, (_, p: string) => {
    const v = text(String(getPath(row, p) ?? ""));
    return encode ? encodeURIComponent(v) : v;
  });

interface Resolved {
  item: ActionItem;
  reason: string | null;
}

export interface ActionsApi {
  run(id: string, key: string): Promise<void>;
  open(key: string): void;
  items(key: string): Resolved[];
}

export function actions<R = Row>(opts: ActionsOptions<R>): AnyModule {
  return Object.freeze({
    name: "actions",
    kind: "feature" as const,
    can: opts.can,
    setup(ctx: ModuleContext) {
      const grid = ctx.grid;
      const m = { ...MSG[ctx.locale.startsWith("tr") ? "tr" : "en"], ...(opts.messages ?? {}) };
      const inline = opts.inline ?? 2;
      const busy = new Set<string>();
      const menu: Panel = createPanel(ctx.root, { role: "menu" });
      const note: Panel = createPanel(ctx.root, { class: "dg-note", role: "note" });
      menu.el.classList.add("dg-actions-menu");
      let menuKey: string | null = null;
      let typeahead = "";
      let typeTimer: ReturnType<typeof setTimeout> | undefined;

      // an HTML-default source (yajra) escapes values: confirm texts, labels and URLs need the text once
      const escaped = () => (grid as unknown as { source?: { cells?: string } }).source?.cells === "html";
      const text = (v: string) => (escaped() && v.includes("&") ? decodeEntities(v) : v);
      const labelOf = (row: Row): string => {
        if (opts.rowLabel) return opts.rowLabel(row as R);
        const c = grid.columns().find((x) => !x.col && x.visible);
        return c ? text(String(getPath(row, c.data ?? c.key) ?? "")) : "";
      };

      const resolve = (row: Row): Resolved[] => {
        const map = opts.field ? (row[opts.field] as unknown) : undefined;
        const out: Resolved[] = [];
        for (const item of opts.items as ActionItem[]) {
          const can = typeof item.can === "function" ? item.can(row) : item.can ?? true;
          if (!can) continue;
          let allowed: unknown = true;
          if (Array.isArray(map)) allowed = map.includes(item.id);
          else if (map && typeof map === "object") allowed = (map as Record<string, unknown>)[item.id] ?? true;
          if (allowed === false) continue;
          let reason: string | null = null;
          const d = item.disabled?.(row);
          if (d) reason = typeof d === "string" ? d : "";
          if (allowed && typeof allowed === "object" && (allowed as { disabled?: unknown }).disabled) {
            const code = String((allowed as { disabled: unknown }).disabled);
            reason = opts.reasons?.[code] ?? decodeEntities(code);
          }
          out.push({ item, reason });
        }
        // danger actions sink to the end of their group
        return out.sort((a, b) => Number(a.item.tone === "danger") - Number(b.item.tone === "danger"));
      };

      const iconEl = (name?: IconName) => {
        if (!name) return h("span", { class: "dg-slot-icon" });
        const f = frag(icons[name]);
        const svg = f.firstElementChild as SVGElement;
        if (["chevron", "send"].includes(name)) svg.classList.add("dg-dir");
        return f;
      };

      const cellButton = (r: Resolved, row: Row, key: string, labelled = true) => {
        const it = r.item;
        const b = h("button", {
          type: "button",
          class: "dg-cellbtn",
          "data-action": it.id,
          "data-variant": it.tone === "danger" ? "danger" : null,
          "aria-disabled": r.reason !== null ? "true" : null,
          "data-dg-tip": labelled ? null : it.label,
          "aria-label": labelled ? null : it.label,
        });
        if (it.icon) b.append(iconEl(it.icon));
        if (labelled) b.append(h("span", null, it.label));
        if (r.reason !== null) {
          b.append(frag(icons.info));
          (b.lastElementChild as SVGElement).classList.add("dg-why");
          if (r.reason) b.setAttribute("aria-description", r.reason);
        }
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          if (r.reason !== null) {
            showNote(b, r.reason || it.label);
            return;
          }
          void api.run(it.id, key);
        });
        return b;
      };

      const showNote = (anchor: HTMLElement, text: string) => {
        note.el.replaceChildren(frag(icons.info), h("span", null, text));
        note.show(anchor, { align: "end" });
      };

      const render = (td: HTMLTableCellElement, row: Row, key: string) => {
        const list = resolve(row);
        td.replaceChildren();
        if (opts.sticky === false) td.removeAttribute("data-sticky");
        if (!list.length) {
          td.append(h("span", { class: "dg-empty-value" }, "—"));
          return;
        }
        const box = h("span", { class: "dg-actions" });
        if (list.length <= inline) {
          for (const r of list) box.append(cellButton(r, row, key));
        } else {
          const primary = list.find((r) => r.item.primary);
          if (primary) box.append(cellButton(primary, row, key));
          const trig = h("button", {
            type: "button",
            class: "dg-cellbtn dg-actions-trigger",
            "aria-haspopup": "menu",
            "aria-expanded": "false",
            "aria-label": primary ? `${m.more}: ${labelOf(row)}` : m.forRow(labelOf(row)),
            "data-dg-tip": primary ? m.more : null,
            "data-icon-only": primary ? true : null,
          });
          if (primary) trig.append(frag(icons.more));
          else {
            trig.append(h("span", null, m.actions));
            trig.append(frag(icons.caret));
          }
          trig.addEventListener("click", (e) => {
            e.stopPropagation();
            openMenu(trig, key, "first", false);
          });
          trig.addEventListener("keydown", (e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              openMenu(trig, key, e.key === "ArrowUp" ? "last" : "first", true);
            }
          });
          box.append(trig);
        }
        td.append(box);
        if (busy.has(key)) setBusy(td.closest("tr")!, true);
      };

      const menuItems = () => Array.from(menu.el.querySelectorAll<HTMLElement>("[role=menuitem]"));

      const openMenu = (trigger: HTMLElement, key: string, focus: "first" | "last", fromKeyboard: boolean) => {
        const row = grid.rowByKey(key);
        if (!row) return;
        if (menu.open && menuKey === key) {
          menu.hide(true);
          return;
        }
        menuKey = key;
        const list = resolve(row);
        const primaryId = list.length > inline ? list.find((r) => r.item.primary)?.item.id : undefined;
        menu.el.replaceChildren();
        menu.el.setAttribute("aria-label", m.forRow(labelOf(row)));
        let lastGroup: string | undefined | null = null;
        let lastDanger = false;
        for (const r of list) {
          if (r.item.id === primaryId) continue;
          const it = r.item;
          if (lastGroup !== null && it.group !== lastGroup) menu.el.append(h("div", { class: "dg-panel-sep", role: "separator" }));
          else if (it.tone === "danger" && !lastDanger && menu.el.childElementCount) menu.el.append(h("div", { class: "dg-panel-sep", role: "separator" }));
          if (it.group && it.group !== lastGroup) menu.el.append(h("div", { class: "dg-panel-group", role: "presentation" }, it.group));
          lastGroup = it.group;
          lastDanger = it.tone === "danger";
          const id = `${menu.el.id || "m"}-${it.id}`;
          const btn = h("button", {
            type: "button",
            role: "menuitem",
            tabindex: "-1",
            class: "dg-panel-item",
            "data-action": it.id,
            "data-tone": it.tone === "danger" ? "bad" : null,
            "aria-disabled": r.reason !== null ? "true" : null,
          });
          btn.append(iconEl(it.icon));
          const body = h("span", { class: "dg-panel-item-body" }, h("span", { class: "dg-panel-item-label", id: `${id}-l` }, it.label + (it.confirm ? "…" : "")));
          if (r.reason) {
            // reason is part of the accessible name (label-in-name, WCAG 2.5.3): "Onayla… İptal edilmiş…, unavailable"
            const rs = h("span", { class: "dg-panel-item-reason", id: `${id}-r` });
            rs.append(frag(icons.info), h("span", null, r.reason));
            body.append(rs);
          }
          btn.append(body);
          btn.addEventListener("click", () => {
            if (r.reason !== null) return;
            menu.hide(true);
            void api.run(it.id, key);
          });
          menu.el.append(btn);
        }
        menu.show(trigger, { align: "end", onClose: () => (menuKey = null) });
        const items = menuItems();
        const target = focus === "last" ? items[items.length - 1] : items[0];
        if (fromKeyboard || true) target?.focus();
      };

      menu.el.addEventListener("keydown", (e) => {
        const items = menuItems();
        const i = items.indexOf(document.activeElement as HTMLElement);
        let n = -1;
        if (e.key === "ArrowDown") n = (i + 1) % items.length;
        else if (e.key === "ArrowUp") n = (i - 1 + items.length) % items.length;
        else if (e.key === "Home") n = 0;
        else if (e.key === "End") n = items.length - 1;
        else if (e.key === "Tab") {
          // back to the trigger first, so Tab continues along the row instead of leaving the grid
          menu.hide(true);
          return;
        } else if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          (document.activeElement as HTMLElement)?.click();
          return;
        } else if (e.key.length === 1 && /\S/.test(e.key)) {
          clearTimeout(typeTimer);
          typeahead += e.key.toLocaleLowerCase(ctx.locale);
          typeTimer = setTimeout(() => (typeahead = ""), 600);
          n = items.findIndex((x) => (x.textContent ?? "").toLocaleLowerCase(ctx.locale).startsWith(typeahead));
        }
        if (n >= 0) {
          e.preventDefault();
          items[n]!.focus();
        }
      });

      const trFor = (key: string) => Array.from(ctx.table.tBodies[0]?.rows ?? []).find((tr) => tr.getAttribute("data-key") === key);

      const setBusy = (tr: HTMLTableRowElement, on: boolean) => {
        if (on) tr.setAttribute("aria-busy", "true");
        else tr.removeAttribute("aria-busy");
        tr.querySelectorAll<HTMLButtonElement>(".dg-actions .dg-cellbtn").forEach((b) => (b.disabled = on));
      };

      const api: ActionsApi = {
        items: (key) => {
          const row = grid.rowByKey(key);
          return row ? resolve(row) : [];
        },
        open: (key) => {
          const trig = trFor(key)?.querySelector<HTMLElement>(".dg-actions-trigger");
          if (trig) openMenu(trig, key, "first", true);
        },
        async run(id, key) {
          const row = grid.rowByKey(key);
          if (!row || busy.has(key)) return;
          const r = resolve(row).find((x) => x.item.id === id);
          if (!r || r.reason !== null) return;
          const it = r.item;
          if (!grid.emit("beforeAction", { id, key, row })) return;
          const subject = labelOf(row);
          if (it.confirm) {
            const c = typeof it.confirm === "string" ? { message: it.confirm } : it.confirm;
            const co: ConfirmOptions = { title: c.title, confirmLabel: (c as { confirmLabel?: string }).confirmLabel ?? (it.tone === "danger" ? it.label : undefined), cancelLabel: (c as { cancelLabel?: string }).cancelLabel, tone: it.tone === "danger" ? "danger" : "default", subject };
            if (!(await grid.confirm(fill(c.message, row, false, text), co))) return;
          }
          if (it.href) {
            const url = fill(it.href, row, true, text);
            if (it.target) window.open(url, it.target, "noopener");
            else location.assign(url);
            return;
          }
          busy.add(key);
          let tr = trFor(key);
          // where focus should come back after the reload replaces the row (same row, else the one in its place)
          const focusHere = !!tr && tr.contains(document.activeElement) || ctx.root.contains(document.activeElement) && document.activeElement?.closest(".dg-actions-menu, dialog") !== null;
          const rowIndex = tr ? Array.from(tr.parentElement?.children ?? []).indexOf(tr) : -1;
          if (tr) setBusy(tr, true);
          const trig = tr?.querySelector(".dg-actions-trigger svg:last-of-type, .dg-actions-trigger svg");
          const spin = frag(icons.spinner).firstElementChild!;
          if (trig) trig.replaceWith(spin);
          try {
            if (it.request) {
              const body = typeof it.request.body === "function" ? it.request.body(row) : it.request.body;
              await grid.action(fill(it.request.url, row, true, text), {
                method: it.request.method ?? "POST",
                body: body ?? null,
                success: it.success === false ? false : it.success ? fill(it.success, row, false, text) : undefined,
                reload: it.reload ?? { keepPage: true },
              });
            } else if (it.handler) {
              await it.handler(row, { grid, key });
            }
            grid.emit("action", { id, key, row });
          } catch (error) {
            grid.emit("actionerror", { id, key, row, error });
          } finally {
            busy.delete(key);
            tr = trFor(key);
            if (tr) {
              setBusy(tr, false);
              const td = tr.querySelector<HTMLTableCellElement>("td[data-col=actions]");
              const cur = grid.rowByKey(key);
              if (td && cur) render(td, cur, key);
            }
            if (focusHere && (!document.activeElement || document.activeElement === document.body)) {
              // the row (or, after a delete, the row now in its place) gets the focus back on its actions
              const rows = ctx.table.tBodies[0] ? Array.from(ctx.table.tBodies[0].rows).filter((r) => r.hasAttribute("data-key")) : [];
              const target = tr ?? rows[Math.min(Math.max(rowIndex, 0), rows.length - 1)];
              const ctl = target?.querySelector<HTMLElement>("td[data-col=actions] button:not([disabled])");
              (ctl ?? ctx.root.querySelector<HTMLElement>(".dg-scroll"))?.focus({ preventScroll: true });
            }
          }
        },
      };

      ctx.row((tr, row, key) => {
        const td = tr.querySelector<HTMLTableCellElement>(":scope > td[data-col=actions]");
        if (td) render(td, row, key);
      });
      const head = (tr: HTMLTableRowElement | null | undefined) => {
        const th = tr?.querySelector<HTMLTableCellElement>("th[data-col=actions]");
        if (!th) return;
        if (opts.sticky === false) th.removeAttribute("data-sticky");
        // a column.actions() without a title gets the localized header
        if (!th.textContent) th.textContent = m.actions;
      };
      ctx.on("headrender" as never, ((d: { tr: HTMLTableRowElement }) => head(d.tr)) as never);
      ctx.ready(() => head(ctx.table.tHead?.rows[0]));
      if (!grid.columns().some((c) => c.col === "actions"))
        ctx.ready(() => {
          if (!grid.columns().some((c) => c.col === "actions")) notice("actions()", "add `column.actions()` to the columns to place the action column.");
        });

      return {
        api,
        destroy() {
          menu.destroy();
          note.destroy();
        },
      };
    },
  });
}

// stable name for grid.module(actions) after minification
actions.moduleName = "actions";
