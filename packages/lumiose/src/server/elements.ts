// Server variants of `ref()`, `<Portal>` and `<Dynamic>` (client: ../dom/public.ts, spec §4.2-4.3).

import type { DynamicProps, PortalProps } from "../dom/public.ts";
import type { JSX } from "../jsx/jsx-runtime.ts";
import { spreadAttrs } from "./attrs.ts";
import { createComponent, type ServerComponent } from "./frame.ts";
import { escapeText, html, rawText, wrap, type Html } from "./node.ts";
import { insert, restProps } from "./ssr.ts";

export type { DynamicProps, PortalProps };

/**
 * Server `ref()`: elements never exist on the server, so the ref reads `undefined` and ignores
 * writes (the server runtime never calls refs).
 */
export function ref<T extends Element>(): JSX.Ref<T> {
  return (() => undefined) as JSX.Ref<T>;
}

/**
 * Server `<Portal>`: renders nothing, and does not evaluate its children. Portal content goes to a
 * node outside the component's place in the document (`document.body` by default), so it is
 * client-only: it renders when the enclosing island mounts or hydrates. Outside islands nothing
 * ever renders it.
 */
export function Portal(_props: PortalProps): null {
  return null;
}

/** Elements without a closing tag (the compiler's list, codegen/client/html.rs). */
const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);
// A tag name that cannot close the tag or start an attribute (`document.createElement` would throw).
const TAG_NAME = /^[A-Za-z][^\s"'<>/=\p{Cc}]*$/u;

function element(tag: string, props: Record<string, unknown>): Html {
  if (!TAG_NAME.test(tag)) {
    throw new TypeError(`<Dynamic component="${tag}">: "${tag}" is not a valid element name.`);
  }
  const open = `<${tag}${spreadAttrs(props)}>`;
  const name = tag.toLowerCase();
  if (VOID.has(name)) return open;
  // As on the client, `innerHTML`/`textContent` set the content and `children` are appended.
  const { innerHTML, textContent, children } = props;
  if (name === "script" || name === "style") {
    // Raw text, as the compiler writes a written `<script>` or `<style>`: the client sets it as
    // text (`innerHTML` included), and `rawText` keeps it from ending the element or, inside
    // `<svg>` or `<math>`, opening a tag (TASK-495).
    const json = name === "script" && isJsonScriptType(props.type);
    const own = rawText(innerHTML ?? textContent, name, json);
    const text = typeof children === "string" || typeof children === "number";
    const inner = text ? rawText(children, name, json) : (insert(children) as Html);
    return wrap(open + own, inner, `</${tag}>`);
  }
  const own =
    innerHTML != null
      ? String(innerHTML)
      : textContent != null
        ? escapeText(String(textContent))
        : "";
  return wrap(open + own, insert(children) as Html, `</${tag}>`);
}

/**
 * Whether a `<script type>` holds JSON, as the compiler's `is_json_script_type`: `…json` types,
 * import maps and speculation rules.
 */
function isJsonScriptType(type: unknown): boolean {
  if (typeof type !== "string") return false;
  const value = type.trim().toLowerCase();
  return value.endsWith("json") || value === "importmap" || value === "speculationrules";
}

/**
 * Server `<Dynamic>`: renders `component` with the other props, a component through
 * `createComponent` or an intrinsic tag name as an element (attributes as in a spread). Nothing
 * renders while `component` is nullish or `false`.
 */
export function Dynamic(props: DynamicProps): unknown {
  const component = props.component;
  if (!component) return null;
  const others = restProps(props, ["component"]) as Record<string, unknown>;
  return typeof component === "string"
    ? html(element(component, others))
    : createComponent(component as ServerComponent<Record<string, unknown>>, others);
}
