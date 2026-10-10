// Context: a value provided by a `<Ctx value>` provider to everything rendered below it, read with
// `useContext(Ctx)` (spec §4.3). Context lives on owners, so it survives `await` once the run's
// owner is restored.
import type { Renderable } from "../contract/client.ts";
import { createOwner, getOwner, provideContext, readUserContext, runWithOwner } from "./owner.ts";

/** A context: a provider component (`<Ctx value={v}>…</Ctx>`) and the key of `useContext(Ctx)`. */
export interface Context<T> {
  (props: { value: T; children?: Renderable }): Renderable;
  readonly id: symbol;
  readonly defaultValue: T;
}

/**
 * Wraps the functions in `children` (content rendered later, such as `{() => items()}`) so that
 * each call runs under a new owner that provides the value: components created then see it,
 * although the call happens under the owner of the region that renders the provider's output.
 * The owner is a child of the calling one, so it is disposed with what the call rendered. Each
 * call gets its own owner, so siblings rendered by the same region never see the value.
 */
function bindChildren(key: symbol, value: unknown, children: Renderable): Renderable {
  if (typeof children === "function") {
    const fn = children;
    return () => {
      const owner = createOwner(getOwner());
      owner.context = { [key]: value };
      return bindChildren(key, value, runWithOwner(owner, fn));
    };
  }
  return Array.isArray(children)
    ? children.map((child: Renderable) => bindChildren(key, value, child))
    : children;
}

/**
 * Creates a context. Its provider reads `value` once, when it renders (components run once):
 * to share changing state, provide a signal, a store or an object with getters.
 */
export function createContext<T>(defaultValue: T): Context<T>;
export function createContext<T>(): Context<T | undefined>;
export function createContext<T>(defaultValue?: T): Context<T | undefined> {
  const id = Symbol();
  const context = ((props: { value: T | undefined; children?: Renderable }): Renderable => {
    const value = props.value;
    provideContext(id, value);
    return bindChildren(id, value, props.children);
  }) as Context<T | undefined> & { id: symbol; defaultValue: T | undefined };
  context.id = id;
  context.defaultValue = defaultValue;
  return context;
}

/**
 * The value of the nearest `<Ctx value>` provider above, or the context's default. Islands start
 * a new root: they do not see context provided outside them, on the server as in the browser.
 */
export function useContext<T>(context: Context<T>): T {
  return readUserContext(context.id, context.defaultValue) as T;
}
