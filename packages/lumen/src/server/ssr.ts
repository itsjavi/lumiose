// Template concatenation and dynamic content helpers for compiled server code (contract doc-2 §3).
// Hydration markers are emitted only inside island subtrees (spec §7.4):
//   insert  <!--[-->…<!--]-->
//   list    <!--[-->rows<!--]-->
//   branch  <!--[-->active<!--]--> when the condition holds, <!--[!-->else<!--]--> otherwise
//   text    <!--!--> between two adjacent text() holes (an empty static part between them)

import type { SSROutput } from "../contract/server.ts";
import { content, currentFrame } from "./frame.ts";
import { escapeText, html, isThenable, join, SSRHtml, TextHole, wrap, type Html } from "./node.ts";

/**
 * Interleaves hoisted static `parts` with `holes`. Sync unless a hole is a thenable; then it
 * returns a promise and resolves the holes concurrently, preserving their order.
 */
export function ssr(parts: readonly string[], ...holes: unknown[]): SSROutput {
  const island = currentFrame()?.island !== undefined;
  let out = parts[0]!;
  for (let i = 0; i < holes.length; i++) {
    const hole = holes[i];
    if (typeof hole === "string") {
      out += hole;
    } else if (hole instanceof SSRHtml) {
      if (island && separated(parts, holes, i)) out += "<!--!-->";
      out += hole.t;
    } else if (hole != null && typeof hole !== "boolean") {
      if (isThenable(hole)) return ssrAsync(parts, holes, i, out, island);
      const value = content(hole);
      if (typeof value !== "string") return ssrAsync(parts, holes, i, out, island, value);
      out += value;
    }
    out += parts[i + 1]!;
  }
  return new SSRHtml(out);
}

function ssrAsync(
  parts: readonly string[],
  holes: readonly unknown[],
  from: number,
  prefix: string,
  island: boolean,
  rendered?: Html,
): Promise<SSRHtml> {
  const pieces: Html[] = [prefix];
  for (let i = from; i < holes.length; i++) {
    if (island && separated(parts, holes, i)) pieces.push("<!--!-->");
    const hole = holes[i];
    if (i === from && rendered !== undefined) pieces.push(rendered);
    else pieces.push(isThenable(hole) ? Promise.resolve(hole).then(holeHtml) : holeHtml(hole));
    pieces.push(parts[i + 1]!);
  }
  return Promise.all(pieces).then((all) => new SSRHtml(all.join("")));
}

function holeHtml(hole: unknown): Html {
  if (typeof hole === "string") return hole;
  if (hole instanceof SSRHtml) return hole.t;
  if (hole == null || typeof hole === "boolean") return "";
  if (isThenable(hole)) return Promise.resolve(hole).then(holeHtml);
  return content(hole);
}

function separated(parts: readonly string[], holes: readonly unknown[], i: number): boolean {
  return (
    i > 0 && parts[i] === "" && holes[i] instanceof TextHole && holes[i - 1] instanceof TextHole
  );
}

/** Escaped text at a fixed text position. Inside islands it is a `TextHole` (see `ssr`). */
export function text(value: unknown): unknown {
  let out: string;
  if (typeof value === "string") out = escapeText(value);
  else if (value == null || typeof value === "boolean") out = "";
  else if (typeof value === "function") return text((value as () => unknown)());
  else out = escapeText(String(value));
  return currentFrame()?.island !== undefined ? new TextHole(out) : out;
}

/** Dynamic content at a `<!>` position: text, nodes, arrays, getters, promises. */
export function insert(value: unknown): unknown {
  const out = content(value);
  return currentFrame()?.island !== undefined ? wrap("<!--[-->", out, "<!--]-->") : out;
}

/** Server rendering of a compiled `.map()`: rows joined in order, async rows resolved concurrently. */
export function list<T>(
  source: readonly T[] | null | undefined,
  render: (item: T, index: () => number) => unknown,
): unknown {
  const island = currentFrame()?.island !== undefined;
  const length = source == null ? 0 : source.length;
  const indexed = render.length > 1;
  // Rows concatenate directly; from the first async row on, the rest are collected and joined.
  let out = "";
  let rows: Html[] | undefined;
  for (let i = 0; i < length; i++) {
    const row = content(render(source![i]!, indexed ? () => i : (undefined as never)));
    if (rows !== undefined) rows.push(row);
    else if (typeof row === "string") out += row;
    else rows = [out, row];
  }
  const all = rows === undefined ? out : join(rows);
  return html(island ? wrap("<!--[-->", all, "<!--]-->") : all);
}

/** Server branch: renders one side once. */
export function branch(cond: unknown, whenTrue: () => unknown, whenFalse?: () => unknown): unknown {
  const island = currentFrame()?.island !== undefined;
  const active = typeof cond === "function" ? (cond as () => unknown)() : cond;
  if (active) {
    const out = content(whenTrue());
    return html(island ? wrap("<!--[-->", out, "<!--]-->") : out);
  }
  const out = whenFalse === undefined ? "" : content(whenFalse());
  return html(island ? wrap("<!--[!-->", out, "<!--]-->") : out);
}

/**
 * A branch side the compiled code already chose and rendered, without closures (TASK-78):
 * `cond ? branchArm(true, a) : branchArm(false, b)`. Same markers as `branch`.
 */
export function branchArm(active: boolean, out?: unknown): unknown {
  const value = content(out);
  if (currentFrame()?.island === undefined) return html(value);
  return html(wrap(active ? "<!--[-->" : "<!--[!-->", value, "<!--]-->"));
}

/** Same semantics as the client helper, evaluated once. */
export function selector<T>(source: () => T): (key: T) => boolean {
  const selected = source();
  return (key) => key === selected;
}

/** `props` without `keys`, keeping getters lazy. */
export function restProps<P extends object, K extends keyof P>(
  props: P,
  keys: readonly K[],
): Omit<P, K> {
  const out = {} as Omit<P, K>;
  const descriptors = Object.getOwnPropertyDescriptors(props);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (!(keys as readonly PropertyKey[]).includes(key)) {
      Object.defineProperty(out, key, descriptors[key as keyof typeof descriptors]!);
    }
  }
  return out;
}

/** Merges props like object spread (the last source with a key wins), keeping getters lazy. Same as the client. */
export function mergeProps<P extends object>(...sources: P[]): P {
  const out = {} as P;
  for (const source of sources) {
    if (source != null) Object.defineProperties(out, Object.getOwnPropertyDescriptors(source));
  }
  return out;
}
