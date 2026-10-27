---
title: CSS tokens
type: reference
description: Every public --dg-* design token with its default and meaning, the two input tokens, the root attributes that switch size, density, theme and states, and the host hooks.
---

# CSS tokens

All styling is driven by custom properties named `--dg-*`. They are defined on the grid root `.dg`
(and on `.dg-portal`, the fallback root panels use when the browser has no Popover API), never on
`:root`, and without `@layer`. Pixel values below assume the default `--dg-rem` of 16 px.

```css
/* rebrand every grid on the page */
:root { --dg-accent: #0f766e; }

/* one grid: set tokens on its root */
#agents-page .dg { --dg-head-bg: #eef2ff; --dg-row-h: 2rem; }
```

- **Input tokens** (`--dg-accent`, `--dg-rem`) are only read, never defined, so they inherit: set
  them on `:root`, `body`, any wrapper or `.dg`.
- **All other tokens** are defined on `.dg`: override them with a selector that matches the root and
  is more specific than `.dg` (`.my-page .dg`). The `data-size` and `data-density` variants use
  `.dg[data-…]`, so overriding a size or density token needs at least that specificity.
- Tokens starting with **`--dg-_`** (underscore) are private row-state variables: don't set or read
  them.

See [Theming](/guide/theming) for the how-to.

## Input tokens

| Token | Default | Meaning |
|---|---|---|
| `--dg-accent` | `#3d63dd` (read as `var(--dg-accent, #3d63dd)`) | Brand color. Every accent token below derives from it, with legibility guarded in modern browsers. |
| `--dg-rem` | `1rem` | Base unit; every size, space and radius is a multiple of it. If the host shrinks `html { font-size }` for its own layout, pin it: `body { --dg-rem: 16px; }`. |

## Palette

Light values are the static defaults; dark values apply under a dark `color-scheme` in browsers with
`light-dark()`.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--dg-bg` | `#ffffff` | `#17191d` | Cell and body background. |
| `--dg-fg` | `#1c2024` | `#e6e8eb` | Primary text. |
| `--dg-muted` | `#f2f3f5` | `#26292f` | Control hover background, neutral surface. |
| `--dg-muted-fg` | `#667085` | `#9aa2b1` | Secondary text. |
| `--dg-border` | `#d5d9e0` | `#3a3f47` | Control border. |
| `--dg-border-hover` | `#b6bcc8` | `#4d535d` | Control border on hover. |
| `--dg-border-strong` | `#858d9b` | `#737b89` | Checkbox box, neutral sort icon (≥ 3:1). |
| `--dg-head-bg` | `#f6f7f9` | `#1f2227` | Header row, `<tfoot>`, card header. |
| `--dg-head-fg` | `#596579` | `#a3abb9` | Header text. |
| `--dg-panel-bg` | `#ffffff` | `#212429` | Column menu, row menu, popovers. |
| `--dg-panel-border` | `#e4e7ec` | `#3a3f47` | Panel border. |
| `--dg-surface` | `#ffffff` | `#1b1d22` | Background of `surface: "card"`. |
| `--dg-danger` | `#d93843` | `#f0656e` | Destructive actions. |

## Tones

Used by badge chips, row tones, banners and states.

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--dg-tone-neutral` | `#475467` | `#a0afc5` | Neutral chip. |
| `--dg-tone-info` | `#1d63c8` | `#66adff` | Info chip and notes. |
| `--dg-tone-ok` | `#15803d` | `#67c67f` | Success chip. |
| `--dg-tone-warn` | `#b45309` | `#f78f54` | Warning chip and banner. |
| `--dg-tone-bad` | `#c0262d` | `#ff756f` | Error chip, banner and state. |
| `--dg-row-ok` | `#edf8f1` | `#15281c` | Row background for `rowTone` `"ok"`. |
| `--dg-row-warn` | `#fff6dc` | `#2b2312` | Row background for `"warn"`. |
| `--dg-row-bad` | `#fdeeee` | `#2e1719` | Row background for `"bad"`. |
| `--dg-row-info` | `#edf3fd` | `#162133` | Row background for `"info"`. |

## Accent derivatives

Component rules never use `--dg-accent` directly, only these. Static fallbacks are listed; modern
browsers derive them with `color-mix()` and relative color syntax.

| Token | Default | Meaning |
|---|---|---|
| `--dg-accent-solid` | `var(--dg-accent)` | Filled surfaces: checked checkbox, current page. Lightened in dark mode. |
| `--dg-accent-fg` | `#ffffff` | Text and glyphs on `--dg-accent-solid`; modern browsers pick black or white by the accent's lightness. |
| `--dg-accent-ink` | `var(--dg-accent)` | Accent as text, icon and focus border; modern browsers cap its lightness so it keeps ≥ 4.5:1 on white. |
| `--dg-accent-weak` | `#ecf1fe` | Tinted surface (9 % accent). |
| `--dg-ring` | `rgba(61, 99, 221, 0.24)` | Focus halo. |

## Derived neutrals

| Token | Default | Meaning |
|---|---|---|
| `--dg-line` | `#e5e6e7` | Row separator. |
| `--dg-line-strong` | `#d6d7d9` | Line under the header and above `<tfoot>`. |
| `--dg-row-alt` | `#f9f9f9` | Zebra row (`striped`). |
| `--dg-veil-hover` | `rgba(28, 32, 36, 0.04)` | Row hover veil. |
| `--dg-veil-selected` | `rgba(61, 99, 221, 0.10)` | Selected row veil. |
| `--dg-veil-selected-hover` | `rgba(61, 99, 221, 0.14)` | Selected row on hover. |
| `--dg-scrollbar-thumb` | `rgba(28, 32, 36, 0.18)` | Scrollbar thumb. |
| `--dg-skeleton` | `#eceef1` | Loading placeholders. |
| `--dg-overlay` | `rgba(255, 255, 255, 0.55)` | Veil over the body while reloading. |

## Spacing and radius

| Token | Default | Meaning |
|---|---|---|
| `--dg-space-1` | `0.25 × rem` (4 px) | Spacing scale on a 4 px grid. |
| `--dg-space-2` | 8 px | |
| `--dg-space-3` | 12 px | |
| `--dg-space-4` | 16 px | |
| `--dg-space-5` | 20 px | |
| `--dg-space-6` | 24 px | |
| `--dg-space-8` | 32 px | |
| `--dg-radius-xs` | 4 px | Checkbox, skeleton. |
| `--dg-radius-sm` | 6 px | Menu item, id pill, cell button. |
| `--dg-radius-md` | 8 px | Controls. |
| `--dg-radius-panel` | 10 px | Panels (item radius + panel padding). |
| `--dg-radius-surface` | 12 px | Card surface. |
| `--dg-radius-full` | `999px` | Badges, counters. |

## Typography

The font family is inherited from the host.

| Token | Default | Meaning |
|---|---|---|
| `--dg-font-size-xs` | 11 px | Chips, caps headers. |
| `--dg-font-size-sm` | 12 px | Sentence headers, footer info, captions. |
| `--dg-font-size-md` | 13 px | Body text at `size: "md"`. |
| `--dg-font-size-lg` | 14 px | Body text at `size: "lg"`. |
| `--dg-line-height` | `1.45` | Cells. |
| `--dg-line-height-tight` | `1.25` | Controls, chips. |
| `--dg-weight-regular` | `400` | |
| `--dg-weight-medium` | `500` | |
| `--dg-weight-strong` | `600` | |
| `--dg-font-mono` | `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` | Monospace text. |
| `--dg-head-font-size` | `var(--dg-font-size-xs)` · sentence: `var(--dg-font-size-sm)` | Header text size. |
| `--dg-head-weight` | `700` · sentence: `600` | Header weight. |
| `--dg-head-transform` | `uppercase` · sentence: `none` | Header case. |
| `--dg-head-tracking` | `0.06em` · sentence: `normal` | Header letter spacing. |

## Shadows

| Token | Meaning |
|---|---|
| `--dg-shadow-xs` | Small controls. |
| `--dg-shadow-panel` | Menus and popovers (layered, low alpha; weaker in dark mode). |
| `--dg-shadow-surface` | Card surface. |
| `--dg-shadow-edge-start` | Overflow shadow of a column pinned to the start. |
| `--dg-shadow-edge-end` | Overflow shadow of a column pinned to the end. |
| `--dg-shadow-stuck` | Sticky header while scrolled. |

## Motion

All motion is turned off under `prefers-reduced-motion: reduce`.

| Token | Default | Meaning |
|---|---|---|
| `--dg-dur-1` | `100ms` | Exits, micro feedback. |
| `--dg-dur-2` | `160ms` | Entrances, panel opening. |
| `--dg-dur-3` | `220ms` | Chevron rotation. |
| `--dg-ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | |
| `--dg-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | |
| `--dg-ease-inout` | `cubic-bezier(0.65, 0, 0.35, 1)` | |

## Stacking

Inside the table only; panels and dialogs use the browser's top layer and need no z-index.

| Token | Default | Meaning |
|---|---|---|
| `--dg-z-sticky-col` | `2` | Pinned columns. |
| `--dg-z-sticky-head` | `3` | Sticky header. |
| `--dg-z-sticky-corner` | `4` | Header cell of a pinned column. |
| `--dg-z-overlay` | `5` | Reload veil. |

## Size

`md` defaults; `data-size="sm"` / `"lg"` override them. On touch screens (`pointer: coarse`)
controls grow to 44 px unless the size is already `lg`.

| Token | sm | md (default) | lg | Meaning |
|---|---|---|---|---|
| `--dg-font-size` | 12 px | 13 px | 14 px | Body text. |
| `--dg-control-h` | 30 px | 34 px | 40 px | Buttons, inputs, selects (44 px on touch). |
| `--dg-control-pad-x` | 8 px | 10 px | 12 px | Control padding. |
| `--dg-control-radius` | | `var(--dg-radius-md)` | | Control radius. |
| `--dg-icon-size` | 14 px | 16 px | 18 px | Icons. |
| `--dg-check-size` | 14 px | 16 px | 18 px | Checkboxes (18 px on touch). |
| `--dg-cell-btn-h` | 24 px | 28 px | 32 px | Buttons inside cells. |

## Density

Independent of size: `data-density="compact"` / `"comfortable"` override the `normal` defaults.

| Token | compact | normal (default) | comfortable | Meaning |
|---|---|---|---|---|
| `--dg-row-h` | 28 px | 36 px | 44 px | Row height (acts as the cells' minimum height). |
| `--dg-cell-pad-y` | 4 px | 8 px | 12 px | Vertical cell padding. |
| `--dg-cell-pad-x` | 8 px | 12 px | 14 px | Horizontal cell padding. |
| `--dg-cell-btn-h` | 22 px | (size) | (size) | Cell buttons in compact rows. |
| `--dg-cell-valign` | | `top` | | Vertical alignment; keeps multi-line rows aligned. |
| `--dg-head-h` | | `var(--dg-row-h)` | | Header row height. |

## Panels

| Token | Default | Meaning |
|---|---|---|
| `--dg-panel-pad` | 4 px | Panel padding. |
| `--dg-panel-offset` | 6 px | Gap between a trigger and its panel. |
| `--dg-panel-max-h` | `min(24 × rem, 70dvh)` | Panel height limit (scrolls beyond). |
| `--dg-menu-item-h` | 32 px | Menu item height (44 px on touch). |

## Host hooks

Variables the stylesheet reads but doesn't define:

| Variable | Default | Meaning |
|---|---|---|
| `--dg-row-bg` | — | Background for specific rows, set from your own CSS (`.dg-table tr.vip { --dg-row-bg: … }`); wins over row tones and zebra. |
| `--dg-max-h` | `70vh` | Height limit of the scroll area with `maxHeight` (set by that option) and with virtual rows. |
| `--dg-clamp` | `2` | Line count for content wrapped in `<span class="dg-clamp">` (multi-line truncation). |

## Root attributes

The grid writes these on its root `.dg`; style against them, never against classes the grid toggles.

| Attribute | Values | Set by |
|---|---|---|
| `data-state` | `loading`, `ready`, `empty`, `error`, `idle` | Load status (`idle` = `load: "manual"` before loading). |
| `data-size` | `sm`, `lg` (absent = `md`) | `size` option. |
| `data-density` | `compact`, `comfortable` (absent = `normal`) | `density` option. |
| `data-dg-theme` | `light`, `dark`, `system` (absent = inherit) | `theme` option. |
| `data-dg-head` | `sentence` (absent = caps) | `head` option. |
| `data-dg-surface` | `card` | `surface` option. |
| `data-dg-striped` | present | `striped: true`. |
| `data-dg-nowrap` | present | `wrap: false`. |
| `data-dg-sticky-head` | present | `maxHeight` (sticky header). |
| `data-dg-virtual` | present | Virtual rows are active. |
| `data-bp` | `xs` (< 480 px), `sm` (< 768 px), `md` (< 1024 px), `lg` | Width of the grid root (not the viewport). At `xs` the toolbar and footer stack and the pager becomes a select. |

The scroll frame also carries `data-overflow="start end"` while the table scrolls horizontally, and
`data-busy="visible"` while a reload runs longer than 300 ms. The full DOM contract is in
[Anatomy](/guide/anatomy).

## Related

- [Theming](/guide/theming) · [Anatomy](/guide/anatomy) · [Grid options: appearance](/reference/options#appearance)
