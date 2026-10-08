// `lumen/jsx-runtime`: JSX types for `jsxImportSource: "lumen"` (owner: Beacon). Spec §4.7.
// Placeholder until TASK-6/Beacon define the full IntrinsicElements; compiled code never imports runtime values from here.
export namespace JSX {
  export type Element = unknown;
  export type ElementType = string | ((props: any) => Element | Promise<Element>);
  export interface ElementChildrenAttribute {
    children: {};
  }
  export interface IntrinsicAttributes {
    key?: string | number;
  }
  export interface IntrinsicElements {
    [tag: string]: Record<string, unknown>;
  }
}
