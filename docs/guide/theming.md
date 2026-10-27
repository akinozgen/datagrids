---
title: Theming
type: explanation
description: Component-scoped --dg-* tokens, one-line rebranding with an inherited --dg-accent, --dg-rem scaling, dark mode via the host color-scheme, size and density axes, header style, card surface and a high-contrast recipe.
---

# Theming

The grid styles itself with **component-scoped design tokens** (`--dg-*` custom properties defined on
the grid root, never on `:root`), a low-specificity reset and state carried in attributes. Your page
CSS can't accidentally restyle it, and you can deliberately restyle it with a few tokens.

<Demo id="guide-theme" />

## Rebrand with one line

`--dg-accent` is an **input token**: the library reads it but never defines it, so it inherits from
anywhere above the grid.

```css
body { --dg-accent: #0f766e; }
```

Every accent color — checkbox fill, current page, focus ring, sort icon, links, selection tint — is
derived from it with `color-mix()` and relative color syntax. Text and icon accents are clamped to a
lightness that keeps ≥ 4.5:1 contrast on white, and the text on accent fills flips between black and
white automatically, so any brand color stays readable. In dark mode the accent is lifted one or two
steps.

Design systems that store colors as RGB triplets work as is:

```css
body { --dg-accent: rgb(var(--brand-rgb)); }
```

## Scale with `--dg-rem`

All sizes derive from the second input token, `--dg-rem` (default `1rem`), so the grid follows the
user's font size. If your layout shrinks `html { font-size }` on small screens and the grid should
not shrink with it, pin the base:

```css
@media (max-width: 970px) { body { --dg-rem: 16px; } }
```

## Dark mode

The palette is written with `light-dark()`: the grid follows the **`color-scheme` of your page**
(inherited), not the operating system. This site sets `color-scheme: dark` on `<html>` in dark mode,
which is why every demo switches with the theme toggle — no bridge code.

| `theme` option | Root attribute | Result |
|---|---|---|
| (none) | — | follow the inherited `color-scheme` (light when the page declares none) |
| `"light"` / `"dark"` | `data-dg-theme="light"` / `"dark"` | force |
| `"system"` | `data-dg-theme="system"` | follow the operating system |

## Size and density

Two independent axes, both token-only:

| | `size: "sm"` | `"md"` (default) | `"lg"` |
|---|---|---|---|
| body text | 12px | 13px | 14px |
| controls | 30px | 34px | 40px |

| | `density: "compact"` | `"normal"` (default) | `"comfortable"` |
|---|---|---|---|
| row height | 28px | 36px | 44px |

Values are at a 16px `--dg-rem`. On touch screens (`pointer: coarse`) controls grow to 44px while
row density stays as chosen. Rows are top-aligned so multi-line cells stay readable.

## Header style, surface and stripes

| Option | Default | Alternatives |
|---|---|---|
| `head` | `"caps"` — 11px, bold, uppercase, tracked | `"sentence"` (`data-dg-head="sentence"`) |
| `surface` | `"plain"` — no box, blends into the page | `"card"` (`data-dg-surface="card"`): own background, radius and shadow; `title`, `description` and the `count` move into a header |
| `striped` | `false` | `true` (`data-dg-striped`) |
| `wrap` | `true` | `false` (`data-dg-nowrap`): single-line cells |
| `rowTone` | — | `(row) => "ok" \| "warn" \| "bad" \| "info" \| "muted"` tints whole rows (`data-tone` on the `<tr>`) |

::: tip Uppercase headers and Turkish
Uppercasing uses the document language: in Turkish `i` must become `İ`. Set `<html lang>`; without it
the grid warns with [DG011](/errors/DG011).
:::

## Overriding tokens

Input tokens (`--dg-accent`, `--dg-rem`) inherit from any ancestor. **All other tokens are defined on
the grid root**, so set them on the root itself, with a selector that is more specific than `.dg`:

```css
/* one grid */
#agents-page .dg { --dg-head-bg: #eef2ff; --dg-row-h: 2rem; }
/* every grid in your app */
.app .dg { --dg-radius-surface: 4px; --dg-tone-ok: #047857; }
```

The full list with defaults is in the [CSS token reference](/reference/css). Variables named
`--dg-_*` are internal and may change without notice.

## What host CSS can and can't change

The grid is built for hostile pages (CSS frameworks, admin themes, global `* {}` rules). Its own rules
use a `.dg-` class reset with specificity (0,1,0), cell rules at (0,1,3), and never exceed (0,2,0)
elsewhere; state lives in attributes (`data-state`, `aria-sort`, `data-selected`), so host classes
like `.active` or `.selected` mean nothing to it. Row separators are painted as backgrounds, not
borders, so `table td { border: none }` style rules can't erase them.

| Host CSS | Effect |
|---|---|
| element rules (`table`, `td`, `button`, `input`) and single-class rules | no effect on the grid's layout |
| framework table classes (`.table td`, `.table-striped tr:nth-child(odd)`) | no effect |
| a more specific selector that targets the grid's elements | wins — that's your deliberate override |
| `!important` rules | win; the library never joins an `!important` race (it only uses it for reduced motion) |
| font family | inherited on purpose — the grid uses your typeface |

This documentation site is a test of that claim: the demos run inside VitePress' content area with
its own table, zebra-row and link styles, without isolation.

## High contrast

**Windows High Contrast / `forced-colors: active`** is supported by the library: borders, focus
outlines and states switch to system colors.

**App-level high-contrast themes** that force colors with `!important` (e.g.
`body.high-contrast * { color: #000 !important }`) also hit the grid's icons and filled buttons. Bridge
them once:

```css
body.high-contrast .dg {
  --dg-accent: #000; --dg-border: #000; --dg-border-strong: #000;
  --dg-line: #000; --dg-line-strong: #000; --dg-muted-fg: #000; --dg-head-fg: #000;
}
body.high-contrast .dg :is(.dg-btn, .dg-pager-btn, .dg-cellbtn, .dg-sort, .dg-textbtn, .dg-search-clear, .dg-panel-item) {
  background-color: transparent !important; color: #000 !important; border-width: 1px !important;
}
body.high-contrast .dg :is(.dg-sort, .dg-textbtn, .dg-search-clear, .dg-panel-item) { border-width: 0 !important; }
body.high-contrast .dg :is([data-variant="primary"], [aria-current="page"]) { background-color: #000 !important; color: #fff !important; }
body.high-contrast .dg :is([data-variant="primary"], [aria-current="page"], .dg-check-box) :is(svg, span) { color: #fff !important; }
body.high-contrast .dg .dg-search-input { border: 0 !important; }
```

## Motion

Panel and spinner animations are short (100–220 ms) and turn off under
`prefers-reduced-motion: reduce`.

## Related

- [CSS token reference](/reference/css)
- [Anatomy (DOM contract)](/guide/anatomy) — the stable classes and attributes to target
- [Localization & RTL](/guide/i18n)
