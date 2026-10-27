/**
 * jQuery 3 `$.param` (traditional: false) byte-for-byte:
 * booleans "true"/"false", null/undefined → `k=`, empty arrays/objects are omitted,
 * arrays of scalars `k[]=`, arrays of objects `k[0][x]=`, nested objects `k[a][b]=`, functions are called.
 * jQuery.ajax additionally turns `%20` into `+` for form bodies only (see `formBody`).
 */
export function encodeForm(data: unknown): string {
  const out: string[] = [];
  const add = (key: string, v: unknown) => {
    let value = typeof v === "function" ? (v as () => unknown)() : v;
    if (value == null) value = "";
    out.push(encodeURIComponent(key) + "=" + encodeURIComponent(String(value)));
  };
  const build = (prefix: string, obj: unknown) => {
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => {
        if (/\[\]$/.test(prefix)) add(prefix, v);
        else build(`${prefix}[${typeof v === "object" && v != null ? i : ""}]`, v);
      });
    } else if (obj != null && typeof obj === "object" && !(obj instanceof Date)) {
      for (const name in obj as Record<string, unknown>) build(`${prefix}[${name}]`, (obj as Record<string, unknown>)[name]);
    } else add(prefix, obj);
  };
  if (Array.isArray(data)) {
    // jQuery serializes a top-level array of {name,value} pairs
    for (const p of data as Array<{ name: string; value: unknown }>) add(p.name, p.value);
  } else if (data && typeof data === "object") {
    for (const k in data as Record<string, unknown>) build(k, (data as Record<string, unknown>)[k]);
  }
  return out.join("&");
}

/** POST body exactly as jQuery.ajax sends it (application/x-www-form-urlencoded). */
export const formBody = (data: unknown): string => encodeForm(data).replace(/%20/g, "+");
