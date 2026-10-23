// Shell-first rendering (decision-19, spec §7.3-7.4): `renderToStream` resolves once everything
// outside `<Suspense>` has resolved, with the collected head; streamed boundaries follow, out of
// order, on `stream`.
//
// Chunk shapes:
//   head         …[<script type="module" async src="loader">] (with the shell's first island)
//   shell body   …HTML…[<script type="application/json" data-l-islands>[records]</script>]
//   placeholder  <?start name="lb3">fallback<?end>
//   first chunk  <script>$swap=…</script>        (once per response; nonce'd when configured)
//   each chunk   [<script type="module" async src="loader">][<link rel="modulepreload" href>…]
//                [<style>rules</style>]
//                <template for="lb3">HTML</template><script>$swap("lb3")</script>
//                [<script type="application/json" data-l-payload>{"s":{…},"c":{…}}</script>]
//                [<script type="application/json" data-l-islands>[records]</script>]
// Browsers with declarative partial updates apply `<template for>` natively and `$swap` finds
// nothing to do; elsewhere the `<?start>`/`<?end>` processing instructions parse as comments and
// `$swap` moves the template content into that range. A boundary nested in another one flushes
// only after its parent, so its placeholder always exists when its chunk arrives.
//
// The page payload (decision-33) precedes the island records of the shell and of each chunk: the
// scoped states (./state.ts) created so far and not sent yet, and the async cache entries that
// islands awaited (../app/cache/server.ts), once the page has islands, so the browser has them
// before any island in that chunk hydrates.

import { createOwner, disposeOwner } from "../core/internal.ts";
import { LUM_AFTER_SHELL, LumioseError } from "../app/diagnostics.ts";
import { isHttpError, isRedirect } from "../app/server/control.ts";
import {
  content,
  FAILED,
  FLUSHED,
  PENDING,
  READY,
  resolvesAll,
  resolveUnit,
  withFrame,
  type CaughtErrorInfo,
  type Frame,
  type IslandRecord,
  type RenderState,
  type Unit,
} from "./frame.ts";
import { escapeAttr, jsonForScript, type Html } from "./node.ts";
import type { RenderedShell, RenderToStreamOptions } from "./render-types.ts";
import { createStateScope, currentStateScope, encodeStates, runInStateScope } from "./state.ts";
import { encodeCache } from "../app/cache/server.ts";

export type { RenderedShell, RenderToStreamOptions };

/** `renderShell` options of the app layer (not public). */
export interface ShellOptions extends RenderToStreamOptions {
  /** `onError`, told whether the error belongs to a streamed boundary (after the shell). */
  onError?: (error: unknown, streamed?: boolean) => void;
  /**
   * Every error an `<ErrorBoundary>` caught, also outside production (instrumentation, decision-49).
   * Default: the sanitized ones go to `onError`, with their digest (decision-29).
   */
  onCaughtError?: (error: unknown, info: CaughtErrorInfo) => void;
  /** Each streamed boundary, with a promise that settles once its content is ready or failed. */
  onBoundary?: (settled: Promise<unknown>) => void;
  /**
   * Whether the response still streams (`response().setStreaming()`, decision-58), read at each
   * boundary and when the shell completes: once false, boundaries render into the shell, and those
   * already streaming are waited for and inlined. Ignored with `resolveAll`.
   */
  streaming?: () => boolean;
  /**
   * `lumiose({ streamTimeout })` in milliseconds (decision-58): once it expires, async component
   * runs still pending fail with LUM5009 (the nearest `<ErrorBoundary>` renders), then boundaries
   * still pending fail, and the response ends. Ignored with `resolveAll`.
   */
  streamTimeout?: number;
  /**
   * Dev (`lumiose dev`): whether client code reaches the scoped state `ref` (`<module>#<export>`).
   * Builds give ids only to such states, so they need no check.
   */
  isClientState?: (ref: string) => boolean;
}

/** A rendered shell whose island records are kept apart from its HTML (see `renderShell`). */
export interface ShellParts {
  head: string;
  /** The shell's HTML, without its island records. */
  html: string;
  /** The shell's island records script, or "". It must precede the stream, inside `<body>`. */
  records: string;
  stream: ReadableStream<string> | null;
}

// Minified; see the module comment. Removes the range between `<?start name=N>` and its `<?end>`
// (counting nested ranges), inserts the template's content there and drops the markers.
export const SWAP_SCRIPT =
  `$swap=function(n,d,t,w,s,e,k,v){d=document;t=d.querySelector('template[for="'+n+'"]');if(!t)return;` +
  `w=d.createTreeWalker(d,128);while((s=w.nextNode())&&s.data!='?start name="'+n+'"');if(!s)return;` +
  `for(k=0,e=s;e=e.nextSibling;)if(e.nodeType==8){v=e.data;if(!v.indexOf("?start"))k++;else if(v=="?end"&&!k--)break}` +
  `while(s.nextSibling!=e)s.nextSibling.remove();s.parentNode.insertBefore(t.content,e);s.remove();e&&e.remove();t.remove()}`;

/** Renders `root` shell-first. Resolves when the shell is ready; rejects with its first thrown value. */
export function renderToStream(
  root: () => unknown,
  options: RenderToStreamOptions = {},
): Promise<RenderedShell> {
  // The public `onError` gets the error alone (the shell's also says where it happened).
  const { onError } = options;
  const shellOptions =
    onError === undefined ? options : { ...options, onError: (error: unknown) => onError(error) };
  return renderShell(root, shellOptions).then(({ head, html, records, stream }) => ({
    head,
    body: html + records,
    stream,
  }));
}

/**
 * `renderToStream` for callers that place the records themselves: with a custom document the
 * shell is the whole document, so the records go before its body ends, not after `</html>`.
 */
export function renderShell(root: () => unknown, options: ShellOptions = {}): Promise<ShellParts> {
  const { signal } = options;
  if (signal?.aborted) return Promise.reject(signal.reason);
  // The request's state scope; a render outside a request gets one of its own.
  const active = currentStateScope();
  const states = active ?? createStateScope();
  const onError = options.onError ?? ((error: unknown) => console.error(error));
  const resolveAll = options.resolveAll === true;
  const render: RenderState = {
    resolveAll,
    streaming: resolveAll ? undefined : options.streaming,
    // Prerendering waits for everything (decision-58).
    streamTimeout: resolveAll ? undefined : options.streamTimeout,
    timeout: undefined,
    streamed: options.streaming === undefined || resolveAll ? undefined : [],
    nonce: options.nonce,
    strictStyles: options.strictStyles === true,
    moduleUrl: options.islandUrl ?? ((specifier) => specifier),
    loaderUrl: options.loaderUrl,
    loaderSent: false,
    sentScripts: new Set(),
    onError,
    onCaughtError:
      options.onCaughtError ??
      ((error, { digest, streamed }) => {
        if (digest !== undefined) onError(error, streamed);
      }),
    onBoundary: options.onBoundary,
    sanitizeErrors: options.sanitizeErrors === true,
    owner: createOwner(undefined),
    shell: createUnit(undefined),
    shellDone: false,
    done: false,
    nextIsland: 0,
    nextBoundary: 0,
    nextStyle: 0,
    styleRules: new Map(),
    title: undefined,
    metas: new Map(),
    head: [],
    pending: 0,
    emit: undefined,
    close: undefined,
    swapSent: false,
    states,
    sentStates: new Set(),
    sentCache: new Set(),
    isClientState: options.isClientState,
    hydrates: false,
    idPrefix: options.idPrefix ?? "",
  };
  const frame: Frame = {
    render,
    unit: render.shell,
    island: undefined,
    path: "",
    children: 0,
    occurrences: undefined,
    streamed: false,
  };
  let body: Html;
  const run = (): Html => withFrame(frame, render.owner, () => content(root()));
  try {
    body = active === undefined ? runInStateScope(states, run) : run();
  } catch (error) {
    finish(render);
    return Promise.reject(error);
  }
  return new Promise<ShellParts>((resolve, reject) => {
    const abort = () => {
      finish(render);
      reject(signal!.reason);
    };
    signal?.addEventListener("abort", abort, { once: true });
    Promise.resolve(body).then(
      (html) => {
        signal?.removeEventListener("abort", abort);
        const failed = (error: unknown) => {
          // LUM4011: a scoped state the page sends holds a value that is not plain data.
          finish(render);
          reject(error);
        };
        if (render.pending > 0 && resolvesAll(render)) {
          // `setStreaming(false)` after boundaries started streaming: one document with them inlined.
          inlineBoundaries(render, html, signal).then(resolve, failed);
          return;
        }
        try {
          resolve(completeShell(render, html, signal));
        } catch (error) {
          failed(error);
        }
      },
      (error: unknown) => {
        signal?.removeEventListener("abort", abort);
        finish(render);
        reject(error);
      },
    );
  });
}

/** Renders everything resolved (no fallbacks or stream) and returns the body HTML. */
export async function renderToString(
  root: () => unknown,
  options: Omit<RenderToStreamOptions, "resolveAll"> = {},
): Promise<string> {
  return (await renderToStream(root, { ...options, resolveAll: true })).body;
}

function completeShell(render: RenderState, html: string, signal?: AbortSignal): ShellParts {
  render.shellDone = true;
  const shell = render.shell;
  const head = headHtml(render) + unitAssets(render, shell);
  const records = statePayload(render, shell) + islandRecords(shell);
  if (render.pending === 0) {
    finish(render);
    return { head, html, records, stream: null };
  }
  const stream = new ReadableStream<string>({
    start(controller) {
      render.emit = (chunk) => controller.enqueue(chunk);
      render.close = () => {
        if (render.done) return;
        finish(render);
        controller.close();
      };
      shell.state = FLUSHED;
      flushWaiting(render, shell);
    },
    cancel() {
      finish(render);
    },
  });
  // A disconnected client ends the stream quietly; `getAbortSignal()` aborts pending work.
  signal?.addEventListener("abort", () => render.close?.(), { once: true });
  return { head, html, records, stream };
}

/**
 * The shell of a render whose response stopped streaming while boundaries were already streaming
 * (`setStreaming(false)` in a page, decision-58): waits for every boundary, then puts each one's
 * content in place of its placeholder, as a synchronous boundary renders. A failed boundary keeps
 * its fallback, as in a streamed response.
 */
async function inlineBoundaries(
  render: RenderState,
  html: string,
  signal: AbortSignal | undefined,
): Promise<ShellParts> {
  const streamed = render.streamed!;
  let abort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(signal!.reason);
    signal?.addEventListener("abort", abort, { once: true });
  });
  try {
    // Boundaries inside streaming ones register while those render: wait until none is left.
    for (let seen = 0; seen < streamed.length;) {
      const settled = streamed.slice(seen).map((boundary) => boundary.settled);
      seen = streamed.length;
      await Promise.race([Promise.all(settled), aborted]);
    }
  } finally {
    signal?.removeEventListener("abort", abort!);
  }
  const out = inline(render, html);
  render.pending = 0;
  render.shell.waiting = [];
  return completeShell(render, out, signal);
}

const RANGE_START = '<?start name="lb';
const RANGE_END = "<?end>";

/** `html` with each placeholder of a ready boundary replaced by its (inlined) content. */
function inline(render: RenderState, html: string): string {
  let out = "";
  let at = 0;
  for (let start = html.indexOf(RANGE_START); start >= 0; start = html.indexOf(RANGE_START, at)) {
    const open = html.indexOf('">', start) + 2;
    const end = open < 2 ? -1 : rangeEnd(html, open);
    if (end < 0) break;
    const unit = render.streamed![Number(html.slice(start + RANGE_START.length, open - 2))]?.unit;
    out += html.slice(at, start);
    if (unit?.state === READY) {
      foldUnit(render, unit);
      out += inline(render, unit.html);
    } else {
      out += html.slice(start, open) + inline(render, html.slice(open, end)) + RANGE_END;
    }
    at = end + RANGE_END.length;
  }
  return out + html.slice(at);
}

/** Where the range whose content starts at `from` ends (`<?end>`), past nested ranges; -1 if open. */
function rangeEnd(html: string, from: number): number {
  let depth = 0;
  for (let at = from; ;) {
    const end = html.indexOf(RANGE_END, at);
    if (end < 0) return -1;
    const start = html.indexOf("<?start ", at);
    if (start >= 0 && start < end) {
      depth++;
      at = start + 1;
    } else if (depth === 0) {
      return end;
    } else {
      depth--;
      at = end + RANGE_END.length;
    }
  }
}

/** Ends the render: disposes the root owner (cleanups run, `getAbortSignal()` aborts). */
function finish(render: RenderState): void {
  if (render.done) return;
  render.done = true;
  render.timeout?.cancel();
  try {
    disposeOwner(render.owner);
  } catch (error) {
    render.onError(error, render.shellDone);
  }
}

// --- Head --------------------------------------------------------------------------------------

function headHtml(render: RenderState): string {
  let out = render.title?.html ?? "";
  for (const meta of render.metas.values()) out += meta.html;
  return out + render.head.join("");
}

function unitAssets(render: RenderState, unit: Unit): string {
  let out = "";
  if (!render.loaderSent && render.loaderUrl !== undefined && unit.islands.length > 0) {
    render.loaderSent = true;
    out += `<script type="module" async src="${escapeAttr(render.loaderUrl)}"${nonceAttr(render)}></script>`;
  }
  for (const url of unit.scripts) {
    // A boundary streamed earlier may have sent it already.
    if (render.sentScripts.has(url)) continue;
    render.sentScripts.add(url);
    out += `<script type="module" async src="${escapeAttr(url)}"${nonceAttr(render)}></script>`;
  }
  for (const url of unit.preloads) {
    out += `<link rel="modulepreload" href="${escapeAttr(url)}"${nonceAttr(render)}>`;
  }
  if (unit.styles.length > 0) out += `<style${nonceAttr(render)}>${unit.styles.join("")}</style>`;
  for (const rule of unit.isolatedStyles) out += `<style${nonceAttr(render)}>${rule}</style>`;
  return out;
}

function nonceAttr(render: RenderState): string {
  return render.nonce === undefined ? "" : ` nonce="${escapeAttr(render.nonce)}"`;
}

function script(render: RenderState, code: string): string {
  return `<script${nonceAttr(render)}>${code}</script>`;
}

// --- Units -------------------------------------------------------------------------------------

export function createUnit(parent: Unit | undefined): Unit {
  return {
    id: -1,
    parent,
    merged: undefined,
    state: PENDING,
    html: "",
    islands: [],
    awaits: undefined,
    preloads: [],
    scripts: [],
    styles: [],
    isolatedStyles: [],
    waiting: [],
  };
}

/** A boundary that resolved synchronously renders inline: its records move to the parent unit. */
export function foldUnit(render: RenderState, unit: Unit): void {
  const target = resolveUnit(unit.parent!);
  unit.merged = target;
  target.islands.push(...unit.islands);
  if (unit.awaits !== undefined) {
    for (const [island, records] of unit.awaits) {
      if (resolveUnit(island.unit) === target)
        Object.assign((island.record.awaits ??= {}), records);
      else {
        const awaits = (target.awaits ??= new Map());
        awaits.set(island, Object.assign(awaits.get(island) ?? {}, records));
      }
    }
  }
  for (const url of unit.preloads) addPreload(render, target, url);
  for (const url of unit.scripts) if (!target.scripts.includes(url)) target.scripts.push(url);
  target.styles.push(...unit.styles);
  target.isolatedStyles.push(...unit.isolatedStyles);
  target.waiting.push(...unit.waiting);
}

export function addPreload(render: RenderState, unit: Unit, url: string): void {
  if (!unit.preloads.includes(url) && !render.shell.preloads.includes(url)) unit.preloads.push(url);
}

/** Registers a streamed boundary whose content is `html`; returns its name for the placeholder. */
export function streamBoundary(render: RenderState, unit: Unit, html: Promise<string>): string {
  const id = (unit.id = render.nextBoundary++);
  render.pending++;
  render.onBoundary?.(html);
  const settled = html.then(
    (value) => {
      if (render.done) return;
      unit.html = value;
      unit.state = READY;
      const parent = resolveUnit(unit.parent!);
      if (parent.state === FLUSHED && render.emit !== undefined) flush(render, unit);
      else if (parent.state === FAILED) drop(render, unit);
      else parent.waiting.push(unit);
    },
    (error: unknown) => {
      if (render.done) return;
      render.onError(boundaryError(error), true);
      drop(render, unit);
    },
  );
  render.streamed?.push({ unit, settled });
  return `lb${id}`;
}

function flush(render: RenderState, unit: Unit): void {
  let payload: string;
  try {
    payload = statePayload(render, unit);
  } catch (error) {
    // LUM4011: the boundary keeps its fallback, as when its content fails.
    render.onError(error, true);
    drop(render, unit);
    return;
  }
  let chunk = "";
  if (!render.swapSent) {
    render.swapSent = true;
    chunk += script(render, SWAP_SCRIPT);
  }
  const name = `lb${unit.id}`;
  chunk +=
    unitAssets(render, unit) +
    `<template for="${name}">${unit.html}</template>` +
    script(render, `$swap("${name}")`) +
    payload +
    islandRecords(unit);
  unit.state = FLUSHED;
  unit.html = "";
  render.pending--;
  render.emit!(chunk);
  flushWaiting(render, unit);
  if (render.pending === 0) render.close?.();
}

function flushWaiting(render: RenderState, unit: Unit): void {
  const waiting = unit.waiting;
  unit.waiting = [];
  for (const child of waiting) flush(render, child);
}

/** A failed boundary keeps its fallback; boundaries inside it can never be placed. */
function drop(render: RenderState, unit: Unit): void {
  unit.state = FAILED;
  render.pending--;
  const waiting = unit.waiting;
  unit.waiting = [];
  for (const child of waiting) drop(render, child);
  if (render.pending === 0 && render.emit !== undefined) render.close?.();
}

/**
 * The page payload of a chunk (decision-33): the scoped states created so far and not sent yet
 * (`s`), and the async cache entries islands awaited (`c`), once the page has islands (nothing in
 * the browser reads them before). Throws LUM4011 and LUM4007.
 */
function statePayload(render: RenderState, unit: Unit): string {
  if (unit.islands.length > 0) render.hydrates = true;
  if (!render.hydrates) return "";
  const states = encodeStates(render.states, render.sentStates, render.isClientState);
  const cache = encodeCache(render.states.cache, render.sentCache);
  if (states === undefined && cache === undefined) return "";
  return `<script type="application/json" data-l-payload>${jsonForScript({ s: states, c: cache })}</script>`;
}

function islandRecords(unit: Unit): string {
  const records: Array<IslandRecord | { id: number; awaits: Record<string, unknown> }> =
    unit.islands.map((island) => island.record);
  if (unit.awaits !== undefined) {
    for (const [island, awaits] of unit.awaits) records.push({ id: island.id, awaits });
  }
  if (records.length === 0) return "";
  return `<script type="application/json" data-l-islands>${jsonForScript(records)}</script>`;
}

/** Redirects and HTTP errors cannot change the response once the shell was sent (decision-19). */
export function boundaryError(error: unknown): unknown {
  if (!isRedirect(error) && !isHttpError(error)) return error;
  const what = isRedirect(error) ? "redirect()" : "notFound()/error()";
  return Object.assign(
    new LumioseError(
      LUM_AFTER_SHELL,
      `${what} was called inside a streamed <Suspense> boundary, after the response status was sent. Call it outside <Suspense> so it runs while the shell renders`,
    ),
    { cause: error },
  );
}
