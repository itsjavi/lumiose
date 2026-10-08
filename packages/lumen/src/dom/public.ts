// Public client components and helpers re-exported from `lumen` (owner: Spark; spec §4.2-4.3).
// TODO(TASK-17): Suspense and ErrorBoundary.
import type { Component, Renderable } from "../contract/client.ts";
import { onCleanup } from "../core/owner.ts";
import { computed, signal } from "../core/signal.ts";
import type { JSX } from "../jsx/jsx-runtime.ts";
import { createComponent, restProps } from "./component.ts";
import { insert } from "./insert.ts";
import { spread } from "./spread.ts";

/**
 * Creates a ref for the `ref` prop: the runtime calls it with the element, and code reads it like
 * a signal (`input()`), which is `undefined` until the element exists.
 */
export function ref<T extends Element>(): JSX.Ref<T> {
  const element = signal<T | undefined>(undefined);
  return ((...args: [T?]): T | undefined | void =>
    args.length === 0 ? element() : element.set(args[0])) as JSX.Ref<T>;
}

export interface PortalProps {
  /** Where the content goes. Defaults to `document.body`. */
  mount?: Node;
  children?: Renderable;
}

/**
 * Renders `children` into a `<div>` appended to `mount`, removed with the owner. Delegated events
 * from the portal's content continue at the portal's position in the tree.
 */
export function Portal(props: PortalProps): Renderable {
  const marker = document.createTextNode("");
  const container = document.createElement("div");
  Object.defineProperty(container, "$$host", { get: () => marker.parentNode });
  insert(container, () => props.children);
  const mount = props.mount ?? document.body;
  mount.appendChild(container);
  onCleanup(() => container.remove());
  return marker;
}

export interface DynamicProps {
  /** A component, or an intrinsic tag name. Nothing renders while it is nullish or `false`. */
  component: Component<any> | string | null | undefined | false;
  [prop: string]: unknown;
}

function createElement(tag: string, props: Record<string, unknown>): Element {
  const el = document.createElement(tag);
  spread(el, () => props);
  insert(el, () => props.children as Renderable);
  return el;
}

/** Renders `component` with the other props, re-creating it only when `component` changes. */
export function Dynamic(props: DynamicProps): Renderable {
  const others = restProps(props, ["component"]) as Record<string, unknown>;
  const current = computed(() => props.component);
  return () => {
    const component = current();
    return !component
      ? null
      : typeof component === "string"
        ? createElement(component, others)
        : createComponent(component, others);
  };
}
