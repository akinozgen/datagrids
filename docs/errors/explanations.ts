// Explanations for the coded warnings and errors in src/core/warn.ts (WARNINGS).
// `[code].paths.ts` merges these with the message templates read from the source and fails the build
// when a code has no entry here (drift gate). Values are Markdown; links are root-relative.
// Keep docs/errors/index.md in sync: it carries the same text for readers and LLMs.

export interface Explanation {
  /** short page title, e.g. "Two modules claim one slot" */
  title: string;
  /** "warning": console.warn, printed once per distinct message · "error": thrown Error */
  kind: "warning" | "error";
  /** when it happens (Markdown) */
  when: string;
  /** how to fix it (Markdown) */
  fix: string;
}

const lines = (...l: string[]) => l.join("\n");

export const explanations: Record<string, Explanation> = {
  DG001: {
    title: "Unknown grid option",
    kind: "warning",
    when: lines(
      "The options object passed to `new Datagrid()` has a key that is not a grid option. The key is ignored.",
      "",
      "The message adds a hint: for a well-known legacy option name (compared case-insensitively) it names the",
      "replacement; for anything within two typing edits of a real option it suggests that option",
      "(`pagesize` → ``Did you mean `pageSize`?``).",
    ),
    fix: lines(
      "Rename or remove the key. The [grid options](/reference/options) are the only accepted keys; every other",
      "capability is a column option or a [module](/modules/) in `use: [...]`.",
      "",
      "| Key you passed | Hint printed |",
      "|---|---|",
      "| `serverSide` | Server mode is a module: use `serverSide({ url, protocol: yajra() })`. |",
      "| `ajax` | Use the `serverSide({ url, … })` module. |",
      "| `dom` | Use toolbar slots (`start`, `end`, `filters`). |",
      "| `buttons` | Attach button modules (`button.reload()`, `excel()`…). |",
      "| `language` | Use `messages`. |",
      "| `stateSave` | Use the `stateSave()` module. |",
      "| `lengthMenu` | Use `pageSizes`. |",
      "| `pageLength` | Use `pageSize`. |",
      "| `order` | Use `sort: [['key', 'desc']]`. |",
      "| `deferLoading` | Use `load: 'manual'`. |",
      "| `columnDefs` | Put options on the column definitions. |",
      "",
      "The [migration guide](/migration/from-datatables) maps every legacy option.",
    ),
  },
  DG002: {
    title: "Grid has no accessible name",
    kind: "warning",
    when: lines(
      "The grid was created without `label`, `labelledBy` or `title`, and the table has no `<caption>`.",
      "Assistive technology then announces the scroll region with the generic `messages.regionLabel`",
      "(\"Data table\"), the same name for every grid on the page.",
    ),
    fix: lines(
      "Name every grid after what it lists:",
      "",
      "```js",
      "new Datagrid(\"#agents\", { label: \"Field agents\", columns });",
      "```",
      "",
      "Or point at a visible heading with `labelledBy: \"agents-heading\"`, or keep a `<caption>` in the table.",
      "`title` names the grid only together with `surface: \"card\"`; `label` works everywhere.",
      "See [Accessibility](/guide/accessibility).",
    ),
  },
  DG003: {
    title: "Rows have no key",
    kind: "warning",
    when: lines(
      "A row has no key: `rowKey` is not set and the row has neither `id` nor `DT_RowId`, or the `rowKey`",
      "path or function returned `null` or `\"\"`. The grid falls back to the row's position (`__i0`, `__i1`, …).",
    ),
    fix: lines(
      "Tell the grid which field identifies a row:",
      "",
      "```js",
      "new Datagrid(\"#agents\", { label: \"Agents\", rowKey: \"uuid\", columns });",
      "new Datagrid(\"#stock\", { label: \"Stock\", rowKey: (row) => `${row.unit}-${row.ref}`, columns });",
      "```",
      "",
      "Position keys change whenever the data changes, so selection, `refreshRow(key)`, `removeRow(key)`,",
      "row actions and focus restoration cannot follow a row across pages or reloads.",
    ),
  },
  DG004: {
    title: "Unknown column key",
    kind: "warning",
    when: lines(
      "Reserved for calls that name a column key the grid does not have. **The current version does not",
      "print DG004**: `setColumnVisible()` and `columnOrder()` ignore unknown keys silently, and the",
      "[footer](/modules/footer) module prints its own message (see [Other console messages](/errors/#other-console-messages)).",
    ),
    fix: lines(
      "Check the key against `grid.columns().map((c) => c.key)`. A column with `can: false` does not exist",
      "at all, so its key is unknown too.",
    ),
  },
  DG005: {
    title: "Selector must match exactly one table",
    kind: "error",
    when: lines(
      "`new Datagrid(selector)` or `grid.remount(selector)` got a CSS selector that matched no element, more",
      "than one element, or a single element that is not a `<table>` (reported as \"matched 0\"). Thrown",
      "synchronously by the constructor.",
    ),
    fix: lines(
      "Use a unique selector (`\"#agents\"`) or pass the `HTMLTableElement` itself, and create the grid after the",
      "table is in the document (for example after a tab or modal has rendered its content).",
      "`Datagrid.get()` and `get()` never throw; they return `null`.",
    ),
  },
  DG006: {
    title: "No grid with that name",
    kind: "warning",
    when: lines(
      "`reload(name)` found no live grid registered under `name`; it returns `false` and does nothing.",
      "A grid registers its `name` option when it is created and unregisters on `destroy()`.",
    ),
    fix: lines(
      "Give the grid a `name` and make sure it exists when you reload it:",
      "",
      "```js",
      "new Datagrid(\"#agents\", { name: \"agents\", label: \"Agents\", columns });",
      "reload(\"agents\", { keepPage: true });",
      "```",
      "",
      "Use `find(name)` to check for a grid without a warning.",
    ),
  },
  DG007: {
    title: "Required module is missing",
    kind: "error",
    when: lines(
      "A module declares `requires: [\"…\"]` and no module with that name is attached. The check runs after all",
      "modules from the constructor's `use` are attached (thrown by the constructor) and, for `grid.use()`,",
      "in a microtask afterwards (an uncaught error in the console). Built-in case: `button.resetState()`",
      "requires `state`, the module name of `stateSave()`.",
    ),
    fix: lines(
      "Attach the dependency in the same `use` array; the order inside the array does not matter:",
      "",
      "```js",
      "use: [stateSave(), button.resetState()]",
      "```",
    ),
  },
  DG008: {
    title: "Two modules claim one slot",
    kind: "error",
    when: lines(
      "Two modules claim the `source` slot, the only single slot. Every data source occupies it: `serverSide`,",
      "`arraySource`, `domSource`, `fetchAll`, `customSource`. Thrown when `use` contains two sources, or when a",
      "source is chained with `grid.use()` while an explicit one is already attached (a chained source replaces",
      "only the default array/DOM source). `{a}` is the source in place, `{b}` the one being attached.",
    ),
    fix: lines(
      "Attach exactly one source, in `use: [...]` at construction:",
      "",
      "```js",
      "new Datagrid(\"#agents\", {",
      "  label: \"Agents\",",
      "  columns,",
      "  use: [serverSide({ url: \"/api/agents\", protocol: yajra() })],",
      "});",
      "```",
      "",
      "To switch sources, `destroy()` the grid and create a new one. Note that `data: [...]` is ignored, without an",
      "error, when `use` already contains a source.",
    ),
  },
  DG009: {
    title: "Module attached twice",
    kind: "error",
    when: lines(
      "A module name is attached a second time: the same factory twice (`colVis()` in a preset and again on the",
      "page) or two modules with the same `name`, such as two `button.custom({ name: \"approve\", … })`.",
    ),
    fix: lines(
      "Attach each module once per grid. When a [preset](/reference/static#preset) already contains a module, don't",
      "repeat it; give custom buttons distinct names, or leave `name` out to get an automatic one.",
    ),
  },
  DG010: {
    title: "Module name collides with a grid member",
    kind: "error",
    when: lines(
      "A module's `name` is a core grid member (`reload`, `columns`, `search`, `status`, …) or another property",
      "the grid instance already has. A module's API is installed on the grid under its name, so the name must",
      "be free. Data source modules are exempt.",
    ),
    fix: lines(
      "Rename the module, for example `name: \"reloadButton\"` instead of `\"reload\"`. The built-in modules",
      "already use free names (`state`, `colVis`, `selection`, …). See [Writing a module](/reference/modules).",
    ),
  },
  DG011: {
    title: "Document has no language",
    kind: "warning",
    when: lines(
      "The page's `<html>` element has no `lang` attribute while the grid uses uppercase headers (the default",
      "`head: \"caps\"`). Uppercasing in CSS depends on the language: in Turkish `i` becomes `İ`, elsewhere `I`, so",
      "a header can come out wrong. Without `lang`, and without a `locale` option or `configure({ locale })`, the",
      "grid also takes the browser's language (English when that is unusable).",
    ),
    fix: lines(
      "Declare the page language: `<html lang=\"en\">`. Or switch to sentence-case headers with",
      "`head: \"sentence\"`. Set `locale` when a grid's language differs from the page's.",
    ),
  },
  DG012: {
    title: "Server error details",
    kind: "warning",
    when: lines(
      "A load failed and the error carries a `detail` the grid keeps out of the visible message: the exception",
      "message of an HTTP error response (JSON `message` / `error`, or up to 500 characters of a text body), the",
      "`error` string of an HTTP 200 SSP response (debug output), or the browser's message for a network",
      "failure. The grid shows a generic message; the detail goes to the console.",
    ),
    fix: lines(
      "Fix the server-side problem the detail describes. While `warnings` is on (the default) the error state",
      "also shows the detail in a \"Details\" disclosure. In production turn both off with",
      "`configure({ warnings: false })`. The full error object is on the `error` event:",
      "",
      "```js",
      "grid.on(\"error\", ({ error }) => report(error.kind, error.status, error.detail));",
      "```",
      "",
      "See [States & errors](/guide/states-and-errors).",
    ),
  },
  DG013: {
    title: "Page size above maxPageSize",
    kind: "warning",
    when: lines(
      "`grid.pageSize(n)` (also used by the page-size menu) got a value above `maxPageSize` (default 1000) or a",
      "negative value; the size is clamped to `maxPageSize`. `-1` (\"All\") is accepted only when the protocol",
      "allows it (`ssp({ allowAll: true })`). The initial `pageSize` option is not checked.",
    ),
    fix: lines(
      "Keep `pageSizes` within `maxPageSize`, or raise the limit for this grid with `maxPageSize: 5000`.",
      "For lists that must show everything, prefer client mode (`fetchAll`) and a server-side export.",
    ),
  },
  DG014: {
    title: "Grid state could not be saved",
    kind: "warning",
    when: lines(
      "Reserved for state storage write failures (blocked storage, a full quota, some private browsing modes).",
      "**The current version prints an uncoded message instead**:",
      "`[datagrids] stateSave: storage is not writable (…); state is not persisted.`, once per page.",
    ),
    fix: lines(
      "Nothing breaks: the grid works, the view is just not remembered. Pass another `Storage`",
      "(`stateSave({ storage: sessionStorage })`) or `storage: null` to turn persistence off deliberately.",
      "See [stateSave](/modules/state-save).",
    ),
  },
  DG015: {
    title: "Invalid locale",
    kind: "warning",
    when: lines(
      "The `locale` option, `configure({ locale })` or `<html lang>` holds a value the `Intl` APIs reject",
      "(`<html lang=\"1\">`, `locale: \"tr_TR\"`). Number and date formatting would throw on it, so the grid",
      "skips it and takes the next candidate: the browser's language, then `\"en\"`.",
    ),
    fix: lines(
      "Use a BCP 47 tag (`tr`, `tr-TR`, `en-GB`). When the value comes from user settings, validate it on the",
      "server before writing it into the page.",
    ),
  },
};
