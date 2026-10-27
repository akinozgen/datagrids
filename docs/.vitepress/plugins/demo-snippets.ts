// Live demo snippets: demo code lives outside the Markdown, in docs/.vitepress/snippets/<id>.js
// (+ optional <id>.html), registered in theme/snippets.ts. This pre-transform expands every
// `<Demo id="…" />` into the component plus fenced code blocks, so the code is visible on the page,
// in the per-page .md files and in llms-full.txt (vitepress-plugin-llms reads the transformed source).
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const TAG = /^([ \t]*)<Demo\s+id="([\w-]+)"([^>]*?)\s*\/>[ \t]*$/gm;

export function demoSnippets(o: { dir: string }): Plugin {
  return {
    name: "datagrids:demo-snippets",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".md") || !code.includes("<Demo")) return null;
      const out = code.replace(TAG, (_m, indent: string, name: string, attrs: string) => {
        const jsFile = resolve(o.dir, `${name}.js`);
        const htmlFile = resolve(o.dir, `${name}.html`);
        if (!existsSync(jsFile)) throw new Error(`[demo-snippets] ${id}: no snippet "${name}" (${jsFile})`);
        this.addWatchFile(jsFile);
        const js = readFileSync(jsFile, "utf8").trimEnd();
        const html = existsSync(htmlFile) ? readFileSync(htmlFile, "utf8").trimEnd() : "";
        if (html) this.addWatchFile(htmlFile);
        const fences = [
          "::: code-group",
          "",
          "```js [JavaScript]",
          js,
          "```",
          ...(html ? ["", "```html [HTML]", html, "```"] : []),
          "",
          ":::",
        ];
        return [`${indent}<Demo id="${name}"${attrs}>`, "", ...fences, "", `${indent}</Demo>`].join("\n");
      });
      return out === code ? null : { code: out, map: null };
    },
  };
}
