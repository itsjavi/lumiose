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

| Option                                          | Why                                                                                                 |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `jsx: "preserve"`, `jsxImportSource: "lumiose"` | The Lumiose compiler transforms JSX; TypeScript only checks it against Lumiose's types.             |
| `rootDirs` with `.lumiose/shadow`               | `import "./X.stsx"` resolves to the shadow file `X.stsx.tsx`.                                       |
| `include` `.lumiose/shadow`, `.lumiose/types`   | Shadow files and generated route types are part of the program.                                     |
| `types: ["lumiose/env"]`                        | The global `JSX` namespace, `import.meta.env`, `Locals` and `.svg`/`.md`/`.html`/`?client` modules. |
| `allowImportingTsExtensions`                    | Imports name their extension: `./Card.stsx`, `./vars.ts`.                                           |
| `skipLibCheck`                                  | Dependencies' `.d.ts` files are not checked: faster, and their type errors are not yours.           |

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

Lumiose packages installed in the project's `node_modules` (from npm or a tarball) are below the
project root, so their `.stsx` files are shadowed too, below `.lumiose/shadow/node_modules/…`, and
an app that imports their components type-checks against them. A shadow resolves bare imports from
where it sits, the project's `node_modules`: a package's `.stsx` that imports one of its own
dependencies by name type-checks where that dependency is hoisted there (npm, Yarn, Bun), not with
pnpm's isolated layout.

### Without `extends`

A tsconfig can also set the options itself, as in the example.

Its `rootDirs` pair only `src` with `.lumiose/shadow/src`, so `.stsx` files must stay inside `src/`:
a `.stsx` import that leaves `src/` does not resolve (TS2307), and the `.stsx` modules of workspace
packages have no shadow. `lumiose check` warns (`LUM6001`) when a used package has `.stsx` files that
the tsconfig's `rootDirs` leave out.

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

**Rejected on purpose** (type errors with a hint): `className` (use `class`), `htmlFor` (use
`for`), camelCase `style` keys, exact-case or lowercase handlers (`onKeydown`, `onclick`), and
`<style>` in `.tsx` files.

### Element props

Every element accepts `children`, `class`, `style`, `ref`, `attach`, `innerHTML`,
`key`, its attributes, `onX` handlers and `on:x` listeners (a spread never sets `innerHTML`,
`textContent` or `srcdoc`). `input` also accepts `bind:value`
(string or number signal) and `bind:checked` (boolean signal); `select` and `textarea` accept
`bind:value`.

| Prop                         | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `class`                      | A string, an array, or a `{ name: boolean }` record (nested arrays allowed). `className` is a type error.                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `style`                      | A string, or an object with **kebab-case** keys, including `--custom` properties. Each key updates on its own.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `aria-*`, `spellcheck`, …    | Booleans are written as `"true"`/`"false"` (`aria-pressed={false}` renders `aria-pressed="false"`): `aria-*`, `contenteditable`, `draggable`, `spellcheck` and the other enumerated attributes, static or not. Other attributes: `true` adds the attribute empty (`hidden`); `false`, `null` and `undefined` leave it out. A function is never an attribute: it is left out too.                                                                                                                                                                                |
| `onClick`, `onKeyDown`, …    | camelCase handlers. Bubbling events are delegated (one listener per type at `document`); non-bubbling ones (`onFocus`, `onMouseEnter`, `onScroll`) get a direct listener.                                                                                                                                                                                                                                                                                                                                                                                       |
| `on:click`, `on:my-event`    | A native `addEventListener` listener with the exact event name. Use it for custom and web-component events. Like `onX` handlers, it runs inside a batch: its writes render together, and the DOM is current when the event returns.                                                                                                                                                                                                                                                                                                                             |
| Props of a custom element    | The element's property when it defines one (arrays and objects as they are), else the attribute, as in React 19. See [Web components](../guides/web-components.md).                                                                                                                                                                                                                                                                                                                                                                                             |
| `bind:value`, `bind:checked` | Two-way binding to a writable signal, on `input`, `select` and `textarea`. `bind:x` also works on components and custom elements (below).                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `attach={[fn]}`              | Runs `fn(el)` with the element in a tracked scope, once the element is in the document (below); it may return a cleanup. Next to a spread it works the same, in either order, and attachments add up: an `attach` the spread carries (a wrapper's `<li {...props} />` given `attach`) runs too.                                                                                                                                                                                                                                                                 |
| `ref={fn}`                   | Called with the element. `ref<T>()` makes a callback you can read like a signal. Next to a spread, `ref` is a prop like any other: the last one wins, so a wrapper that sets its own calls the caller's (`ref={(el) => { mine(el); rest.ref?.(el); }}`).                                                                                                                                                                                                                                                                                                        |
| `innerHTML`                  | Sets unescaped HTML. The lint rule `no-unsafe-html` warns. Only as a written prop: a spread drops `innerHTML`, `textContent` and `srcdoc`, on the server and the client, so an object from JSON cannot inject markup. Written next to a spread (`<div {...rest} innerHTML={html} />`), they apply as written, and replace the spread's `children`.                                                                                                                                                                                                              |
| `key`                        | Allowed on intrinsic elements and components (list identity).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `<script>`, `<style>` text   | Raw text: written as it is, never `&lt;`; the character after a `<` that could open a tag is escaped (`<\u0069mg`, in a style `<\69 mg`; `<\/`, `<\!`), so a value can neither end the element nor open a tag inside `<svg>` or `<math>`. In a JSON script every `<` is `\u003c`. See [Security](../concepts/security.md), and [Head](../concepts/head.md) for JSON-LD.                                                                                                                                                                                         |
| `{...props}`, `children`     | A spread applies every prop it carries, in order with the other attributes; written `attach` and `bind:` apply on their own (above). A nullish or `false` spread (`{...props.extra}`, `{...(open && attrs)}`) applies nothing. An element without content of its own renders the `children` of its spreads or of a `children` attribute, as in React: `<button {...props} />` renders what the caller passed. Written content wins. When the spread has no `children` prop at all, the element's content is left alone, so a script or the browser may fill it. |
| `client:*`                   | Island directives, on components only. See [Islands](../concepts/islands.md).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Handlers receive the **native** event, with `currentTarget` typed as the element. There are no
synthetic events.

**Event names.** `onX` handlers use React-style camelCase after `on` (`onClick`, `onKeyDown`,
`onDblClick`, `onPointerDown`, `onMouseEnter`); the DOM event is the suffix lowercased. Bubbling
events are delegated; non-bubbling ones (`focus`, `blur`, `mouseenter`, `mouseleave`,
`pointerenter`, `pointerleave`, `scroll`, `load`, `error`, media events) get a direct listener.
`on:name` adds a native listener with the exact name; any `on:${string}` is accepted for custom
events. Every handler (delegated, direct or `on:`, and one passed in a spread) runs inside a
batch: what it writes renders together when it returns, so the DOM is current right after the
event.

### When attach runs

An attachment is an effect: it runs after the update that created its
element has written all of its DOM, so the element is already inserted and can be measured. A new
list row goes into the document complete, with its nested lists, conditionals and components, in
one insertion, and only then do the attachments inside it run. The exception is content that a
`<Suspense>` holds back while it shows its fallback: it waits in a fragment, so its attachments run
before it is in the document (`el.isConnected` is `false`), and do not run again when it appears.

The attachments and effects that one update queues all run before the DOM shows their own writes.
When each attachment measures (`getBoundingClientRect`) and then sets a signal the page renders,
every measurement reads the same layout, and the writes reach the DOM together after the last
attachment has run: N elements cost one layout, not N. Reading the signal still returns the new
value at once; only the DOM lags. To measure what such a write renders, read the signal in an
effect (it re-runs once the DOM shows the write), or measure in the next frame or in a
`ResizeObserver`.

### bind: on components and custom elements

`bind:x={signal}` works on any component with an
`x` prop and an `onXChange` callback, like `bind:value` on inputs: `bind:open` on `Dialog.Root`,
`bind:value` on `Combobox.Root`, `bind:checked` on `Menu.CheckboxItem`. The compiler expands it to
both props, `x={signal()}` and `onXChange={(value) => signal.set(value)}`, in server and client
output. An `onXChange` written next to it still runs, after the signal is set. The types come from
the component's props: a component without `x` or without `onXChange` has no `bind:x`, so the
attribute is a type error. `bind:x` takes a writable signal of the type of `x`; when `x` or
`onXChange` is required, `bind:x` stands in for both.

On a custom element (a tag with a dash), `bind:x` sets the element's `x` property and reads it back
into the signal when the element dispatches `input`, `change` or `xchange` (lowercase:
`openchange`, `checkedchange`); events bubbling up from its children are ignored. The server
renders the signal's value as the attribute (`<lu-menu open>`). Declare `bind:x` on a typed custom
element (`"bind:open"?: Signal<boolean>`); undeclared ones accept it untyped.

```tsx check
import { signal } from "lumiose";

function Disclosure(props: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: JSX.Element;
}) {
  return (
    <details open={props.open} onToggle={(event) => props.onOpenChange?.(event.currentTarget.open)}>
      {props.children}
    </details>
  );
}

export function Faq() {
  const open = signal(false);
  return (
    <>
      <Disclosure bind:open={open}>
        <summary>Shipping</summary>2 to 4 days.
      </Disclosure>
      <button onClick={() => open.set(!open())}>{open() ? "Collapse" : "Expand"}</button>
    </>
  );
}
```

## Custom elements

Undeclared custom elements accept global attributes and any other attribute. Type one by
augmenting `IntrinsicElements`, as the example does.

A prop of a custom element goes to the element's property when the element defines one (not one
every element has, such as `id`), else to the attribute, as in React 19; `on:name` listens to the
event of that exact name. `bind:x` binds the `x` property to a signal; declare it on a typed
element (`"bind:value"?: Signal<number>`). See [Web components](../guides/web-components.md).

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

The ambient types of a Lumiose project: `import.meta.env`, `Locals` and the modules of asset
imports. Load them with `"types": ["lumiose/env"]` in the tsconfig.

Declare known public variables by merging `interface ImportMetaEnv { readonly PUBLIC_API: string }`.
The built-in members match `vite/client`, so both can be loaded. `vite/client` types the other
asset imports, bare `.svg` URLs included (see [SVG imports](../concepts/svg.md)). TypeScript checks
side-effect imports (`noUncheckedSideEffectImports`), hence `*.css`. CSS modules (`*.module.css`)
are read-only class maps, with `lumiose/env` alone or with `vite/client` in either order: the
pattern is declared before `*.css`, which would otherwise match them first, and leaves out the dot
so that it does not merge with `vite/client`'s own `*.module.css` declaration (a duplicate default
export when `skipLibCheck` is off). See [CSS Modules](../guides/stylesheets.md#css-modules) for using them.

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
declare module "*?client" {
  // import defineMenu from "./menu.element.ts?client": call it while rendering
  const clientScript: () => void;
  export default clientScript;
}
```

## Bindings and compiled idioms

**Bindings.** The compiler looks at each JSX expression:

- Literals and plain identifiers are **static**: written once.
- Calls and member access (`count()`, `user.name`, `props.title`) become **bindings** that re-run
  when a signal they read changes, and write only the part of the DOM they own.
- `untrack(() => …)` opts an expression out.

**Compiled idioms.** There are no `<For>` or `<Show>` components; ordinary JavaScript compiles to
the efficient form:

| Source                                              | Compiled to                                                                                                                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{items().map((item, i) => <Row key={item.id} />)}` | A keyed list. `key` is optional (items are keyed by reference otherwise). `i` becomes a reactive index only if you use it. See [Lists and keys](../concepts/jsx.md#lists-and-keys).                                                   |
| `item.id === selected()` inside `.map`              | An O(1) selector: a selection change touches two rows.                                                                                                                                                                                |
| `{c() ? <A /> : <B />}`, `{c() && <A />}`           | A memoised branch: switches only when the condition flips.                                                                                                                                                                            |
| `{count() * 2}`, ``{`#${id}`}``, `{String(x)}`      | Provably text: a text node of the template, updated with `setText` (written once when nothing reactive is read). Applies to sole children and to children between elements; a `const` initialised with such an expression counts too. |
| `{row.label()}`, `{id}`, `{props.title}`            | Maybe text, alone between nodes (or the only child): also a text node of the template, written by `insertText`. Text values update the node in place; nodes, arrays and other values render in a region before it.                    |
| `{fn()}` next to text or another `{…}`              | A dynamic insert (a region), since adjacent text nodes would merge when the HTML is parsed.                                                                                                                                           |

### Lists and keys in depth

`{items().map((item, i) => …)}` compiles to a list that reconciles its rows when the array changes:
it keeps, moves, creates and removes rows instead of rendering them all again.

- **With a `key`** on the element the callback returns, the key alone decides whether a row is
  kept, as in React, Vue or Svelte. A kept row whose item is a new object (a refetch, an array
  derived again) keeps its DOM, its components with their local state, and its effects; the item
  updates in place. Reads of the item in JSX, in props passed to components and in effects re-run,
  as reads of props do, and so do reads of a destructured item (`({ id, name }) => …`).
- **Without a key**, rows match by item reference: a row is kept while its item is the same
  object, and a new object makes a new row.

The callback itself runs once per row. A value it reads from the item at the top, outside JSX and
functions, is a copy taken when the row was created: `const label = format(item.name)` keeps the
first name when the item changes in place, which [LUM2001](../errors/LUM2001.md) reports where the
JSX uses it (and [LUM2003](../errors/LUM2003.md) an early return on the item). Read the item where
it is used instead (`{format(item.name)}`), or derive lazily (`const label = () => format(item.name)`,
called as `label()`). Copies of the key are fine (`const id = item.id` with `key={item.id}`): a
different id is a different row. To make a new row when some field changes (to reset a row's state,
or for setup code that must run again), put that field in the key:
``key={`${item.id}:${item.version}`}``.

The index stays reactive (`i` is compiled to `i()`), and a row keyed by its index
(`key={i}`) keeps its place while its item changes, like Solid's `<Index>`.

Key rows that hold user state by the record's id, never by the index or position. That state might
be a checked box, a typed value, an expanded panel or an open menu. A kept row keeps its DOM state
when another record arrives under its key. A "delete selected" form whose rows are keyed by index
would still have a box checked after a filter or a sort, now next to a different record. React and
Vue behave the same way.

The compiler moves the key into a function that the list calls for every item, so the key may
read the item (or the bindings of its destructuring pattern), the index, bindings it declares
itself (`key={row.map((p) => p.id).join("|")}`), `const`s at the top of the callback that copy item
fields (`const id = item.id`), and anything declared outside the callback. A callback that returns
in several places keeps its key when every returned element carries the same one. A key the
compiler cannot use, such as one that reads a value computed in the row, is
[LUM2008](../errors/LUM2008.md), and the list matches rows by reference.

```tsx
<section class="grid">
  {entries().map(({ row, index }) => (
    <div key={`${index}:${row.map((card) => card.id).join("|")}`}>
      {row.map((card) => (
        <Card key={card.id} card={card} />
      ))}
    </div>
  ))}
</section>
```

Here a refetch that returns new card objects with the same ids keeps every row and every `Card`:
only the bindings whose values changed write to the DOM.

## Common JSX mistakes

- **React prop names.** `className` → `class`, `htmlFor` → `for`, `onclick`/`onKeydown` →
  `onClick`/`onKeyDown` (camelCase after `on`). The wrong forms are type errors.
- **camelCase style keys.** `style={{ fontWeight: 600 }}` is a type error; write
  `{ "font-weight": 600 }`, as in CSS. Numbers get no units: write `"12px"`.
- **Passing a value to `bind:value`.** It needs the signal itself: `bind:value={draft}`, not
  `bind:value={draft()}`.
- **`bind:x` on a component without `onXChange`.** The component must take both `x` and
  `onXChange`; otherwise pass `x={signal()}` and handle the change yourself. An island call site
  (`client:*`) has no `bind:`: a signal cannot be serialized.
- **Custom events with `onX`.** `onMyEvent` is not an event prop; write `on:my-event`.
- **Using the index outside the row.** The `i` of `.map((item, i) => …)` is a reactive index that
  belongs to its row; storing it in an outer variable or closure that outlives the row is
  `LUM2006`.
- **Reading the item once in a keyed row.** `const name = item.name` at the top of the callback
  keeps the first name when a same-key item replaces it (`LUM2001`). Read `item.name` in the JSX,
  or put the field in the key to make a new row when it changes.
- **Wrapping lists in helper components.** `{items().map(…)}` already compiles to a keyed list;
  there is no `<For>`.
- **`innerHTML` with user input.** It is not escaped. Prefer text children.
