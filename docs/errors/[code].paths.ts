// Dynamic route /errors/DG001 … : one page per coded warning/error.
// Message templates are read from the library source at build time; explanations come from
// ./explanations.ts. The build fails when the two drift apart (a code without an explanation, an
// explanation without a code, or a code missing from errors/index.md).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { explanations } from "./explanations";

const WARN_TS = fileURLToPath(new URL("../../src/core/warn.ts", import.meta.url));
const INDEX_MD = fileURLToPath(new URL("./index.md", import.meta.url));

/** `DG001: "Unknown option `{name}`.{hint}",` entries of the WARNINGS object. */
function readWarnings(): Array<{ code: string; message: string }> {
  const src = readFileSync(WARN_TS, "utf8");
  const block = src.match(/export const WARNINGS = \{([\s\S]*?)\} as const;/);
  if (!block) throw new Error(`[errors] WARNINGS object not found in ${WARN_TS}`);
  const out: Array<{ code: string; message: string }> = [];
  const entry = /^\s*(DG\d{3}):\s*"((?:[^"\\]|\\.)*)",?\s*$/gm;
  for (const m of block[1]!.matchAll(entry)) out.push({ code: m[1]!, message: JSON.parse(`"${m[2]}"`) as string });
  if (!out.length) throw new Error("[errors] no WARNINGS entries matched");
  return out;
}

/** Inline code span that survives backticks inside the message. */
function code(s: string): string {
  const runs = s.match(/`+/g) ?? [];
  const fence = "`".repeat(Math.max(0, ...runs.map((r) => r.length)) + 1);
  const pad = s.startsWith("`") || s.endsWith("`") ? " " : "";
  return `${fence}${pad}${s}${pad}${fence}`;
}

export default {
  paths() {
    const warnings = readWarnings();
    const index = readFileSync(INDEX_MD, "utf8");
    const codes = new Set(warnings.map((w) => w.code));
    const problems: string[] = [];
    for (const { code: c } of warnings) {
      if (!explanations[c]) problems.push(`${c} has no entry in docs/errors/explanations.ts`);
      if (!new RegExp(`^## ${c}\\b`, "m").test(index)) problems.push(`${c} has no "## ${c}" section in docs/errors/index.md`);
    }
    for (const c of Object.keys(explanations)) if (!codes.has(c)) problems.push(`${c} is explained but not defined in src/core/warn.ts`);
    if (problems.length) throw new Error(`[errors] warning codes drifted:\n- ${problems.join("\n- ")}`);

    return warnings.map(({ code: c, message }) => {
      const x = explanations[c]!;
      const kind = x.kind === "error" ? "Thrown error" : "Console warning";
      const content = [
        `# ${c}: ${x.title}`,
        "",
        `<Badge type="${x.kind === "error" ? "danger" : "warning"}" text="${kind}" />`,
        "",
        "```text",
        `[datagrids ${c}] ${message}`,
        "```",
        "",
        x.kind === "error"
          ? "This is a wiring mistake: the grid throws an `Error` with this message instead of half-working."
          : "Printed with `console.warn`, once per distinct message. `configure({ warnings: false })` silences it.",
        "",
        "## When it happens",
        "",
        x.when,
        "",
        "## How to fix it",
        "",
        x.fix,
        "",
        "## Related",
        "",
        "- [All warning codes](/errors/)",
        "- [Grid options](/reference/options)",
        "- [Static API & configure()](/reference/static)",
        "",
      ].join("\n");
      return { params: { code: c, title: x.title, kind: x.kind, message }, content };
    });
  },
};
