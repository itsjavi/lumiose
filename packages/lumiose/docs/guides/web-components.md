# Web components

> Use custom elements and web-component libraries in Lumiose: define them in the browser, type them in JSX, pass properties and attributes, listen to their events with `on:`, and render them on the server. Lumiose scores 100 on Custom Elements Everywhere.

Web components are how Lumiose works with UI libraries that are not written for it (decision-54):
anything built as custom elements, by hand or with Lit, Stencil, FAST or Web Awesome, runs in
Lumiose pages and islands without an adapter.

## Custom Elements Everywhere

[Custom Elements Everywhere](https://custom-elements-everywhere.com) tests how a framework passes
data to custom elements and listens to their events. Lumiose runs its suites in
`benchmarks/custom-elements-everywhere`, with upstream's tests, weights and scoring:

| Engines                     | Score | Basic | Advanced |
| --------------------------- | ----- | ----- | -------- |
| Chrome and Firefox (scored) | 100   | 16/16 | 16/16    |
| WebKit                      | 100   | 8/8   | 8/8      |

Basic support: elements with and without children in a shadow root, booleans, numbers and strings,
and events listened to imperatively. Advanced support: arrays and objects (camelCase names too) as
properties, and events with lowercase, kebab-case, camelCase, CAPS and PascalCase names, listened
to in JSX. Run it with `pnpm --filter @lumiose/bench-cee test:e2e`. The site does not list Lumiose
yet.

## Define the elements in the browser

A custom element must be defined before the component that renders it runs, so that it is already
upgraded when Lumiose passes it properties. Import the definition with `?client` in the component
that renders the element, and call the import while it renders ([Islands](../concepts/islands.md),
"Scripts of server-rendered components"). The definition never runs on the server, where
`customElements` does not exist. An island imports it before it hydrates, and a page that renders
the component on the server loads it as a module script of its own, without the island runtime:

```ts check file=elements/star-rating.ts
// src/elements/star-rating.ts: a custom element of your own, or a library's entry point
export class StarRating extends HTMLElement {
  #value = 0;
  labels: string[] = [];

  get value(): number {
    return this.#value;
  }
  set value(next: number) {
    this.#value = next;
    this.render();
  }

  connectedCallback(): void {
    // Before an island sets the property, the server's attribute.
    this.#value ||= Number(this.getAttribute("value") ?? 0);
    this.attachShadow({ mode: "open" });
    this.render();
  }

  render(): void {
    if (!this.shadowRoot) return;
    const max = Number(this.getAttribute("max") ?? 5);
    this.shadowRoot.innerHTML = "";
    for (let star = 1; star <= max; star++) {
      const button = document.createElement("button");
      button.textContent = star <= this.#value ? "★" : "☆";
      button.title = this.labels[star - 1] ?? String(star);
      button.onclick = () => {
        this.value = star;
        this.dispatchEvent(new CustomEvent("rating-change", { detail: star }));
      };
      this.shadowRoot.append(button);
    }
  }
}

customElements.define("star-rating", StarRating);
```

## Type it in JSX

Undeclared custom elements accept any attribute. Declare an element to type-check its props, in
any `.d.ts` or module of the project ([JSX types](../reference/jsx.md#custom-elements)):

```tsx check file=components/Review.tsx
// src/components/Review.tsx
import { signal } from "lumiose";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "star-rating": JSX.HTMLProps<HTMLElement> & {
        /** A property: the element defines `value`. */
        value?: number;
        /** An attribute: the element reads `max` with `getAttribute()`. */
        max?: number;
        /** A property holding an array. */
        labels?: string[];
      };
    }
  }
}

// Defines <star-rating> in the browser: before an island hydrates, or on the pages that render it.
import defineStarRating from "../elements/star-rating.ts?client";

export function Review(props: { rating: number }) {
  defineStarRating();
  const rating = signal(props.rating);
  return (
    <figure>
      <star-rating
        value={rating()}
        max={5}
        labels={["Bad", "Poor", "Fair", "Good", "Great"]}
        on:rating-change={(event: CustomEvent<number>) => rating.set(event.detail)}
      />
      <figcaption>{rating()} of 5</figcaption>
    </figure>
  );
}
```

Render it as an island: `<Review client:visible rating={4} />` ([Islands](../concepts/islands.md)).

## Properties and attributes

Lumiose follows React 19's rule. On a custom element (a tag with a dash), each prop goes to:

- **the property of that name, as it is**, when the element defines one (`name in element`, and not
  a property that every element has, such as `id` or `title`): `value={rating()}` sets
  `element.value`, and arrays, objects, booleans and camelCase names (`labels`, `camelCaseObj`)
  arrive unchanged;
- **the attribute** otherwise: `max={5}` writes `max="5"`, and `true`, `false` and `null` add or
  remove it, as on built-in elements.

A read-only property (a getter without a setter) cannot take a prop: the assignment throws, and
an island that renders the prop fails to hydrate. When you write the element, give such a property
a setter, or a name that no prop uses (a private `#getter` for an attribute it reads).

Strings set as properties keep the URL check of attributes (a `javascript:` URL becomes a
placeholder). An element that is not defined yet when the component runs gets attributes for
everything, so load its definition first (above). `class`, `style`, `ref`, `attach` and
`innerHTML` work as on any element, and a spread (`{...props}`) follows the same rule (it never
sets `innerHTML`, `textContent` or `srcdoc`, on any element).

## Events

`on:name` adds a native listener for the event of that exact name, so any casing works:
`on:rating-change`, `on:sl-change`, `on:valueChanged`, `on:PascalEvent`. Type the handler's event
yourself, as above. `onClick` and the other camelCase handlers are for the standard DOM events,
lowercased and delegated: use `on:` for a component's own events.

## Two-way binding

`bind:x={signal}` sets the element's `x` property from the signal and writes the property back
when the element itself dispatches `input`, `change` or `xchange` (lowercase: `openchange`,
`checkedchange`, `valuechange`); events that bubble up from its children are ignored. It suits
elements whose state lives in a property and that announce its changes with one of those events,
as native controls and `@lumiose/ui`'s elements do. For other event names (`rating-change`,
`sl-change`), set the property and listen with `on:` as above. Declare the binding on a typed
element:

```tsx check
import { signal, type Signal } from "lumiose";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "toggle-switch": JSX.HTMLProps<HTMLElement> & {
        pressed?: boolean;
        /** Sets `pressed`; `pressedchange` and `change` events write it back. */
        "bind:pressed"?: Signal<boolean>;
      };
    }
  }
}

export function Bold() {
  const bold = signal(false);
  return <toggle-switch bind:pressed={bold}>Bold</toggle-switch>;
}
```

## Server rendering

On the server a custom element renders as its tag with the attributes Lumiose can write:
strings, numbers and `true` (`<star-rating max="5" value="4">`), and its light-DOM children. Its
shadow root and properties exist only once the browser defines the element; when the island
hydrates, Lumiose sets the properties on the upgraded element. Arrays and objects are not
attributes: the server leaves them out of the HTML, as React 19 does (`labels` above), and the
island sets them as properties when it hydrates; functions are left out too. Elements outside
islands stay server HTML: they upgrade when their definition loads (the `?client` script of the
component that renders them), and read what they need from attributes.

To show the element before its definition loads, style it with `:not(:defined)`:

```css
star-rating:not(:defined) {
  display: inline-block;
  inline-size: 7.5em;
  block-size: 1.5em;
}
```

## Server data in attributes

An element that needs a little behaviour, and no island, gets the server's data through its
attributes (decision-71). The component that renders it writes the data as attributes and calls
its `?client` script, which takes no arguments. The element reads the attributes in
`connectedCallback`. Declare the element in `JSX.IntrinsicElements` so the server side is
type-checked: a missing or mistyped attribute is a `lumiose check` error. The page loads the
definition as one module script, without the island runtime.

```ts check file=elements/local-time.ts
// src/elements/local-time.ts: runs in the browser only
customElements.define(
  "local-time",
  class extends HTMLElement {
    connectedCallback(): void {
      // Replaces the server's text, which the parser may not have added yet: wait for it.
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => this.#format(), { once: true });
      } else {
        this.#format();
      }
    }

    #format(): void {
      // Attribute values are strings: the script parses them.
      const date = new Date(this.getAttribute("datetime") ?? "");
      if (Number.isNaN(date.getTime())) return;
      const options: Intl.DateTimeFormatOptions =
        this.getAttribute("format") === "time" ? { timeStyle: "short" } : { dateStyle: "medium" };
      this.textContent = date.toLocaleString(undefined, options);
    }
  },
);
```

```stsx check file=components/PublishedAt.stsx
// src/components/PublishedAt.stsx
import defineLocalTime from "../elements/local-time.ts?client";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "local-time": JSX.HTMLProps<HTMLElement> & {
        /** An ISO 8601 date, shown in the reader's locale and time zone. */
        datetime: string;
        format?: "date" | "time";
      };
    }
  }
}

export function PublishedAt(props: { date: Date }) {
  defineLocalTime();
  // The server's text shows until the definition loads.
  return (
    <local-time datetime={props.date.toISOString()} format="date">
      {props.date.toISOString().slice(0, 10)}
    </local-time>
  );
}
```

Each instance carries its own data, and the element upgrades wherever it appears: in server HTML,
in streamed `<Suspense>` boundaries, after SPA navigations, and in Markdown or CMS HTML that
contains the tag. Numbers and booleans become attribute strings (`true` adds the attribute, `false`
removes it), so the script converts them back. Pass structured data as JSON
(`data={JSON.stringify(points)}`) and `JSON.parse` it in the script. An element that also renders
inside an island gets the same attributes there, unless it defines a property of that name
([Properties and attributes](#properties-and-attributes)).

## Before the children are parsed

A `?client` script loads as `<script type="module" async>`, so it can run before the parser
reaches the elements it defines: on a slow or streamed response, or when the browser has the
script cached. The parser then upgrades each element as it creates it, and `connectedCallback`
runs before the element has children: the parser appends them afterwards. The attributes are
already there, and listening works; reading or replacing the children does not:

- **Listen on the element itself.** Events from children that the parser adds later bubble up to
  it. Look up the part an event concerns when it fires (`event.target`, `this.querySelector()`),
  not in `connectedCallback`, as `copy-button` does in
  [Islands](../concepts/islands.md#concept).
- **Wait for the parser** to read or change the children: while `document.readyState` is
  `"loading"`, do that work on `DOMContentLoaded`, as `local-time` does above. Without the wait,
  `local-time` would set its text and the parser would then append the server's text after it.
  Elements that connect once the document is parsed (an SPA navigation, an island, `innerHTML`)
  are inserted with their children.

**Elements the script creates are unscoped.** The component's scoped `<style>` blocks style the
elements of its templates ([Styles](../concepts/styles.md)), not those the script makes with
`document.createElement()` or `innerHTML`, and a selector that only they match is `LUM3005`.
Render the markup on the server and let the script fill, show or hide it, or reach the created
elements with `:deep()` under an element of the scope:

```ts check file=elements/copy-code.ts
// src/elements/copy-code.ts: adds a Copy button to the code it wraps
customElements.define(
  "copy-code",
  class extends HTMLElement {
    #button: HTMLButtonElement | undefined;

    connectedCallback(): void {
      if (this.#button) return; // connected again after a move
      this.#button = document.createElement("button");
      this.#button.type = "button";
      this.#button.textContent = "Copy";
      // Looks the code up on click: it may not be parsed yet when the element connects.
      this.#button.addEventListener("click", () => {
        void navigator.clipboard.writeText(this.querySelector("code")?.textContent ?? "");
      });
      this.prepend(this.#button);
    }
  },
);
```

```stsx check file=components/CodeBlock.stsx
// src/components/CodeBlock.stsx
import defineCopyCode from "../elements/copy-code.ts?client";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "copy-code": JSX.HTMLProps<HTMLElement>;
    }
  }
}

export function CodeBlock(props: { code: string }) {
  defineCopyCode();
  // Without JavaScript, the code shows without a button that would do nothing.
  return (
    <copy-code class="code-block">
      <pre>
        <code>{props.code}</code>
      </pre>
      <style>
        .code-block { display: block; position: relative; }
        pre { overflow-x: auto; }
        /* The script's button carries no scope: reach it from an element that does. */
        .code-block :deep(button) { position: absolute; inset-block-start: 0.5rem; inset-inline-end: 0.5rem; }
      </style>
    </copy-code>
  );
}
```

## Related

- [JSX](../concepts/jsx.md): element props and `on:` events.
- [JSX types](../reference/jsx.md#custom-elements): declaring custom elements.
- [Islands](../concepts/islands.md): hydration and directives.
