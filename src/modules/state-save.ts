// Persisted view state: localStorage, 90-day TTL, selective cleanup.
import { notice, warn } from "../core/warn";
import type { DatagridApi, ModuleDef, SortSpec, StateContribution } from "../core/types";

export type StateInclude = "search" | "filters" | "page";

export interface StateSaveOptions {
  /** storage key part; defaults to the grid name, then the table id, then "grid" */
  key?: string;
  /** bump to drop every stored state of this grid (default 1) */
  version?: number;
  /** max age in ms (default 90 days); 0 = never expires */
  ttl?: number;
  /** opt-in parts; search and page are never saved by default, filters only when listed */
  include?: StateInclude[];
  storage?: Storage | null;
  /** write debounce in ms (default 250) */
  delay?: number;
  /** permission flag */
  can?: boolean;
}

export interface StatePayload {
  v: number;
  t: number;
  fp: string[];
  core: {
    sort: SortSpec[];
    pageSize: number;
    hidden: string[];
    search?: string;
    filters?: Record<string, unknown>;
    page?: number;
  };
  modules: Record<string, unknown>;
}

export interface StateApi {
  /** storage key in use */
  readonly key: string;
  /** writes the current state now */
  save(): void;
  /** the stored payload (null when missing, expired or unreadable) */
  read(): StatePayload | null;
  /** removes the stored state; the current view is left as is */
  clear(): void;
  /** removes the stored state, restores the initial view and reloads (never `location.reload()`) */
  reset(): Promise<void>;
}

const DAY = 86_400_000;
/** storage slots of the grids alive on this page */
const liveKeys = new Set<string>();

/** Visibility from the column definitions (core `defaultVisible`). */
function defaultVisibility(grid: DatagridApi): Map<string, boolean> {
  return new Map(grid.columns().map((c) => [c.key, c.defaultVisible]));
}

const allContributions = (grid: DatagridApi): ReadonlyArray<StateContribution> => grid.stateContributions();

function localStore(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null; // sandboxed iframe / blocked storage
  }
}

let warned = false;
function storageWarn(e: unknown): void {
  if (warned) return;
  warned = true;
  warn("DG014", { reason: String((e as Error)?.name ?? e) });
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isSort = (s: unknown): s is SortSpec =>
  isObj(s) && typeof s.key === "string" && (s.dir === "asc" || s.dir === "desc");

/** Parses and validates a stored payload against version and TTL. Exported for tests. */
export function parsePayload(raw: string | null, version: number, ttl: number, now = Date.now()): StatePayload | null {
  if (!raw) return null;
  let p: unknown;
  try {
    p = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObj(p) || p.v !== version || typeof p.t !== "number" || !isObj(p.core)) return null;
  if (ttl > 0 && now - p.t > ttl) return null;
  const core = p.core;
  return {
    v: p.v,
    t: p.t,
    fp: Array.isArray(p.fp) ? p.fp.filter((k): k is string => typeof k === "string") : [],
    core: {
      sort: Array.isArray(core.sort) ? core.sort.filter(isSort).map((s) => ({ key: s.key, dir: s.dir })) : [],
      pageSize: typeof core.pageSize === "number" ? core.pageSize : NaN,
      hidden: Array.isArray(core.hidden) ? core.hidden.filter((k): k is string => typeof k === "string") : [],
      search: typeof core.search === "string" ? core.search : undefined,
      filters: isObj(core.filters) ? core.filters : undefined,
      page: typeof core.page === "number" ? core.page : undefined,
    },
    modules: isObj(p.modules) ? p.modules : {},
  };
}

export function stateSave(opts: StateSaveOptions = {}): ModuleDef<"state", StateApi> {
  return Object.freeze<ModuleDef<"state", StateApi>>({
    name: "state" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid } = ctx;
      const version = opts.version ?? 1;
      const ttl = opts.ttl ?? 90 * DAY;
      const include = new Set(opts.include ?? []);
      // module parts that belong to an opt-in part (a filter panel's controls) follow `include`
      const contributions = (g: DatagridApi) => allContributions(g).filter((c) => !c.part || include.has(c.part));
      const store = opts.storage === undefined ? localStore() : opts.storage;
      const path = typeof location === "undefined" ? "" : location.pathname;
      let id = opts.key ?? grid.name ?? (ctx.table.id || "grid");
      // two grids on one page never share a slot: an unnamed second grid gets "grid-2" (construction order)
      if (liveKeys.has(`${id}:${path}`)) {
        let n = 2;
        while (liveKeys.has(`${id}-${n}:${path}`)) n++;
        notice("stateSave", `storage key "${id}" is taken on this page; using "${id}-${n}". Give the grid a \`name\`.`);
        id = `${id}-${n}`;
      }
      liveKeys.add(`${id}:${path}`);
      const key = `dg:1:${id}:${path}`;

      let initial: {
        sort: SortSpec[];
        pageSize: number;
        search: string;
        filters: Record<string, unknown>;
        modules: Record<string, unknown>;
      } | null = null;
      let lastWritten: string | null = null;
      let muted = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;

      const get = (): string | null => {
        try {
          return store?.getItem(key) ?? null;
        } catch {
          return null;
        }
      };
      const remove = () => {
        try {
          store?.removeItem(key);
        } catch {
          /* blocked storage */
        }
      };

      const snapshot = (): Omit<StatePayload, "t"> => {
        const cols = grid.columns();
        const coreState: StatePayload["core"] = {
          sort: grid.sort(),
          pageSize: grid.pageSize(),
          hidden: cols.filter((c) => !c.visible).map((c) => c.key),
        };
        if (include.has("search")) coreState.search = grid.search();
        if (include.has("filters")) coreState.filters = { ...grid.filters() };
        if (include.has("page")) coreState.page = grid.page();
        const modules: Record<string, unknown> = {};
        for (const c of contributions(grid)) {
          try {
            const v = c.save();
            if (v !== undefined) modules[c.key] = v;
          } catch (e) {
            console.error(e);
          }
        }
        return { v: version, fp: cols.map((c) => c.key).sort(), core: coreState, modules };
      };

      /** Writes when the state changed since the last write (or when forced: sliding TTL). */
      const write = (force = false) => {
        clearTimeout(timer);
        timer = undefined;
        if (!store) return;
        const snap = snapshot();
        const body = JSON.stringify(snap);
        if (!force && body === lastWritten) return;
        try {
          store.setItem(key, JSON.stringify({ ...snap, t: Date.now() }));
          lastWritten = body;
        } catch (e) {
          storageWarn(e);
        }
      };
      const schedule = () => {
        if (muted || !initial) return;
        clearTimeout(timer);
        timer = setTimeout(() => write(), opts.delay ?? 250);
      };
      const flush = () => timer !== undefined && write();

      const read = () => parsePayload(get(), version, ttl);

      /** Applies a stored payload; runs inside ready(), so core loads are held until the first load. */
      const apply = (p: StatePayload) => {
        const cols = grid.columns();
        const known = new Map(cols.map((c) => [c.key, c]));
        const savedKeys = new Set(p.fp);
        // visibility: only columns that existed at save time; new columns keep their default
        const hidden = new Set(p.core.hidden);
        for (const c of cols) if (savedKeys.has(c.key)) grid.setColumnVisible(c.key, !hidden.has(c.key));
        // sort: drop unknown / unsortable keys; an emptied sort keeps the default
        const sort = p.core.sort.filter((s) => known.get(s.key)?.sortable);
        if (sort.length || !p.core.sort.length) {
          if (JSON.stringify(sort) !== JSON.stringify(grid.sort())) grid.sort(sort);
        }
        // page size: positive integers only, clamped to maxPageSize
        const max = grid.maxPageSize;
        const size = p.core.pageSize;
        if (Number.isInteger(size) && size > 0 && grid.pageSize() > 0) grid.pageSize(Math.min(size, max));
        if (include.has("search") && p.core.search) grid.search(p.core.search);
        if (include.has("filters") && p.core.filters && Object.keys(p.core.filters).length) grid.filters(p.core.filters);
        for (const c of contributions(grid)) {
          if (!(c.key in p.modules)) continue;
          try {
            c.load(p.modules[c.key]);
          } catch (e) {
            console.error(e);
          }
        }
        // before the first load the core takes the page as is; an out-of-range page is corrected after it
        const page = p.core.page;
        if (include.has("page") && page && page > 1) grid.page(page);
      };

      const offs: Array<() => void> = [];
      ctx.ready(() => {
        defaultVisibility(grid);
        initial = {
          sort: grid.sort(),
          pageSize: grid.pageSize(),
          search: grid.search(),
          filters: { ...grid.filters() },
          modules: {},
        };
        for (const c of contributions(grid)) {
          try {
            initial.modules[c.key] = c.save();
          } catch {
            /* ignore */
          }
        }
        const raw = get();
        const p = parsePayload(raw, version, ttl);
        if (raw && !p) remove(); // corrupt, other version or expired
        if (p) {
          muted++;
          try {
            apply(p);
          } finally {
            muted--;
          }
          // touch: refresh `t` so the TTL slides with use
          queueMicrotask(() => write(true));
        } else lastWritten = JSON.stringify(snapshot());

        for (const ev of ["sort", "pagesize", "columnchange"]) offs.push(grid.on(ev, schedule));
        if (include.has("search")) offs.push(grid.on("search", schedule));
        if (include.has("page")) offs.push(grid.on("page", schedule));
        if (include.has("filters") || contributions(grid).length) offs.push(grid.on("load", schedule));
      });

      const onHide = () => flush();
      if (typeof window !== "undefined") window.addEventListener("pagehide", onHide, { signal: ctx.signal });

      const reset = async () => {
        clearTimeout(timer);
        timer = undefined;
        remove();
        const init = initial;
        if (!init) return;
        // no intermediate loads while restoring; one reload follows
        muted++;
        try {
          grid.batch(() => {
          const d = defaultVisibility(grid);
          for (const c of grid.columns()) {
            const v = d.get(c.key);
            if (v !== undefined) grid.setColumnVisible(c.key, v);
          }
          grid.sort(init.sort);
          if (grid.pageSize() > 0) grid.pageSize(init.pageSize);
          if (include.has("search")) grid.search(init.search);
          if (include.has("filters")) {
            const patch: Record<string, unknown> = {};
            for (const k of Object.keys(grid.filters())) patch[k] = null;
            Object.assign(patch, init.filters);
            grid.filters(patch);
          }
          for (const c of contributions(grid)) {
            if (!(c.key in init.modules)) continue;
            try {
              c.load(init.modules[c.key]);
            } catch (e) {
              console.error(e);
            }
          }
          });
        } finally {
          muted--;
        }
        lastWritten = JSON.stringify(snapshot());
        await grid.reload();
      };

      return {
        api: {
          key,
          save: () => write(true),
          read,
          clear: () => {
            clearTimeout(timer);
            timer = undefined;
            remove();
            lastWritten = null;
          },
          reset,
        },
        destroy() {
          flush();
          for (const off of offs) off();
          liveKeys.delete(`${id}:${path}`);
        },
      };
    },
  });
}
stateSave.moduleName = "state";
