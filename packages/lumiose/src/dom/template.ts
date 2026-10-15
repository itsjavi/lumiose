// `template(html, flags)`: parse once, clone per instance (contract doc-2 §2, spec §6.3).
import type { MultiRootTemplateFactory, TemplateFactory } from "../contract/client.ts";
import { hydrator } from "./hydration.ts";

// TemplateFlags (contract/client.ts), inlined so the flags object is not bundled.
const MULTI_ROOT = 1;
const SVG = 2;
const MATHML = 4;

/**
 * Parses minified `html` into a `<template>` (on first use, so importing a module never touches the
 * DOM) and returns a factory that clones its root, or all its roots with `MultiRoot`. `Svg` and
 * `MathMl` parse inside that namespace. `<!>` is parsed as an empty comment (a placeholder).
 */
export function template(html: string): TemplateFactory;
export function template(html: string, flags: number): TemplateFactory | MultiRootTemplateFactory;
export function template(html: string, flags = 0): TemplateFactory | MultiRootTemplateFactory {
  let source: Node | undefined;
  // Custom elements (a tag with a dash) are imported instead of cloned: those already defined
  // upgrade at once, so their properties exist before the bindings write them (TASK-326).
  const custom = /<\w+-/.test(html);
  const clone = (node: Node): Node =>
    custom ? document.importNode(node, true) : node.cloneNode(true);
  const parse = (): Node => {
    const t = document.createElement("template");
    t.innerHTML =
      flags & SVG ? `<svg>${html}</svg>` : flags & MATHML ? `<math>${html}</math>` : html;
    // Namespaced templates are wrapped: their roots are the wrapper's children.
    const content: Node = flags & (SVG | MATHML) ? t.content.firstChild! : t.content;
    return flags & MULTI_ROOT ? content : content.firstChild!;
  };
  return flags & MULTI_ROOT
    ? (): Node[] => {
        source ??= parse();
        const claimed = hydrator?.template(source, flags);
        return claimed !== undefined
          ? (claimed as Node[])
          : Array.from(clone(source).childNodes);
      }
    : (): Element => {
        source ??= parse();
        return (hydrator?.template(source, flags) ?? clone(source)) as Element;
      };
}
