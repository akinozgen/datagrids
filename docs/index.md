---
layout: home
title: datagrids
titleTemplate: Accessible, zero-dependency data grid
description: Zero-dependency, accessible data grid for plain HTML tables. Typed columns, composable modules, server protocols and a design host CSS can't break.

hero:
  name: datagrids
  text: Data grids for plain HTML tables
  tagline: Zero dependencies. A design your page's CSS can't break. Native-table accessibility. Typed columns and small composable modules. Talks to your server the way it already works.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Concepts
      link: /guide/concepts
    - theme: alt
      text: Modules
      link: /modules/

features:
  - icon: 📦
    title: Zero dependencies
    details: Vanilla TypeScript, ESM + CJS + a single IIFE for script tags. No jQuery, no CSS framework, nothing to keep in sync.
  - icon: 🛡️
    title: A design host CSS can't break
    details: Component-scoped --dg-* tokens, a low-specificity reset and state carried in attributes. One --dg-accent line rebrands it; dark mode follows your page's color-scheme.
  - icon: ♿
    title: Accessible by default
    details: A real table element, sort buttons with aria-sort, a "Skip table" link, polite live announcements, focus that survives re-renders. Checked with axe.
  - icon: 🧩
    title: Composition, not configuration
    details: A grid is a table plus typed columns. Saved state, column menu, selection, row actions and export are modules you attach with use — and only those end up in your bundle.
  - icon: 🔌
    title: Your server, as it is
    details: Three protocols out of the box — the classic draw/start/length wire that yajra (Laravel) speaks, Laravel's paginate() JSON, and the typed datagrids protocol v1.
  - icon: 📊
    title: Real Excel files, no library
    details: A built-in XLSX writer exports real numbers, money and dates with a frozen, filterable header. CSV and a light print view sit next to it.
  - icon: ⚙️
    title: Laravel conveniences
    details: csrf true, session-expiry events on 419/401, Laravel error shapes normalized into one error state with Retry, soft-delete toggles, URL-synced filters.
  - icon: 🌱
    title: Progressive enhancement
    details: Enhance a server-rendered table in place. destroy() hands it back exactly as it was; upgrade() initializes data-datagrid tables declaratively and is idempotent.
---

<div class="vp-doc home-section">

## See it working

A server-side grid with a column menu, saved view, reload button and export menu. The server runs
inside this page; the **Request** tab shows exactly what goes over the wire.

<Demo id="home-grid" />

## Install

```sh
npm i @akinozgen17/datagrids
```

```js
import { Datagrid, column, serverSide, yajra } from "@akinozgen17/datagrids";
import "@akinozgen17/datagrids/css";
```

Then read [Getting started](/guide/getting-started) and [Concepts](/guide/concepts). Moving an
existing grid over? The [migration guide](/migration/) maps options, events and API
calls one by one.

</div>
