import type { GlobalConfig } from "./types";
import { setWarnings } from "./warn";

/** Global defaults. Affects only grids created afterwards. */
export const config: GlobalConfig = {
  csrf: false,
  laravel: true,
  timeout: 30000,
  pageSize: 25,
  pageSizes: [10, 25, 50, 100],
  maxPageSize: 1000,
  warnings: true,
  errorMode: "inline",
  locale: undefined,
};

export function configure(patch: GlobalConfig): GlobalConfig {
  for (const k in patch) {
    const v = (patch as Record<string, unknown>)[k];
    if (v !== undefined) (config as Record<string, unknown>)[k] = v;
  }
  if (patch.warnings !== undefined) setWarnings(patch.warnings);
  return config;
}
