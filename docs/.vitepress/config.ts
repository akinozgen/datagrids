import { defineConfig, type DefaultTheme } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { demoSnippets } from "./plugins/demo-snippets";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const require = createRequire(import.meta.url);
const { version } = require("../../package.json") as { version: string };

const SITE = "https://akinozgen.github.io/datagrids";
const NPM = "https://www.npmjs.com/package/@akinozgen17/datagrids";
const REPO = "https://github.com/akinozgen/datagrids";

const guide: DefaultTheme.SidebarItem[] = [
  {
    text: "Introduction",
    items: [
      { text: "Getting started", link: "/guide/getting-started" },
      { text: "Concepts", link: "/guide/concepts" },
    ],
  },
  {
    text: "Essentials",
    items: [
      { text: "Columns", link: "/guide/columns" },
      { text: "Data sources", link: "/guide/data-sources" },
      { text: "Server protocols", link: "/guide/server-protocols" },
      { text: "Lifecycle", link: "/guide/lifecycle" },
      { text: "States & errors", link: "/guide/states-and-errors" },
    ],
  },
  {
    text: "Look & feel",
    items: [
      { text: "Theming", link: "/guide/theming" },
      { text: "Localization & RTL", link: "/guide/i18n" },
      { text: "Anatomy (DOM contract)", link: "/guide/anatomy" },
    ],
  },
  {
    text: "Quality",
    items: [
      { text: "Accessibility", link: "/guide/accessibility" },
      { text: "Performance", link: "/guide/performance" },
    ],
  },
];

const modules: DefaultTheme.SidebarItem[] = [
  { text: "Overview", link: "/modules/" },
  {
    text: "Data & view",
    items: [
      { text: "stateSave", link: "/modules/state-save" },
      { text: "colVis", link: "/modules/colvis" },
      { text: "colReorder", link: "/modules/col-reorder" },
      { text: "responsive", link: "/modules/responsive" },
      { text: "lazyColumns", link: "/modules/lazy-columns" },
      { text: "stickyHeader", link: "/modules/sticky-header" },
      { text: "filterPresets", link: "/modules/filter-presets" },
      { text: "autoRefresh", link: "/modules/auto-refresh" },
      { text: "multiSort", link: "/modules/multi-sort" },
      { text: "columnFilters", link: "/modules/column-filters" },
      { text: "filterPanel", link: "/modules/filter-panel" },
      { text: "urlSync", link: "/modules/url-sync" },
      { text: "softDeletes", link: "/modules/soft-deletes" },
    ],
  },
  {
    text: "Rows",
    items: [
      { text: "actions", link: "/modules/actions" },
      { text: "selection", link: "/modules/selection" },
      { text: "rowReorder", link: "/modules/row-reorder" },
      { text: "keyboardGrid", link: "/modules/keyboard-grid" },
    ],
  },
  {
    text: "Output",
    items: [
      { text: "excel · csv · print", link: "/modules/export" },
      { text: "footer", link: "/modules/footer" },
      { text: "metaBind", link: "/modules/meta-bind" },
      { text: "buttons", link: "/modules/buttons" },
    ],
  },
];

const recipes: DefaultTheme.SidebarItem[] = [
  { text: "All recipes", link: "/recipes/" },
  {
    text: "Laravel",
    items: [
      { text: "Laravel + yajra list", link: "/recipes/laravel-yajra" },
      { text: "Laravel paginator & API resources", link: "/recipes/laravel-paginator" },
      { text: "CSRF & session expiry", link: "/recipes/csrf-and-session" },
    ],
  },
  {
    text: "Pages",
    items: [
      { text: "Page filter panel", link: "/recipes/filter-panel" },
      { text: "Selection + bulk action", link: "/recipes/bulk-actions" },
      { text: "Row actions with confirm", link: "/recipes/row-actions" },
      { text: "Export", link: "/recipes/export" },
      { text: "Custom toolbar (headless)", link: "/recipes/custom-toolbar" },
    ],
  },
  {
    text: "Lifecycle",
    items: [
      { text: "Grids in tabs & modals", link: "/recipes/tabs-and-modals" },
      { text: "Destroy, re-init & Livewire", link: "/recipes/destroy-and-reinit" },
    ],
  },
];

const reference: DefaultTheme.SidebarItem[] = [
  {
    text: "Reference",
    items: [
      { text: "Grid options", link: "/reference/options" },
      { text: "Column options", link: "/reference/columns" },
      { text: "Instance methods", link: "/reference/methods" },
      { text: "Events", link: "/reference/events" },
      { text: "Static API & configure()", link: "/reference/static" },
      { text: "Writing a module", link: "/reference/modules" },
      { text: "Messages (i18n keys)", link: "/reference/messages" },
      { text: "CSS tokens", link: "/reference/css" },
      { text: "Warning codes", link: "/errors/" },
    ],
  },
];

const protocol: DefaultTheme.SidebarItem[] = [
  {
    text: "Server protocols",
    items: [
      { text: "Overview", link: "/protocol/" },
      { text: "SSP wire (ssp / yajra)", link: "/protocol/ssp" },
      { text: "Laravel paginator", link: "/protocol/laravel-paginator" },
      { text: "datagrids protocol v1", link: "/protocol/v1/" },
    ],
  },
];

export default defineConfig({
  lang: "en-US",
  title: "datagrids",
  description:
    "Zero-dependency, accessible data grid for plain HTML tables. Typed columns, composable modules, server protocols and a design host CSS can't break.",
  base: "/datagrids/",
  // internal working documents: gitignored, never part of the site
  srcExclude: ["research/**", "[A-Z]*.md", "**/README.md"],
  lastUpdated: true,
  sitemap: { hostname: `${SITE}/` },
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/datagrids/logo.svg" }],
    ["meta", { name: "theme-color", content: "#3d63dd" }],
    // live demos talk to an in-browser server that expects a Laravel-style CSRF token
    ["meta", { name: "csrf-token", content: "docs-demo-token" }],
  ],
  markdown: {
    theme: { light: "github-light", dark: "github-dark" },
  },
  vite: {
    plugins: [
      demoSnippets({ dir: resolve(here, "snippets") }),
      llmstxt({
        domain: SITE.replace(/\/datagrids$/, ""),
        description: "Zero-dependency, accessible data grid that enhances plain HTML tables",
        details:
          "A small grid core with typed columns plus independent modules attached with `use`. Server protocols: the classic SSP wire (yajra/laravel-datatables), the datagrids protocol v1 and Laravel paginator JSON. Styling is isolated under `--dg-*` tokens. Start with the cheat sheet: llm.md.",
      }),
    ],
    resolve: {
      alias: [
        { find: /^@akinozgen17\/datagrids$/, replacement: resolve(here, "theme/lib.ts") },
      ],
    },
    server: { fs: { allow: [repo] } },
    // the docs build is a host page: keep library warnings visible in the console
    define: {},
  },
  themeConfig: {
    logo: { src: "/logo.svg", alt: "" },
    nav: [
      { text: "Guide", link: "/guide/getting-started", activeMatch: "/guide/" },
      { text: "Modules", link: "/modules/", activeMatch: "/modules/" },
      { text: "Recipes", link: "/recipes/", activeMatch: "/recipes/" },
      { text: "Protocol", link: "/protocol/", activeMatch: "/protocol/" },
      {
        text: "Reference",
        items: [
          { text: "Grid options", link: "/reference/options" },
          { text: "Methods", link: "/reference/methods" },
          { text: "Events", link: "/reference/events" },
          { text: "CSS tokens", link: "/reference/css" },
          { text: "Warning codes", link: "/errors/" },
          { text: "LLM cheat sheet", link: "/llm" },
        ],
      },
      { text: "Migration", link: "/migration/", activeMatch: "/migration/" },
      { text: `v${version}`, link: NPM },
    ],
    sidebar: {
      "/guide/": guide,
      "/modules/": modules,
      "/recipes/": recipes,
      "/reference/": reference,
      "/errors/": reference,
      "/protocol/": protocol,
      "/migration/": [
        { text: "Migration", items: [{ text: "Overview", link: "/migration/" }, { text: "From DataTables", link: "/migration/from-datatables" }] },
        ...guide,
      ],
      "/llm": reference,
    },
    outline: { level: [2, 3] },
    search: { provider: "local" },
    socialLinks: [
      { icon: "github", link: REPO },
      { icon: "npm", link: NPM },
    ],
    editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: "Edit this page on GitHub" },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © Akın Özgen",
    },
  },
});
