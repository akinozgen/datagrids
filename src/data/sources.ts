import type { AnyModule, DataSource, Row } from "../core/types";
import { getPath } from "../core/util";
import { fetchError, httpError } from "./errors";
import { makeArraySource, makeDomSource } from "./client";

/** Wraps a DataSource as an attachable module (single `source` slot). */
export function sourceModule(source: DataSource): AnyModule {
  return Object.freeze({ name: "source", kind: "source", slot: "source", source });
}

export const arraySourceDef = (rows: Row[]) => sourceModule(makeArraySource(rows));
export const domSourceDef = () => sourceModule(makeDomSource());

/** Client mode over an array (`data: []`). */
export function arraySource(rows: Row[]): AnyModule {
  return arraySourceDef(rows);
}

/** Progressive enhancement of the table's existing <tbody>. */
export function domSource(): AnyModule {
  return domSourceDef();
}

/** Any custom source: `customSource({ mode: 'server', load })`. */
export function customSource(source: Omit<DataSource, "name"> & { name?: string }): AnyModule {
  return sourceModule({ name: "custom", ...source });
}

export interface FetchAllOptions {
  url: string;
  method?: "GET" | "POST";
  /** path to the rows in the JSON (default: `data` when present, else the body itself) */
  dataSrc?: string | ((json: any) => Row[]);
  csrf?: boolean;
  body?: Record<string, unknown>;
}

/** Client mode over rows fetched once ("ajax + client" tables); search/sort/paging stay local. */
export function fetchAll(o: FetchAllOptions): AnyModule {
  return sourceModule({
    name: "fetchAll",
    mode: "client",
    cells: "text",
    async load(_q, ctx) {
      const m = ctx.grid.messages;
      const headers: Record<string, string> = { Accept: "application/json" };
      if (ctx.host.laravel !== false) headers["X-Requested-With"] = "XMLHttpRequest";
      const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content;
      if ((o.csrf ?? ctx.host.csrf) && token) headers["X-CSRF-TOKEN"] = token;
      let body: string | undefined;
      if (o.body) {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify(o.body);
      }
      const f = ctx.host.fetch ?? ((...a: Parameters<typeof fetch>) => globalThis.fetch(...a));
      let res: Response;
      try {
        res = await f(o.url, { method: o.method ?? (o.body ? "POST" : "GET"), headers, body, signal: ctx.signal, credentials: "same-origin" });
      } catch (e) {
        throw fetchError(e, m);
      }
      const err = await httpError(res, m);
      if (err) throw err;
      const json = await res.json().catch(() => {
        throw { kind: "parse", status: res.status, message: m.errParse, retryable: false };
      });
      const rows = (typeof o.dataSrc === "function" ? o.dataSrc(json) : o.dataSrc ? getPath(json, o.dataSrc) : Array.isArray(json) ? json : json?.data) as Row[];
      const list = Array.isArray(rows) ? rows : [];
      return { rows: list, total: list.length, filtered: list.length, raw: json };
    },
  });
}
