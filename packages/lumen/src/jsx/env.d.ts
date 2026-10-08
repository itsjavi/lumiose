// `lumen/env`: ambient types for Lumen projects (owner: Beacon). Spec §4.7, §8 (Context, Env).
// Enabled with `"types": ["lumen/env"]` in tsconfig.
import type { JSX as LumenJSX } from "./jsx-runtime.ts";

declare global {
  /** Global alias of `lumen/jsx-runtime`'s `JSX`, for annotations such as `JSX.Element`. */
  namespace JSX {
    type Element = LumenJSX.Element;
    type ElementType = LumenJSX.ElementType;
    interface ElementChildrenAttribute extends LumenJSX.ElementChildrenAttribute {}
    interface IntrinsicAttributes extends LumenJSX.IntrinsicAttributes {}
    interface IntrinsicElements extends LumenJSX.IntrinsicElements {}
    type ClassValue = LumenJSX.ClassValue;
    interface CSSProperties extends LumenJSX.CSSProperties {}
    type EventHandler<E, T> = LumenJSX.EventHandler<E, T>;
    type Ref<T extends Element> = LumenJSX.Ref<T>;
    interface HTMLProps<T extends HTMLElement> extends LumenJSX.HTMLProps<T> {}
    interface SVGProps<T extends SVGElement> extends LumenJSX.SVGProps<T> {}
    interface MathMLProps<T extends MathMLElement> extends LumenJSX.MathMLProps<T> {}
  }

  /**
   * `import.meta.env`. Only `PUBLIC_*` variables reach client code; read secrets with `env()` in
   * server-only modules. Declare known variables by merging: `interface ImportMetaEnv { readonly PUBLIC_API: string }`.
   * The built-in members match `vite/client`, so both can be loaded.
   */
  interface ImportMetaEnv {
    readonly [publicVariable: `PUBLIC_${string}`]: string;
    BASE_URL: string;
    MODE: string;
    DEV: boolean;
    PROD: boolean;
    SSR: boolean;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

declare module "lumen" {
  /**
   * Request-scoped values set by middleware (`ctx.locals`, `locals()`). Type them by augmenting:
   * `declare module "lumen" { interface Locals { user?: User } }`.
   */
  interface Locals {}
}
