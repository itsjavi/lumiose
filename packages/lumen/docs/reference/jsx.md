# JSX types and tsconfig

> `lumen/jsx-runtime` types JSX for `jsxImportSource: "lumen"`; `lumen/env` declares the global `JSX` namespace, `import.meta.env` and `Locals`. This page lists the type rules and the required tsconfig.

## tsconfig.json

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

| Option                                        | Why                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------- |
| `jsx: "preserve"`, `jsxImportSource: "lumen"` | The Lumen compiler transforms JSX; TypeScript only checks it against Lumen's types. |
| `rootDirs` with `.lumen/shadow/src`           | `import "./X.stsx"` resolves to the shadow file `X.stsx.tsx`.                       |
| `include` `.lumen/shadow`, `.lumen/types`     | Shadow files and generated route types are part of the program.                     |
| `types: ["lumen/env"]`                        | The global `JSX` namespace, `import.meta.env` and `Locals`.                         |
| `allowImportingTsExtensions`                  | Imports name their extension: `./Card.stsx`, `./tokens.ts`.                         |

`lumen check` reports missing options (`LUM6001`) and prints this template when there is no
tsconfig.

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
```

Declare known public variables by merging `interface ImportMetaEnv { readonly PUBLIC_API: string }`.
The built-in members match `vite/client`, so both can be loaded.
