// Compiler-runtime contract: server side (owner: Lux; see backlog doc-2 "Compiler-runtime contract").
// Compiled server output imports exactly these names from `lumiose/server`. The runtime in
// `src/server/index.ts` must satisfy `ServerRuntime` (checked in src/contract/contract.test.ts).

import type { Component } from "./client.ts";

/** Already-escaped HTML produced by the server runtime. Plain strings are always treated as text. */
export interface SSRNode {
  readonly t: string;
}

/** Output of server rendering functions: sync when possible, a promise when a hole was async. */
export type SSROutput = SSRNode | Promise<SSRNode>;

/** Island hydration strategies (`client:*`). */
export type IslandStrategy = "load" | "idle" | "visible" | "media" | "only";

export interface ServerRuntime {
  /**
   * Concatenates static template parts (hoisted, already escaped, minified, with scope tokens) with
   * holes. Holes must be produced by the helpers below (`text`, `insert`, `attr`, components…).
   * Sync-first: returns an SSRNode unless some hole is a thenable, then a promise.
   */
  ssr(parts: readonly string[], ...holes: unknown[]): SSROutput;
  /**
   * The class of the runtime's rendered HTML: every `SSRNode` the runtime creates is an
   * `SSRHtml` instance. Compiled templates inline `ssr()`'s synchronous outcome: when
   * every hole is an HTML string or (for `list` and `branch` holes) an `SSRHtml`, they return
   * `new SSRHtml(concatenation)`; otherwise they call `ssr()` with the same holes.
   */
  SSRHtml: new (html: string) => SSRNode;
  /** Escaped text content at a fixed text position; emits a `<!--!-->` separator when hydrating and adjacent to other dynamic text. */
  text(value: unknown): unknown;
  /** Dynamic content at a `<!>` placeholder position: renders value (text, nodes, arrays, components); wraps it in `<!--[-->…<!--]-->` only inside island subtrees. */
  insert(value: unknown): unknown;
  /** A child that may be text, at a template text position (the client's `insertText`): text, nullish and booleans render like `text()`, anything else like `insert()`. */
  insertText(value: unknown): unknown;
  /** A dynamic item of an array of renderables (fragments, component children; the client's `insertValue`): `insert()`, returned as markup the array renders as is. */
  insertValue(value: unknown): unknown;
  /** One attribute: ` name="escaped"`, ` name` for true, "" for null/undefined/false. */
  attr(name: string, value: unknown): string;
  /** ` class="…"` from string | array | object. */
  classAttr(value: unknown): string;
  /** ` style="…"` from string | object (kebab-case keys, custom properties); in `csp: "strict"` mode emits a `data-l-v` hook and records a nonce'd rule instead. */
  styleAttr(value: unknown): string;
  /** `lumiose({ csp: "strict" })`: ` nonce="…"` with the response's CSP nonce for a JSX `<script>`/`<style>`, "" without one. */
  nonceAttr(): string;
  /** Attribute spread for `{...props}` on elements. */
  spreadAttrs(props: Record<string, unknown>): string;
  /** Escapes a value for text (`&`, `<`) or double-quoted attribute (`&`, `"`) context. */
  escape(value: unknown, attribute?: boolean): string;
  /**
   * The text of a `<script>` or `<style>` (`tag`), not HTML-escaped: the character after a `<`
   * that could open a tag, an end tag or a comment is escaped (`<\u0062`, `<\62 `, `<\/`, `<\!`,
   * `<\?`), and in a JSON script (`json`) every `<` is `\u003c` (TASK-495). Nullish and booleans
   * render nothing.
   */
  rawText(value: unknown, tag: string, json?: boolean): string;

  /** Server list rendering for compiled `.map()`; emits block markers only inside islands. */
  list<T>(
    source: readonly T[] | null | undefined,
    render: (item: T, index: () => number) => unknown,
  ): unknown;
  /** Server branch; emits `<!--[-->` / `<!--[!-->` markers only inside islands. */
  branch(cond: unknown, whenTrue: () => unknown, whenFalse?: () => unknown): unknown;
  /** The side of a branch that compiled code already chose and rendered, `cond ? branchArm(true, a) : branchArm(false, b)`: no closures; the same markers as `branch`. */
  branchArm(active: boolean, out?: unknown): unknown;
  /** Same semantics as the client helper, evaluated once. */
  selector<T>(source: () => T): (key: T) => boolean;

  /** Runs a component in a lightweight context frame (no reactive graph). Async components return a promise. */
  createComponent<P>(component: Component<P>, props: P): unknown;
  restProps<P extends object, K extends keyof P>(props: P, keys: readonly K[]): Omit<P, K>;
  mergeProps<P extends object>(...sources: P[]): P;

  /**
   * Island call site for `<X client:… />`. `ref` is "<module specifier>#<export>". Renders X inside
   * `<!--l:ID-->…<!--/l:ID-->` (except `only`, which renders slots only), serializes props
   * (data-only; LUM4002 otherwise), renders `slots` into `<template data-l-slot>` and queues the record.
   */
  island<P>(
    ref: string,
    component: Component<P>,
    props: P,
    strategy: IslandStrategy,
    strategyValue?: string,
    slots?: Record<string, () => unknown>,
  ): unknown;

  /**
   * Server `$await`, same shape as the client: `(await $await(() => e, site))()`. Awaits the thunk;
   * inside an island records the value under its replay key; the resume function restores the
   * context frame.
   */
  $await<T>(thunk: () => T | PromiseLike<T>, site: number): Promise<() => Awaited<T>>;
  /** `finally { $leave() }` around async component bodies; leaves the context frame. */
  $leave(): void;
  /** Wraps an async component definition (emitted by the compiler) so `createComponent` takes the async path without bundling it otherwise. */
  $async<C extends Component<any>>(component: C): C;
}
