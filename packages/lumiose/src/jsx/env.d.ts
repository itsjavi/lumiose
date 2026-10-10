// `lumiose/env`: ambient types for Lumiose projects (owner: Beacon). Spec §4.7, §8 (Context, Env).
// Enabled with `"types": ["lumiose/env"]` in tsconfig.
import type { JSX as LumioseJSX } from "./jsx-runtime.ts";
// `.css`, `.svg`, `.md` and `.html` module patterns: script files, since this module cannot declare them.
import "./css-modules.d.ts";
import "./svg-modules.d.ts";
import "./content-modules.d.ts";

declare global {
  /** Global alias of `lumiose/jsx-runtime`'s `JSX`, for annotations such as `JSX.Element`. */
  namespace JSX {
    type Element = LumioseJSX.Element;
    type ElementType = LumioseJSX.ElementType;
    interface ElementChildrenAttribute extends LumioseJSX.ElementChildrenAttribute {}
    interface IntrinsicAttributes extends LumioseJSX.IntrinsicAttributes {}
    interface IntrinsicElements extends LumioseJSX.IntrinsicElements {}
    type ClassValue = LumioseJSX.ClassValue;
    interface CSSProperties extends LumioseJSX.CSSProperties {}
    type EventHandler<E, T> = LumioseJSX.EventHandler<E, T>;
    type Ref<T extends Element> = LumioseJSX.Ref<T>;
    interface HTMLProps<T extends HTMLElement> extends LumioseJSX.HTMLProps<T> {}
    interface SVGProps<T extends SVGElement> extends LumioseJSX.SVGProps<T> {}
    interface MathMLProps<T extends MathMLElement> extends LumioseJSX.MathMLProps<T> {}
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

declare module "lumiose" {
  /**
   * Request-scoped values set by middleware (`ctx.locals`, `locals()`). Type them by augmenting:
   * `declare module "lumiose" { interface Locals { user?: User } }`.
   */
  interface Locals {}
}
