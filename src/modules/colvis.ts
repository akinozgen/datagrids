// Column visibility menu: popover + fieldset + native checkboxes.
import type { DatagridApi, ModuleDef, ResolvedColumn } from "../core/types";
import { fold } from "../core/collate";
import { frag, h, nextId } from "../core/util";
import { icons } from "../dom/icons";
import { createPanel, toolbarButton } from "../dom/popover";

export interface ColVisMessages {
  button: string;
  legend: string;
  showAll: string;
  reset: string;
  search: string;
  searchLabel: string;
  noMatch: string;
  locked: string;
}

const tr: ColVisMessages = {
  button: "Kolonlar",
  legend: "Kolonları göster / gizle",
  showAll: "Tümünü göster",
  reset: "Varsayılana dön",
  search: "Kolon ara…",
  searchLabel: "Kolon ara",
  noMatch: "Eşleşen kolon yok",
  locked: "Bu kolon gizlenemez",
};
const en: ColVisMessages = {
  button: "Columns",
  legend: "Show / hide columns",
  showAll: "Show all",
  reset: "Reset to default",
  search: "Find column…",
  searchLabel: "Find column",
  noMatch: "No matching columns",
  locked: "This column can't be hidden",
};

export interface ColVisOptions {
  messages?: Partial<ColVisMessages>;
  /** show the in-panel search above this many columns (default 12) */
  searchAbove?: number;
  slot?: "start" | "end";
  order?: number;
  /** permission flag */
  can?: boolean;
}

export interface ColVisApi {
  open(): void;
  close(): void;
  toggle(): void;
  /** restores the initial visibility */
  reset(): void;
  /** visible / total of the menu's columns */
  count(): { visible: number; total: number };
}

/** Visibility from the column definitions (core `defaultVisible`). */
function defaultVisibility(grid: DatagridApi): Map<string, boolean> {
  return new Map(grid.columns().map((c) => [c.key, c.defaultVisible]));
}

const menuColumns = (grid: DatagridApi): ResolvedColumn[] =>
  grid.columns().filter((c) => !c.col && c.title.trim() !== "");

export function colVis(opts: ColVisOptions = {}): ModuleDef<"colVis", ColVisApi> {
  return Object.freeze<ModuleDef<"colVis", ColVisApi>>({
    name: "colVis" as const,
    kind: "toolbar" as const,
    can: opts.can,
    setup(ctx) {
      const { grid } = ctx;
      const m: ColVisMessages = { ...(ctx.locale.startsWith("tr") ? tr : en), ...opts.messages };
      const threshold = opts.searchAbove ?? 12;
      const panelId = nextId("dg-colvis");

      const trigger = toolbarButton({ label: m.button, icon: icons.columns, caret: true, badge: "" });
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-controls", panelId);
      trigger.title = m.legend;
      const badge = trigger.querySelector<HTMLElement>(".dg-btn-badge")!;
      // name = text + badge even when the narrow root hides the text; labelledby reads hidden nodes
      const textEl = trigger.querySelector<HTMLElement>(".dg-btn-text")!;
      textEl.id = `${panelId}-t`;
      badge.id = `${panelId}-b`;
      trigger.setAttribute("aria-labelledby", `${textEl.id} ${badge.id}`);
      // a collapsed space keeps "Kolonlar 9/14" one phrase for label-in-name checks
      textEl.append(" ");
      ctx.toolbar({ slot: opts.slot ?? "start", order: opts.order ?? 10, el: trigger });

      const panel = createPanel(ctx.root, { id: panelId, role: "dialog", "aria-label": m.button });
      panel.el.classList.add("dg-colvis");
      const searchInput = h("input", {
        class: "dg-colvis-search-input",
        type: "search",
        placeholder: m.search,
        "aria-label": m.searchLabel,
        autocomplete: "off",
        spellcheck: "false",
        dir: "auto",
      });
      const searchBox = h("label", { class: "dg-colvis-search" });
      searchBox.append(frag(icons.search), searchInput);
      const legend = h("legend", { class: "dg-panel-label" }, m.legend);
      const list = h("div", { class: "dg-colvis-list" });
      const empty = h("div", { class: "dg-colvis-empty", role: "status" });
      const fieldset = h("fieldset", { class: "dg-colvis-set" }, legend, list, empty);
      const showAllBtn = h("button", { type: "button", class: "dg-btn", "data-variant": "ghost" }, m.showAll);
      const resetBtn = h("button", { type: "button", class: "dg-btn", "data-variant": "ghost" }, m.reset);
      const foot = h("div", { class: "dg-panel-foot dg-colvis-foot" }, showAllBtn, resetBtn);
      panel.el.append(searchBox, fieldset, foot);

      const inputs = new Map<string, HTMLInputElement>();
      type Reorder = { movable(): ResolvedColumn[]; move(key: string, to: number): void; messages: { earlier(c: string): string; later(c: string): string } };
      const reorder = () => (grid as unknown as { colReorder?: Reorder }).colReorder ?? null;

      const updateBadge = () => {
        const cols = menuColumns(grid);
        const text = `${cols.filter((c) => c.visible).length}/${cols.length}`;
        badge.textContent = text;
      };

      const build = () => {
        inputs.clear();
        const cols = menuColumns(grid);
        list.replaceChildren(
          ...cols.map((c) => {
            const input = h("input", { type: "checkbox", class: "dg-check-input", value: c.key });
            input.checked = c.visible;
            input.disabled = !c.hideable;
            inputs.set(c.key, input);
            const box = h("span", { class: "dg-check-box" });
            box.append(frag(icons.check));
            const row = h("label", { class: "dg-panel-item", "data-key": c.key },
              h("span", { class: "dg-check" }, input, box),
              h("span", { class: "dg-panel-item-label", dir: "auto" }, c.title));
            if (!c.hideable) {
              row.setAttribute("data-locked", "");
              row.title = m.locked;
              row.append(frag(icons.lock), h("span", { class: "dg-offscreen" }, ` (${m.locked})`));
            }
            const ro = reorder();
            if (!ro) return row;
            // colReorder attached: keyboard / single-pointer alternative to dragging headers
            const mov = ro.movable().map((x) => x.key);
            const i = mov.indexOf(c.key);
            const btn = (dir: -1 | 1) => {
              const b = h("button", {
                type: "button",
                class: "dg-move",
                "data-dir": dir < 0 ? "earlier" : "later",
                "aria-label": dir < 0 ? ro.messages.earlier(c.title) : ro.messages.later(c.title),
                title: dir < 0 ? ro.messages.earlier(c.title) : ro.messages.later(c.title),
              });
              b.append(frag(dir < 0 ? icons.up : icons.down));
              b.disabled = i < 0 || (dir < 0 ? i === 0 : i === mov.length - 1);
              return b;
            };
            return h("div", { class: "dg-panel-row", "data-key": c.key }, row, btn(-1), btn(1));
          }),
        );
        const many = cols.length > threshold;
        searchBox.hidden = !many;
        if (!many) searchInput.value = "";
        filter();
      };

      const sync = () => {
        for (const c of menuColumns(grid)) {
          const input = inputs.get(c.key);
          if (input) input.checked = c.visible;
        }
      };

      const filter = () => {
        const q = fold(searchInput.value.trim(), ctx.locale);
        let shown = 0;
        for (const row of Array.from(list.children) as HTMLElement[]) {
          const hit = !q || fold(row.textContent ?? "", ctx.locale).includes(q);
          row.hidden = !hit;
          if (hit) shown++;
        }
        empty.textContent = shown ? "" : m.noMatch;
        empty.hidden = !!shown;
        panel.reposition();
      };

      const focusables = () =>
        Array.from(panel.el.querySelectorAll<HTMLElement>("input, button")).filter(
          (el) => !(el as HTMLInputElement).disabled && !el.closest("[hidden]"),
        );

      const open = () => {
        if (panel.open) return;
        build();
        panel.show(trigger);
        (searchBox.hidden ? focusables()[0] : searchInput)?.focus();
      };
      const close = () => panel.hide(true);

      const reset = () => {
        const d = defaultVisibility(grid);
        for (const c of grid.columns()) {
          const v = d.get(c.key);
          if (v !== undefined) grid.setColumnVisible(c.key, v);
        }
      };

      trigger.addEventListener("click", () => (panel.open ? close() : open()));
      list.addEventListener("click", (e) => {
        const b = (e.target as Element).closest<HTMLButtonElement>(".dg-move");
        const ro = reorder();
        if (!b || !ro) return;
        const key = b.closest<HTMLElement>(".dg-panel-row")!.getAttribute("data-key")!;
        const dir = b.getAttribute("data-dir")!;
        const mov = ro.movable().map((x) => x.key);
        ro.move(key, mov.indexOf(key) + (dir === "earlier" ? -1 : 1));
        build();
        // keep the focus on the moved column; fall back to the other arrow at the ends
        const row = list.querySelector<HTMLElement>(`.dg-panel-row[data-key="${CSS.escape(key)}"]`);
        const same = row?.querySelector<HTMLButtonElement>(`.dg-move[data-dir="${dir}"]`);
        (same && !same.disabled ? same : row?.querySelector<HTMLButtonElement>(".dg-move:not(:disabled)"))?.focus();
      });
      list.addEventListener("change", (e) => {
        const input = e.target as HTMLInputElement;
        if (input.type === "checkbox") grid.setColumnVisible(input.value, input.checked);
      });
      searchInput.addEventListener("input", filter);
      searchInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && searchInput.value) {
          e.preventDefault();
          e.stopPropagation();
          searchInput.value = "";
          filter();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          focusables().find((el) => el.classList.contains("dg-check-input"))?.focus();
        }
      });
      panel.el.addEventListener("keydown", (e) => {
        // arrows move between the checkboxes; Tab off either edge closes back to the trigger
        if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
          const boxes = focusables().filter((el) => el.classList.contains("dg-check-input"));
          const i = boxes.indexOf(document.activeElement as HTMLElement);
          if (i < 0) return;
          e.preventDefault();
          if (e.key === "Home") boxes[0]!.focus();
          else if (e.key === "End") boxes[boxes.length - 1]!.focus();
          else if (e.key === "ArrowUp" && i === 0 && !searchBox.hidden) searchInput.focus();
          else boxes[(i + (e.key === "ArrowDown" ? 1 : -1) + boxes.length) % boxes.length]!.focus();
        } else if (e.key === "Tab") {
          const f = focusables();
          const edge = e.shiftKey ? f[0] : f[f.length - 1];
          if (document.activeElement === edge) {
            e.preventDefault();
            close();
          }
        }
      });
      panel.el.addEventListener("focusout", (e) => {
        const to = e.relatedTarget as Node | null;
        if (to && !panel.el.contains(to) && to !== trigger) panel.hide(false);
      });
      showAllBtn.addEventListener("click", () => {
        for (const c of menuColumns(grid)) if (!c.visible) grid.setColumnVisible(c.key, true);
      });
      resetBtn.addEventListener("click", reset);

      const offChange = ctx.on("columnchange", () => {
        updateBadge();
        if (!panel.open) return;
        // setColumns() may add/remove columns: rebuild, otherwise just sync the boxes
        const keys = menuColumns(grid).map((c) => c.key).join("\u0000");
        if (keys !== Array.from(inputs.keys()).join("\u0000")) build();
        else sync();
      });
      ctx.ready(() => {
        defaultVisibility(grid);
        updateBadge();
      });

      return {
        api: { open, close, toggle: () => (panel.open ? close() : open()), reset, count: () => {
          const cols = menuColumns(grid);
          return { visible: cols.filter((c) => c.visible).length, total: cols.length };
        } },
        destroy() {
          offChange();
          panel.destroy();
          trigger.remove();
        },
      };
    },
  });
}
colVis.moduleName = "colVis";
