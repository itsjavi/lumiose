// Context: values provided on an owner and injected anywhere below it (spec §4.3).
// Context lives on owners, so it survives `await` once the run's owner is restored.
import { injectUserContext, provideContext } from "./owner.ts";

export interface Context<T> {
  readonly id: symbol;
  readonly defaultValue: T;
}

export function createContext<T>(defaultValue: T): Context<T>;
export function createContext<T>(): Context<T | undefined>;
export function createContext<T>(defaultValue?: T): Context<T | undefined> {
  return { id: Symbol("lumiose.context"), defaultValue };
}

/** Provides `value` to the current owner and everything created under it. */
export function provide<T>(context: Context<T>, value: T): void {
  provideContext(context.id, value);
}

/**
 * The value provided by the nearest owner above, or the context's default. Islands start a new
 * root: they do not see context provided outside them, on the server as in the browser.
 */
export function inject<T>(context: Context<T>): T {
  return injectUserContext(context.id, context.defaultValue) as T;
}
