# JSX types and tsconfig

> The JSX and environment types, and the tsconfig settings a Lumiose project needs.

## tsconfig.json

A Lumiose project's `tsconfig.json` extends the tsconfig that Lumiose generates (decision-25). This is
what `create-lumiose` writes, what `lumiose agents init` writes when the file is missing, and what
`lumiose check` prints when there is none:

```jsonc
{
  // Lumiose's compiler options, shadow TSX and route types. lumiose dev, build, check and typegen
  // write the generated file; add your own options below.
  "extends": "./.lumiose/tsconfig.generated.json",
}
```

Add your own `compilerOptions` next to `extends`; they override the generated ones. `lumiose check`,
`lumiose typegen`, `lumiose dev`/`build`, `@lumiose/vite` and the language server write
`.lumiose/tsconfig.generated.json`, so it follows the installed Lumiose version and the workspace
layout. `.lumiose/` is not committed: in a fresh clone, run `lumiose typegen` (or `lumiose check`) before
a bare `tsc`.

The generated file, with paths relative to `.lumiose/`:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "lumiose",
    "module": "preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "rootDirs": ["..", "./shadow"],
    "types": ["lumiose/env"]
  },
  "include": ["../src", "./shadow", "./types"]
}
```

| Option                                          | Why                                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `jsx: "preserve"`, `jsxImportSource: "lumiose"` | The Lumiose compiler transforms JSX; TypeScript only checks it against Lumiose's types.   |
| `rootDirs` with `.lumiose/shadow`               | `import "./X.stsx"` resolves to the shadow file `X.stsx.tsx`.                             |
| `include` `.lumiose/shadow`, `.lumiose/types`   | Shadow files and generated route types are part of the program.                           |
| `types: ["lumiose/env"]`                        | The global `JSX` namespace, `import.meta.env`, `Locals` and `.svg`/`.md`/`.html` modules. |
| `allowImportingTsExtensions`                    | Imports name their extension: `./Card.stsx`, `./tokens.ts`.                               |
| `skipLibCheck`                                  | Dependencies' `.d.ts` files are not checked: faster, and their type errors are not yours. |

If you set `include` or `types` yourself, they replace the generated lists: keep `src`,
`.lumiose/shadow` and `.lumiose/types` in `include`, and `lumiose/env` in `types`. An array `extends`
keeps a shared base: `["../../tsconfig.base.json", "./.lumiose/tsconfig.generated.json"]` (later
entries win). `lumiose check` reports missing options (`LUM6001`).

### Imports outside `src/` and `.stsx` from other packages

The generated `rootDirs` pair a _mirror base_ with `.lumiose/shadow`. The mirror base is the nearest
directory that contains the project and the Lumiose packages it uses. These are the linked
dependencies that list `lumiose` as a dependency, plus the enclosing package of a project without its
own `package.json`. For a standalone project, it is the project root (`..` above).

Shadows mirror the paths below that base. For example, `apps/web/.lumiose/shadow/apps/web/src/` holds
the app's own shadows and `apps/web/.lumiose/shadow/packages/ui/src/` holds a package's. So a `.stsx`
import may leave `src/` (`../../lib/x.ts`), and a component that a workspace package re-exports
from its own `.stsx` files (`@acme/ui` → `./Button.stsx`) is type-checked with your project, with
errors pointing at its sources.

### Without `extends`

A tsconfig can also set the options itself:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "lumiose",
    "module": "preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "rootDirs": ["src", ".lumiose/shadow/src"],
    "types": ["lumiose/env"]
  },
  "include": ["src", ".lumiose/shadow", ".lumiose/types"]
}
```

Its `rootDirs` pair only `src` with `.lumiose/shadow/src`, so `.stsx` files must stay inside `src/`:
a `.stsx` import that leaves `src/` does not resolve (TS2307), and the `.stsx` modules of workspace
packages have no shadow. `lumiose check` warns (`LUM6001`) when a used package has `.stsx` files that
the tsconfig's `rootDirs` leave out.

## The `JSX` namespace

| Type                                                        | Rule                                                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `JSX.Element`                                               | What JSX evaluates to: nodes, strings, numbers, booleans, `null`/`undefined`, arrays and functions of those.                                            |
| `JSX.ElementType`                                           | Intrinsic tags, and sync **or async** function components.                                                                                              |
| `JSX.IntrinsicElements`                                     | Every HTML (except `style`), SVG and MathML tag of lib.dom, plus custom elements (`my-widget`).                                                         |
| `JSX.IntrinsicAttributes`                                   | `key`, and on components `client:load`, `client:idle`, `client:visible` (`boolean \| string`), `client:media` (`string`), `client:only`.                |
| `JSX.ClassValue`                                            | `string \| false \| null \| undefined \| Record<string, boolean \| null \| undefined> \| ClassValue[]`.                                                 |
| `JSX.CSSProperties`                                         | Kebab-case CSS properties (`"font-weight"`, `"-webkit-line-clamp"`) and `--custom` properties; values `string \| number \| false \| null \| undefined`. |
| `JSX.EventHandler<E, T>`                                    | `(event: E & { currentTarget: T }) => void`.                                                                                                            |
| `JSX.Ref<T>`                                                | What `ref<T>()` returns: callable with the element, readable as `() => T \| undefined`.                                                                 |
| `JSX.HTMLProps<T>`, `JSX.SVGProps<T>`, `JSX.MathMLProps<T>` | Props of an element type, for wrappers.                                                                                                                 |

**Element props.** Every element accepts `children`, `class`, `style`, `ref`, `attach`, `innerHTML`,
`key`, its attributes, `onX` handlers and `on:x` listeners. `input` also accepts `bind:value`
(string or number signal) and `bind:checked` (boolean signal); `select` and `textarea` accept
`bind:value`.

**Rejected on purpose** (type errors with a hint): `className` (use `class`), `htmlFor` (use
`for`), camelCase `style` keys, exact-case or lowercase handlers (`onKeydown`, `onclick`), and
`<style>` in `.tsx` files.

**Event names.** `onX` handlers use React-style camelCase after `on` (`onClick`, `onKeyDown`,
`onDblClick`, `onPointerDown`, `onMouseEnter`); the DOM event is the suffix lowercased. Bubbling
events are delegated; non-bubbling ones (`focus`, `blur`, `mouseenter`, `mouseleave`,
`pointerenter`, `pointerleave`, `scroll`, `load`, `error`, media events) get a direct listener.
`on:name` adds a native listener with the exact name; any `on:${string}` is accepted for custom
events.

## Custom elements

Undeclared custom elements accept global attributes and any other attribute. Type one by
augmenting `IntrinsicElements`:

```tsx check
declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "rating-stars": JSX.HTMLProps<HTMLElement> & { value: number; max?: number };
    }
  }
}

export function Review() {
  return (
    <rating-stars
      value={4}
      on:rating-change={(event: CustomEvent<number>) => console.log(event.detail)}
    />
  );
}
```

## `lumiose/env`

```ts
interface ImportMetaEnv {
  readonly [publicVariable: `PUBLIC_${string}`]: string;
  BASE_URL: string;
  MODE: string;
  DEV: boolean;
  PROD: boolean;
  SSR: boolean;
}
declare module "lumiose" {
  interface Locals {}
}
declare module "*module.css" {
  // import styles from "./card.module.css": the hashed class of each name, class={styles.card}
  const classNames: { readonly [className: string]: string };
  export default classNames;
}
declare module "*.css" {} // import "./app.css": bundled into the page's CSS
declare module "*.css?url" {} // export default url: string
declare module "*.css?inline" {} // export default css: string
declare module "*.css?raw" {} // export default source: string
declare module "*.svg?component" {
  const Svg: (props: JSX.SVGProps<SVGSVGElement> & { title?: string }) => JSX.Element;
  export default Svg;
}
declare module "*.svg?url" {} // export default url: string
declare module "*.svg?raw" {} // export default raw: string
declare module "*.md" {
  const Content: () => JSX.Element;
  export default Content;
  export interface Frontmatter extends Record<string, unknown> {} // merge your fields into it
  export const frontmatter: Frontmatter;
  export interface Heading {
    depth: 1 | 2 | 3 | 4 | 5 | 6;
    text: string;
    id: string;
  } // read-only
  export const headings: ReadonlyArray<Heading>; // document order, ids of the rendered anchors
}
declare module "*.html" {
  const Content: () => JSX.Element;
  export default Content;
}
```

Declare known public variables by merging `interface ImportMetaEnv { readonly PUBLIC_API: string }`.
The built-in members match `vite/client`, so both can be loaded. `vite/client` types the other
asset imports, bare `.svg` URLs included (see [SVG imports](../concepts/svg.md)). TypeScript checks
side-effect imports (`noUncheckedSideEffectImports`), hence `*.css`. CSS modules (`*.module.css`)
are read-only class maps, with `lumiose/env` alone or with `vite/client` in either order: the
pattern is declared before `*.css`, which would otherwise match them first, and leaves out the dot
so that it does not merge with `vite/client`'s own `*.module.css` declaration (a duplicate default
export when `skipLibCheck` is off). See [Styles](../concepts/styles.md) for using them.
