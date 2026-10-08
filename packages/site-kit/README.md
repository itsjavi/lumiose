# @lumen/site-kit

The design system of the Lumen websites (landing page, docs, playground): design tokens, a global
base stylesheet and `.stsx` components. Private workspace package.

## Use

```stsx
import { Footer, SiteHeader } from "@lumen/site-kit";
import { color, space, bp } from "@lumen/site-kit/tokens";

export default function Layout(props: { children: JSX.Element }) {
  return (
    <div class="layout">
      <SiteHeader current="/docs" />
      <main>{props.children}</main>
      <Footer />
      <style>
        main { padding: $space.xl; color: $color.text; }
        @media (width < $bp.md) { main { padding: $space.md; } }
      </style>
    </div>
  );
}
```

- Importing `@lumen/site-kit` loads the base stylesheet (`src/Base.stsx`: theme custom properties,
  reset, typography, focus rings, code font) before any component CSS.
- Style blocks read tokens as `$color.*`, `$space.*`, `$radius.*`, `$text.*`, `$bp.*`, … from
  `@lumen/site-kit/tokens`; the compiler inlines them. Colors are `var(--lm-*)` references, so they
  follow the theme.
- Put `themeInitScript` (`@lumen/site-kit/theme`) in an inline `<script>` in the document head, so a
  stored theme applies before the first paint.

## Theme

Without a stored choice the site follows the system (`prefers-color-scheme`). `data-theme="light"`
or `"dark"` on `<html>` pins a theme (ThemeToggle sets it and stores it in localStorage under
`lumen-theme`); on any other element it gives that subtree its own theme. Every color is a
`light-dark()` pair; text and background pairs meet WCAG AA in both themes.

## Components

| Component              | Notes                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `SiteHeader`           | Logo (slot), navigation, actions (slot) and the theme toggle. Sticky.                    |
| `SiteNav`              | Island inside SiteHeader: active link (`aria-current`), disclosure menu below `$bp.md`.  |
| `Footer`               | Logo, tagline, link columns, bottom line (children).                                     |
| `Button`, `LinkButton` | `variant`: primary, secondary, ghost; `size`: sm, md, lg.                                |
| `Callout`              | `kind`: info, warn, tip; optional `title`.                                               |
| `Card`                 | `title`, optional `href` (whole card is a link), `eyebrow`, `icon` (slot).               |
| `CodeBlock`            | `code`, `lang`, `title`, `highlight` hook (`highlight` from the kit, Shiki, …), copy.    |
| `CopyButton`           | Island inside CodeBlock (`client:visible`).                                              |
| `Tabs`                 | `labels` plus one child element per panel; WAI-ARIA keyboard pattern. Pass `id` for SSR. |
| `ThemeToggle`          | Island inside SiteHeader (`client:load`); the icon follows the theme through CSS.        |
| `Logo`                 | The mark and wordmark.                                                                   |

`highlight` (`@lumen/site-kit/highlight`) is a small highlighter for TS/TSX/`.stsx` (style blocks
as CSS, `$` references included), CSS, shell and JSON, producing `tok-*` spans that CodeBlock colors.

## Showcase

`showcase/` is a client-rendered page with every component, in both themes:

```sh
pnpm --filter @lumen/site-kit dev          # http://localhost:5173
pnpm --filter @lumen/site-kit typecheck    # lumen check, kit and showcase
pnpm --filter @lumen/site-kit test:e2e     # Playwright, dev and production build
pnpm --filter @lumen/site-kit screenshots  # backlog/assets/task-59-*.png
```

Consuming `.stsx` from another Lumen project currently needs the kit's source and shadow folders
in that project's tsconfig `rootDirs` for `lumen check` (see `showcase/tsconfig.json`, TASK-73).
