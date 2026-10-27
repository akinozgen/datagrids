---
title: Getting started
type: tutorial
description: Install datagrids, load the stylesheet, turn a table into a grid, then point it at a server endpoint.
---

# Getting started

datagrids turns a plain `<table>` into a sortable, searchable, paged grid. It has no runtime
dependencies, works with any framework (or none), and keeps the table you gave it: `destroy()`
hands it back exactly as it was.

## Install

::: code-group

```sh [npm]
npm i @akinozgen17/datagrids
```

```sh [pnpm]
pnpm add @akinozgen17/datagrids
```

```sh [yarn]
yarn add @akinozgen17/datagrids
```

:::

```js
import { Datagrid, column } from "@akinozgen17/datagrids";
import "@akinozgen17/datagrids/css";
```

The stylesheet is required: without it the grid has no layout. It contains the design tokens and
every module's styles in one file. If you only want the tokens (to theme your own markup with the
same values), import `@akinozgen17/datagrids/css/tokens`.

### Without a bundler

The package ships an IIFE build that exposes everything on `window.Datagrids`:

```html
<link rel="stylesheet" href="https://unpkg.com/@akinozgen17/datagrids/dist/datagrids.css">
<script src="https://unpkg.com/@akinozgen17/datagrids/dist/datagrids.global.js"></script>
<script>
  const { Datagrid, column } = Datagrids;
  new Datagrid("#agents", { label: "Agents", columns: [column.text("name", { title: "Name" })] });
</script>
```

Pin a version in production (`@akinozgen17/datagrids@0.1.0/dist/…`).

## Your first grid

A grid is a table plus columns. Everything else — data sources, buttons, export, saved state — is a
[module](/guide/concepts#modules) you attach with `use`.

<Demo id="first-grid" />

What you get without asking:

- **Search** across searchable columns, accent- and case-insensitive (`isik` finds `Işık`).
- **Sorting** on every typed column, with a permanent sort icon and `aria-sort` on the header.
- **Paging** with a page-size menu, a page jump field and a "1–10 / 120 records" summary.
- **Typed cells**: money and dates are formatted, right-aligned where it matters, and exported as
  real numbers and dates later.
- **Accessibility**: a native `<table>`, header buttons, a "Skip table" link and polite
  announcements for search results and page changes.

::: tip Give every grid a name
`label` (or `labelledBy`, or a `<caption>`) is the grid's accessible name. Without one you get the
[DG002](/errors/DG002) warning in the console.
:::

## Enhance an existing table

If the server already renders the rows, don't pass `columns` or `data`: datagrids reads `<thead>`,
adopts the existing `<tr>` elements (cell HTML, links and widgets survive) and runs search, sort
and paging in the browser.

```html
<table id="inventory">
  <caption>Unit inventory</caption>
  <thead>
    <tr>
      <th data-dg-key="code">Code</th>
      <th data-dg-key="item">Item</th>
      <th data-dg-key="qty" data-dg-type="number">Qty</th>
    </tr>
  </thead>
  <tbody>
    <tr><td>INV-001</td><td>Green Herb</td><td>42</td></tr>
    <tr><td>INV-002</td><td>Red Herb</td><td>7</td></tr>
  </tbody>
</table>
<script type="module">
  import { Datagrid } from "@akinozgen17/datagrids";
  new Datagrid("#inventory", { pageSize: 25 });
</script>
```

See [Data sources → DOM](/guide/data-sources#dom-progressive-enhancement) for the `data-dg-*`
header attributes.

## Point it at a server

Large lists page on the server. Attach a `serverSide` source with the protocol your endpoint
speaks. This one talks to a Laravel controller that returns
[yajra/laravel-datatables](https://yajrabox.com/docs/laravel-datatables) JSON — the demo server
runs inside this page, so open the **Request** and **Response** tabs to see the exact wire format.

<Demo id="first-server" faults="500,419" />

The endpoint receives the classic `draw/start/length/search/order/columns[]` form body and never
needs to change. See [Server protocols](/guide/server-protocols) for the other two protocols
(Laravel's paginator JSON and the datagrids protocol).

## Next steps

- [Concepts](/guide/concepts): grid, columns, modules, pipelines — read this before anything else.
- [Columns](/guide/columns): typed factories, HTML opt-in, export values.
- [Modules](/modules/): saved state, column menu, selection, row actions, export…
- Coming from another grid library? [Migration](/migration/from-datatables).
