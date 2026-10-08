# JSX types and tsconfig

> `lumen/jsx-runtime` types JSX for `jsxImportSource: "lumen"`; `lumen/env` declares the global `JSX` namespace, `import.meta.env` and `Locals`. This page lists the type rules and the tsconfig.

## tsconfig.json

A Lumen project's `tsconfig.json` extends the tsconfig that Lumen generates (decision-25). This is
what `create-lumen` writes, what `lumen agents init` writes when the file is missing, and what
`lumen check` prints when there is none:

```jsonc
{
  // Lumen's compiler options, shadow TSX and route types. lumen dev, build, check and typegen
  // write the generated file; add your own options below.
  "extends": "./.lumen/tsconfig.generated.json",
}
```

Add your own `compilerOptions` next to `extends`; they override the generated ones. `lumen check`,
`lumen typegen`, `lumen dev`/`build`, `lumen/vite` and the language server write
`.lumen/tsconfig.generated.json`, so it follows the installed Lumen version and the workspace
layout. `.lumen/` is not committed: in a fresh clone, run `lumen typegen` (or `lumen check`) before
a bare `tsc`.

The generated file, with paths relative to `.lumen/`:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "lumen",
    "module": "preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "rootDirs": ["..", "./shadow"],
    "types": ["lumen/env"]
  },
  "include": ["../src", "./shadow", "./types"]
}
```

| Option                                        | Why                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `jsx: "preserve"`, `jsxImportSource: "lumen"` | The Lumen compiler transforms JSX; TypeScript only checks it against Lumen's types.       |
| `rootDirs` with `.lumen/shadow`               | `import "./X.stsx"` resolves to the shadow file `X.stsx.tsx`.                             |
| `include` `.lumen/shadow`, `.lumen/types`     | Shadow files and generated route types are part of the program.                           |
| `types: ["lumen/env"]`                        | The global `JSX` namespace, `import.meta.env`, `Locals` and `.svg`/`.md`/`.html` modules. |
| `allowImportingTsExtensions`                  | Imports name their extension: `./Card.stsx`, `./tokens.ts`.                               |

If you set `include` or `types` yourself, they replace the generated lists: keep `src`,
`.lumen/shadow` and `.lumen/types` in `include`, and `lumen/env` in `types`. An array `extends`
keeps a shared base: `["../../tsconfig.base.json", "./.lumen/tsconfig.generated.json"]` (later
entries win). `lumen check` reports missing options (`LUM6001`).

### Imports outside `src/` and `.stsx` from other packages

The generated `rootDirs` pair a _mirror base_ with `.lumen/shadow`. The mirror base is the nearest
directory that contains the project and the Lumen packages it uses. These are the linked
dependencies that list `lumen` as a dependency, plus the enclosing package of a project without its
own `package.json`. For a standalone project, it is the project root (`..` above).

Shadows mirror the paths below that base. For example, `apps/web/.lumen/shadow/apps/web/src/` holds
the app's own shadows and `apps/web/.lumen/shadow/packages/ui/src/` holds a package's. So a `.stsx`
import may leave `src/` (`../../lib/x.ts`), and a component that a workspace package re-exports
from its own `.stsx` files (`@acme/ui` → `./Button.stsx`) is type-checked with your project, with
errors pointing at its sources.

### Without `extends`

A tsconfig can also set the options itself:

```json
{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "lumen",
    "module": "preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "rootDirs": ["src", ".lumen/shadow/src"],
    "types": ["lumen/env"]
  },
  "include": ["src", ".lumen/shadow", ".lumen/types"]
}
```

Its `rootDirs` pair only `src` with `.lumen/shadow/src`, so `.stsx` files must stay inside `src/`:
a `.stsx` import that leaves `src/` does not resolve (TS2307), and the `.stsx` modules of workspace
packages have no shadow. `lumen check` warns (`LUM6001`) when a used package has `.stsx` files that
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
declare module "lumen/jsx-runtime" {
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

## `lumen/env`

```ts
interface ImportMetaEnv {
  readonly [publicVariable: `PUBLIC_${string}`]: string;
  BASE_URL: string;
  MODE: string;
  DEV: boolean;
  PROD: boolean;
  SSR: boolean;
}
declare module "lumen" {
  interface Locals {}
}
declare module "*.svg" {
  const Svg: (props: JSX.SVGProps<SVGSVGElement> & { title?: string }) => JSX.Element;
  export default Svg;
}
declare module "*.svg?inline" {} // the same component
declare module "*.svg?url" {} // export default url: string
declare module "*.svg?raw" {} // export default raw: string
declare module "*.md" {
  const Content: () => JSX.Element;
  export default Content;
  export interface Frontmatter extends Record<string, unknown> {} // merge your fields into it
  export const frontmatter: Frontmatter;
}
declare module "*.html" {
  const Content: () => JSX.Element;
  export default Content;
}
```

Declare known public variables by merging `interface ImportMetaEnv { readonly PUBLIC_API: string }`.
The built-in members match `vite/client`, so both can be loaded; list `lumen/env` first, because
`vite/client` types `*.svg` as a URL string and the first declaration wins (see
[SVG imports](../concepts/svg.md)).
