// Multi-column sort: Shift+click (or Shift+Enter) on a sortable header adds it as the next sort key;
// again flips its direction, a third time removes it. Secondary keys show their rank; aria-sort stays on
// the primary column only (ARIA allows one), the rest is in the button's name and announced.
import type { ModuleDef, SortSpec } from "../core/types";
import { h, setTip } from "../core/util";

export interface MultiSortMessages {
  hint: string;
  rank: (n: number, dir: "asc" | "desc") => string;
  announce: (cols: string) => string;
}
const tr: MultiSortMessages = {
  hint: "Shift+tık: ek sıralama ölçütü",
  rank: (n, d) => `, ${n}. sıralama, ${d === "asc" ? "artan" : "azalan"}`,
  announce: (c) => `Sıralama: ${c}`,
};
const en: MultiSortMessages = {
  hint: "Shift+click: add a sort key",
  rank: (n, d) => `, sort key ${n}, ${d === "asc" ? "ascending" : "descending"}`,
  announce: (c) => `Sorted by ${c}`,
};

export interface MultiSortOptions {
  /** most keys at once (default 3) */
  max?: number;
  messages?: Partial<MultiSortMessages>;
  /** permission flag */
  can?: boolean;
}

export interface MultiSortApi {
  /** adds / flips / removes a key like a Shift+click */
  toggle(key: string): void;
}

export function multiSort(opts: MultiSortOptions = {}): ModuleDef<"multiSort", MultiSortApi> {
  return Object.freeze<ModuleDef<"multiSort", MultiSortApi>>({
    name: "multiSort" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid, table } = ctx;
      const m: MultiSortMessages = { ...(ctx.locale.startsWith("tr") ? tr : en), ...opts.messages };
      const max = Math.max(2, opts.max ?? 3);

      const toggle = (key: string) => {
        const cur = grid.sort();
        const i = cur.findIndex((s) => s.key === key);
        let next: SortSpec[];
        if (i < 0) next = [...cur, { key, dir: "asc" as const }].slice(-max);
        else if (cur[i]!.dir === "asc") next = cur.map((s, j) => (j === i ? { key, dir: "desc" as const } : s));
        else next = cur.filter((_, j) => j !== i);
        grid.sort(next);
        if (next.length > 1) {
          const title = (k: string) => grid.columns().find((c) => c.key === k)?.title ?? k;
          ctx.announce(m.announce(next.map((s) => `${title(s.key)} ${s.dir === "asc" ? "↑" : "↓"}`).join(", ")));
        }
      };

      const paint = () => {
        const sort = grid.sort();
        const multi = sort.length > 1;
        for (const th of Array.from(table.tHead?.rows[0]?.cells ?? [])) {
          const btn = th.querySelector<HTMLElement>(":scope > .dg-sort");
          if (!btn) continue;
          setTip(btn, m.hint, true);
          btn.querySelector(".dg-sort-rank")?.remove();
          btn.querySelector(".dg-sort-rank-sr")?.remove();
          const i = sort.findIndex((s) => s.key === th.getAttribute("data-key"));
          if (!multi || i < 0) {
            th.removeAttribute("data-sort-dir");
            th.removeAttribute("data-sort-rank");
            continue;
          }
          th.setAttribute("data-sort-rank", String(i + 1));
          // the primary column already has aria-sort; the others get a visual direction
          if (i > 0) th.setAttribute("data-sort-dir", sort[i]!.dir);
          else th.removeAttribute("data-sort-dir");
          btn.append(
            h("span", { class: "dg-sort-rank", "aria-hidden": "true" }, String(i + 1)),
            h("span", { class: "dg-sort-rank-sr dg-offscreen" }, m.rank(i + 1, sort[i]!.dir)),
          );
        }
      };

      table.addEventListener(
        "click",
        (e) => {
          if (!(e as MouseEvent).shiftKey) return;
          const btn = (e.target as Element).closest(".dg-sort");
          const th = btn?.closest("th");
          if (!btn || !th || th.closest("table") !== table) return;
          e.stopPropagation();
          e.preventDefault();
          toggle(th.getAttribute("data-key")!);
        },
        { capture: true, signal: ctx.signal },
      );
      // Shift+click selects text in some browsers: keep the header clean
      table.addEventListener("mousedown", (e) => e.shiftKey && (e.target as Element).closest(".dg-sort") && e.preventDefault(), { signal: ctx.signal });

      ctx.on("sort", paint);
      ctx.on("headrender" as never, paint as never);
      ctx.ready(paint);

      return {
        api: { toggle },
        destroy() {
          for (const el of Array.from(table.querySelectorAll(".dg-sort-rank, .dg-sort-rank-sr"))) el.remove();
          for (const th of Array.from(table.querySelectorAll("th[data-sort-rank]"))) {
            th.removeAttribute("data-sort-rank");
            th.removeAttribute("data-sort-dir");
          }
          for (const b of Array.from(table.querySelectorAll<HTMLElement>(".dg-sort[data-dg-tip]"))) setTip(b, null, true);
        },
      };
    },
  });
}

// stable name for grid.module(multiSort) after minification
multiSort.moduleName = "multiSort";
