// Drag-to-reorder rows: pointer (mouse + touch) and keyboard (Space/Enter grab, arrows move, Space/Enter drop, Esc cancel).
import { warn } from "../core/warn";
import type { ColumnDef, ModuleDef, Row } from "../core/types";
import { decodeEntities, frag, getPath, h, htmlToText, nextId, setTip } from "../core/util";
import { icons } from "../dom/icons";

export interface RowReorderMessages {
  /** handle name: "Taşı: Jill Valentine" */
  handle: (label: string) => string;
  /** header of the dedicated column (visually hidden) */
  column: string;
  /** keyboard instructions (the handles' description) */
  help: string;
  /** tooltip of an active handle */
  hint: string;
  grabbed: (label: string, pos: number, n: number) => string;
  moved: (label: string, pos: number, n: number) => string;
  dropped: (label: string, pos: number, n: number) => string;
  cancelled: (label: string, pos: number, n: number) => string;
  /** disabled reason while sorted by another column (`column` = the order column's title, if any) */
  sorted: (column: string | null) => string;
  /** reason shown on the handles of a windowed (virtual) page */
  virtual: string;
  saving: string;
  failed: (detail: string | null) => string;
}

const tr: RowReorderMessages = {
  handle: (l) => `Taşı: ${l}`,
  column: "Sıra",
  help: "Boşluk ya da Enter ile tutun, ok tuşlarıyla taşıyın, yeniden Boşluk ya da Enter ile bırakın. Esc vazgeçer.",
  hint: "Sürükleyerek taşıyın",
  grabbed: (l, p, n) => `${l} tutuldu, konum ${p} / ${n}.`,
  moved: (l, p, n) => `${l}: konum ${p} / ${n}.`,
  dropped: (l, p, n) => `${l} bırakıldı, konum ${p} / ${n}.`,
  cancelled: (l, p, n) => `Taşıma iptal edildi. ${l}: konum ${p} / ${n}.`,
  sorted: (c) => (c ? `Taşımak için “${c}” sıralamasına dönün` : "Sıralı görünümde satırlar taşınamaz"),
  virtual: "Çok satırlı sayfada taşıma kapalı; sayfa boyunu küçültün",
  saving: "Sıra kaydediliyor…",
  failed: (d) => (d ? `Sıra kaydedilemedi: ${d}` : "Sıra kaydedilemedi."),
};
const en: RowReorderMessages = {
  handle: (l) => `Move: ${l}`,
  column: "Order",
  help: "Press Space or Enter to pick up, arrow keys to move, Space or Enter again to drop. Escape cancels.",
  hint: "Drag to move",
  grabbed: (l, p, n) => `${l} picked up, position ${p} of ${n}.`,
  moved: (l, p, n) => `${l}: position ${p} of ${n}.`,
  dropped: (l, p, n) => `${l} dropped, position ${p} of ${n}.`,
  cancelled: (l, p, n) => `Move cancelled. ${l}: position ${p} of ${n}.`,
  sorted: (c) => (c ? `Sort by “${c}” to move rows` : "Rows cannot be moved while sorted"),
  virtual: "Moving is off on very long pages; use a smaller page size",
  saving: "Saving order…",
  failed: (d) => (d ? `Could not save the order: ${d}` : "Could not save the order."),
};

/** What `onEnd` receives. Indices are zero-based inside the current view (page). */
export interface RowReorderEnd {
  row: Row;
  key: string;
  from: number;
  to: number;
  /** page offset: absolute position = offset + index */
  offset: number;
  /** key of the row now right before / after the moved one (direction-free "place between") */
  prevKey: string | null;
  nextKey: string | null;
  /** view rows in the new order */
  rows: Row[];
}

export interface RowReorderOptions {
  /** saves the new order; a rejection reverts the move and shows the error. Server mode reloads (keepPage) after it */
  onEnd(e: RowReorderEnd): unknown;
  /** column key holding the grip; default: the `reorderColumn()` column, else the first visible data column */
  handle?: string;
  /** sort key that stands for the stored order: moving is allowed while unsorted or sorted by it */
  orderKey?: string;
  /** row name for the handle and announcements (default: first text column) */
  label?: (row: Row) => string;
  messages?: Partial<RowReorderMessages>;
  /** permission flag */
  can?: boolean;
}

export interface RowReorderApi {
  /** true while handles are active (not sorted by another column, nothing saving) */
  enabled(): boolean;
  /** moves a row of the current view to `to` (zero-based) through the same path as a drag */
  move(key: string, to: number): Promise<boolean>;
}

export const REORDER_KEY = "__reorder";

/** Dedicated grip column (narrow, no search/sort/export, keeps its slot, hidden in print). */
export function reorderColumn(o: Partial<Omit<ColumnDef, "key">> = {}): ColumnDef {
  return { col: "handle", title: "", sortable: false, searchable: false, exportable: false, hideable: false, ...o, key: REORDER_KEY };
}

/** Copy of `row` with a dotted path set (rows are never mutated). */
function setPath(row: Row, path: string, v: unknown): Row {
  const parts = path.split(".");
  const out: Row = { ...row };
  let cur: Record<string, unknown> = out;
  for (const p of parts.slice(0, -1)) {
    const next = { ...((cur[p] as Record<string, unknown> | undefined) ?? {}) };
    cur[p] = next;
    cur = next;
  }
  cur[parts[parts.length - 1]!] = v;
  return out;
}

interface Drag {
  b: HTMLButtonElement;
  tr: HTMLTableRowElement;
  key: string;
  id: number;
  x: number;
  y: number;
  lastY: number;
  started: boolean;
  rows: HTMLTableRowElement[];
  slot: number;
}

interface Grab {
  b: HTMLButtonElement;
  tr: HTMLTableRowElement;
  key: string;
  /** view index and DOM index when picked up */
  from: number;
  dom: number;
  moving: boolean;
}

export function rowReorder(opts: RowReorderOptions): ModuleDef<"rowReorder", RowReorderApi> {
  return Object.freeze<ModuleDef<"rowReorder", RowReorderApi>>({
    name: "rowReorder" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid, root } = ctx;
      const m = { ...(ctx.locale.startsWith("tr") ? tr : en), ...opts.messages };
      const sig = { signal: ctx.signal };
      const helpId = nextId("dg-reorder-help");
      const help = h("span", { id: helpId, class: "dg-offscreen" }, m.help);
      ctx.layer(help);
      const frame = root.querySelector<HTMLElement>(":scope > .dg-frame") ?? root;
      const line = h("div", { class: "dg-drop-line", "aria-hidden": "true" });
      line.hidden = true;
      frame.append(line);

      let saving = false;
      let drag: Drag | null = null;
      let kb: Grab | null = null;
      let warned = false;

      const tbody = () => ctx.table.tBodies[0];
      const dataRows = () =>
        Array.from(tbody()?.rows ?? []).filter((r) => r.hasAttribute("data-key") && !r.classList.contains("dg-spacer"));
      const keyOf = (r: Element) => r.getAttribute("data-key")!;
      const viewIndex = (key: string) => grid.viewRows().findIndex((r) => grid.keyOf(r) === key);

      const hostKey = (): string | null => {
        const cols = grid.columns();
        if (opts.handle) {
          if (cols.some((c) => c.key === opts.handle)) return opts.handle;
          if (!warned) warn("DG004", { name: String(opts.handle) });
          warned = true;
          return null;
        }
        if (cols.some((c) => c.key === REORDER_KEY)) return REORDER_KEY;
        return cols.find((c) => c.visible && !c.col)?.key ?? null;
      };

      const labelOf = (row: Row, key: string): string => {
        if (opts.label) return opts.label(row);
        const c = grid.columns().find((x) => x.type === "text" && !x.col);
        const v = c ? (c.value ? c.value(row) : getPath(row, c.data ?? c.key)) : undefined;
        if (v == null || v === "") return key;
        const s = String(v);
        return (s.includes("<") ? htmlToText(s) : decodeEntities(s)).trim() || key;
      };
      const labelByKey = (key: string) => {
        const row = grid.rowByKey(key);
        return row ? labelOf(row, key) : key;
      };

      /** null = handles active; otherwise the reason they are not */
      const blocked = (): string | null => {
        if (saving) return m.saving;
        // a windowed page recycles rows under the pointer: no moves there
        if (ctx.root.hasAttribute("data-dg-virtual")) return m.virtual;
        const s = grid.sort()[0];
        if (!s || (opts.orderKey && s.key === opts.orderKey)) return null;
        const col = opts.orderKey ? grid.columns().find((c) => c.key === opts.orderKey) : undefined;
        return m.sorted(col ? col.title || col.key : opts.orderKey ?? null);
      };

      /* ---------- handles ---------- */

      const buttons = () => Array.from(ctx.table.querySelectorAll<HTMLButtonElement>(":scope > tbody > tr > td .dg-reorder"));
      const syncBtn = (b: HTMLButtonElement, why: string | null) => {
        if (why) {
          b.setAttribute("aria-disabled", "true");
          b.removeAttribute("aria-describedby");
          setTip(b, why, true); // the reason is the accessible description, and visible on hover
        } else {
          b.removeAttribute("aria-disabled");
          b.setAttribute("aria-describedby", helpId);
          b.removeAttribute("aria-description");
          setTip(b, m.hint);
        }
      };
      const syncAll = () => {
        const why = blocked();
        for (const b of buttons()) syncBtn(b, why);
      };

      ctx.row((trEl, row, key) => {
        const k = hostKey();
        const td = k ? Array.from(trEl.cells).find((c) => c.getAttribute("data-key") === k) : undefined;
        // the host column can change (first column hidden / shown): one handle per row
        for (const other of Array.from(trEl.querySelectorAll<HTMLElement>(".dg-reorder"))) {
          if (other.closest("td") === td) continue;
          const wrap = other.closest(".dg-reorder-wrap");
          other.remove();
          if (wrap) wrap.replaceWith(...Array.from(wrap.childNodes));
        }
        if (!td) return;
        let b = td.querySelector<HTMLButtonElement>(".dg-reorder");
        if (!b) {
          b = h("button", { type: "button", class: "dg-reorder", "aria-pressed": "false" });
          b.append(frag(icons.grip));
          if (k === REORDER_KEY) td.replaceChildren(b);
          else td.replaceChildren(h("div", { class: "dg-reorder-wrap" }, b, ...Array.from(td.childNodes)));
        }
        b.setAttribute("aria-label", m.handle(labelOf(row, key)));
        syncBtn(b, blocked());
      });

      const offs = [
        ctx.on("headrender", ({ tr: head }) => {
          const th = Array.from(head.cells).find((c) => c.getAttribute("data-key") === REORDER_KEY);
          if (th && !th.textContent) th.append(h("span", { class: "dg-offscreen" }, m.column));
        }),
        ctx.on("sort", syncAll),
        ctx.on("render", () => {
          // the body was re-rendered under a gesture (reload, data change): the gesture ends, the render wins
          if (drag) endDrag();
          const g = release();
          if (g) ctx.announce(m.cancelled(labelByKey(g.key), g.from + 1, grid.viewRows().length));
        }),
      ];

      /** Moves `rows[cur]` to DOM index `to` by moving its neighbours: the moved row (and its focus) stays put. */
      const place = (rows: HTMLTableRowElement[], cur: number, to: number) => {
        const body = tbody();
        const me = rows[cur];
        if (!body || !me || to === cur) return;
        if (to < cur) {
          const ref = me.nextSibling;
          for (const r of rows.slice(to, cur)) body.insertBefore(r, ref);
        } else for (const r of rows.slice(cur + 1, to + 1)) body.insertBefore(r, me);
      };

      /** DOM follows a new view order for the moved row (server mode preview / keyboard drop). */
      const placeDom = (key: string, next: Row[]) => {
        const rows = dataRows();
        const cur = rows.findIndex((r) => keyOf(r) === key);
        if (cur < 0) return;
        const at = new Map(next.map((r, i) => [grid.keyOf(r), i]));
        const mine = at.get(key) ?? 0;
        const to = rows.filter((r, i) => i !== cur && (at.get(keyOf(r)) ?? -1) < mine).length;
        place(rows, cur, to);
      };

      /** Client + sorted by orderKey: the order values of the touched range follow the new order. */
      const renumber = (view: Row[], next: Row[], lo: number, hi: number): Map<Row, Row> => {
        const out = new Map<Row, Row>();
        const s = grid.sort()[0];
        if (!opts.orderKey || !s || s.key !== opts.orderKey) return out;
        const col = grid.columns().find((c) => c.key === opts.orderKey);
        const path = col?.sortKey ?? col?.data ?? opts.orderKey;
        for (let i = lo; i <= hi; i++) {
          const v = getPath(view[i], path);
          const r = next[i]!;
          if (getPath(r, path) !== v) out.set(r, setPath(r, path, v));
        }
        return out;
      };

      const handleFor = (key: string) =>
        dataRows().find((r) => keyOf(r) === key)?.querySelector<HTMLButtonElement>(".dg-reorder") ?? null;

      const commit = async (key: string, to: number): Promise<boolean> => {
        const view = grid.viewRows();
        const from = view.findIndex((r) => grid.keyOf(r) === key);
        const restore = () => grid.mode === "server" ? ctx.requestRender() : placeDom(key, view);
        if (from < 0 || to < 0 || to >= view.length || to === from || blocked()) {
          restore();
          return false;
        }
        const row = view[from]!;
        const next = view.slice();
        next.splice(from, 1);
        next.splice(to, 0, row);
        const client = grid.mode === "client";
        const repl = client ? renumber(view, next, Math.min(from, to), Math.max(from, to)) : new Map<Row, Row>();
        const rows = next.map((r) => repl.get(r) ?? r);
        const e: RowReorderEnd = {
          row: rows[to]!,
          key,
          from,
          to,
          offset: (grid.page() - 1) * Math.max(0, grid.pageSize()),
          prevKey: to > 0 ? grid.keyOf(rows[to - 1]!) : null,
          nextKey: to < rows.length - 1 ? grid.keyOf(rows[to + 1]!) : null,
          rows,
        };
        if (!grid.emit("beforeReorder", { ...e })) {
          restore();
          return false;
        }
        const focused = !!document.activeElement?.closest?.(".dg-reorder") && root.contains(document.activeElement);
        const label = labelOf(row, key);
        const before = client ? grid.rows() : null;
        if (client) {
          // the underlying list follows: the row moves next to its new neighbour (filters and paging stay valid)
          const all = before!.map((r) => repl.get(r) ?? r);
          const moved = rows[to]!;
          all.splice(all.indexOf(moved), 1);
          const nb = to < rows.length - 1 ? all.indexOf(rows[to + 1]!) : -1;
          const pb = to > 0 ? all.indexOf(rows[to - 1]!) : -1;
          all.splice(nb >= 0 ? nb : pb >= 0 ? pb + 1 : all.length, 0, moved);
          grid.setData(all);
        } else placeDom(key, next);
        saving = true;
        syncAll();
        handleFor(key)?.closest("tr")?.setAttribute("aria-busy", "true");
        if (focused) handleFor(key)?.focus({ preventScroll: true });
        ctx.announce(m.dropped(label, to + 1, view.length));
        const done = () => {
          saving = false;
          handleFor(key)?.closest("tr")?.removeAttribute("aria-busy");
          syncAll();
          if (focused) handleFor(key)?.focus({ preventScroll: true });
        };
        try {
          await opts.onEnd(e);
        } catch (err) {
          saving = false;
          if (client) grid.setData(before!);
          else ctx.requestRender();
          const detail = err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string" ? (err as { message: string }).message : null;
          grid.notify("error", m.failed(detail || null));
          grid.emit("reordererror", { ...e, error: err });
          done();
          return false;
        }
        saving = false;
        grid.emit("reorder", { ...e });
        try {
          // the server's order is the truth: same page, fresh rows
          if (!client) await grid.reload({ keepPage: true });
        } finally {
          done();
        }
        return true;
      };

      /* ---------- pointer ---------- */

      let raf = 0;
      const scroller = () => root.querySelector<HTMLElement>(".dg-scroll");

      const position = (d: Drag) => {
        const rows = dataRows();
        let slot = rows.length;
        for (let i = 0; i < rows.length; i++) {
          const r = rows[i]!.getBoundingClientRect();
          if (d.lastY < r.top + r.height / 2) {
            slot = i;
            break;
          }
        }
        d.rows = rows;
        d.slot = slot;
        const cur = rows.indexOf(d.tr);
        const noop = !rows.length || slot === cur || slot === cur + 1;
        line.hidden = noop;
        if (noop) return;
        const edge = slot < rows.length ? rows[slot]!.getBoundingClientRect().top : rows[rows.length - 1]!.getBoundingClientRect().bottom;
        line.style.setProperty("--dg-_drop-y", `${Math.round(edge - frame.getBoundingClientRect().top)}px`);
      };

      /** Scrolls the grid's own scroller (virtual / maxHeight) or the page while the pointer is near an edge. */
      const tick = () => {
        raf = 0;
        const d = drag;
        if (!d?.started) return;
        const edge = 40;
        const speed = (dist: number) => Math.ceil(((edge - dist) / edge) * 14);
        const sc = scroller();
        let dy = 0;
        let target: HTMLElement | Window = window;
        if (sc && sc.scrollHeight > sc.clientHeight + 1) {
          const r = sc.getBoundingClientRect();
          if (d.lastY < r.top + edge) dy = -speed(d.lastY - r.top);
          else if (d.lastY > r.bottom - edge) dy = speed(r.bottom - d.lastY);
          target = sc;
        }
        if (!dy) {
          target = window;
          if (d.lastY < edge) dy = -speed(d.lastY);
          else if (d.lastY > innerHeight - edge) dy = speed(innerHeight - d.lastY);
        }
        if (!dy) return;
        target.scrollBy(0, dy);
        position(d);
        raf = requestAnimationFrame(tick);
      };

      const onMove = (e: PointerEvent) => {
        const d = drag;
        if (!d || e.pointerId !== d.id) return;
        d.lastY = e.clientY;
        if (!d.started) {
          if (Math.abs(e.clientY - d.y) < 4 && Math.abs(e.clientX - d.x) < 4) return;
          d.started = true;
          d.tr.setAttribute("data-state", "dragging");
          root.setAttribute("data-dg-dragging", "");
        }
        position(d);
        if (!raf) raf = requestAnimationFrame(tick);
      };

      const onKeyDuringDrag = (e: KeyboardEvent) => {
        if (e.key !== "Escape" || !drag) return;
        e.preventDefault();
        e.stopPropagation();
        endDrag();
      };

      const endDrag = () => {
        const d = drag;
        drag = null;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        line.hidden = true;
        root.removeAttribute("data-dg-dragging");
        document.removeEventListener("keydown", onKeyDuringDrag, true);
        if (!d) return;
        d.tr.removeAttribute("data-state");
        d.b.removeEventListener("pointermove", onMove);
        d.b.removeEventListener("pointerup", onUp);
        d.b.removeEventListener("pointercancel", onLost);
        d.b.removeEventListener("lostpointercapture", onLost);
        try {
          if (d.b.hasPointerCapture?.(d.id)) d.b.releasePointerCapture(d.id);
        } catch {
          /* already released */
        }
      };

      const onLost = () => drag && endDrag();

      const onUp = (e: PointerEvent) => {
        const d = drag;
        if (!d || e.pointerId !== d.id) return;
        endDrag();
        if (!d.started) return;
        const rows = d.rows;
        const cur = rows.indexOf(d.tr);
        if (!rows.length || cur < 0 || d.slot === cur || d.slot === cur + 1) return;
        const from = viewIndex(d.key);
        // the slot is "before rows[slot]" (or after the last rendered row): map it to a view index
        let to: number;
        if (d.slot < rows.length) {
          const bi = viewIndex(keyOf(rows[d.slot]!));
          to = bi > from ? bi - 1 : bi;
        } else {
          const ai = viewIndex(keyOf(rows[rows.length - 1]!));
          to = ai >= from ? ai : ai + 1;
        }
        void commit(d.key, to);
      };

      root.addEventListener("pointerdown", (e) => {
        const b = (e.target as Element | null)?.closest?.<HTMLButtonElement>(".dg-reorder");
        const trEl = b?.closest("tr");
        if (!b || !trEl || !root.contains(b) || e.button !== 0 || drag || kb || blocked()) return;
        e.preventDefault(); // no text selection, no native drag
        b.focus({ preventScroll: true });
        drag = { b, tr: trEl, key: keyOf(trEl), id: e.pointerId, x: e.clientX, y: e.clientY, lastY: e.clientY, started: false, rows: [], slot: -1 };
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic pointer */
        }
        b.addEventListener("pointermove", onMove);
        b.addEventListener("pointerup", onUp);
        b.addEventListener("pointercancel", onLost);
        b.addEventListener("lostpointercapture", onLost);
        document.addEventListener("keydown", onKeyDuringDrag, true);
      }, sig);

      /* ---------- keyboard ---------- */

      const posOf = (g: Grab) => g.from + (dataRows().indexOf(g.tr) - g.dom);

      const release = () => {
        const g = kb;
        kb = null;
        if (!g) return null;
        g.b.setAttribute("aria-pressed", "false");
        g.tr.removeAttribute("data-state");
        return g;
      };

      const cancelKb = () => {
        const g = kb;
        if (!g) return;
        const rows = dataRows();
        g.moving = true;
        place(rows, rows.indexOf(g.tr), g.dom);
        g.moving = false;
        release();
        ctx.announce(m.cancelled(labelByKey(g.key), g.from + 1, grid.viewRows().length));
      };

      root.addEventListener("keydown", (e) => {
        const b = (e.target as Element | null)?.closest?.<HTMLButtonElement>(".dg-reorder");
        const trEl = b?.closest("tr");
        if (!b || !trEl || !root.contains(b)) return;
        if (!kb) {
          if (e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
          const why = blocked();
          if (why) return void ctx.announce(why);
          const rows = dataRows();
          kb = { b, tr: trEl, key: keyOf(trEl), from: viewIndex(keyOf(trEl)), dom: rows.indexOf(trEl), moving: false };
          b.setAttribute("aria-pressed", "true");
          trEl.setAttribute("data-state", "dragging");
          ctx.announce(m.grabbed(labelByKey(kb.key), kb.from + 1, grid.viewRows().length));
          return;
        }
        const g = kb;
        if (g.b !== b) return;
        const n = grid.viewRows().length;
        switch (e.key) {
          case "ArrowUp":
          case "ArrowDown":
          case "Home":
          case "End": {
            e.preventDefault();
            const rows = dataRows();
            const cur = rows.indexOf(g.tr);
            const to = e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : Math.min(rows.length - 1, Math.max(0, cur + (e.key === "ArrowUp" ? -1 : 1)));
            g.moving = true;
            place(rows, cur, to);
            g.moving = false;
            ctx.announce(m.moved(labelByKey(g.key), posOf(g) + 1, n));
            break;
          }
          case " ":
          case "Enter": {
            e.preventDefault();
            const to = posOf(g);
            release();
            if (to === g.from) ctx.announce(m.dropped(labelByKey(g.key), to + 1, n));
            else void commit(g.key, to);
            break;
          }
          case "Escape":
            e.preventDefault();
            e.stopPropagation();
            cancelKb();
            break;
          case "Tab":
            cancelKb();
            break;
        }
      }, sig);

      root.addEventListener("focusout", (e) => {
        if (kb && e.target === kb.b && !kb.moving) cancelKb();
      }, sig);

      // a disabled handle explains itself on click (touch has no hover tooltip)
      root.addEventListener("click", (e) => {
        const b = (e.target as Element | null)?.closest?.(".dg-reorder");
        if (!b || !root.contains(b) || b.getAttribute("aria-disabled") !== "true") return;
        ctx.announce(b.getAttribute("data-dg-tip") ?? "");
      }, sig);

      const move: RowReorderApi["move"] = async (key, to) => {
        if (blocked()) return false;
        const view = grid.viewRows();
        const from = view.findIndex((r) => grid.keyOf(r) === key);
        if (from < 0) return false;
        return commit(key, Math.min(Math.max(0, Math.floor(to)), view.length - 1));
      };

      return {
        api: { enabled: () => !blocked(), move },
        destroy() {
          endDrag();
          release();
          for (const off of offs) off();
          for (const b of buttons()) {
            const wrap = b.parentElement;
            if (wrap?.classList.contains("dg-reorder-wrap")) {
              b.remove();
              wrap.replaceWith(...Array.from(wrap.childNodes));
            } else b.remove();
          }
          line.remove();
          help.remove();
        },
      };
    },
  });
}
rowReorder.moduleName = "rowReorder";
