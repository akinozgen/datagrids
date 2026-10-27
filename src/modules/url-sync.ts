// URL ↔ grid state: ?q= ?sort=-tarih ?page= ?f.<key>= — shareable links; the URL wins at init.
import { notice } from "../core/warn";
import type { ModuleDef, SortSpec } from "../core/types";

export interface UrlSyncOptions {
  /** filter keys allowed in the URL (`f.<key>`); default: the filterPanel fields */
  keys?: string[];
  /** key prefix (`<ns>.q`); `true` = the grid name. A second grid without one is prefixed automatically */
  namespace?: string | boolean;
  /** "replace" (default) rewrites the entry; "push" adds history entries and follows back/forward */
  mode?: "replace" | "push";
  /** permission flag */
  can?: boolean;
}

export interface UrlState {
  q?: string;
  /** present = given in the URL (an empty `sort=` means "no sort") */
  sort?: SortSpec[];
  page?: number;
  filters: Record<string, string | string[]>;
}

export interface UrlSyncApi {
  /** shareable link of the current view */
  link(): string;
}

type Panel = {
  raw(): Record<string, string | string[] | null>;
  set(p: Record<string, unknown>, o?: { reload?: boolean }): void;
};

/** Parses this grid's part of a query string. Exported for tests. */
export function readUrlState(search: string, ns = ""): UrlState {
  const sp = new URLSearchParams(search);
  const p = ns ? `${ns}.` : "";
  const out: UrlState = { filters: {} };
  const q = sp.get(`${p}q`);
  if (q !== null) out.q = q;
  const sort = sp.get(`${p}sort`);
  if (sort !== null)
    out.sort = sort.split(",").map((t) => t.trim()).filter(Boolean).map((t) =>
      t.startsWith("-") ? { key: t.slice(1), dir: "desc" as const } : { key: t.replace(/^\+/, ""), dir: "asc" as const },
    );
  const page = parseInt(sp.get(`${p}page`) ?? "", 10);
  if (page > 1) out.page = page;
  for (const k of new Set(sp.keys())) {
    if (!k.startsWith(`${p}f.`)) continue;
    const all = sp.getAll(k);
    out.filters[k.slice(p.length + 2)] = all.length > 1 ? all : all[0]!;
  }
  return out;
}

/** Replaces this grid's part of `href` with `s`; other parameters and the hash are kept. Exported for tests. */
export function writeUrlState(href: string, s: UrlState, ns = ""): string {
  const u = new URL(href);
  const p = ns ? `${ns}.` : "";
  const sp = u.searchParams;
  for (const k of Array.from(new Set(sp.keys())))
    if (k === `${p}q` || k === `${p}sort` || k === `${p}page` || k.startsWith(`${p}f.`)) sp.delete(k);
  if (s.q) sp.set(`${p}q`, s.q);
  if (s.sort) sp.set(`${p}sort`, s.sort.map((x) => (x.dir === "desc" ? "-" : "") + x.key).join(","));
  if (s.page && s.page > 1) sp.set(`${p}page`, String(s.page));
  for (const [k, v] of Object.entries(s.filters)) for (const x of Array.isArray(v) ? v : [v]) sp.append(`${p}f.${k}`, x);
  return u.href;
}

const sameSort = (a: SortSpec[], b: SortSpec[]) =>
  a.length === b.length && a.every((x, i) => x.key === b[i]!.key && x.dir === b[i]!.dir);
const scalar = (v: unknown): v is string | number | boolean => ["string", "number", "boolean"].includes(typeof v);
const used = new Set<string>();

export function urlSync(opts: UrlSyncOptions = {}): ModuleDef<"urlSync", UrlSyncApi> {
  return Object.freeze<ModuleDef<"urlSync", UrlSyncApi>>({
    name: "urlSync" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid } = ctx;
      // a grid with neither name nor id still gets its own keys (construction order: g2, g3, …)
      let auto = grid.name || ctx.table.id;
      if (!auto) {
        let n = 2;
        while (used.has(`g${n}`)) n++;
        auto = `g${n}`;
      }
      let ns = opts.namespace === true ? auto : opts.namespace || "";
      if (used.has(ns)) {
        notice("urlSync", `URL keys "${ns || "q/sort/page"}" are taken; using namespace "${auto}".`);
        ns = auto;
      }
      used.add(ns);
      const panel = () => (grid as unknown as { filterPanel?: Panel }).filterPanel;
      const keys = () => opts.keys ?? Object.keys(panel()?.raw() ?? {});
      let baseSort: SortSpec[] | null = null;
      let baseFp: Record<string, unknown> = {};
      /** writes start after the first load: init restores never touch the history */
      let started = false;
      let muted = 0;
      let pendingPage = 0;
      /** push mode: init and back/forward results replace the entry instead of adding one */
      let replaceNext = true;
      const offs: Array<() => void> = [];
      // the configured sort, before stateSave or the URL change it
      offs.push(ctx.on("headrender", () => (baseSort ??= grid.sort())));

      const valid = (s: SortSpec[]) => s.filter((x) => grid.columns().find((c) => c.key === x.key)?.sortable);

      const current = (): UrlState => {
        const s: UrlState = { filters: {} };
        const q = grid.search();
        if (q) s.q = q;
        const sort = grid.sort();
        if (!sameSort(sort, baseSort ?? [])) s.sort = sort;
        s.page = grid.page();
        const fp = panel()?.raw() ?? {};
        const core = grid.filters();
        for (const k of keys()) {
          const v = k in fp ? fp[k] : core[k];
          if (k in fp && JSON.stringify(v) === JSON.stringify(baseFp[k])) continue;
          if (scalar(v) && v !== "") s.filters[k] = String(v);
          else if (Array.isArray(v) && v.length && v.every(scalar)) s.filters[k] = v.map(String);
        }
        return s;
      };
      const link = () => writeUrlState(location.href, current(), ns);
      const write = () => {
        if (!started || muted || pendingPage) return;
        const href = link();
        if (href === location.href) return void (replaceNext = false);
        if (opts.mode === "push" && !replaceNext) history.pushState(null, "", href);
        else history.replaceState(history.state, "", href);
        replaceNext = false;
      };

      /** Applies URL values; `complete` (back/forward) resets what the URL leaves out. Loads are held. */
      const apply = (t: UrlState, complete: boolean) => {
        const hold = grid.on("beforeLoad", (e) => e.cancel());
        muted++;
        try {
          const fp = panel();
          const fields = fp?.raw() ?? {};
          const fpPatch: Record<string, unknown> = {};
          const corePatch: Record<string, unknown> = {};
          for (const k of keys()) {
            const has = k in t.filters;
            if (!has && !complete) continue;
            if (k in fields) fpPatch[k] = has ? t.filters[k] : baseFp[k];
            else corePatch[k] = has ? t.filters[k] : null;
          }
          if (Object.keys(fpPatch).length) fp!.set(fpPatch, { reload: false });
          if (Object.keys(corePatch).length) grid.filters(corePatch);
          if (t.q !== undefined || complete) grid.search(t.q ?? "");
          if (t.sort || complete) {
            const sort = valid(t.sort ?? baseSort ?? []);
            // unknown keys only (`?sort=bogus`) leave the sort alone; an empty `sort=` clears it
            if ((sort.length || !t.sort?.length) && !sameSort(sort, grid.sort())) grid.sort(sort);
          }
          // the page needs a row count: set now when known, re-applied after the next load
          pendingPage = t.page ?? (complete ? 1 : 0);
          if (pendingPage) grid.page(pendingPage);
        } finally {
          hold();
          muted--;
        }
      };

      offs.push(
        grid.on("load", () => {
          started = true;
          const p = pendingPage;
          pendingPage = 0;
          if (p && grid.page() !== p) grid.page(p);
          else write();
        }),
      );
      for (const ev of ["beforeLoad", "search", "sort", "page"]) offs.push(grid.on(ev, write));

      ctx.ready(() => {
        baseSort ??= grid.sort();
        baseFp = { ...(panel()?.raw() ?? {}) };
        const target = readUrlState(location.search, ns);
        const loaded = grid.status().loaded;
        apply(target, false);
        if (loaded) void grid.load();
        else {
          // a module registered after this one (stateSave) may restore over the URL: re-apply once
          const off = grid.on("beforeLoad", (e) => {
            off();
            const sort = target.sort && valid(target.sort);
            // filters too: a shared link must not lose to a filter set restored from storage
            const norm = (v: unknown) => JSON.stringify(Array.isArray(v) ? v.map(String) : v == null || v === "" ? null : String(v));
            const cur: Record<string, unknown> = { ...grid.filters(), ...(panel()?.raw() ?? {}) };
            const fdrift = Object.entries(target.filters).some(([k, v]) => norm(cur[k]) !== norm(v));
            const drift =
              (target.q !== undefined && grid.search() !== target.q) || (sort?.length && !sameSort(sort, grid.sort())) || fdrift;
            if (!drift) return;
            e.cancel();
            apply(target, false);
            void grid.load();
          });
          offs.push(off);
        }
      });

      if (opts.mode === "push")
        window.addEventListener(
          "popstate",
          () => {
            const t = readUrlState(location.search, ns);
            if (writeUrlState(location.href, t, ns) === link()) return; // not this grid's entry (hash, other grid)
            apply(t, true);
            replaceNext = true;
            void grid.load();
          },
          { signal: ctx.signal },
        );

      return {
        api: { link },
        destroy() {
          for (const off of offs) off();
          used.delete(ns);
        },
      };
    },
  });
}
urlSync.moduleName = "urlSync";
