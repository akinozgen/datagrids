/** Locale-aware comparison and search folding (TR: ı/İ/i, diacritics). */
const collators = new Map<string, Intl.Collator>();

export function collator(locale: string): Intl.Collator {
  let c = collators.get(locale);
  if (!c) {
    c = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
    collators.set(locale, c);
  }
  return c;
}

/** Folds text for search: locale lowercase, strip marks, dotless ı → i. */
export function fold(s: string, locale = "tr"): string {
  return s
    .toLocaleLowerCase(locale)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i");
}

const MACHINE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * A value as data: `source: "number"` reads machine strings as JS numbers ("1.500" from a DECIMAL column is 1.5);
 * `"tr"` (display text, DOM cells) applies the Turkish/English formatting rules of parseNumber.
 */
export function readNumber(v: unknown, source: "number" | "tr" = "number"): number | null {
  if (source === "number" && typeof v === "string" && MACHINE.test(v.trim())) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return parseNumber(v);
}

/** Parses Turkish/English formatted numbers: "1.234,56", "-403,00", "1,234.56", "12". */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (v == null) return null;
  let s = String(v).replace(/[^\d,.\-+]/g, "");
  if (!s || s === "-" || s === "+") return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // the later separator is the decimal one
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    // single comma = TR decimal ("-403,00", "1234,5"); several = EN grouping ("1,234,567")
    s = s.split(",").length > 2 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot > -1) {
    const parts = s.split(".");
    // "1.234" / "1.234.567" are TR thousands; "12.5" is a decimal; "0.125" never groups thousands
    const lead = parts[0]!.replace(/^[+-]/, "");
    if (parts.length > 2 || (parts.length === 2 && parts[1]!.length === 3 && lead !== "0" && lead !== "")) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
