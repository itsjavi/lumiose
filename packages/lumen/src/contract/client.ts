// Compiler-runtime contract: client side (owner: Lux; see backlog doc-2 "Compiler-runtime contract").
// Compiled client output imports exactly these names from `lumen/dom`. The runtime in `src/dom/index.ts`
// must satisfy `ClientRuntime` (checked in src/contract/contract.test.ts). Changing this file requires
// updating doc-2 and both the compiler (Photon) and the runtime (Spark).

/** Anything `insert()` can render: nodes, text, arrays, nested reactive functions, or nothing. */
export type Renderable =
  | Node
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | readonly Renderable[]
  | (() => Renderable);

/** A component as compiled: takes the getter-based props object, returns renderable output. */
export type Component<P = Record<string, unknown>> = (props: P) => Renderable | Promise<Renderable>;

/** Returned by `template()`: a factory producing a fresh copy of the template's root(s). */
export interface TemplateFactory {
  (): Element;
}
export interface MultiRootTemplateFactory {
  (): Node[];
}

/** Bit flags for `template()`. */
export const TemplateFlags = {
  /** The HTML has several top-level nodes; the factory returns `Node[]`. */
  MultiRoot: 1,
  /** Parse inside the SVG namespace. */
  Svg: 2,
  /** Parse inside the MathML namespace. */
  MathMl: 4,
} as const;

export interface ClientRuntime {
  // ---- templates -------------------------------------------------------------------------------
  /**
   * Parses `html` once (minified; optional closing tags may be omitted; `<!>` is a placeholder
   * comment) and returns a factory that clones it. While a hydration cursor is active (installed by
   * `lumen/dom/hydrate`), the factory claims the next existing node instead of cloning; compiled code
   * is identical in both modes and walks the result with `firstChild`/`nextSibling`.
   */
  template(html: string): TemplateFactory;
  template(html: string, flags: number): TemplateFactory | MultiRootTemplateFactory;

  // ---- bindings ----------------------------------------------------------------------------------
  /**
   * Fine-grained binding: runs `compute` tracked; when its value changes (Object.is), calls
   * `apply(target, value)`. `apply` is a hoisted module-level function (no per-binding closure).
   * `compute` may be a signal itself. Disposed with the current owner.
   */
  bind<E, T>(target: E, compute: () => T, apply: (target: E, value: T) => void): void;
  /** Sets a text node's data (`String(value)`; nullish → ""). Usable as an `apply` function. */
  setText(node: Text, value: unknown): void;
  /** Sets/removes an attribute: null/undefined/false remove it, true sets "". */
  setAttr(el: Element, name: string, value: unknown): void;
  /** Sets a DOM property (value, checked, selected, muted, …). */
  setProp(el: Element, name: string, value: unknown): void;
  /** Applies a `class` value: string | array | Record<string, boolean>, combinable. Static scope tokens are attributes, not classes, so they are never touched. */
  setClass(el: Element, value: unknown): void;
  /** Toggles one class (used when the compiler splits a static class object into per-key bindings). */
  toggleClass(el: Element, name: string, on: unknown): void;
  /** Applies a `style` value: string | object with kebab-case keys (incl. `--custom`); diffs against the previous object. */
  setStyle(el: HTMLElement | SVGElement, value: unknown): void;
  /** Sets one style property (`setProperty`), removing it when nullish/false. Usable as an `apply` function via `bind(el, () => v, ...)` wrappers generated per key. */
  setStyleProperty(el: HTMLElement | SVGElement, name: string, value: unknown): void;

  // ---- dynamic content ----------------------------------------------------------------------------
  /**
   * Inserts `value` into `parent` before `marker` (or appends when `marker` is null). If `value` is a
   * function or signal it is tracked and the inserted content is reconciled on change. The `<!>`
   * placeholder in the template is the marker and stays in the DOM.
   */
  insert(parent: Node, value: Renderable, marker?: Node | null): void;
  /**
   * Keyed list for compiled `.map()`. `render` receives the item and, only when declared
   * (render.length > 1), a reactive index accessor. Items are keyed by `key(item)` or by reference.
   * Reconciliation: prefix/suffix trim, append/remove/clear/swap fast paths, LIS for moves.
   */
  list<T>(
    parent: Node,
    marker: Node | null,
    source: () => readonly T[] | null | undefined,
    render: (item: T, index: () => number) => Renderable,
    key?: (item: T) => unknown,
  ): void;
  /** Memoised branch for ternaries / `&&`: re-renders only when `!!cond()` flips. `whenFalse` may be omitted. */
  branch(
    parent: Node,
    marker: Node | null,
    cond: () => unknown,
    whenTrue: () => Renderable,
    whenFalse?: () => Renderable,
  ): void;
  /** O(1) selection helper: `selector(selected)(key)` is true for the selected key and only re-notifies the two keys that change. */
  selector<T>(source: () => T): (key: T) => boolean;

  // ---- components ----------------------------------------------------------------------------------
  /**
   * Runs a component under a new owner, untracked. `props` is built by the compiler with getters for
   * dynamic values. Async functions (native `async function`) take the async path: tracked body,
   * re-runs, `$await` replay, boundary registration (spec §4.4).
   */
  createComponent<P>(component: Component<P>, props: P): Renderable;
  /** Reactive object rest for `...rest` in destructured props: excludes `keys`, keeps getters live. */
  restProps<P extends object, K extends keyof P>(props: P, keys: readonly K[]): Omit<P, K>;
  /** Merges props sources left to right preserving getters (spread attributes on components). */
  mergeProps<P extends object>(...sources: P[]): P;
  /** Spreads a props object onto an element (attributes, class, style, events, ref, $$scope). */
  spread(el: Element, props: () => Record<string, unknown>): void;
  /** Applies hidden scope tokens (`$$scope`, space-separated `data-l-*` names) as attributes; class passthrough (spec §4.6.2). */
  applyScope(el: Element, tokens: string | undefined): void;

  // ---- events ---------------------------------------------------------------------------------------
  /**
   * Registers document-level delegated listeners for the given event names (idempotent). Handlers
   * are stored as `el.$$<name>` and optional data as `el.$$<name>Data` (handler is then called as
   * `handler(data, event)`). Dispatch walks from `event.target` to the island/app boundary.
   */
  delegateEvents(names: readonly string[]): void;
  /** Native listener (`on:x`), removed when the owner is disposed. */
  listen(
    el: EventTarget,
    name: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void;

  // ---- element helpers ------------------------------------------------------------------------------
  /** `bind:value` / `bind:checked`: two-way binding to a writable signal. */
  bindValue(
    el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
    signal: WritableSource<unknown>,
  ): void;
  bindChecked(el: HTMLInputElement, signal: WritableSource<boolean>): void;
  /** `attach={[a, b]}`: runs each `(el) => cleanup?` in a tracked scope; re-runs when its inputs change. */
  attach(
    el: Element,
    attachments: () => ReadonlyArray<
      ((el: Element) => void | (() => void)) | false | null | undefined
    >,
  ): void;
  /** `ref={fn}`: calls `fn(el)` (refs created with `ref<T>()` are such functions). */
  useRef(el: Element, ref: ((el: Element) => void) | undefined): void;

  // ---- async components ------------------------------------------------------------------------------
  /**
   * Inserted by the compiler around every `await e` whose nearest function is the component:
   * `(await $await(() => e, site))()`. Synchronously pauses the current run, evaluates the thunk
   * (or, during hydration, replays the recorded value; key: instance path, site, occurrence) and
   * resolves to a resume function. Calling it inside the component's own continuation restores the
   * run (owner, context, tracking) and returns the value; this is the only sound place to resume,
   * because other runs' continuations may interleave between microtasks. `site` is the static await
   * index within the component.
   */
  $await<T>(thunk: () => T | PromiseLike<T>, site: number): Promise<() => Awaited<T>>;
  /**
   * Emitted by the compiler as `finally { $leave() }` around the body of every async component, so
   * the run is paused synchronously when the body returns or throws.
   */
  $leave(): void;
  /** Wraps an async component definition (emitted by the compiler) so `createComponent` takes the async path without bundling it otherwise. */
  $async<C extends Component<any>>(component: C): C;
}

/** Minimal writable signal shape used by `bind:*` (matches `signal()` from `lumen`). */
export interface WritableSource<T> {
  (): T;
  set(value: T): void;
}
