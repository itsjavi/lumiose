// `lumiose/jsx-runtime`: JSX types for `jsxImportSource: "lumiose"` (owner: Beacon). Spec §4.5, §4.7.
// Type-only: with `jsx: "preserve"` the Lumiose compiler transforms JSX, so compiled code never imports
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
  /**
   * `on:event={handler}`: a native `addEventListener` listener for the exact event name, on this
   * element (not delegated). Use it for custom and web-component events (`on:my-event`); prefer
   * `onClick`-style props for standard events, which bubbling events share through delegation.
   */
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

/** A prop Lumiose rejects. Any value other than `undefined` fails, and the error names the fix. */
interface Rejected<Hint extends string> {
  readonly "~lumiose": Hint;
}

/**
 * Brands the props of intrinsic elements, which {@link JSX.LibraryManagedAttributes} leaves as they
 * are. A symbol key, so it is never offered as an attribute.
 */
declare const intrinsic: unique symbol;

/** Lumiose props shared by every intrinsic element (spec §4.5). */
interface LumioseProps<T extends Element> {
  readonly [intrinsic]?: never;
  children?: Renderable;
  class?: JSX.ClassValue;
  style?: string | JSX.CSSProperties;
  /**
   * `ref={fn}`: called with the element once it is created. `const input = ref<HTMLInputElement>()`
   * makes a callback that can also be read like a signal: `input()` is the element (or
   * `undefined` before it exists).
   */
  ref?: RefProp<T>;
  /**
   * `attach={[fn, …]}`: each `fn(element)` runs as an effect once the element is mounted, so the
   * signals it reads re-run it. It may return a cleanup, which runs before each re-run and when the
   * element is removed. Falsy entries are skipped (`attach={[open() && trapFocus]}`).
   */
  attach?: readonly (Attachment<T> | false | null | undefined)[];
  /** Sets `innerHTML` unescaped. The `no-unsafe-html` lint rule warns. */
  innerHTML?: string;
  /**
   * `key`: the identity of a row in a `.map` list, so a reordered list moves rows instead of
   * re-creating them. Optional: rows are keyed by item reference otherwise.
   */
  key?: unknown;
  className?: Rejected<"use `class` instead of `className`">;
  /**
   * `on:event={handler}`: a native `addEventListener` listener for the exact event name, on this
   * element (not delegated). Use it for custom and web-component events (`on:my-event`).
   */
  [nativeEvent: `on:${string}`]: CustomEventHandler | undefined;
}

/**
 * Undeclared custom elements (`<my-widget>`): Lumiose props and global attributes are typed, any other
 * attribute is accepted. `any` (element and catch-all) keeps declared custom elements, such as
 * `"my-widget": JSX.HTMLProps<MyWidget> & { count: number }`, assignable to this index signature.
 */
interface CustomElementProps extends JSX.HTMLProps<any> {
  [attribute: string]: any;
}

/** `bind:value` / `bind:checked`: two-way binding to a writable signal, only where meaningful. */
interface BindProps {
  input: {
    /**
     * `bind:value={signal}`: two-way binding. The signal sets the input's value, and `input`
     * events write it back. A number signal on `type="number"` or `type="range"` uses
     * `valueAsNumber`. Pass the signal itself, not its value: `bind:value={draft}`.
     */
    "bind:value"?: WritableSource<string> | WritableSource<number>;
    /**
     * `bind:checked={signal}`: two-way binding of a checkbox or radio. The signal sets `checked`,
     * and `change` events write it back. Pass the signal itself: `bind:checked={done}`.
     */
    "bind:checked"?: WritableSource<boolean>;
  };
  select: {
    /**
     * `bind:value={signal}`: two-way binding. The signal selects the option, and `input` events
     * write the selected value back. Pass the signal itself: `bind:value={choice}`.
     */
    "bind:value"?: WritableSource<string>;
  };
  textarea: {
    /**
     * `bind:value={signal}`: two-way binding. The signal sets the text, and `input` events write
     * it back. Pass the signal itself: `bind:value={draft}`.
     */
    "bind:value"?: WritableSource<string>;
  };
}

/** The props `x` of `P` that come with an `onXChange` callback. */
type BindableKeys<P> = {
  [K in keyof P & string]: `on${Capitalize<K>}Change` extends keyof P ? K : never;
}[keyof P & string];

/**
 * `bind:x` on a component (decision-62): a `bind:x` key for each bindable prop. The compiler
 * expands `bind:x={signal}` to `x={signal()}` plus `onXChange={(value) => signal.set(value)}`, so
 * a component without either prop has no `bind:x`.
 */
type ComponentBindings<P> = { [K in BindableKeys<P> as `bind:${K}`]?: WritableSource<P[K]> };

/**
 * The props with `bind:x` standing in for `x` and `onXChange`, for each bindable prop that is
 * required; `never` (no extra union member, so no change to error messages) when there is none.
 */
type RequiredBindings<P> = {
  [K in BindableKeys<P>]: {} extends Pick<P, K | ChangeKey<P, K>>
    ? never
    : Omit<P, K | ChangeKey<P, K>> &
        Partial<Pick<P, ChangeKey<P, K>>> & { [B in `bind:${K}`]: WritableSource<P[K]> };
}[BindableKeys<P>];

/** `onXChange` of a bindable prop `x`, as a key of `P`. */
type ChangeKey<P, K extends string> = `on${Capitalize<K>}Change` & keyof P;

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

// ---- island props -----------------------------------------------------------------------------------

/** Serialized as is (spec §7.2): JSON values plus `undefined`, `BigInt`, `Date` and `URL`. */
type SerializableLeaf = string | number | boolean | bigint | null | undefined | Date | URL;

/**
 * The type an island prop is checked against. Not distributive at the top, so a slot type such as
 * `JSX.Element` (whose union includes functions and nodes) is kept whole; members of other unions
 * are checked one by one.
 */
type IslandValue<T> = [JSX.Element] extends [T] ? T : IslandMember<T>;

type IslandMember<T> = T extends SerializableLeaf
  ? T
  : T extends (...args: never) => unknown
    ? NotSerializable<"a function">
    : T extends symbol
      ? NotSerializable<"a symbol">
      : T extends PromiseLike<unknown>
        ? NotSerializable<"a promise">
        : T extends readonly unknown[]
          ? number extends T["length"]
            ? readonly IslandValue<T[number]>[]
            : { [K in keyof T]: IslandValue<T[K]> }
          : T extends ReadonlyMap<infer K, infer V>
            ? ReadonlyMap<IslandValue<K>, IslandValue<V>>
            : T extends ReadonlySet<infer V>
              ? ReadonlySet<IslandValue<V>>
              : { [K in keyof T]: IslandValue<T[K]> };

/**
 * What a non-serializable island prop is checked against: no value but `undefined` fits, and the
 * marker names the rule in the TypeScript message (`lumiose check` and the language server report
 * it as LUM4002).
 */
interface NotSerializable<What extends string> {
  readonly "~lumiose": `LUM4002: ${What} cannot be an island prop (not serializable)`;
}

// ---- JSX namespace -----------------------------------------------------------------------------------

export declare namespace JSX {
  /** What JSX evaluates to: anything the runtime can insert (contract `Renderable`). */
  export type Element = Renderable;

  /** Intrinsic tags, and sync or async function components (decision-13). */
  export type ElementType = keyof IntrinsicElements | ((props: any) => Element | Promise<Element>);

  export interface ElementChildrenAttribute {
    children: {};
  }

  /** Props every component accepts: `key`. The island directives come from {@link LibraryManagedAttributes}. */
  export interface IntrinsicAttributes {
    /**
     * `key`: the identity of a row in a `.map` list, so a reordered list moves rows instead of
     * re-creating them. Optional: rows are keyed by item reference otherwise.
     */
    key?: unknown;
  }

  /**
   * The props of a component call. A component whose props all serialize takes its props plus the
   * island directives. Otherwise the type is a union discriminated by the directive: its own props
   * without a `client:*` directive, or, with one, its props as {@link IslandProps}, so passing a
   * function (or another value that cannot be serialized) to an island is a type error at the
   * call site, which `lumiose check` and the language server report as LUM4002.
   */
  export type LibraryManagedAttributes<_C, P> = typeof intrinsic extends keyof P
    ? P // an intrinsic element (TypeScript calls this for its contextual types too)
    : [P] extends [IslandProps<P>]
      ? P & IslandDirectives
      :
          | ((P | RequiredBindings<P>) & ComponentBindings<P> & NoIslandDirectives)
          | (IslandProps<P> & IslandDirectives);

  /** The island directives (decision-9, spec §7.2). Island props must be serializable. */
  export interface IslandDirectives {
    /**
     * Island directive: renders this component on the server and hydrates it in the browser
     * **immediately** on page load. Its props must be serializable and the component exported.
     */
    "client:load"?: boolean;
    /**
     * Island directive: renders this component on the server and hydrates it in the browser
     * **when the browser is idle** (`requestIdleCallback`).
     */
    "client:idle"?: boolean;
    /**
     * Island directive: renders this component on the server and hydrates it **when it enters the
     * viewport**. `client:visible="200px"` sets a root margin, to hydrate a little earlier.
     */
    "client:visible"?: boolean | string;
    /**
     * Island directive: renders this component on the server and hydrates it **when the media
     * query matches**: `client:media="(max-width: 600px)"`.
     */
    "client:media"?: string;
    /**
     * Island directive: **client-rendered only**. The server sends no HTML for this component; it
     * renders in the browser on page load.
     */
    "client:only"?: boolean;
  }

  /** A plain component call: no island directive. */
  export type NoIslandDirectives = { [K in keyof IslandDirectives]?: undefined };

  /**
   * Props of an island call site (`client:*`): every prop whose declared type cannot be serialized
   * (functions, symbols, promises, objects with methods such as class instances) only accepts
   * `undefined`, so passing one is a LUM4002 type error at the prop. Slots (props that accept
   * JSX, like `children`), `unknown` and `any` stay as declared.
   */
  export type IslandProps<P> = { [K in keyof P]: IslandValue<P[K]> };
  /**
   * Every HTML (except `style`), SVG and MathML tag of lib.dom, plus custom elements. Type a custom
   * element by augmenting this interface: `declare module "lumiose/jsx-runtime" { namespace JSX { … } }`.
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

  /** Props of HTML, SVG and MathML elements: Lumiose props, attributes, `onX` and `on:x` events. */
  export interface HTMLProps<T extends HTMLElement>
    extends
      LumioseProps<T>,
      GlobalHTMLAttributes,
      DelegatedEvents<T, HTMLElementEventMap>,
      NativeEvents<T, HTMLElementEventMap> {
    htmlFor?: Rejected<"use `for` instead of `htmlFor`">;
  }

  export interface SVGProps<T extends SVGElement>
    extends
      LumioseProps<T>,
      SVGAttributes,
      DelegatedEvents<T, SVGElementEventMap>,
      NativeEvents<T, SVGElementEventMap> {}

  export interface MathMLProps<T extends MathMLElement>
    extends
      LumioseProps<T>,
      MathMLAttributes,
      DelegatedEvents<T, MathMLElementEventMap>,
      NativeEvents<T, MathMLElementEventMap> {}
}
