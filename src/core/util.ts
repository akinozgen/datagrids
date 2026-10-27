/** Writes a dotted path (`birim.ad`), creating the objects on the way. */
export function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  if (path.indexOf(".") < 0) {
    obj[path] = value;
    return;
  }
  const parts = path.split(".");
  let cur = obj;
  for (const part of parts.slice(0, -1)) {
    const next = cur[part];
    cur = (next && typeof next === "object" ? next : (cur[part] = {})) as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]!] = value;
}

/** Reads a dotted path (`musteri.isim`) from a row object. */
export function getPath(obj: unknown, path: string | undefined): unknown {
  if (obj == null || !path) return undefined;
  if (path.indexOf(".") < 0) return (obj as Record<string, unknown>)[path];
  let cur: unknown = obj;
  for (const part of path.split(".")) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

type Attrs = Record<string, string | number | boolean | null | undefined>;

/** Small element factory. `false`/`null`/`undefined` attributes are skipped. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  ...children: Array<Node | string | null | undefined | false>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v === false || v == null) continue;
      if (k === "class") el.className = String(v);
      else el.setAttribute(k, v === true ? "" : String(v));
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    el.append(c);
  }
  return el;
}

/** Parses a trusted, library-owned SVG/markup string into a node. */
export function frag(html: string): DocumentFragment {
  const t = document.createElement("template");
  t.innerHTML = html;
  return t.content;
}

export function toggleAttr(el: Element, name: string, on: boolean, value = ""): void {
  if (on) el.setAttribute(name, value);
  else el.removeAttribute(name);
}

let uid = 0;
export const nextId = (prefix = "dg"): string => `${prefix}${++uid}`;

/** Decodes the five entities yajra's e() produces (strict, no innerHTML). */
export function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#0?39);/g, (_, e: string) =>
    e === "amp" ? "&" : e === "lt" ? "<" : e === "gt" ? ">" : e === "quot" ? '"' : "'",
  );
}

/** Plain text of an HTML string without executing anything. */
export function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}`, "text/html");
  doc.querySelectorAll(".dropdown-menu, .sr-only, [data-export-ignore], script, style, template").forEach((n) => n.remove());
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  const d = (...a: A) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
  d.cancel = () => t && clearTimeout(t);
  return d;
}
