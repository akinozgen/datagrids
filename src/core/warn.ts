/** Coded dev warnings. Always compiled, printed once per message. */
export const WARNINGS = {
  DG001: "Unknown option `{name}`.{hint}",
  DG002: "Grid has no accessible name; pass `label` or `labelledBy`.",
  DG003: "No row key found (rowKey/id/DT_RowId); falling back to index. Selection and focus keeping are disabled.",
  DG004: "Unknown column key `{name}`.",
  DG005: "`{name}` needs a selector that matches exactly one <table>; matched {count}.",
  DG006: "Datagrids.reload(`{name}`): no grid with that name.",
  DG007: "Module `{name}` requires `{dep}`, which is not attached.",
  DG008: "Two modules claim the single `{slot}` slot (`{a}` and `{b}`).",
  DG009: "Module `{name}` is attached twice.",
  DG010: "Module name `{name}` collides with a core grid member.",
  DG011: "<html lang> is missing; uppercase headers may render Turkish i wrong (TARIH).",
  DG012: "Server error: {detail}",
  DG013: "Page size {size} exceeds maxPageSize {max}; clamped.",
  DG014: "Could not write grid state to storage ({reason}).",
} as const;

export type WarningCode = keyof typeof WARNINGS;

const seen = new Set<string>();
let enabled = true;

export function setWarnings(on: boolean): void {
  enabled = on;
}

export function format(code: WarningCode, vars: Record<string, string | number> = {}): string {
  return `[datagrids ${code}] ` + WARNINGS[code].replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export function warn(code: WarningCode, vars?: Record<string, string | number>): void {
  if (!enabled) return;
  const msg = format(code, vars);
  if (seen.has(msg)) return;
  seen.add(msg);
  console.warn(msg);
}

/** Module-specific dev notice: same switch and once-per-message rule as the coded warnings. */
export function notice(module: string, text: string): void {
  if (!enabled) return;
  const msg = `[datagrids] ${module}: ${text}`;
  if (seen.has(msg)) return;
  seen.add(msg);
  console.warn(msg);
}

/** Throws a coded error (module wiring mistakes). */
export function fail(code: WarningCode, vars?: Record<string, string | number>): never {
  throw new Error(format(code, vars));
}

/** Levenshtein distance ≤ 2 suggestion for typos (`serverside` → `serverSide`). */
export function suggest(name: string, known: readonly string[]): string | null {
  let best: string | null = null;
  let bestD = 3;
  const a = name.toLowerCase();
  for (const k of known) {
    const b = k.toLowerCase();
    if (Math.abs(a.length - b.length) > 2) continue;
    const d = lev(a, b);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

function lev(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}
