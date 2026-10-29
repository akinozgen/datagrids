// Public API — single source of truth.
import type { Messages } from "./i18n";

export type Row = Record<string, unknown>;
export type Align = "start" | "end" | "center";
export type SortDir = "asc" | "desc";
export interface SortSpec {
  key: string;
  dir: SortDir;
}
export type SortInput = ReadonlyArray<SortSpec | readonly [string, SortDir]>;
export type Tone = "ok" | "warn" | "bad" | "info" | "muted" | "neutral" | "accent";
export type ColumnType =
  | "text" | "number" | "money" | "date" | "badge" | "link" | "html" | "index" | "actions" | "select" | "boolean";
export type ExportType = "string" | "number" | "money" | "date" | "boolean";

export interface CellContext<R = Row> {
  row: R;
  key: string;
  /** zero-based index inside the current view */
  index: number;
  /** absolute position (page offset + index) */
  position: number;
  td: HTMLTableCellElement;
  /** the grid's locale (typed columns format with it unless given their own) */
  locale?: string;
  /**
   * A field of a row as plain text. `value` arrives as text already, `row` as received: on an
   * HTML-default source (yajra) its strings are server-escaped (`&amp;`) and may hold markup.
   */
  text(row: R, path: string): string;
}

export interface ColumnDef<R = Row> {
  key: string;
  /** dotted data path; defaults to `key` */
  data?: string;
  /** server-side column name (ssp/yajra `columns[i][name]`) */
  name?: string;
  title?: string;
  type?: ColumnType;
  sortable?: boolean;
  sortKey?: string;
  searchable?: boolean;
  visible?: boolean;
  hideable?: boolean;
  exportable?: boolean;
  align?: Align;
  className?: string;
  defaultContent?: string;
  /** permission flag: false → column does not exist (render, colVis, export, state, wire) */
  can?: boolean;
  /** server-computed on demand: requested only while visible (lazyColumns module) */
  lazy?: boolean;
  /** explicit render mode; when omitted the data source's default applies (ssp: text, yajra: html) */
  html?: boolean;
  text?: boolean;
  sticky?: "start" | "end";
  render?: (value: unknown, row: R, ctx: CellContext<R>) => Node | string | number | null | undefined;
  value?: (row: R) => unknown;
  compare?: (a: unknown, b: unknown) => number;
  searchText?: (value: unknown, row: R) => string;
  exportValue?: (row: R) => unknown;
  exportType?: ExportType;
  exportFormat?: string;
  /** value → label map (badge columns; used by filters and export) */
  labels?: Record<string, string>;
  /** special column marker (select / actions / rownum) */
  col?: "select" | "actions" | "rownum" | "go" | "handle";
}

export interface Query {
  page: number;
  pageSize: number;
  sort: SortSpec[];
  search: string;
  filters: Record<string, unknown>;
  columns: ReadonlyArray<ResolvedColumn>;
  /** false only for an explicit `sort: []`; with an empty sort the classic wire then sends no order
   *  (otherwise it sends the default [[0,'asc']], also after the sort was cleared at runtime) */
  sortDefault?: boolean;
  /** the query is still the one the grid was configured with (nothing restored or changed yet) */
  pristine?: boolean;
}

export interface LoadResult<R = Row> {
  rows: R[];
  total: number | null;
  filtered: number | null;
  hasMore?: boolean | null;
  meta?: Record<string, unknown>;
  raw?: unknown;
  /** non-blocking server error text (yajra `error` with rows) */
  error?: DatagridError | null;
  /** page parameters the request for this result actually carried (after every middleware) */
  params?: Record<string, unknown>;
  /** the page the server actually served when it differs from the requested one (cursor mode) */
  page?: number;
}

export interface LoadContext {
  signal: AbortSignal;
  grid: DatagridApi;
  /** request middlewares registered by modules (server sources run them) */
  middlewares: ReadonlyArray<RequestMiddleware>;
  host: HostAdapters;
}

export interface DataSource<R = Row> {
  readonly name?: string;
  readonly mode: "client" | "server";
  /** default cell render mode for untyped columns */
  readonly cells?: "text" | "html";
  /** pageSize -1 ("All") allowed (DataTables compat opt-in) */
  readonly allowAll?: boolean;
  /** rows live in the page (array / DOM): reload() re-runs search/sort/paging over the current rows,
   *  keeping setData / addRows / removeRow changes, instead of reading the source again */
  readonly local?: boolean;
  load(query: Query, ctx: LoadContext): Promise<LoadResult<R>>;
  /** client sources may adopt existing <tr> nodes (progressive enhancement) */
  nodeFor?(row: R): HTMLTableRowElement | undefined;
  /** called once before the first render (DOM source snapshots <tbody> rows) */
  prepare?(table: HTMLTableElement): void;
  /** optional column discovery (DOM source reads <thead>) */
  columns?(table: HTMLTableElement): ColumnDef[];
}

export interface WireRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  /** neutral query; protocols encode it */
  query: Query;
  /** extra page parameters (filter panels etc.) */
  params: Record<string, unknown>;
  body?: BodyInit | null;
}
export type RequestMiddleware = (req: WireRequest, next: (req: WireRequest) => Promise<Response>) => Promise<Response>;

export type DatagridErrorKind =
  | "network" | "timeout" | "abort" | "http" | "server" | "session" | "forbidden" | "validation" | "parse" | "protocol";

export interface DatagridError {
  kind: DatagridErrorKind;
  status: number | null;
  message: string;
  detail?: string;
  retryable: boolean;
  raw?: unknown;
}

export interface HostAdapters {
  confirm?: (message: string, opts: ConfirmOptions) => Promise<boolean>;
  notify?: (kind: "success" | "error" | "info", message: string) => void;
  csrf?: boolean;
  laravel?: boolean;
  timeout?: number;
  onSessionExpired?: (error: DatagridError) => void;
  fetch?: typeof fetch;
  /**
   * `grid.action()`: a 2xx response whose body still reports a failure (`{ status: false, error }`).
   * Truthy = failed; a string is the message shown. HTTP errors are handled before this runs.
   */
  isError?: ActionErrorCheck;
}

export type ActionErrorCheck = (body: unknown, res: Response) => boolean | string | null | undefined;

export interface ConfirmOptions {
  title?: string;
  tone?: "danger" | "default";
  confirmLabel?: string;
  cancelLabel?: string;
  subject?: string;
}

export interface GlobalConfig extends HostAdapters {
  messages?: Partial<Messages>;
  locale?: string;
  pageSize?: number;
  pageSizes?: number[];
  maxPageSize?: number;
  warnings?: boolean;
  errorMode?: "inline" | "silent" | "throw";
}

export interface DatagridOptions {
  columns?: ColumnDef[];
  use?: ReadonlyArray<ModuleInput>;
  name?: string;
  label?: string;
  labelledBy?: string;
  pageSize?: number;
  pageSizes?: number[];
  maxPageSize?: number;
  paging?: boolean;
  sort?: SortInput;
  search?: boolean | { delay?: number; minLength?: number; placeholder?: string };
  load?: "eager" | "visible" | "manual";
  rowKey?: string | ((row: Row) => string);
  virtual?: boolean | number;
  maxHeight?: string;
  errorMode?: "inline" | "silent" | "throw";
  messages?: Partial<Messages>;
  locale?: string;
  host?: HostAdapters;
  surface?: "plain" | "card";
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  density?: "compact" | "normal" | "comfortable";
  theme?: "light" | "dark" | "system";
  head?: "caps" | "sentence";
  striped?: boolean;
  wrap?: boolean;
  count?: boolean;
  rowTone?: (row: Row) => Tone | null | undefined;
  rowClass?: (row: Row) => string | null | undefined;
  rowAttrs?: (row: Row) => Record<string, string> | null | undefined;
  rowClick?: (row: Row, e: MouseEvent) => void;
}

export interface ResolvedColumn extends ColumnDef {
  index: number;
  /** position in the column definitions before `can: false` ones were dropped (host cells of a DOM table) */
  hostIndex?: number;
  title: string;
  sortable: boolean;
  searchable: boolean;
  visible: boolean;
  hideable: boolean;
  exportable: boolean;
  /** visibility from the definition (colVis "reset", stateSave) */
  defaultVisible: boolean;
}

/* ---------- modules ---------- */

export interface ToolbarItem {
  slot: "start" | "end" | "filters";
  order?: number;
  el: HTMLElement;
}

export interface StateContribution {
  key: string;
  save(): unknown;
  load(value: unknown): void;
  /** belongs to an opt-in part of the saved state (stateSave `include`); saved only when included */
  part?: "filters" | "search" | "page";
}

export interface ModuleContext {
  grid: DatagridApi;
  root: HTMLElement;
  table: HTMLTableElement;
  messages: Messages;
  host: HostAdapters;
  locale: string;
  signal: AbortSignal;
  on: DatagridApi["on"];
  toolbar(item: ToolbarItem): void;
  /** row mutator: runs after a row is rendered */
  row(fn: (tr: HTMLTableRowElement, row: Row, key: string) => void): void;
  request(mw: RequestMiddleware, enforce?: "pre" | "post"): void;
  state(c: StateContribution): void;
  /** mount an element above the frame (bulk bar, banners) */
  above(el: HTMLElement): void;
  /** mount an element inside the root (panels/dialogs, top-layer) */
  layer(el: HTMLElement): void;
  announce(msg: string): void;
  requestRender(): void;
  /** runs once columns are resolved, before the first load (state restore, URL sync) */
  ready(fn: () => void): void;
}

export interface ModuleDef<N extends string = string, Api = unknown> {
  readonly name: N;
  readonly kind: "source" | "feature" | "toolbar" | "export";
  readonly slot?: string;
  readonly requires?: readonly string[];
  readonly enforce?: "pre" | "post";
  readonly can?: boolean;
  /** data source modules expose the source */
  readonly source?: DataSource;
  setup?(ctx: ModuleContext): { api?: Api; destroy?(): void } | void;
  /** brand for typing */
  readonly __api?: Api;
}

export type AnyModule = ModuleDef<string, any>;
export type ModuleInput = AnyModule | ReadonlyArray<ModuleInput>;

export interface CoreEvents {
  init: { grid: DatagridApi };
  beforeLoad: { query: Query; cancel(): void };
  load: { result: LoadResult; query: Query };
  response: { raw: unknown; result: LoadResult };
  error: { error: DatagridError };
  sessionexpired: { error: DatagridError };
  render: { keys: string[]; rows: Row[] };
  beforeSort: { sort: SortSpec[]; cancel(): void };
  sort: { sort: SortSpec[] };
  beforePage: { page: number; cancel(): void };
  page: { page: number };
  pagesize: { pageSize: number };
  search: { search: string };
  columnchange: { columns: ReadonlyArray<ResolvedColumn> };
  loadingchange: { loading: boolean };
  selectionchange: { count: number; keys: string[]; all: boolean };
  beforeAction: { id: string; key: string; row: Row; cancel(): void };
  action: { id: string; key: string; row: Row };
  actionerror: { id: string; key: string; row: Row; error: unknown };
  beforePrint: { document: Document; window: Window; cancel(): void };
  headrender: { tr: HTMLTableRowElement };
  /** virtual mode: a new window of rows was drawn while scrolling */
  window: {};
  /** rowReorder */
  beforeReorder: ReorderEvent & { cancel(): void };
  reorder: ReorderEvent;
  reordererror: ReorderEvent & { error: unknown };
  /** responsive: the set of collapsed columns changed */
  collapse: { columns: string[] };
  destroy: {};
}

/** A row move (rowReorder): page-local indexes; `offset + index` is the absolute position. */
export interface ReorderEvent {
  row: Row;
  key: string;
  from: number;
  to: number;
  offset: number;
  prevKey: string | null;
  nextKey: string | null;
  rows: Row[];
}

export interface RowContext {
  row: Row;
  key: string;
  tr: HTMLTableRowElement;
  td: HTMLTableCellElement | null;
  column: ResolvedColumn | null;
}

export interface DatagridApi {
  readonly root: HTMLElement;
  readonly table: HTMLTableElement;
  readonly name: string | undefined;
  readonly messages: Messages;
  on<K extends keyof CoreEvents>(type: K, fn: (d: CoreEvents[K]) => void): () => void;
  on(type: string, fn: (d: any) => void): () => void;
  emit(type: string, detail: unknown): boolean;
  delegate(type: string, selector: string, fn: (e: Event, ctx: RowContext) => void): () => void;
  use<M extends AnyModule>(m: M | ReadonlyArray<ModuleInput>): this;
  module<M extends AnyModule>(m: M | ((...a: any[]) => M)): unknown;
  load(): Promise<void>;
  reload(o?: { keepPage?: boolean; silent?: boolean }): Promise<void>;
  setData(rows: Row[]): void;
  addRows(rows: Row[], o?: { keepPage?: boolean }): void;
  removeRow(key: string): void;
  refreshRow(key: string, row?: Row): void;
  setColumns(c: ColumnDef[]): void;
  destroy(): void;
  /** destroy + re-create on the same (or another) table with the same options (Livewire morph) */
  remount(table?: HTMLTableElement | string): DatagridApi;
  search(v?: string): string;
  page(n?: number): number;
  pageSize(n?: number): number;
  sort(s?: SortInput): SortSpec[];
  /** columns in display order (`query().columns` keeps the definition order) */
  columns(): ReadonlyArray<ResolvedColumn>;
  setColumnVisible(key: string, visible: boolean): void;
  /** display order of column keys; special and sticky columns keep their slots */
  columnOrder(keys?: readonly string[]): string[];
  /** page parameters of the request behind the rows on screen, as sent (protocol fields and `_token` excluded) */
  lastRequestParams(): Record<string, unknown>;
  filters(patch?: Record<string, unknown>): Readonly<Record<string, unknown>>;
  query(): Query;
  rows(): Row[];
  keyOf(row: Row): string;
  rowByKey(key: string): Row | undefined;
  lastResponse(): unknown;
  /** current view rows (after client filtering/paging or the server page) */
  viewRows(): Row[];
  /** rows for export: "page" = current view; "all" = every filtered row (server: one request ≤ maxPageSize) */
  exportRows(scope?: "page" | "all"): Promise<Row[]>;
  status(): GridStatus;
  readonly locale: string;
  /** "client" (array/DOM) or "server" (remote paging) */
  readonly mode: "client" | "server";
  readonly maxPageSize: number;
  /** run several state changes (sort, pageSize, filters…) without intermediate loads or announcements */
  batch(fn: () => void): void;
  stateContributions(): ReadonlyArray<StateContribution>;
  /** confirm → CSRF request → notify → reload({keepPage}) */
  action(url: string, o?: ActionOptions): Promise<unknown>;
  /** host notify adapter, else live region (+ error banner) */
  notify(kind: "success" | "error" | "info", message: string): void;
  /** host confirm adapter, else the built-in <dialog> */
  confirm(message: string, o?: ConfirmOptions): Promise<boolean>;
}

export interface ActionOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown> | FormData | null;
  confirm?: string | (ConfirmOptions & { message: string });
  success?: string | false;
  reload?: false | { keepPage?: boolean; silent?: boolean };
  headers?: Record<string, string>;
  /** overrides `configure({ isError })` / the grid's `host.isError` for this call */
  isError?: ActionErrorCheck;
}

export interface GridStatus {
  status: "idle" | "loading" | "reloading" | "ready" | "error";
  loaded: boolean;
  total: number | null;
  filtered: number | null;
  hasMore: boolean | null;
  error: DatagridError | null;
}
