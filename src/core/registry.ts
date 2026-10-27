import type { DatagridApi } from "./types";

export const byTable = new WeakMap<Element, DatagridApi>();
export const byName = new Map<string, DatagridApi>();
