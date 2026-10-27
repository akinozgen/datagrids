// Visual verification helper: node scripts/shot.mjs <path> <out.png> [--w 1280] [--h 900] [--sel css] [--full] [--dark] [--rtl] [--wait css] [--click css]...
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const [path, out] = args;
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const browser = await chromium.launch({ executablePath: process.env.DG_BROWSER ?? "/usr/bin/brave-browser" });
const page = await browser.newPage({
  viewport: { width: +opt("--w", 1280), height: +opt("--h", 900) },
  reducedMotion: "reduce",
  colorScheme: args.includes("--dark") ? "dark" : "light",
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/favicon|404/.test(m.text()) && errors.push(m.text()));
await page.goto(`http://localhost:5174/${path}`);
const wait = opt("--wait", null);
if (wait) await page.waitForSelector(wait);
for (const c of all("--click")) await page.click(c);
for (const c of all("--fclick")) await page.click(c, { force: true });
for (const f of all("--focus")) await page.focus(f);
for (const k of all("--key")) await page.keyboard.press(k);
for (const t of all("--type")) { const [sel, val] = t.split("="); await page.fill(sel, val); }
await page.waitForTimeout(+opt("--settle", 150));
const sel = opt("--sel", null);
if (sel) await page.locator(sel).first().screenshot({ path: out });
else await page.screenshot({ path: out, fullPage: args.includes("--full") });
if (errors.length) console.log("PAGE ERRORS:\n" + errors.join("\n"));
await browser.close();
console.log("shot:", out);
