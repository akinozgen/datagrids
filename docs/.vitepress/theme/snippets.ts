// Demo snippet registry. The code of each live demo lives in ../snippets/<id>.js
// (+ optional <id>.html) — real files, not Markdown fences — and the build embeds it into the page
// (plugins/demo-snippets.ts), so readers, llms-full.txt and per-page .md files all see the same code.
//
// Snippet rules:
// - ES module syntax; import from "@akinozgen17/datagrids" (the library) and "./data.js" (demo records).
// - Ids, table ids and grid names are unique per page.
// - Server demos call /api/* — answered in the page by the shared protocol emulator.

export interface SnippetSource {
  id: string;
  js: string;
  html: string;
}

const js = import.meta.glob("../snippets/*.js", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const html = import.meta.glob("../snippets/*.html", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const idOf = (path: string) => path.replace(/^.*\/([\w-]+)\.(js|html)$/, "$1");

export const snippets: Record<string, SnippetSource> = {};
for (const [path, code] of Object.entries(js)) {
  const id = idOf(path);
  snippets[id] = { id, js: code, html: "" };
}
for (const [path, markup] of Object.entries(html)) {
  const id = idOf(path);
  if (snippets[id]) snippets[id].html = markup;
}

/** Fault buttons offered under server demos (see server.ts / the emulator). */
export const FAULTS: Record<string, string> = {
  "500": "HTTP 500",
  "419": "419 session expired",
  "302": "302 to the login page",
  error200: "200 with error",
  "422": "422 validation",
  timeout: "timeout",
};
