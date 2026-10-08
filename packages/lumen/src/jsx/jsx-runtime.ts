// `lumen/jsx-runtime`: JSX types for `jsxImportSource: "lumen"` (owner: Beacon). Spec §4.5, §4.7.
// Type-only: with `jsx: "preserve"` the Lumen compiler transforms JSX, so compiled code never imports
// values from here. Keep checking cheap: tag → props is a lazy mapped type over the lib.dom tag maps,
// per-tag extras are single lookups, and the kebab-case CSS property map is computed once.
import type { Renderable, WritableSource } from "../contract/client.ts";
import type {
  GlobalHTMLAttributes,
  HTMLAttributeMap,
  MathMLAttributes,
  SVGAttributes,
} from "./attributes.ts";
import type { DelegatedEventTable } from "./events.ts";

// ---- class and style ------------------------------------------------------------------------------

type ClassRecord = Record<string, boolean | null | undefined>;

/** A style property value. Nullish or `false` removes the property; numbers are not given units. */
type CSSValue = string | number | false | null | undefined;

type Hump<C extends string> = C extends Lowercase<C> ? C : `-${Lowercase<C>}`;
// Two characters per step: about a third of the instantiations of a per-character accumulator.
type KebabCase<S extends string> = S extends `${infer A}${infer B}${infer Rest}`
  ? `${Hump<A>}${Hump<B>}${KebabCase<Rest>}`
  : Hump<S>;
/** `backgroundColor` → `background-color`, `webkitLineClamp` → `-webkit-line-clamp`, `cssFloat` → `float`. */
type CSSPropertyName<K extends string> = K extends "cssFloat"
  ? "float"
  : K extends `webkit${infer Rest}`
    ? `-webkit${KebabCase<Rest>}`
    : KebabCase<K>;
type StandardCSSProperties = {
  [
    K in Exclude<keyof CSSStyleProperties, keyof CSSStyleDeclarationBase> &
      string as CSSPropertyName<K>
  ]?: CSSValue;
};

// ---- events -----------------------------------------------------------------------------------------

/**
 * Handler for `on:` events missing from the element's event map (custom and web-component events).
 * Bivariant on purpose, so `(e: CustomEvent<Detail>) => void` is accepted.
 */
type CustomEventHandler = { bivarianceHack(event: Event): void }["bivarianceHack"];

/**
 * `onClick`, `onKeyDown`, `onDblClick`, …: delegated (decision-17). Only the camelCase names of the
 * `delegatedEvents` table in `events.ts` exist, so `onKeydown` and `onclick` are rejected.
 */
type DelegatedEvents<T, M> = {
  [K in keyof DelegatedEventTable as `on${K}`]?: JSX.EventHandler<
    Lookup<M, DelegatedEventTable[K]>,
    T
  >;
};

/** `on:click`, `on:scroll`, …: native `addEventListener` listeners. */
type NativeEvents<T, M> = {
  [K in keyof M & string as `on:${K}`]?: JSX.EventHandler<M[K], T>;
};

// ---- element props ----------------------------------------------------------------------------------

/**
 * `ref={fn}`: called with the element. A plain callback only meets the call signature. The marker
 * matters for `JSX.Ref` values, whose getter signature `() => T` would otherwise fit any callback:
 * through the marker, a ref of another element type is rejected.
 */
type RefProp<T extends Element> = ((element: T) => void) & {
  readonly "~element"?: (element: T) => void;
};

/** `attach={[fn]}` entry: runs with the element in a tracked scope and may return a cleanup. */
type Attachment<T> = (element: T) => void | (() => void);

/** A prop Lumen rejects. Any value other than `undefined` fails, and the error names the fix. */
interface Rejected<Hint extends string> {
  readonly "~lumen": Hint;
}

/** Lumen props shared by every intrinsic element (spec §4.5). */
interface LumenProps<T extends Element> {
  children?: Renderable;
  class?: JSX.ClassValue;
  style?: string | JSX.CSSProperties;
  ref?: RefProp<T>;
  attach?: readonly (Attachment<T> | false | null | undefined)[];
  /** Sets `innerHTML` unescaped. The `no-unsafe-html` lint rule warns. */
  innerHTML?: string;
  key?: unknown;
  className?: Rejected<"use `class` instead of `className`">;
  [nativeEvent: `on:${string}`]: CustomEventHandler | undefined;
}

/**
 * Undeclared custom elements (`<my-widget>`): Lumen props and global attributes are typed, any other
 * attribute is accepted. `any` (element and catch-all) keeps declared custom elements, such as
 * `"my-widget": JSX.HTMLProps<MyWidget> & { count: number }`, assignable to this index signature.
 */
interface CustomElementProps extends JSX.HTMLProps<any> {
  [attribute: string]: any;
}

/** `bind:value` / `bind:checked`: two-way binding to a writable signal, only where meaningful. */
interface BindProps {
  input: {
    "bind:value"?: WritableSource<string> | WritableSource<number>;
    "bind:checked"?: WritableSource<boolean>;
  };
  select: { "bind:value"?: WritableSource<string> };
  textarea: { "bind:value"?: WritableSource<string> };
}

type Lookup<M, K> = K extends keyof M ? M[K] : unknown;

/** `style` is omitted: `<style>` blocks belong in `.stsx` files (spec §4.1), so `.tsx` rejects them. */
type HTMLTag = Exclude<keyof HTMLElementTagNameMap, "style">;
/** SVG tags shared with HTML (`a`, `script`, `style`, `title`) use the HTML entry. */
type SVGTag = Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>;
/** `annotation-xml` contains a dash, so it falls under the custom-element signature. */
type MathMLTag = Exclude<
  keyof MathMLElementTagNameMap,
  keyof HTMLElementTagNameMap | keyof SVGElementTagNameMap | `${string}-${string}`
>;

type HTMLElements = {
  [K in HTMLTag]: JSX.HTMLProps<HTMLElementTagNameMap[K]> &
    Lookup<HTMLAttributeMap, K> &
    Lookup<BindProps, K>;
};
type SVGElements = { [K in SVGTag]: JSX.SVGProps<SVGElementTagNameMap[K]> };
type MathMLElements = { [K in MathMLTag]: JSX.MathMLProps<MathMLElementTagNameMap[K]> };

// ---- JSX namespace -----------------------------------------------------------------------------------

export declare namespace JSX {
  /** What JSX evaluates to: anything the runtime can insert (contract `Renderable`). */
  export type Element = Renderable;

  /** Intrinsic tags, and sync or async function components (decision-13). */
  export type ElementType = keyof IntrinsicElements | ((props: any) => Element | Promise<Element>);

  export interface ElementChildrenAttribute {
    children: {};
  }

  /** Props every component accepts: `key`, and the island directives (decision-9, spec §7.2). */
  export interface IntrinsicAttributes {
    key?: unknown;
    "client:load"?: boolean;
    "client:idle"?: boolean;
    /** `client:visible`, or `client:visible="200px"` for a root margin. */
    "client:visible"?: boolean | string;
    /** `client:media="(max-width: 600px)"`. */
    "client:media"?: string;
    "client:only"?: boolean;
  }

  /**
   * Every HTML (except `style`), SVG and MathML tag of lib.dom, plus custom elements. Type a custom
   * element by augmenting this interface: `declare module "lumen/jsx-runtime" { namespace JSX { … } }`.
   */
  export interface IntrinsicElements extends HTMLElements, SVGElements, MathMLElements {
    [customElement: `${string}-${string}`]: CustomElementProps;
  }

  /** `class`: a string, a `{ name: on }` record, or an array of those (nested; falsy entries skipped). */
  export type ClassValue = string | false | null | undefined | ClassRecord | readonly ClassValue[];

  /** `style` object: kebab-case CSS property names (as in CSS) plus `--custom` properties. */
  export interface CSSProperties extends StandardCSSProperties {
    [customProperty: `--${string}`]: CSSValue;
  }

  /** `onX` / `on:x` handler: the native event (no synthetic events) with a typed `currentTarget`. */
  export type EventHandler<E, T> = (event: E & { currentTarget: T }) => void;

  /**
   * The value of `ref<T>()` (spec §4.5): the runtime calls it with the element, and code reads it
   * like a signal (`input()`). `ref<T>()` must return this type. A plain intersection of the two
   * call signatures would let a ref of another element type pass: the type-only `"~element"`
   * marker is what the `ref` prop checks.
   */
  export interface Ref<T extends Element> {
    (element: T): void;
    (): T | undefined;
    readonly "~element"?: (element: T) => void;
  }

  /** Props of HTML, SVG and MathML elements: Lumen props, attributes, `onX` and `on:x` events. */
  export interface HTMLProps<T extends HTMLElement>
    extends
      LumenProps<T>,
      GlobalHTMLAttributes,
      DelegatedEvents<T, HTMLElementEventMap>,
      NativeEvents<T, HTMLElementEventMap> {
    htmlFor?: Rejected<"use `for` instead of `htmlFor`">;
  }

  export interface SVGProps<T extends SVGElement>
    extends
      LumenProps<T>,
      SVGAttributes,
      DelegatedEvents<T, SVGElementEventMap>,
      NativeEvents<T, SVGElementEventMap> {}

  export interface MathMLProps<T extends MathMLElement>
    extends
      LumenProps<T>,
      MathMLAttributes,
      DelegatedEvents<T, MathMLElementEventMap>,
      NativeEvents<T, MathMLElementEventMap> {}
}
