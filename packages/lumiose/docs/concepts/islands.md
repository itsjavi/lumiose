# Islands

> Pages ship no JavaScript by default: add a `client:*` directive to a component and only that island hydrates in the browser.

## Concept

### Make a component an island

A `client:*` directive at the usage site makes that instance an island: the server renders it,
and the browser hydrates it. The rest of the page stays HTML that ships no JavaScript.

```stsx check
import { signal } from "lumiose";

export function Counter(props: { start: number }) {
  const count = signal(props.start);
  return (
    <button onClick={() => count.update((n) => n + 1)}>
      {count()}
    </button>
  );
}

export default function Page() {
  return (
    <main>
      <h1>A static heading</h1>
      <Counter client:load start={1} />
    </main>
  );
}
```

### Directives

The directive says when the island hydrates: `client:visible` waits until it is on screen. Directives go on components only, and the component
must be exported (`LUM4001`).

| Directive                                   | Hydrates                                            |
| ------------------------------------------- | --------------------------------------------------- |
| `client:load`                               | Immediately.                                        |
| `client:idle`                               | When the browser is idle (at the latest after 2 s). |
| `client:visible` / `client:visible="200px"` | When it enters the viewport (optional root margin). |
| `client:media="(max-width: 600px)"`         | When the media query matches.                       |
| `client:only`                               | Client-rendered only: no server HTML.               |

> **Props:** island props must be serializable (`LUM4002`), and children are slots rendered on the
> server. Context starts at the island (`LUM4010`). All in
> [Islands in detail](../reference/dom.md#islands-in-detail), with early events, hydration,
> `searchParams`, server-only boundaries, awaited data, the loader and the status.

### Scripts without an island

A server-rendered component that needs a small browser script imports it with `?client` and
calls the import while it renders. Only the pages that render it load the script, without the
island runtime.

```ts check file=components/copy-button.ts
customElements.define(
  "copy-button",
  class extends HTMLElement {
    connectedCallback(): void {
      // The server's data, from the attribute.
      const text = this.getAttribute("text") ?? "";
      // On the element: clicks bubble from the button,
      // which the parser may add later.
      this.addEventListener("click", () => {
        void navigator.clipboard.writeText(text);
      });
    }
  },
);
```

```stsx check file=components/CopyButton.stsx
import defineCopyButton from "./copy-button.ts?client";

// Types the attributes the server writes.
declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "copy-button": JSX.HTMLProps<HTMLElement> & {
        text: string;
      };
    }
  }
}

export function CopyButton(props: { text: string }) {
  defineCopyButton();
  return (
    <copy-button text={props.text}>
      <button type="button">Copy</button>
    </copy-button>
  );
}
```

> **Details:** the rules of `?client` scripts are in
> [Client scripts](../reference/dom.md#client-scripts). Code that must run before any island
> hydrates (an SDK, `onError`, `instrumentations`) goes in `src/instrumentation.client.ts`:
> [Client instrumentation](../reference/dom.md#client-instrumentation). What a build emits and how
> chunks load: [Island chunks and build output](../reference/dom.md#island-chunks-and-build-output).

## API

| API                                                         | Use                                                       |
| ----------------------------------------------------------- | --------------------------------------------------------- |
| `client:load`, `client:idle`, `client:visible`              | Make a component instance an island.                      |
| `client:media`, `client:only`                               | The same, on a media query or without server HTML.        |
| `export function X`                                         | Islands must be exported, so the browser can import them. |
| `*.server.ts`, `src/server/**`                              | Server-only modules (`LUM4003`).                          |
| `import.meta.env.PUBLIC_*`                                  | Env values that may reach islands.                        |
| `src/instrumentation.client.ts`                             | Runs once per page load, before islands hydrate.          |
| `onError`, `instrumentations` exports of it                 | Report browser errors; observe hydration and requests.    |
| `ClientErrorInfo`, `ClientInstrumentation`                  | Their types.                                              |
| `import x from "./script.ts?client"`, `x()` while rendering | A browser script for the pages that render a component.   |

## Example

A server page with one island. Only `LikeButton` ships JavaScript, and `client:visible` loads
it when it scrolls into view. Its child is a slot: it renders on the server and stays server HTML.

```stsx check file=components/LikeButton.stsx
import { signal } from "lumiose";

type Props = { initial: number; children?: JSX.Element };

export function LikeButton({ initial, children }: Props) {
  const likes = signal(initial);

  return (
    <button
      class="like"
      onClick={() => likes.update((n) => n + 1)}
    >
      {children} {likes()}
    </button>
  );
}

<style>
  .like { border-radius: 999px; }
</style>
```

```stsx check file=routes/posts/[id]/page.stsx
import { params } from "lumiose";
import { LikeButton } from "../../../components/LikeButton.stsx";

export default function Post() {
  const { id } = params<"/posts/[id]">();

  return (
    <main>
      <h1>Post {id}</h1>
      <LikeButton client:visible initial={3}>
        <strong>Like</strong>
      </LikeButton>
    </main>
  );
}
```

## Common mistakes

Each in full: [Mistakes with islands](../reference/dom.md#mistakes-with-islands).

- **A non-exported island** cannot be imported by the browser (`LUM4001`).
- **Functions or class instances as island props** (`LUM4002`). Pass data.
- **Importing server code into an island** (`LUM4003`). Call an endpoint with `fetchJSON`.
- **`window` or `document` at module scope** in a module the server also runs (`LUM4004`).
- **Reading page context inside an island** (`LUM4010`). Pass a prop, or use
  [scoped state](state.md).
- **Different output on server and client**, as from `Math.random()` in render (`LUM4006`).
- **Expecting `submit()` to refresh an MPA page:** [Data and actions](data-and-actions.md).
- **Starting an SDK inside an island.** Use `src/instrumentation.client.ts`.
- **Making a whole page an island.** Mark the interactive parts, or use an `spa` route
  ([Choosing a mode](rendering-modes.md#choosing-a-mode)).
- **Server-rendered, query-dependent HTML with a shallow `searchParams.set()`** keeps old rows.

## Related diagnostics

- [LUM4001](../errors/LUM4001.md): island component is not exported.
- [LUM4002](../errors/LUM4002.md): non-serializable island prop.
- [LUM4003](../errors/LUM4003.md): server-only module in a client graph.
- [LUM4004](../errors/LUM4004.md): browser API at module scope.
- [LUM4006](../errors/LUM4006.md): hydration mismatch.
- [LUM4007](../errors/LUM4007.md): non-serializable awaited value.
- [LUM4010](../errors/LUM4010.md): island reads context provided by the page.
- [LUM4011](../errors/LUM4011.md): non-serializable scoped state value.

See also: [Rendering modes](rendering-modes.md), [Async components](async.md), [Sharing state](state.md) (state shared by islands).
