// Visits every built docs page (run `npm run docs:build` and `npm run docs:preview` first) and reports
// page errors, console errors, demos that failed to mount and grids stuck loading or in error.
// Usage: node scripts/verify-docs.mjs [baseUrl]   (default http://localhost:4174/datagrids/)
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://localhost:4174/datagrids/";
const dist = "docs/.vitepress/dist";
const walk = (d) =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    if (statSync(p).isDirectory()) return f === "assets" ? [] : walk(p);
    return p.endsWith(".html") && !p.endsWith("404.html") ? [relative(dist, p)] : [];
  });
const pages = walk(dist);
const browser = await chromium.launch(process.env.BROWSER ? { executablePath: process.env.BROWSER } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
let bad = 0;
let demos = 0;
for (const path of pages) {
  const p = await ctx.newPage();
  const msgs = [];
  p.on("pageerror", (e) => msgs.push("pageerror: " + e.message));
  p.on("console", (m) => {
    if ((m.type() === "error" || m.type() === "warning") && !/404|DG012|favicon/.test(m.text())) msgs.push(`${m.type()}: ${m.text().slice(0, 160)}`);
  });
  await p.goto(base + path, { waitUntil: "networkidle" }).catch((e) => msgs.push("goto: " + e.message));
  await p
    .waitForFunction(() => ![...document.querySelectorAll(".dg[data-state=loading]")].some((g) => !g.closest('[data-demo="guide-states"]') && g.offsetParent !== null), null, { timeout: 8000 })
    .catch(() => msgs.push("a visible grid stayed loading"));
  const errs = await p.$$eval(".dgd-error", (els) => els.map((e) => e.textContent.slice(0, 160)));
  const n = await p.$$eval(".dgd", (els) => els.length);
  // the states guide shows a failing grid on purpose
  const failed = await p.$$eval(".dgd .dg", (els) => els.filter((e) => e.getAttribute("data-state") === "error" && !e.closest('[data-demo="guide-states"]')).length);
  demos += n;
  const all = [...errs.map((e) => "DEMO ERROR: " + e), ...msgs, ...(failed ? [`${failed} grid(s) in error state`] : [])];
  if (all.length) {
    bad++;
    console.log(`== ${path} (${n} demos)\n  ` + [...new Set(all)].join("\n  "));
  }
  await p.close();
}
console.log(`pages: ${pages.length}, demos: ${demos}, pages with findings: ${bad}`);
await browser.close();
process.exit(bad ? 1 : 0);
