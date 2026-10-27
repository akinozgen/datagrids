---
title: Recipes
type: how-to
description: Task-first guides for common list pages — Laravel back ends, filters, selection, row actions, export, custom toolbars, tabs and re-initialization.
---

# Recipes

Each recipe solves one task end to end: the goal, the steps, complete working code (with a live
demo you can edit) and the reasons behind the choices. They assume you know the
[concepts](/guide/concepts) — a grid, its columns, and the modules you attach with `use`.

## Laravel

| Recipe | What you get |
|---|---|
| [Laravel + yajra list](/recipes/laravel-yajra) | Point a grid at an existing `yajra/laravel-datatables` controller without changing it; server-rendered HTML columns, extra page parameters, joined columns. |
| [Laravel paginator & API resources](/recipes/laravel-paginator) | Use `paginate()`, `simplePaginate()` or `JsonResource::collection()` JSON as a grid source. |
| [CSRF & session expiry](/recipes/csrf-and-session) | Send the CSRF token, recognize an expired session (419, 401, redirect to login) and react in one place. |

## Pages

| Recipe | What you get |
|---|---|
| [Page filter panel](/recipes/filter-panel) | A filter form above the grid that sends its values with every request, plus a shareable URL. |
| [Selection + bulk action](/recipes/bulk-actions) | Checkbox selection across pages, "select all matching" and one POST that handles both. |
| [Row actions with confirm](/recipes/row-actions) | A per-row action menu with links, requests, confirmation, permissions and disabled reasons. |
| [Export](/recipes/export) | Excel, CSV and print on a server grid, and a server-side export for very large lists. |
| [Custom toolbar (headless)](/recipes/custom-toolbar) | Drive the grid from your own controls, or place your elements into the toolbar slots. |

## Lifecycle

| Recipe | What you get |
|---|---|
| [Grids in tabs & modals](/recipes/tabs-and-modals) | No request until the grid is visible, no column re-alignment calls. |
| [Destroy, re-init & Livewire](/recipes/destroy-and-reinit) | Tear down and rebuild grids safely, declarative `upgrade()`, Livewire and Turbo pages. |
