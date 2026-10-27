// Builds dist/tokens.css and dist/datagrids.css (tokens + core + every module stylesheet) with a light minify.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const minify = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{};,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();

const dir = "src/styles";
const modules = readdirSync(dir)
  .filter((f) => f.endsWith(".css") && f !== "tokens.css" && f !== "datagrids.css")
  .sort();
mkdirSync("dist", { recursive: true });
const tokens = readFileSync(`${dir}/tokens.css`, "utf8");
const parts = [tokens, readFileSync(`${dir}/datagrids.css`, "utf8"), ...modules.map((f) => readFileSync(`${dir}/${f}`, "utf8"))];
writeFileSync("dist/tokens.css", minify(tokens));
writeFileSync("dist/datagrids.css", minify(parts.join("\n")));
console.log("css ok:", ["tokens.css", "datagrids.css", ...modules].join(", "));
