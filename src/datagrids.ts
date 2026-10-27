import type {
  ActionOptions, AnyModule, CellContext, ConfirmOptions, ColumnDef, CoreEvents, DataSource, DatagridApi, DatagridError, DatagridOptions,
  GridStatus, HostAdapters, LoadResult, ModuleContext, ModuleInput, Query, RequestMiddleware, ResolvedColumn,
  Row, RowContext, SortInput, SortSpec, StateContribution, ToolbarItem,
} from "./core/types";
import { en, mergeMessages, tr as trMessages, type Messages } from "./core/i18n";
import { config } from "./core/config";
import { byName, byTable } from "./core/registry";
import { fail, notice, suggest, warn } from "./core/warn";
import { debounce, frag, getPath, h, htmlToText, nextId, toggleAttr } from "./core/util";
import { icons } from "./dom/icons";
import { arraySourceDef, domSourceDef } from "./data/sources";
import { httpError, fetchError } from "./data/errors";
import { confirmDialog } from "./dom/dialog";
import { cellValue, runClient } from "./data/client";
import * as columnFactories from "./columns/index";

const OPTION_KEYS = [
  "columns", "use", "name", "label", "labelledBy", "pageSize", "pageSizes", "maxPageSize", "paging", "sort",
  "search", "load", "rowKey", "virtual", "maxHeight", "errorMode", "messages", "locale", "host", "surface",
  "title", "description", "size", "density", "theme", "head", "striped", "wrap", "count", "rowTone",
  "rowClass", "rowAttrs", "rowClick", "data",
] as const;

const CORE_MEMBERS = new Set([
  "root", "table", "name", "messages", "on", "emit", "delegate", "use", "module", "load", "reload", "setData",
  "addRows", "removeRow", "refreshRow", "setColumns", "destroy", "search", "page", "pageSize", "sort", "columns",
  "setColumnVisible", "columnOrder", "lastRequestParams", "filters", "query", "rows", "keyOf", "rowByKey", "lastResponse", "viewRows", "status",
  "exportRows", "locale", "mode", "maxPageSize", "batch", "stateContributions",
  "action", "remount", "notify", "confirm", "showBanner",
]);

const SOURCE_SLOT = "source";

/** DataTables-style option names → where the capability lives now. */
const LEGACY_HINTS: Record<string, string> = {
  serverside: "Server mode is a module: use `serverSide({ url, protocol: yajra() })`.",
  ajax: "Use the `serverSide({ url, … })` module.",
  dom: "Use toolbar slots (`start`, `end`, `filters`).",
  buttons: "Attach button modules (`button.reload()`, `excel()`…).",
  language: "Use `messages`.",
  statesave: "Use the `stateSave()` module.",
  lengthmenu: "Use `pageSizes`.",
  pagelength: "Use `pageSize`.",
  order: "Use `sort: [['key', 'desc']]`.",
  deferloading: "Use `load: 'manual'`.",
  columndefs: "Put options on the column definitions.",
};

interface Attached {
  def: AnyModule;
  api: unknown;
  destroy?: () => void;
}

/** Records the original attribute values of host-owned elements so destroy() can restore them. */
class Journal {
  private attrs = new Map<Element, Map<string, string | null>>();
  private kids = new Map<Element, Node[]>();
  /** remembers the original child order once (reordered host cells) */
  children(el: Element): void {
    if (!this.kids.has(el)) this.kids.set(el, Array.from(el.childNodes));
  }
  original(el: Element): Node[] | undefined {
    return this.kids.get(el);
  }
  set(el: Element, name: string, value: string | null): void {
    let m = this.attrs.get(el);
    if (!m) this.attrs.set(el, (m = new Map()));
    if (!m.has(name)) m.set(name, el.getAttribute(name));
    if (value === null) el.removeAttribute(name);
    else el.setAttribute(name, value);
  }
  restore(): void {
    for (const [el, nodes] of this.kids) el.replaceChildren(...nodes);
    this.kids.clear();
    for (const [el, m] of this.attrs) for (const [n, v] of m) v === null ? el.removeAttribute(n) : el.setAttribute(n, v);
    this.attrs.clear();
  }
}

type DatagridCtor = {
  new (target: HTMLTableElement | string, options?: DatagridOptions & { data?: Row[] }): Datagrid;
  get(target: Element | string | null): Datagrid | null;
};

export class Datagrid implements DatagridApi {
  /** Returns the grid on an element (or selector) — never creates one. */
  static get(target: Element | string | null): Datagrid | null {
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return null;
    const t = el.closest?.("table") ?? el;
    const hit = (byTable.get(t) as Datagrid | undefined) ?? (byTable.get(el) as Datagrid | undefined);
    if (hit) return hit;
    // an element of the grid's chrome (toolbar, pager, bulk bar): its root holds the table
    const root = el.closest?.(".dg");
    const table = root?.querySelector(":scope .dg-table");
    return table ? ((byTable.get(table) as Datagrid | undefined) ?? null) : null;
  }

  readonly root!: HTMLDivElement;
  readonly table!: HTMLTableElement;
  readonly name: string | undefined;
  readonly messages!: Messages;

  private o!: DatagridOptions & { data?: Row[] };
  private id = nextId();
  readonly locale!: string;
  private host!: HostAdapters;
  private journal = new Journal();
  private ac = new AbortController();
  private handlers = new Map<string, Set<(d: any) => void>>();
  private modules = new Map<string, Attached>();
  private toolbarItems: ToolbarItem[] = [];
  private rowFns: Array<(tr: HTMLTableRowElement, row: Row, key: string) => void> = [];
  private mws: { fn: RequestMiddleware; enforce?: "pre" | "post" }[] = [];
  private stateParts: StateContribution[] = [];
  private source!: DataSource;
  private sourceName: string | null = null;
  /** the default source picked when none was given; a later `.use(source)` replaces it */
  private implicitSource = false;
  /** modules added with `.use()` after construction (kept for remount) */
  private chained: Array<AnyModule | ReadonlyArray<ModuleInput>> = [];
  private colDefs: ColumnDef[] = [];
  private cols: ResolvedColumn[] = [];
  private colVersion = 0;
  /** display order (keys); null = definition order. The wire keeps the definition order. */
  private order: string[] | null = null;
  private shown: ResolvedColumn[] = [];
  private all: Row[] = [];
  private view: Row[] = [];
  private searchCache = new WeakMap<Row, string>();
  private keyCache = new WeakMap<Row, string>();
  private trByKey = new Map<string, { tr: HTMLTableRowElement; row: Row; v: number }>();
  private keyByTr = new WeakMap<Element, string>();
  private rowByKeyMap = new Map<string, Row>();
  private seq = 0;
  private inflight: AbortController | null = null;
  private busyTimer: ReturnType<typeof setTimeout> | undefined;
  private raw: unknown = null;
  private st = {
    page: 1,
    pageSize: 25,
    sort: [] as SortSpec[],
    search: "",
    filters: {} as Record<string, unknown>,
    status: "idle" as GridStatus["status"],
    loaded: false,
    total: null as number | null,
    filtered: null as number | null,
    hasMore: null as boolean | null,
    error: null as DatagridError | null,
  };
  private dirtyWhileHidden = false;
  private visibleNow = true;
  private destroyed = false;
  private announceAfterLoad: string | null = null;
  private readyFns: Array<() => void> | null = [];
  private booting = false;

  // DOM
  private origParent!: Node | null;
  private origNext!: Node | null;
  private origThead!: HTMLTableSectionElement | null;
  private origBody!: Node[];
  private origTfoot!: HTMLTableSectionElement | null;
  private tbody!: HTMLTableSectionElement;
  private thead!: HTMLTableSectionElement;
  private toolbarEl!: HTMLDivElement;
  private slots!: Record<"start" | "end" | "filters", HTMLDivElement>;
  private aboveEl!: HTMLDivElement;
  private frame!: HTMLDivElement;
  private scroller!: HTMLDivElement;
  private footerEl!: HTMLDivElement;
  private infoEl!: HTMLDivElement;
  private pagerEl!: HTMLElement;
  private sizeSel: HTMLSelectElement | null = null;
  private live!: HTMLDivElement;
  private searchInput: HTMLInputElement | null = null;
  private countEl: HTMLElement | null = null;
  private loadingCard!: HTMLDivElement;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;

  constructor(target: HTMLTableElement | string, options: DatagridOptions & { data?: Row[] } = {}) {
    const table = Datagrid.resolve(target);
    const existing = byTable.get(table);
    if (existing) return existing as Datagrid;

    this.o = options;
    this.table = table;
    this.name = options.name;
    this.locale = options.locale ?? config.locale ?? (document.documentElement.lang || "tr");
    const base = this.locale.startsWith("tr") ? trMessages : en;
    this.messages = mergeMessages(base, config.messages, options.messages);
    this.host = { ...pickHost(config), ...(options.host ?? {}) };
    this.st.pageSize = options.paging === false ? 0 : options.pageSize ?? config.pageSize ?? 25;
    this.checkOptions(options);

    // ---- DOM: wrap the host table (identity kept) ----
    this.origParent = table.parentNode;
    this.origNext = table.nextSibling;
    this.origThead = table.tHead;
    this.origTfoot = table.tFoot;
    let body = table.tBodies[0];
    this.origBody = body ? Array.from(body.childNodes) : [];
    this.createdBody = !body;
    if (!body) body = table.createTBody();
    this.tbody = body;

    this.root = h("div", { class: "dg", "data-state": "loading" }) as HTMLDivElement;
    const a = this.root;
    if (options.surface === "card") a.setAttribute("data-dg-surface", "card");
    if (options.size) a.setAttribute("data-size", options.size);
    if (options.density) a.setAttribute("data-density", options.density);
    if (options.theme) a.setAttribute("data-dg-theme", options.theme);
    if (options.head === "sentence") a.setAttribute("data-dg-head", "sentence");
    if (options.striped) a.setAttribute("data-dg-striped", "");
    if (options.wrap === false) a.setAttribute("data-dg-nowrap", "");

    this.slots = {
      start: h("div", { class: "dg-slot", "data-slot": "start" }),
      end: h("div", { class: "dg-slot", "data-slot": "end" }),
      filters: h("div", { class: "dg-slot", "data-slot": "filters" }),
    };
    this.toolbarEl = h("div", { class: "dg-toolbar" }, this.slots.start, this.slots.end, this.slots.filters);
    this.aboveEl = h("div", { class: "dg-above" });
    const labelId = `${this.id}-label`;
    this.scroller = h("div", { class: "dg-scroll", role: "region" });
    this.loadingCard = h("div", { class: "dg-loading", "aria-hidden": "true" });
    this.loadingCard.append(frag(icons.spinner), h("span", null, this.messages.loading));
    this.frame = h("div", { class: "dg-frame" }, this.loadingCard, this.scroller);
    this.infoEl = h("div", { class: "dg-info" });
    const gridLabel = options.label ?? options.title ?? table.caption?.textContent?.trim();
    this.pagerEl = h("nav", { class: "dg-pager", "aria-label": gridLabel ? `${this.messages.pagination}: ${gridLabel}` : this.messages.pagination });
    this.footerEl = h("div", { class: "dg-footer" }, this.infoEl, h("div", { class: "dg-footer-end" }));
    this.live = h("div", { class: "dg-live dg-offscreen", role: "status", "aria-live": "polite", "aria-atomic": "true" });
    const skip = h("a", { class: "dg-skip", href: `#${this.id}-after` }, this.messages.skip);
    const after = h("span", { id: `${this.id}-after`, tabindex: "-1", class: "dg-after" });

    if (options.surface === "card" && (options.title || options.description)) {
      const head = h("div", { class: "dg-head" },
        h("div", null,
          options.title ? h("div", { class: "dg-title", id: labelId }, options.title) : null,
          options.description ? h("div", { class: "dg-desc" }, options.description) : null),
      );
      a.append(head);
    }
    this.frame.prepend(skip);
    a.append(this.toolbarEl, this.aboveEl, this.frame, after, this.footerEl, this.live);
    table.parentNode?.insertBefore(a, table);
    this.scroller.append(table);
    this.journal.set(table, "class", (table.getAttribute("class") ? table.getAttribute("class") + " " : "") + "dg-table");

    // accessible name
    if (options.labelledBy) this.scroller.setAttribute("aria-labelledby", options.labelledBy);
    else if (options.label || options.title) {
      if (!options.title) a.prepend(h("span", { id: labelId, class: "dg-offscreen" }, options.label!));
      this.scroller.setAttribute("aria-labelledby", labelId);
    } else if (table.caption) {
      if (!table.caption.id) this.journal.set(table.caption, "id", labelId);
      this.scroller.setAttribute("aria-labelledby", table.caption.id);
    } else {
      this.scroller.setAttribute("aria-label", this.messages.regionLabel);
      warn("DG002");
    }
    if (options.maxHeight) {
      a.setAttribute("data-dg-sticky-head", "");
      this.scroller.style.setProperty("--dg-max-h", options.maxHeight);
    }
    if (options.head !== "sentence" && !document.documentElement.lang) warn("DG011");

    byTable.set(table, this);
    if (this.name) byName.set(this.name, this);

    // ---- modules (array form validated synchronously) ----
    if (options.use) this.attachAll(options.use);
    if (!this.source) {
      const def = options.data ? arraySourceDef(options.data) : body.rows.length ? domSourceDef() : arraySourceDef([]);
      this.attachOne(def);
      this.implicitSource = !options.data;
    }
    this.validateRequires();
    this.source.prepare?.(table);
    this.capPageSize();

    // ---- columns ----
    this.colDefs = options.columns ?? this.source.columns?.(table) ?? this.columnsFromHead();
    this.resolveColumns();
    this.thead = document.createElement("thead");
    if (this.origThead) this.origThead.replaceWith(this.thead);
    else table.insertBefore(this.thead, table.tBodies[0] ?? null);
    // only an explicit `sort: []` opts out of the protocol's default order; clearing the sort later
    // (state reset, `?sort=`) goes back to the same wire as the first load
    this.sortOptOut = Array.isArray(options.sort) && options.sort.length === 0;
    if (options.sort) this.st.sort = normalizeSort(options.sort);
    else if (this.source.mode === "server" && this.cols.some((c) => c.sortable)) this.st.sort = [];

    this.buildToolbar();
    this.renderHead();
    this.initialSig = this.querySig();
    const ready = this.readyFns ?? [];
    this.readyFns = null;
    this.booting = true; // state restores in ready() must not trigger loads; the first load follows
    for (const fn of ready) fn();
    this.booting = false;
    this.renderFooter();
    this.bindEvents();
    this.observe();

    const mode = options.load ?? "eager";
    if (mode === "manual") this.setStatus("idle");
    else queueMicrotask(() => {
      if (this.destroyed) return;
      if (mode === "visible" && !this.visibleNow) this.dirtyWhileHidden = true;
      else void this.load();
    });
    queueMicrotask(() => this.emit("init", { grid: this }));
  }

  private static resolve(target: HTMLTableElement | string): HTMLTableElement {
    if (typeof target !== "string") return target;
    const list = document.querySelectorAll<HTMLTableElement>(target);
    if (list.length !== 1) fail("DG005", { name: target, count: list.length });
    const t = list[0]!;
    if (t.tagName !== "TABLE") fail("DG005", { name: target, count: 0 });
    return t;
  }

  private checkOptions(o: object): void {
    for (const k of Object.keys(o)) {
      if ((OPTION_KEYS as readonly string[]).includes(k)) continue;
      const legacy = LEGACY_HINTS[k.toLowerCase()];
      const s = legacy ? null : suggest(k, OPTION_KEYS);
      warn("DG001", { name: k, hint: legacy ? ` ${legacy}` : s ? ` Did you mean \`${s}\`?` : "" });
    }
  }

  /** Column definitions from <thead> attributes. */
  private columnsFromHead(): ColumnDef[] {
    const ths = this.origThead?.rows[0]?.cells;
    if (!ths?.length) return [];
    return Array.from(ths, (th, i) => {
      const d = th.dataset;
      const key = d.dgKey || `c${i}`;
      const title = (th.textContent ?? "").trim();
      const base: Partial<ColumnDef> = { title };
      if (d.dgSortable === "false") base.sortable = false;
      if (d.dgSearchable === "false") base.searchable = false;
      if (d.dgVisible === "false") base.visible = false;
      if (d.dgHideable === "false") base.hideable = false;
      if (d.dgExport === "false") base.exportable = false;
      if (d.dgSortKey) base.sortKey = d.dgSortKey;
      switch (d.dgType) {
        case "number": return columnFactories.number(key, base);
        case "money": return columnFactories.money(key, base);
        case "date": return columnFactories.date(key, base);
        case "html": return columnFactories.html(key, base);
        case "text": return columnFactories.text(key, base);
        default: return { key, ...base };
      }
    });
  }

  private resolveColumns(): void {
    const defs = this.o.rowClick && !this.colDefs.some((c) => c.col === "go")
      ? [...this.colDefs, { key: "__go", col: "go" as const, title: "", sortable: false, searchable: false, exportable: false, hideable: false, align: "end" as const }]
      : this.colDefs;
    this.cols = defs
      .map((c, hostIndex) => ({ c, hostIndex }))
      .filter(({ c }) => c.can !== false)
      .map(({ c, hostIndex }, index) => ({
        ...c,
        index,
        hostIndex,
        // control columns (select, actions, …) stay untitled unless given one; their module labels them
        title: c.title ?? (c.col ? "" : c.key),
        sortable: c.sortable ?? !c.col,
        searchable: c.searchable ?? !c.col,
        visible: c.visible ?? true,
        hideable: c.hideable ?? !c.col,
        exportable: c.exportable ?? !c.col,
        defaultVisible: c.visible ?? true,
      }));
    this.order = this.order && this.normalizeOrder(this.order);
    this.applyOrder();
    // searchable columns may have changed
    this.searchCache = new WeakMap();
  }

  private applyOrder(): void {
    const at = new Map((this.order ?? []).map((k, i) => [k, i]));
    this.shown = this.order ? this.cols.slice().sort((a, b) => at.get(a.key)! - at.get(b.key)!) : this.cols;
    this.colVersion++;
    this.trByKey.clear();
  }

  /** Full display order; special (`col`) and sticky columns keep their slots. null when it equals the definition order. */
  private normalizeOrder(keys: readonly string[]): string[] | null {
    const movable = this.cols.filter((c) => !c.col && !c.sticky).map((c) => c.key);
    const want = keys.filter((k, i) => movable.includes(k) && keys.indexOf(k) === i);
    for (const k of movable) if (!want.includes(k)) want.push(k);
    let j = 0;
    const out = this.cols.map((c) => (c.col || c.sticky ? c.key : want[j++]!));
    return out.every((k, i) => k === this.cols[i]!.key) ? null : out;
  }

  columnOrder(keys?: readonly string[]): string[] {
    if (keys) {
      const next = this.normalizeOrder(keys);
      if (JSON.stringify(next) !== JSON.stringify(this.order)) {
        this.order = next;
        this.applyOrder();
        this.renderHead();
        this.relockBody();
        this.emit("columnchange", { columns: this.shown });
      }
    }
    return this.shown.map((c) => c.key);
  }

  /* ============================== events ============================== */

  on<K extends keyof CoreEvents>(type: K, fn: (d: CoreEvents[K]) => void): () => void;
  on(type: string, fn: (d: any) => void): () => void;
  on(type: string, fn: (d: any) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  /** Emits an event; returns false when a listener cancelled it. */
  emit(type: string, detail: any): boolean {
    let cancelled = false;
    const d = detail && typeof detail === "object" ? detail : {};
    if ("cancel" in d === false && type.startsWith("before")) d.cancel = () => (cancelled = true);
    for (const fn of Array.from(this.handlers.get(type) ?? [])) {
      try {
        fn(d);
      } catch (e) {
        console.error(e);
      }
    }
    this.root.dispatchEvent(new CustomEvent(`dg:${type}`, { detail: d }));
    return !cancelled;
  }

  delegate(type: string, selector: string, fn: (e: Event, ctx: RowContext) => void): () => void {
    const listener = (e: Event) => {
      const t = e.target as Element | null;
      const hit = t?.closest?.(selector);
      if (!hit || !this.root.contains(hit)) return;
      const tr = hit.closest("tr");
      const key = tr ? this.keyByTr.get(tr) : undefined;
      const row = key !== undefined ? this.rowByKeyMap.get(key) : undefined;
      if (!tr || key === undefined || !row) return;
      const td = hit.closest("td") as HTMLTableCellElement | null;
      const colKey = td?.getAttribute("data-key");
      fn(e, { row, key, tr: tr as HTMLTableRowElement, td, column: this.cols.find((c) => c.key === colKey) ?? null });
    };
    this.root.addEventListener(type, listener);
    return () => this.root.removeEventListener(type, listener);
  }

  /* ============================== modules ============================== */

  use(m: AnyModule | ReadonlyArray<ModuleInput>): this {
    this.chained.push(m);
    this.attachAll([m]);
    queueMicrotask(() => this.validateRequires());
    if (this.cols.length) {
      this.buildToolbar();
      this.renderHead();
      if (this.virtualOn) this.setVirtual(false);
      this.renderBody();
    }
    return this;
  }

  module(m: AnyModule | ((...a: any[]) => AnyModule)): unknown {
    const name = typeof m === "function" ? (m as { moduleName?: string }).moduleName ?? m.name : m.name;
    return this.modules.get(name)?.api ?? null;
  }

  private attachAll(list: ReadonlyArray<ModuleInput>): void {
    for (const m of list) {
      if (Array.isArray(m)) this.attachAll(m);
      else if (m) this.attachOne(m as AnyModule);
    }
  }

  private attachOne(def: AnyModule): void {
    if (CORE_MEMBERS.has(def.name)) fail("DG010", { name: def.name });
    if (def.kind !== "source" && def.name in this && !this.modules.has(def.name)) fail("DG010", { name: def.name });
    if (def.kind === "source" || def.slot === SOURCE_SLOT) {
      if (this.sourceName && !this.implicitSource) fail("DG008", { slot: SOURCE_SLOT, a: this.sourceName, b: def.source?.name ?? def.name });
      if (!def.source) return;
      const replacing = this.implicitSource;
      this.implicitSource = false;
      this.source = def.source;
      this.sourceName = def.source.name ?? def.name;
      if (replacing) {
        // `new Datagrid(el, opts).use(serverSide(…))`: the chained source takes over the default one and the
        // grid is set up as if it had been in `use: [...]` (columns from the head, page size cap)
        this.source.prepare?.(this.table);
        if (!this.o.columns) {
          this.colDefs = this.source.columns?.(this.table) ?? this.columnsFromHead();
          this.resolveColumns();
        }
        this.st.pageSize = this.o.paging === false ? 0 : this.o.pageSize ?? config.pageSize ?? 25;
        this.capPageSize();
        if (this.st.loaded) queueMicrotask(() => void this.reload());
      }
      return;
    }
    if (this.modules.has(def.name)) fail("DG009", { name: def.name });
    const entry: Attached = { def, api: undefined };
    this.modules.set(def.name, entry);
    if (def.can === false || !def.setup) {
      // permission flag: attached but contributes nothing
      entry.api = noopApi();
    } else {
      const out = def.setup(this.moduleContext(def));
      if (out) {
        entry.api = out.api;
        entry.destroy = out.destroy;
      }
    }
    if (entry.api !== undefined)
      Object.defineProperty(this, def.name, { value: entry.api, enumerable: false, configurable: true });
  }

  private validateRequires(): void {
    for (const { def } of this.modules.values()) {
      for (const dep of def.requires ?? []) {
        if (!this.modules.has(dep)) fail("DG007", { name: def.name, dep });
      }
    }
  }

  private moduleContext(def: AnyModule): ModuleContext {
    return {
      grid: this,
      root: this.root,
      table: this.table,
      messages: this.messages,
      host: this.host,
      locale: this.locale,
      signal: this.ac.signal,
      on: this.on.bind(this) as ModuleContext["on"],
      toolbar: (item) => {
        this.toolbarItems.push(item);
        this.placeToolbar(item);
      },
      row: (fn) => this.rowFns.push(fn),
      request: (fn, enforce) => this.mws.push({ fn, enforce: enforce ?? def.enforce }),
      state: (c) => this.stateParts.push(c),
      above: (el) => this.aboveEl.append(el),
      layer: (el) => this.root.append(el),
      announce: (msg) => this.announce(msg),
      requestRender: () => this.renderBody(),
      ready: (fn) => (this.readyFns ? this.readyFns.push(fn) : fn()),
    };
  }

  /** Ordered middleware list: pre → registration order → post. */
  middlewares(): RequestMiddleware[] {
    const pre = this.mws.filter((m) => m.enforce === "pre");
    const mid = this.mws.filter((m) => !m.enforce);
    const post = this.mws.filter((m) => m.enforce === "post");
    return [...pre, ...mid, ...post].map((m) => m.fn);
  }

  private lastParams: Record<string, unknown> = {};

  /** an initial page size above the cap is clamped like a later pageSize(n) */
  private capPageSize(): void {
    const cap = this.o.maxPageSize ?? config.maxPageSize ?? 1000;
    const n = this.st.pageSize;
    if (n > cap || (n < 0 && !(n === -1 && this.source.allowAll))) {
      warn("DG013", { size: n, max: cap });
      this.st.pageSize = cap;
    }
  }

  lastRequestParams(): Record<string, unknown> {
    return { ...this.lastParams };
  }

  stateContributions(): ReadonlyArray<StateContribution> {
    return this.stateParts;
  }

  get mode(): "client" | "server" {
    return this.source.mode;
  }

  get maxPageSize(): number {
    return this.o.maxPageSize ?? config.maxPageSize ?? 1000;
  }

  batch(fn: () => void): void {
    const prev = this.booting;
    this.booting = true;
    try {
      fn();
    } finally {
      this.booting = prev;
    }
  }

  /* ============================== data ============================== */

  query(): Query {
    return {
      page: this.st.page,
      pageSize: this.st.pageSize,
      sort: this.st.sort.slice(),
      search: this.st.search,
      filters: { ...this.st.filters },
      columns: this.cols,
      sortDefault: !this.sortOptOut,
      pristine: this.querySig() === this.initialSig,
    };
  }
  private sortOptOut = false;
  private initialSig = "";
  private querySig(): string {
    return JSON.stringify([this.st.sort, this.st.search, this.st.filters, this.st.page, this.st.pageSize]);
  }

  /** Loads (or reloads) data. Last request wins; responses are matched by sequence, never by `draw`. */
  async load(): Promise<void> {
    if (this.destroyed || this.booting) return;
    const query = this.query();
    if (!this.emit("beforeLoad", { query })) return;
    if (this.source.mode === "client" && this.st.loaded) {
      this.refreshClient();
      return;
    }
    const seq = ++this.seq;
    this.inflight?.abort();
    const ac = (this.inflight = new AbortController());
    this.setStatus(this.st.loaded ? "reloading" : "loading");
    let result: LoadResult;
    try {
      result = await this.source.load(query, {
        signal: ac.signal,
        grid: this,
        middlewares: this.middlewares(),
        host: this.host,
      });
    } catch (e) {
      if (seq !== this.seq || this.destroyed) return;
      if ((e as Error)?.name === "AbortError" || (e as DatagridError)?.kind === "abort") return;
      this.fail(toError(e));
      return;
    }
    if (seq !== this.seq || this.destroyed) return; // stale response
    this.inflight = null;
    this.raw = result.raw ?? null;
    this.lastParams = result.params ?? {};
    if (result.page && result.page !== this.st.page) this.st.page = result.page;
    this.st.loaded = true;
    this.st.error = null;
    if (this.source.mode === "client") {
      this.all = result.rows;
      this.searchCache = new WeakMap();
      this.refreshClient(false);
    } else {
      this.st.total = result.total;
      this.st.filtered = result.filtered ?? result.total;
      this.st.hasMore = result.hasMore ?? null;
      // a restored page or a keepPage reload after deletes can land past the end: step back once
      if (!result.rows.length && this.st.page > 1 && !this.st.hasMore && this.st.filtered != null) {
        const last = Math.max(1, this.pageCount());
        if (this.st.page > last) {
          this.st.page = last;
          return this.load();
        }
      }
      this.view = result.rows;
      this.indexRows(this.view);
      this.commitRender();
    }
    this.emit("response", { raw: result.raw, result });
    this.emit("load", { result, query });
    if (result.error) this.reportError(result.error, true);
  }

  async reload(o: { keepPage?: boolean; silent?: boolean } = {}): Promise<void> {
    if (!o.keepPage) this.st.page = 1;
    // remote client sources (fetchAll) fetch again; in-page rows keep the local edits
    if (this.source.mode === "client" && !this.source.local) this.st.loaded = false;
    this.silent = !!o.silent;
    try {
      await this.load();
    } finally {
      this.silent = false;
    }
  }
  private silent = false;

  private refreshClient(emitLoad = true): void {
    const res = runClient(this.all, this.query(), this.locale, this.searchCache);
    this.st.total = res.total;
    this.st.filtered = res.filtered;
    this.st.hasMore = null;
    const pages = this.pageCount();
    if (this.st.page > pages && pages > 0) {
      this.st.page = pages;
      return this.refreshClient(emitLoad);
    }
    this.view = res.view;
    this.indexRows(this.all);
    this.commitRender();
    if (emitLoad) this.emit("load", { result: res, query: this.query() });
  }

  private indexRows(rows: Row[]): void {
    this.rowByKeyMap.clear();
    rows.forEach((r, i) => this.rowByKeyMap.set(this.keyOf(r, i), r));
  }

  keyOf(row: Row, fallbackIndex?: number): string {
    const cached = this.keyCache.get(row);
    if (cached !== undefined) return cached;
    const rk = this.o.rowKey;
    let k: unknown = typeof rk === "function" ? rk(row) : rk ? getPath(row, rk) : row.id ?? row.DT_RowId;
    if (k == null || k === "") {
      warn("DG003");
      k = `__i${fallbackIndex ?? this.view.indexOf(row)}`;
    }
    const s = String(k);
    this.keyCache.set(row, s);
    return s;
  }

  rowByKey(key: string): Row | undefined {
    return this.rowByKeyMap.get(key);
  }

  rows(): Row[] {
    return this.source.mode === "client" ? this.all.slice() : this.view.slice();
  }

  viewRows(): Row[] {
    return this.view.slice();
  }

  /* ============================== actions (QoL) ============================== */

  notify(kind: "success" | "error" | "info", message: string): void {
    if (this.host.notify) this.host.notify(kind, message);
    else {
      this.announce(message);
      if (kind === "error") this.showBanner({ kind: "server", status: null, message, retryable: false }, this.messages.actionFailed);
    }
  }

  confirm(message: string, o: ConfirmOptions = {}): Promise<boolean> {
    if (this.host.confirm) return this.host.confirm(message, o);
    const m = this.messages;
    return confirmDialog(this.root, message, o, { title: m.confirmTitle, confirm: m.confirmOk, cancel: m.confirmCancel }, this.ac.signal);
  }

  async action(url: string, o: ActionOptions = {}): Promise<unknown> {
    const method = (o.method ?? "POST").toUpperCase();
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new Error(`datagrids: method ${method} is not allowed`);
    const target = new URL(url, location.href);
    if (target.origin !== location.origin || !/^https?:$/.test(target.protocol)) throw new Error("datagrids: action URL must be same-origin");
    if (o.confirm) {
      const c = typeof o.confirm === "string" ? { message: o.confirm } : o.confirm;
      if (!(await this.confirm(c.message, c))) return undefined;
    }
    const headers: Record<string, string> = { Accept: "application/json", ...(o.headers ?? {}) };
    if (this.host.laravel !== false) headers["X-Requested-With"] = "XMLHttpRequest";
    const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
    if (token) headers["X-CSRF-TOKEN"] = token;
    let body: BodyInit | undefined;
    if (o.body instanceof FormData) body = o.body;
    else if (o.body && method !== "GET") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(o.body);
    }
    const doFetch = this.host.fetch ?? ((...a: Parameters<typeof fetch>) => globalThis.fetch(...a));
    let res: Response;
    try {
      res = await doFetch(target.href, { method, headers, body, credentials: "same-origin" });
    } catch (e) {
      const err = fetchError(e, this.messages);
      this.notify("error", err.message);
      throw err;
    }
    let err = await httpError(res, this.messages);
    // a classic controller answering a POST with `return back()` lands on a page (200 HTML): like the
    // jQuery calls it replaces, that is a success; a redirect to the login page stays a session error
    if (err && err.kind === "forbidden" && res.redirected && res.ok) err = null;
    if (err) {
      if (err.kind === "session") {
        this.emit("sessionexpired", { error: err });
        this.host.onSessionExpired?.(err);
      }
      this.notify("error", err.message);
      throw err;
    }
    let out: unknown = null;
    try {
      out = /json/.test(res.headers.get("content-type") ?? "") ? await res.json() : await res.text();
    } catch {
      out = null;
    }
    if (o.success !== false) this.notify("success", o.success ?? (typeof out === "object" && out && typeof (out as { message?: unknown }).message === "string" ? (out as { message: string }).message : this.messages.actionDone));
    if (o.reload !== false) await this.reload({ keepPage: true, ...(o.reload ?? {}) });
    return out;
  }

  async exportRows(scope: "page" | "all" = "page"): Promise<Row[]> {
    if (scope === "page") return this.view.slice();
    if (this.source.mode === "client") {
      const q = { ...this.query(), page: 1, pageSize: 0 };
      return runClient(this.all, q, this.locale, this.searchCache).view;
    }
    const max = this.o.maxPageSize ?? config.maxPageSize ?? 1000;
    let res: LoadResult;
    try {
      res = await this.source.load(
        { ...this.query(), page: 1, pageSize: max },
        { signal: new AbortController().signal, grid: this, middlewares: this.middlewares(), host: this.host },
      );
    } catch (e) {
      const err = toError(e);
      if (err.kind === "session") {
        this.emit("sessionexpired", { error: err });
        this.host.onSessionExpired?.(err);
      }
      throw err;
    }
    // a 200 with an `error` field (yajra) is a failed export, not an empty one
    if (res.error) throw res.error;
    return res.rows;
  }

  lastResponse(): unknown {
    return this.raw;
  }

  setData(rows: Row[]): void {
    this.all = rows.slice();
    this.st.loaded = true;
    this.searchCache = new WeakMap();
    if (this.source.mode === "client") this.refreshClient();
  }

  addRows(rows: Row[], o: { keepPage?: boolean } = {}): void {
    // server pages come from the server: adding local rows would overwrite its counts
    if (this.source.mode !== "client") {
      notice("addRows", "the grid is in server mode; reload() it instead.");
      return;
    }
    this.all = this.all.concat(rows);
    this.searchCache = new WeakMap();
    if (!o.keepPage) this.st.page = this.pageCountFor(this.all.length);
    this.refreshClient();
  }

  removeRow(key: string): void {
    const r = this.rowByKeyMap.get(key);
    if (!r) return;
    this.all = this.all.filter((x) => x !== r);
    this.view = this.view.filter((x) => x !== r);
    if (this.source.mode === "client") this.refreshClient();
    else this.commitRender();
  }

  refreshRow(key: string, row?: Row): void {
    const old = this.rowByKeyMap.get(key);
    if (!old) return;
    // the row may have been edited in place: its cached search text is stale
    this.searchCache.delete(old);
    if (row) {
      this.keyCache.set(row, key);
      this.all = this.all.map((x) => (x === old ? row : x));
      this.view = this.view.map((x) => (x === old ? row : x));
      this.rowByKeyMap.set(key, row);
    }
    const entry = this.trByKey.get(key);
    if (!entry) return;
    const r = this.rowByKeyMap.get(key)!;
    const idx = this.view.indexOf(r);
    const fresh = this.buildRow(r, key, idx);
    if (this.virtualOn) fresh.setAttribute("aria-rowindex", String(idx + 2));
    entry.tr.replaceWith(fresh);
    this.trByKey.set(key, { tr: fresh, row: r, v: this.colVersion });
  }

  setColumns(defs: ColumnDef[]): void {
    this.colDefs = defs;
    this.resolveColumns();
    this.st.sort = this.st.sort.filter((s) => this.cols.some((c) => c.key === s.key));
    this.renderHead();
    if (this.virtualOn) this.setVirtual(false); // the next render locks the new columns' widths
    this.emit("columnchange", { columns: this.shown });
    void this.reload({ keepPage: true });
  }

  columns(): ReadonlyArray<ResolvedColumn> {
    return this.shown;
  }

  setColumnVisible(key: string, visible: boolean): void {
    const c = this.cols.find((x) => x.key === key);
    if (!c || c.visible === visible) return;
    if (!visible && !c.hideable) return;
    c.visible = visible;
    this.applyColumnVisibility();
    if (this.virtualOn) this.relockBody();
    this.emit("columnchange", { columns: this.shown });
  }

  filters(patch?: Record<string, unknown>): Readonly<Record<string, unknown>> {
    if (patch) {
      for (const k in patch) {
        const v = patch[k];
        if (v == null || v === "" || (Array.isArray(v) && !v.length)) delete this.st.filters[k];
        else this.st.filters[k] = v;
      }
      this.st.page = 1;
      this.scroller.scrollTop = 0; // a new order or result set starts at its top
      // the new result count is announced like a search ("12 kayıt bulundu"), not on the restore before the first load
      if (this.st.loaded && !this.booting) this.announceAfterLoad = "found";
      this.st.loaded && this.source.mode === "client" ? this.refreshClient() : void this.load();
    }
    return { ...this.st.filters };
  }

  search(v?: string): string {
    if (v !== undefined && v !== this.st.search) {
      this.st.search = v;
      this.st.page = 1;
      this.scroller.scrollTop = 0; // a new order or result set starts at its top
      if (this.searchInput && this.searchInput.value !== v) this.searchInput.value = v;
      this.syncSearchUi();
      this.announceAfterLoad = "found";
      this.emit("search", { search: v });
      void this.load();
    }
    return this.st.search;
  }

  page(n?: number): number {
    if (n !== undefined && !this.st.loaded && !this.inflight) {
      // restoring (URL/state) before the first load: no clamp, no extra request
      this.st.page = Math.max(1, Math.floor(n));
      return this.st.page;
    }
    if (n !== undefined) {
      // unknown total (simplePaginate, count:none): only `hasMore` bounds the next page
      const max = this.st.filtered == null ? (this.st.hasMore === false ? this.st.page : Infinity) : this.st.hasMore ? Infinity : Math.max(1, this.pageCount());
      const p = Math.min(Math.max(1, Math.floor(n)), max);
      if (p !== this.st.page && this.emit("beforePage", { page: p })) {
        this.st.page = p;
        this.emit("page", { page: p });
        this.announceAfterLoad = "page";
        void this.load();
        this.scroller.scrollTop = 0;
      }
    }
    return this.st.page;
  }

  pageSize(n?: number): number {
    if (n !== undefined && n !== this.st.pageSize) {
      const max = this.o.maxPageSize ?? config.maxPageSize ?? 1000;
      if ((n > max || n < 0) && !(n === -1 && this.source.allowAll)) {
        warn("DG013", { size: n, max });
        n = max;
      }
      this.st.pageSize = n;
      this.st.page = 1;
      this.scroller.scrollTop = 0; // a new order or result set starts at its top
      this.emit("pagesize", { pageSize: n });
      void this.load();
    }
    return this.st.pageSize;
  }

  sort(s?: SortInput): SortSpec[] {
    if (s !== undefined) {
      const next = normalizeSort(s);
      if (this.emit("beforeSort", { sort: next })) {
        this.st.sort = next;
        this.st.page = 1;
        this.scroller.scrollTop = 0; // a new order or result set starts at its top
        this.updateSortUi();
        this.emit("sort", { sort: next });
        const first = next[0];
        const col = first && this.cols.find((c) => c.key === first.key);
        if (!this.booting) this.announce(col ? (first.dir === "asc" ? this.messages.sortedAsc(col.title) : this.messages.sortedDesc(col.title)) : this.messages.sortCleared);
        void this.load();
      }
    }
    return this.st.sort.slice();
  }

  status(): GridStatus {
    const s = this.st;
    return { status: s.status, loaded: s.loaded, total: s.total, filtered: s.filtered, hasMore: s.hasMore, error: s.error };
  }

  private pageCount(): number {
    return this.pageCountFor(this.st.filtered ?? 0);
  }

  private pageCountFor(n: number): number {
    return this.st.pageSize > 0 ? Math.max(1, Math.ceil(n / this.st.pageSize)) : 1;
  }

  /* ============================== status / errors ============================== */

  private setStatus(s: GridStatus["status"]): void {
    this.st.status = s;
    const loading = s === "loading" || s === "reloading";
    toggleAttr(this.table, "aria-busy", loading, "true");
    this.emit("loadingchange", { loading });
    clearTimeout(this.busyTimer);
    if (s === "reloading" && !this.silent) {
      this.busyTimer = setTimeout(() => this.frame.setAttribute("data-busy", "visible"), 300);
    } else this.frame.removeAttribute("data-busy");
    if (s === "loading" || s === "idle" || s === "error") this.renderBody();
    this.root.setAttribute("data-state", this.dataState());
  }

  private dataState(): string {
    const s = this.st.status;
    if (s === "idle") return "idle";
    if (s === "loading") return "loading";
    if (s === "error" && !this.view.length) return "error";
    return this.view.length ? "ready" : this.st.loaded ? "empty" : "loading";
  }

  private fail(err: DatagridError): void {
    this.inflight = null;
    this.reportError(err, this.st.loaded && this.view.length > 0);
  }

  private reportError(err: DatagridError, nonBlocking: boolean): void {
    this.st.error = err;
    if (err.detail) warn("DG012", { detail: err.detail });
    this.emit("error", { error: err });
    if (err.kind === "session") {
      this.emit("sessionexpired", { error: err });
      this.host.onSessionExpired?.(err);
    }
    const mode = this.o.errorMode ?? config.errorMode ?? "inline";
    if (mode === "throw") throw Object.assign(new Error(err.message), err);
    if (mode === "silent") {
      this.setStatus("ready");
      // a failed first load must not spin forever: show the (empty) grid
      if (!nonBlocking) {
        this.view = [];
        this.st.loaded = true;
        this.renderBody();
      }
      return;
    }
    if (nonBlocking) {
      this.setStatus("ready");
      this.showBanner(err);
    } else {
      this.view = [];
      this.setStatus("error");
    }
  }

  /** non-blocking error banner; `title` defaults to the load-error title */
  showBanner(err: DatagridError, title = this.messages.error): void {
    this.aboveEl.querySelector(".dg-banner[data-kind=error]")?.remove();
    const retry = h("button", { type: "button", class: "dg-btn", "data-variant": "ghost" }, this.messages.retry);
    const close = h("button", { type: "button", class: "dg-btn", "data-variant": "ghost", "data-icon-only": true, "aria-label": this.messages.clear, title: this.messages.clear });
    close.append(frag(icons.x));
    const banner = h("div", { class: "dg-banner", "data-tone": err.kind === "session" ? "warn" : "bad", "data-kind": "error", role: "alert" });
    banner.append(frag(icons.alert), h("div", { class: "dg-banner-text" }, h("strong", null, title), " ", err.message), err.retryable ? retry : "", close);
    retry.addEventListener("click", () => {
      banner.remove();
      void this.reload({ keepPage: true });
    });
    close.addEventListener("click", () => banner.remove());
    this.aboveEl.append(banner);
  }

  /* ============================== rendering ============================== */

  private commitRender(): void {
    this.aboveEl.querySelector(".dg-banner[data-kind=error]")?.remove();
    this.setStatus("ready");
    this.renderBody();
    this.renderFooter();
    this.updateCount();
    if (this.announceAfterLoad === "found") this.announce(this.messages.found(this.fmt(this.st.filtered ?? this.view.length)));
    else if (this.announceAfterLoad === "page")
      this.announce(this.st.filtered == null ? this.messages.pageAnnounceUnknown(this.fmt(this.st.page)) : this.messages.pageAnnounce(this.fmt(this.st.page), this.fmt(this.pageCount())));
    this.announceAfterLoad = null;
    this.emit("render", { keys: this.view.map((r) => this.keyOf(r)), rows: this.view });
  }

  private fmt(n: number): string {
    return new Intl.NumberFormat(this.locale).format(n);
  }

  private renderHead(): void {
    const tr = document.createElement("tr");
    for (const c of this.shown) {
      const th = h("th", {
        scope: "col",
        "data-key": c.key,
        "data-col": c.col ?? null,
        "data-align": c.align && c.align !== "start" ? c.align : null,
        "data-sticky": c.sticky ?? null,
        class: c.className ?? null,
      });
      th.hidden = !c.visible;
      if (c.sortable) {
        const btn = h("button", { type: "button", class: "dg-sort" }, h("span", { class: "dg-sort-label" }, c.title));
        btn.append(frag(icons.sort));
        th.append(btn);
      } else if (c.col === "go") th.append(h("span", { class: "dg-offscreen" }, this.messages.openRow));
      else if (c.col !== "select") th.textContent = c.title;
      tr.append(th);
    }
    this.thead.replaceChildren(tr);
    this.updateSortUi();
    this.emit("headrender", { tr });
  }

  private updateSortUi(): void {
    const first = this.st.sort[0];
    for (const th of Array.from(this.thead.querySelectorAll<HTMLTableCellElement>("th[data-key]"))) {
      const k = th.getAttribute("data-key");
      if (first && k === first.key) th.setAttribute("aria-sort", first.dir === "asc" ? "ascending" : "descending");
      else th.removeAttribute("aria-sort");
    }
  }

  /** re-renders the body; virtual mode re-measures its locked column widths */
  private relockBody(): void {
    if (!this.st.loaded) return;
    if (this.virtualOn) this.setVirtual(false);
    this.renderBody();
  }

  private applyColumnVisibility(): void {
    const hidden = new Set(this.cols.filter((c) => !c.visible).map((c) => c.key));
    for (const cell of Array.from(this.table.querySelectorAll<HTMLElement>(":scope > thead > tr > th[data-key], :scope > tbody > tr > td[data-key], :scope > tfoot > tr > td[data-key]"))) {
      const on = hidden.has(cell.getAttribute("data-key")!);
      if (cell.hidden !== on) {
        if (this.isHostNode(cell)) this.journal.set(cell, "hidden", on ? "" : null);
        else cell.hidden = on;
      }
    }
    this.updateStateColspan();
  }

  private isHostNode(el: Element): boolean {
    const tr = el.closest("tr");
    return !!tr && this.origBody.includes(tr);
  }

  private visibleCount(): number {
    return this.cols.filter((c) => c.visible).length || 1;
  }

  private updateStateColspan(): void {
    const td = this.tbody.querySelector<HTMLTableCellElement>(":scope > tr.dg-state-row > td");
    if (td) td.colSpan = this.visibleCount();
  }

  private renderBody(): void {
    const s = this.st.status;
    if (!this.view.length) {
      this.trByKey.clear();
      let kind: string;
      if (s === "idle") kind = "manual";
      else if (s === "loading" || (!this.st.loaded && s !== "error")) kind = "loading";
      else if (s === "error") kind = "error";
      else kind = "empty";
      this.tbody.replaceChildren(this.stateRow(kind));
      this.root.setAttribute("data-state", this.dataState());
      return;
    }
    const want = this.wantsVirtual();
    if (want !== this.virtualOn) this.setVirtual(want);
    if (want) {
      this.renderWindow(true);
      this.root.setAttribute("data-state", this.dataState());
      return;
    }
    const frag2 = document.createDocumentFragment();
    const next = new Map<string, { tr: HTMLTableRowElement; row: Row; v: number }>();
    this.view.forEach((row, i) => {
      frag2.append(this.rowFor(row, i, next));
    });
    this.trByKey = next;
    this.tbody.replaceChildren(frag2);
    this.root.setAttribute("data-state", this.dataState());
  }

  private rowFor(row: Row, i: number, next: Map<string, { tr: HTMLTableRowElement; row: Row; v: number }>): HTMLTableRowElement {
    const key = this.keyOf(row, i);
    const prev = this.trByKey.get(key);
    let tr: HTMLTableRowElement;
    if (prev && prev.row === row && prev.v === this.colVersion && this.source.mode === "client") {
      tr = prev.tr;
      this.decorateRow(tr, row, key, i);
    } else tr = this.buildRow(row, key, i);
    // only a windowed page numbers its rows (renderWindow sets it right after)
    if (!this.virtualOn) tr.removeAttribute("aria-rowindex");
    next.set(key, { tr, row, v: this.colVersion });
    return tr;
  }

  /* ---------- automatic virtual rows ---------- */

  private virtualOn = false;
  private printing = false;
  private heights = new Map<string, number>();
  private avgH = 0;
  private windowRaf = 0;
  private colgroup: HTMLTableColElement | null = null;
  private lockPending = false;
  private createdBody = false;

  private wantsVirtual(): boolean {
    const v = this.o.virtual;
    if (v === false || this.printing) return false;
    const threshold = typeof v === "number" ? v : 300;
    return this.view.length >= threshold;
  }

  private setVirtual(on: boolean): void {
    this.virtualOn = on;
    toggleAttr(this.root, "data-dg-virtual", on);
    if (on) {
      // columns a module collapsed (responsive) come back first: they would be locked at 0px
      for (const el of Array.from(this.table.querySelectorAll("[data-dg-collapsed]"))) el.removeAttribute("data-dg-collapsed");
      // lock column widths from a normal render of the first rows (inline width rule's single exception)
      const sample = this.view.slice(0, 60);
      const tmp = new Map<string, { tr: HTMLTableRowElement; row: Row; v: number }>();
      this.tbody.replaceChildren(...sample.map((r, i) => this.rowFor(r, i, tmp)));
      this.trByKey = tmp;
      const ths = Array.from(this.thead.rows[0]?.cells ?? []);
      // a hidden container (tab, modal) measures 0: lock later, when the ResizeObserver sees a width
      this.lockPending = !ths.some((th) => th.getBoundingClientRect().width > 0);
      const cg = document.createElement("colgroup");
      cg.className = "dg-cols";
      for (const th of ths) {
        const col = document.createElement("col");
        if (th.hidden) col.hidden = true;
        else if (!this.lockPending) col.style.inlineSize = `${th.getBoundingClientRect().width}px`;
        cg.append(col);
      }
      this.colgroup?.remove();
      this.colgroup = cg;
      this.table.insertBefore(cg, this.thead);
      if (!this.lockPending) this.table.style.tableLayout = "fixed";
      const measured = Array.from(this.tbody.rows).map((tr) => tr.getBoundingClientRect().height).filter((x) => x > 0);
      this.avgH = measured.length ? measured.reduce((a, b) => a + b, 0) / measured.length : 36;
      this.table.setAttribute("aria-rowcount", String(this.view.length + 1));
    } else {
      this.colgroup?.remove();
      this.colgroup = null;
      this.table.style.tableLayout = "";
      if (!this.table.getAttribute("style")) this.table.removeAttribute("style");
      this.table.removeAttribute("aria-rowcount");
      this.heights.clear();
    }
  }

  private renderWindow(reset = false): void {
    const n = this.view.length;
    this.table.setAttribute("aria-rowcount", String(n + 1));
    const sc = this.scroller;
    const viewH = sc.clientHeight || 600;
    const top = sc.scrollTop;
    const keys = this.view.map((r, i) => this.keyOf(r, i));
    const hOf = (i: number) => this.heights.get(keys[i]!) ?? this.avgH;
    const overscan = 8;
    let start = 0;
    let acc = 0;
    while (start < n && acc + hOf(start) < top) acc += hOf(start++);
    start = Math.max(0, start - overscan);
    let end = start;
    let vis = 0;
    while (end < n && vis < viewH + overscan * this.avgH * 2) vis += hOf(end++);
    end = Math.min(n, end + overscan);
    let topPad = 0;
    for (let i = 0; i < start; i++) topPad += hOf(i);
    let bottomPad = 0;
    for (let i = end; i < n; i++) bottomPad += hOf(i);
    const next = new Map<string, { tr: HTMLTableRowElement; row: Row; v: number }>();
    const rows: HTMLTableRowElement[] = [];
    for (let i = start; i < end; i++) {
      const tr = this.rowFor(this.view[i]!, i, next);
      tr.setAttribute("aria-rowindex", String(i + 2));
      rows.push(tr);
    }
    if (!reset) for (const [k, v] of this.trByKey) if (!next.has(k)) next.set(k, v); // keep built rows cached while scrolling
    this.trByKey = next;
    const spacer = (px: number) => {
      const td = h("td", { colspan: this.visibleCount() });
      td.style.blockSize = `${px}px`;
      return h("tr", { class: "dg-spacer", "aria-hidden": "true" }, td);
    };
    this.tbody.replaceChildren(...(topPad ? [spacer(topPad)] : []), ...rows, ...(bottomPad ? [spacer(bottomPad)] : []));
    // measure what we rendered and refine the estimate
    let sum = 0;
    for (const tr of rows) {
      const hh = tr.getBoundingClientRect().height;
      const k = tr.getAttribute("data-key");
      if (k && hh) this.heights.set(k, hh);
      sum += hh;
    }
    if (rows.length && sum) this.avgH = (this.avgH * 3 + sum / rows.length) / 4;
    // a window swap re-inserts rows (focus inside them is lost); modules restore what they need
    this.emit("window", {});
  }

  private onVirtualScroll(): void {
    if (!this.virtualOn || this.windowRaf) return;
    this.windowRaf = requestAnimationFrame(() => {
      this.windowRaf = 0;
      this.renderWindow();
    });
  }

  private decorateRow(tr: HTMLTableRowElement, row: Row, key: string, i: number): void {
    // index column depends on position
    const pos = (this.st.page - 1) * Math.max(0, this.st.pageSize) + i;
    const idxCell = tr.querySelector<HTMLTableCellElement>(":scope > td[data-col=rownum]");
    if (idxCell && !this.isHostNode(tr)) idxCell.textContent = String(pos + 1);
    for (const fn of this.rowFns) fn(tr, row, key);
  }

  private buildRow(row: Row, key: string, i: number): HTMLTableRowElement {
    const adopted = this.source.nodeFor?.(row);
    let tr: HTMLTableRowElement;
    const pos = (this.st.page - 1) * Math.max(0, this.st.pageSize) + i;
    if (adopted) {
      tr = adopted;
      // host cells map to definitions by their original position, even after a reorder
      const cells = (this.journal.original(tr)?.filter((n): n is HTMLTableCellElement => n instanceof HTMLTableCellElement)) ?? Array.from(tr.cells);
      cells.forEach((td, ci) => {
        // modules decorate host cells (handles, expand buttons): destroy puts the original content back,
        // also for rows that are on another page at that moment
        this.journal.children(td);
        const c = this.cols.find((x) => (x.hostIndex ?? x.index) === ci);
        // a host cell of a `can: false` column: the column does not exist for this user
        if (!c) {
          this.journal.set(td, "hidden", "");
          return;
        }
        this.journal.set(td, "data-key", c.key);
        if (c.align && c.align !== "start") this.journal.set(td, "data-align", c.align);
        if (!c.visible) this.journal.set(td, "hidden", "");
      });
      if (this.order || this.journal.original(tr)) {
        this.journal.children(tr);
        const byKey = new Map(Array.from(tr.cells).map((td) => [td.getAttribute("data-key"), td]));
        for (const c of this.shown) {
          const td = byKey.get(c.key);
          if (td) tr.append(td);
        }
      }
      this.journal.set(tr, "data-key", key);
    } else {
      tr = document.createElement("tr");
      tr.setAttribute("data-key", key);
      const mode = this.source.cells ?? "text";
      for (const c of this.shown) {
        const td = document.createElement("td");
        td.setAttribute("data-key", c.key);
        if (c.col) td.setAttribute("data-col", c.col);
        if (c.align && c.align !== "start") td.setAttribute("data-align", c.align);
        if (c.sticky) td.setAttribute("data-sticky", c.sticky);
        if (c.className) td.className = c.className;
        if (!c.visible) td.hidden = true;
        this.fillCell(td, c, row, { row, key: c.key, index: i, position: pos, td, locale: this.locale }, mode);
        tr.append(td);
      }
      const extra = row as { DT_RowClass?: unknown; DT_RowId?: unknown };
      if (extra.DT_RowClass) tr.className = String(extra.DT_RowClass);
      if (extra.DT_RowId != null) tr.id = String(extra.DT_RowId);
    }
    this.keyByTr.set(tr, key);
    const tone = this.o.rowTone?.(row);
    if (tone) tr.setAttribute("data-tone", tone);
    const cls = this.o.rowClass?.(row);
    if (cls) tr.classList.add(...cls.split(/\s+/).filter(Boolean));
    if (this.o.rowClick) tr.setAttribute("data-clickable", "");
    const attrs = this.o.rowAttrs?.(row);
    if (attrs) for (const k in attrs) tr.setAttribute(k, attrs[k]!);
    for (const fn of this.rowFns) fn(tr, row, key);
    return tr;
  }

  private fillCell(td: HTMLTableCellElement, c: ResolvedColumn, row: Row, ctx: CellContext, mode: "text" | "html"): void {
    if (c.col === "select" || c.col === "actions" || c.col === "handle") return; // modules fill these
    if (c.col === "go") {
      // permanent indicator for a clickable row; keyboard users use the row's primary link
      td.append(frag(icons.chevron));
      td.setAttribute("aria-hidden", "true");
      return;
    }
    let v = cellValue(c, row);
    // an HTML-default source (yajra) escapes text values: typed renderers (badge labels, links) get the text once
    if (mode === "html" && c.render && !c.html && typeof v === "string" && v.includes("&")) v = htmlToText(v);
    let out: unknown = c.render ? c.render(v, row, ctx) : v;
    if (out == null || out === "") out = c.defaultContent ?? null;
    if (out == null || out === "") {
      td.append(h("span", { class: "dg-empty-value" }, "—"));
      return;
    }
    if (out instanceof Node) {
      td.append(out);
      return;
    }
    const s = String(out);
    const asHtml = c.html ?? (c.text ? false : mode === "html");
    if (asHtml && !c.render) td.innerHTML = s;
    else if (asHtml && c.html) td.innerHTML = s;
    else {
      // an HTML-default source (yajra) escapes text on the server: show `&` instead of `&amp;`
      td.textContent = mode === "html" && c.text && !c.render ? htmlToText(s) : s;
      td.dir = "auto";
    }
  }

  private stateRow(kind: string): HTMLTableRowElement {
    const m = this.messages;
    const box = h("div", { class: "dg-state", "data-kind": kind });
    if (kind === "loading") {
      box.setAttribute("role", "presentation");
      box.append(h("div", { class: "dg-loading-card" }, ...Array.from(frag(icons.spinner).childNodes), h("span", null, m.loading)));
    } else if (kind === "empty") {
      const filtered = !!this.st.search || Object.keys(this.st.filters).length > 0;
      box.append(frag(icons.inbox), h("div", { class: "dg-state-title" }, filtered ? m.noMatch : m.empty), h("div", { class: "dg-state-text" }, filtered ? m.noMatchText : m.emptyText));
      if (this.st.search) {
        const b = h("button", { type: "button", class: "dg-btn" }, m.clearSearch);
        b.addEventListener("click", () => this.search(""));
        box.append(h("div", { class: "dg-state-actions" }, b));
      }
    } else if (kind === "error") {
      box.setAttribute("data-tone", "bad");
      box.setAttribute("role", "alert");
      const err = this.st.error;
      box.append(frag(icons.alert), h("div", { class: "dg-state-title" }, m.error), h("div", { class: "dg-state-text" }, err?.message || m.errorText));
      if (err?.retryable !== false) {
        const b = h("button", { type: "button", class: "dg-btn" }, m.retry);
        b.addEventListener("click", () => void this.reload({ keepPage: true }));
        box.append(h("div", { class: "dg-state-actions" }, b));
      }
      if (err?.detail && config.warnings !== false) {
        box.append(h("details", { class: "dg-state-detail" }, h("summary", null, m.errorDetail), h("pre", null, err.detail)));
      }
    } else if (kind === "manual") {
      box.append(frag(icons.play), h("div", { class: "dg-state-title" }, m.manual), h("div", { class: "dg-state-text" }, m.manualText));
      const b = h("button", { type: "button", class: "dg-btn", "data-variant": "primary" }, m.load);
      b.addEventListener("click", () => void this.load());
      box.append(h("div", { class: "dg-state-actions" }, b));
    }
    const td = h("td", { colspan: this.visibleCount() }, box);
    return h("tr", { class: "dg-state-row" }, td);
  }

  /* ---------- toolbar ---------- */

  private buildToolbar(): void {
    for (const s of Object.values(this.slots)) s.replaceChildren();
    const so = this.o.search;
    if (so !== false) {
      const opts = typeof so === "object" ? so : {};
      const input = h("input", {
        class: "dg-search-input",
        type: "search",
        placeholder: opts.placeholder ?? this.messages.search,
        "aria-label": this.messages.searchLabel,
        autocomplete: "off",
        spellcheck: "false",
        dir: "auto",
      });
      input.value = this.st.search;
      const clear = h("button", { type: "button", class: "dg-search-clear", "aria-label": this.messages.clear, title: this.messages.clear });
      clear.append(frag(icons.x));
      const label = h("label", { class: "dg-search" });
      label.append(frag(icons.search), input, clear);
      const delay = opts.delay ?? (this.source?.mode === "server" ? 400 : 200);
      const min = opts.minLength ?? 0;
      const run = debounce((v: string) => this.search(v.length < min ? "" : v), delay);
      input.addEventListener("input", () => {
        this.syncSearchUi();
        run(input.value);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          run.cancel();
          this.search(input.value);
        } else if (e.key === "Escape" && input.value) {
          e.preventDefault();
          input.value = "";
          run.cancel();
          this.search("");
        }
      });
      clear.addEventListener("click", () => {
        input.value = "";
        run.cancel();
        this.search("");
        input.focus();
      });
      this.searchInput = input;
      this.slots.start.append(label);
      this.syncSearchUi();
    }
    if (this.o.count && this.o.surface !== "card") {
      this.countEl = h("span", { class: "dg-count" });
      this.slots.end.append(this.countEl);
    } else if (this.o.count && this.o.surface === "card") {
      this.countEl = h("span", { class: "dg-count" });
      this.root.querySelector(".dg-head")?.append(this.countEl);
    }
    for (const item of this.toolbarItems) this.placeToolbar(item);
  }

  private placeToolbar(item: ToolbarItem): void {
    const slot = this.slots[item.slot];
    const order = item.order ?? 0;
    item.el.dataset.dgOrder = String(order);
    const after = Array.from(slot.children).find((c) => Number((c as HTMLElement).dataset.dgOrder ?? 0) > order);
    slot.insertBefore(item.el, after ?? null);
  }

  private syncSearchUi(): void {
    const label = this.searchInput?.parentElement;
    if (label) toggleAttr(label, "data-has-value", !!this.searchInput!.value);
  }

  private updateCount(): void {
    if (!this.countEl) return;
    const n = this.st.filtered ?? this.view.length;
    this.countEl.replaceChildren(h("span", { class: "dg-count-num" }, this.fmt(n)), " ", this.messages.records);
  }

  /* ---------- footer ---------- */

  private renderFooter(): void {
    const m = this.messages;
    const end = this.footerEl.querySelector(".dg-footer-end")!;
    const paging = this.st.pageSize !== 0 || this.o.paging !== false;
    // info
    const filtered = this.st.filtered;
    const n = this.view.length;
    const from = n ? (this.st.page - 1) * Math.max(0, this.st.pageSize) + 1 : 0;
    const to = from ? from + n - 1 : 0;
    this.infoEl.dir = "auto";
    if (!this.st.loaded) this.infoEl.textContent = "";
    else if (!n && filtered != null) this.infoEl.textContent = `${this.fmt(filtered)} ${m.records}`;
    else if (filtered == null) {
      const range = `${this.fmt(from)}–${this.fmt(to)}`;
      const text = m.infoUnknown(this.fmt(from), this.fmt(to));
      const i = text.indexOf(range);
      this.infoEl.replaceChildren(
        ...(i >= 0 ? [text.slice(0, i), h("strong", null, range), text.slice(i + range.length)] : [text]),
        ` · ${m.totalUnknown}`,
      );
    } else {
      const total = this.st.total != null && this.st.total !== filtered ? this.fmt(this.st.total) : null;
      const text = m.info(this.fmt(from), this.fmt(to), this.fmt(filtered), total);
      const dash = text.indexOf(" / ");
      if (dash > 0) this.infoEl.replaceChildren(h("strong", null, text.slice(0, dash)), text.slice(dash));
      else this.infoEl.textContent = text;
    }
    if (this.o.paging === false) {
      end.replaceChildren();
      return;
    }
    // page size
    if (!this.sizeSel) {
      const sizes = this.o.pageSizes ?? config.pageSizes ?? [10, 25, 50, 100];
      this.sizeSel = h("select", { class: "dg-select dg-pagesize", "aria-label": m.pageSize });
      for (const s of sizes) this.sizeSel.append(h("option", { value: s }, s === -1 ? m.all : String(s)));
      this.sizeSel.addEventListener("change", () => this.pageSize(Number(this.sizeSel!.value)));
    }
    if (!Array.from(this.sizeSel.options).some((o) => Number(o.value) === this.st.pageSize))
      this.sizeSel.append(h("option", { value: this.st.pageSize }, String(this.st.pageSize)));
    this.sizeSel.value = String(this.st.pageSize);
    const sizeLabel = h("label", { class: "dg-label" }, m.pageSize, this.sizeSel);
    // pager
    const pages = filtered == null ? null : this.pageCount();
    const p = this.st.page;
    const atEnd = pages == null ? this.st.hasMore === false : p >= pages;
    const btn = (go: string, label: string, icon: string, disabled: boolean) => {
      const b = h("button", { type: "button", class: "dg-pager-btn", "data-go": go, "aria-label": label, title: label, disabled });
      b.append(frag(icon));
      return b;
    };
    const jump = h("span", { class: "dg-pager-jump" });
    const narrow = this.root.getAttribute("data-bp") === "xs";
    if (narrow && pages != null && pages <= 200) {
      const sel = h("select", { class: "dg-select dg-pager-select", "aria-label": m.page });
      for (let i = 1; i <= pages; i++) sel.append(h("option", { value: i, selected: i === p }, `${i} / ${pages}`));
      sel.addEventListener("change", () => this.page(Number(sel.value)));
      jump.append(sel);
    } else {
      const input = h("input", { class: "dg-pager-input", inputmode: "numeric", "aria-label": m.page, value: String(p) });
      const go = () => {
        const v = parseInt(input.value, 10);
        if (Number.isFinite(v)) this.page(v);
        // out of range ("99" of 3): the box shows the page actually open
        input.value = String(this.st.page);
      };
      input.addEventListener("keydown", (e) => e.key === "Enter" && go());
      input.addEventListener("change", go);
      jump.append(m.page, input);
      if (pages != null) jump.append(" ", h("span", { class: "dg-pager-total" }, m.pageOf(this.fmt(pages))));
    }
    // keep focus on the same pager control across re-renders
    const focused = document.activeElement as HTMLElement | null;
    const focusGo = this.pagerEl.contains(focused) ? focused?.closest(".dg-pager-btn")?.getAttribute("data-go") ?? "input" : null;
    this.pagerEl.replaceChildren(
      btn("first", m.first, icons.first, p <= 1),
      btn("prev", m.prev, icons.prev, p <= 1),
      jump,
      btn("next", m.next, icons.next, atEnd || !this.st.loaded),
      btn("last", m.last, icons.last, pages == null || atEnd || !this.st.loaded),
    );
    end.replaceChildren(sizeLabel, this.pagerEl);
    if (focusGo) {
      const again = focusGo === "input" ? null : this.pagerEl.querySelector<HTMLButtonElement>(`[data-go="${focusGo}"]`);
      (again && !again.disabled ? again : this.pagerEl.querySelector<HTMLElement>(".dg-pager-input"))?.focus();
    }
    void paging;
  }

  /* ---------- events / observers ---------- */

  private bindEvents(): void {
    const sig = { signal: this.ac.signal };
    this.thead.addEventListener("click", (e) => {
      const btn = (e.target as Element).closest(".dg-sort");
      if (!btn) return;
      const key = btn.closest("th")!.getAttribute("data-key")!;
      const cur = this.st.sort[0];
      const dir = cur && cur.key === key ? (cur.dir === "asc" ? "desc" : "asc") : "asc";
      this.sort([{ key, dir }]);
    }, sig);
    this.pagerEl.addEventListener("click", (e) => {
      const b = (e.target as Element).closest<HTMLButtonElement>(".dg-pager-btn");
      if (!b || b.disabled) return;
      const go = b.dataset.go;
      const p = this.st.page;
      if (go === "first") this.page(1);
      else if (go === "prev") this.page(p - 1);
      else if (go === "next") this.page(p + 1);
      else if (go === "last") this.page(this.pageCount());
    }, sig);
    this.scroller.addEventListener("scroll", () => {
      this.updateOverflow();
      this.onVirtualScroll();
    }, { ...sig, passive: true });
    // print renders every row (virtual window off), then restores
    window.addEventListener("beforeprint", () => {
      if (!this.virtualOn) return;
      this.printing = true;
      this.renderBody();
    }, sig);
    window.addEventListener("afterprint", () => {
      if (!this.printing) return;
      this.printing = false;
      this.renderBody();
    }, sig);
    if (this.o.rowClick) {
      this.tbody.addEventListener("click", (e) => {
        const t = e.target as Element;
        if (t.closest("a,button,input,select,textarea,label,[role=menuitem],td[data-col=select],td[data-col=actions],td[data-col=handle]")) return;
        const tr = t.closest("tr");
        const key = tr && this.keyByTr.get(tr);
        const row = key !== undefined && key !== null ? this.rowByKeyMap.get(key) : undefined;
        if (row) this.o.rowClick!(row, e as MouseEvent);
      }, sig);
    }
  }

  private observe(): void {
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => {
        const w = this.root.clientWidth;
        const bp = w < 480 ? "xs" : w < 768 ? "sm" : w < 1024 ? "md" : "lg";
        if (this.root.getAttribute("data-bp") !== bp) {
          this.root.setAttribute("data-bp", bp);
          this.renderFooter();
        }
        this.updateOverflow();
        if (this.virtualOn && this.lockPending && this.root.clientWidth > 0) this.relockBody();
      });
      this.ro.observe(this.root);
      this.ro.observe(this.table);
    }
    if (this.o.load === "visible" && typeof IntersectionObserver !== "undefined") {
      this.visibleNow = false;
      this.io = new IntersectionObserver((entries) => {
        const vis = entries.some((e) => e.isIntersecting);
        this.visibleNow = vis;
        if (vis && this.dirtyWhileHidden) {
          this.dirtyWhileHidden = false;
          void this.load();
        }
      }, { rootMargin: "200px" });
      this.io.observe(this.root);
    }
  }

  private updateOverflow(): void {
    const s = this.scroller;
    const max = s.scrollWidth - s.clientWidth;
    const x = Math.abs(s.scrollLeft);
    const parts: string[] = [];
    if (max > 1) {
      if (x > 1) parts.push("start");
      if (x < max - 1) parts.push("end");
    }
    if (parts.length) this.frame.setAttribute("data-overflow", parts.join(" "));
    else this.frame.removeAttribute("data-overflow");
    toggleAttr(s, "tabindex", max > 1, "0");
  }

  private announce(msg: string): void {
    this.live.textContent = "";
    setTimeout(() => (this.live.textContent = msg), 30);
  }

  remount(table?: HTMLTableElement | string): Datagrid {
    const t = table ?? this.table;
    // chained `.use()` modules come along (module definitions are immutable and reusable)
    const opts = this.chained.length ? { ...this.o, use: [...(this.o.use ?? []), ...this.chained] } : this.o;
    this.destroy();
    return new Datagrid(t, opts);
  }

  /* ---------- teardown ---------- */

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.inflight?.abort();
    clearTimeout(this.busyTimer);
    cancelAnimationFrame(this.windowRaf);
    // virtual mode leaves a colgroup, fixed layout and aria-rowcount on the host table
    if (this.virtualOn) this.setVirtual(false);
    this.table.removeAttribute("aria-busy");
    for (const entry of Array.from(this.modules.values()).reverse()) entry.destroy?.();
    this.emit("destroy", {});
    this.ac.abort();
    this.ro?.disconnect();
    this.io?.disconnect();
    // restore DOM exactly
    this.journal.restore();
    this.tbody.replaceChildren(...this.origBody);
    // a table that had no <tbody> gets none back
    if (this.createdBody) this.tbody.remove();
    if (this.origThead) this.thead.replaceWith(this.origThead);
    else this.thead.remove();
    if (this.origTfoot && this.table.tFoot !== this.origTfoot) this.table.append(this.origTfoot);
    if (this.origParent) this.origParent.insertBefore(this.table, this.origNext && this.origNext.parentNode === this.origParent ? this.origNext : this.root);
    this.root.remove();
    byTable.delete(this.table);
    if (this.name && byName.get(this.name) === this) byName.delete(this.name);
    this.handlers.clear();
  }
}

function normalizeSort(s: SortInput): SortSpec[] {
  return s.map((x) => (Array.isArray(x) ? { key: x[0] as string, dir: x[1] as SortSpec["dir"] } : { ...(x as SortSpec) }));
}

function pickHost(c: typeof config): HostAdapters {
  const { confirm, notify, csrf, laravel, timeout, onSessionExpired, fetch } = c;
  return { confirm, notify, csrf, laravel, timeout, onSessionExpired, fetch };
}

function noopApi(): unknown {
  return new Proxy(() => undefined, { get: () => noopApi(), apply: () => undefined });
}

export function toError(e: unknown): DatagridError {
  if (e && typeof e === "object" && "kind" in e && "retryable" in e) return e as DatagridError;
  const err = e as Error;
  if (err?.name === "TimeoutError") return { kind: "timeout", status: null, message: err.message, retryable: true };
  if (err instanceof TypeError) return { kind: "network", status: null, message: err.message, retryable: true };
  return { kind: "server", status: null, message: err?.message ?? String(e), retryable: true, raw: e };
}

export const DatagridClass = Datagrid as unknown as DatagridCtor;
