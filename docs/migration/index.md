---
title: Migration
type: how-to
description: Guides for moving existing tables from other grid libraries to datagrids, one page at a time.
---

# Migration

| Coming from | Guide | Covers |
|---|---|---|
| DataTables | [Migrating from DataTables](/migration/from-datatables) | 1.10, 2.x and 3.x (plus legacy 1.9 names): options, events, API calls, server endpoints |

Whatever you migrate from, the approach is the same:

1. **Keep the server.** datagrids speaks the DataTables server-side protocol, Laravel paginator JSON
   and its own protocol, so endpoints don't have to change first. See [Server protocols](/protocol/).
2. **Move one page at a time.** datagrids has no global state that clashes with other grid libraries,
   so old and new grids can live on the same page while you migrate.
3. **Turn repeated configuration into a preset.** The options most pages copy (data source, column
   menu, export, saved state) become one array you put in `use`. See
   [Concepts → Modules](/guide/concepts#modules).
