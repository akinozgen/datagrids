// Server columns computed on demand: only the visible lazy columns are requested; showing one reloads the page
// in place. Hiding one needs no request.
import { notice } from "../core/warn";
import type { ModuleDef } from "../core/types";
import { config } from "../core/config";

export interface LazyColumnsOptions {
  /** lazy column keys (columns with `lazy: true` are included too) */
  keys?: string[];
  /** request parameter listing the visible lazy keys (default "lazy") */
  param?: string;
  /** permission flag */
  can?: boolean;
}

export interface LazyColumnsApi {
  /** request parameter carrying the lazy keys */
  readonly param: string;
  /** lazy keys sent with the last request */
  requested(): string[];
  /** lazy keys visible right now */
  visible(): string[];
}

export function lazyColumns(opts: LazyColumnsOptions = {}): ModuleDef<"lazyColumns", LazyColumnsApi> {
  return Object.freeze<ModuleDef<"lazyColumns", LazyColumnsApi>>({
    name: "lazyColumns" as const,
    kind: "feature" as const,
    can: opts.can,
    setup(ctx) {
      const { grid } = ctx;
      const param = opts.param ?? "lazy";
      const lazy = () => new Set([...(opts.keys ?? []), ...grid.columns().filter((c) => c.lazy).map((c) => c.key)]);
      const visible = () => {
        const set = lazy();
        return grid.columns().filter((c) => c.visible && set.has(c.key)).map((c) => c.data ?? c.key);
      };
      let requested: string[] = [];

      ctx.request((req, next) => {
        requested = visible();
        // an empty list is left out, like any empty array on the wire
        if (requested.length) req.params[param] = requested.slice();
        return next(req);
      });

      ctx.ready(() => {
        if (grid.mode !== "server" && config.warnings !== false)
          notice("lazyColumns", "the data source is not in server mode; every column is already loaded.");
      });

      ctx.on("columnchange", () => {
        if (grid.mode !== "server" || !grid.status().loaded) return;
        // a newly shown lazy column has no data yet: reload the same page
        if (visible().some((k) => !requested.includes(k))) void grid.reload({ keepPage: true });
      });

      return { api: { param, requested: () => requested.slice(), visible } };
    },
  });
}

// stable name for grid.module(lazyColumns) after minification
lazyColumns.moduleName = "lazyColumns";
