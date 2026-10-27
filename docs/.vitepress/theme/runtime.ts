// Runs a snippet inside its demo stage: ES imports are rewritten to the docs' live library build and
// demo data, every grid the snippet creates gets the demo's own fetch (Request/Response tabs).
import type { LogEntry } from "./server";

type Lib = typeof import("./lib");

let libP: Promise<Lib> | null = null;
let dataP: Promise<typeof import("./data")> | null = null;
let serverP: Promise<typeof import("./server")> | null = null;

export const loadLib = () => (libP ??= import("./lib"));
export const loadServer = () =>
  (serverP ??= import("./server").then((s) => {
    s.install();
    return s;
  }));
const loadData = () => (dataP ??= import("./data"));

const IMPORT = /^[ \t]*import\s+(?:([\w$]+\s*,\s*)?(\{[\s\S]*?\}|\*\s+as\s+[\w$]+)\s+from\s+)?["']([^"']+)["'];?[ \t]*$/gm;

/** `import { a, b as c } from "x"` → `const { a, b: c } = __mods["x"];` (CSS imports are dropped). */
export function rewriteImports(code: string): string {
  return code.replace(IMPORT, (_m, _def: string | undefined, spec: string | undefined, from: string) => {
    if (!spec) return ""; // side-effect import (CSS)
    const mod = from === "@akinozgen17/datagrids" ? "__lib" : /^\.\/data(\.js)?$/.test(from) ? "__data" : null;
    if (!mod) throw new Error(`Demo snippets can only import "@akinozgen17/datagrids" and "./data.js" (got "${from}").`);
    if (spec.startsWith("*")) return `const ${spec.replace(/^\*\s+as\s+/, "")} = ${mod};`;
    return `const ${spec.replace(/([\w$]+)\s+as\s+([\w$]+)/g, "$1: $2")} = ${mod};`;
  });
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => (...a: unknown[]) => Promise<unknown>;

export interface RunHandle {
  destroy(): void;
}

/** Destroys every grid inside `stage` (restores the tables), then clears it. */
export async function teardown(stage: HTMLElement): Promise<void> {
  const lib = await loadLib();
  stage.querySelectorAll("table").forEach((t) => lib.Datagrid.get(t)?.destroy());
  stage.replaceChildren();
}

export async function run(stage: HTMLElement, html: string, js: string, log: (e: LogEntry) => void): Promise<void> {
  const [lib, data, server] = await Promise.all([loadLib(), loadData(), loadServer()]);
  // compile first: a syntax error must not tear down the running demo
  const body = rewriteImports(js);
  const fn = new AsyncFunction("__lib", "__data", body);
  await teardown(stage);
  stage.innerHTML = html;
  // grids pick their host adapters at construction: give the ones created now this demo's fetch
  const cfg = lib.config as { fetch?: typeof fetch };
  const prev = cfg.fetch;
  cfg.fetch = server.fetchFor(log);
  try {
    const p = fn(lib, data);
    // constructors run synchronously; restore once the snippet's synchronous part is done
    cfg.fetch = prev;
    if (prev === undefined) delete cfg.fetch;
    await p;
  } finally {
    if (cfg.fetch !== prev) {
      cfg.fetch = prev;
      if (prev === undefined) delete cfg.fetch;
    }
  }
}
