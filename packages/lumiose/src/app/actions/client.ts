// Form action helpers for the browser (spec §8 Actions, decision-18). `submit()` posts to a page
// action with the JSON protocol (./protocol.ts); `isSubmitting()` and `actionData()` expose its
// state as signals; `submission()` keeps that state per component instance (decision-51);
// `invalidate()` refreshes server data after a mutation. Navigation is MPA (a full page load)
// unless the SPA router (TASK-25) installs its hooks with setClientNavigation().

import { beginBusy } from "../../core/internal.ts";
import { onCleanup } from "../../core/owner.ts";
import { signal, type Signal } from "../../core/signal.ts";
import { decodeData } from "../../server/serialize.ts";
import { invalidateEntries, settled } from "../cache/client.ts";
import { fetchError, FetchError, readBody } from "../fetch-json.ts";
import { navigation } from "./navigation.ts";
import {
  ACTION_HEADER,
  actionName,
  type ActionResponseBody,
  type ActionResult,
} from "./protocol.ts";
import type { ActionData, ActionFailureData, ActionsExport, ActionSuccessData } from "./types.ts";
import { INSTRUMENTED, instrument, notify } from "../../dom/instrument.ts";

/** What `submit()` posts: a form, its submit event (`onSubmit={submit}`), or the fields. */
export type SubmitTarget =
  | HTMLFormElement
  | Event
  | FormData
  | URLSearchParams
  | Record<string, string | Blob | readonly (string | Blob)[]>;

export interface SubmitOptions {
  /**
   * Where to post: a URL, or `?/name` for a named action of the current page. Default: the
   * submitter's `formaction`, else the form's `action`, else the current URL (the default action).
   */
  action?: string;
  /** Default `POST`. A form must say `method="post"`, as the no-JS form it enhances does. */
  method?: string;
  /** Aborts the request. */
  signal?: AbortSignal;
  /**
   * What to refresh after a `success` result, before resolving (decision-20): `true` (the default)
   * refreshes the whole page with `invalidate()` on client-routed (SPA) pages, `false` keeps the
   * page as it is, and a list of targets (URLs and `query()` keys, as for `invalidate()`) refetches
   * only those, on SPA and MPA pages alike. MPA pages never refresh as a whole on their own (that
   * would reload): call `invalidate()` yourself.
   */
  invalidate?: boolean | readonly (string | readonly unknown[])[];
}

export { setClientNavigation, type ClientNavigation } from "./navigation.ts";

/** The action name of each submission in flight ("" for default actions). */
const inFlight = signal<readonly string[]>([]);
let data: Signal<unknown> | undefined;

/** Created on first read, from the data the server embedded when it re-rendered after a post. */
function dataSignal(): Signal<unknown> {
  return (data ??= signal(embeddedActionData()));
}

function embeddedActionData(): unknown {
  if (typeof document === "undefined") return undefined;
  const json = document.querySelector("script[data-l-action]")?.textContent;
  return json ? decodeData(JSON.parse(json)) : undefined;
}

/**
 * The data of the last action result: what the action returned, or its `fail()` data. Reactive.
 * After a no-JS form post it starts with the data the page was rendered with.
 */
export function actionData(): unknown;
/**
 * Typed by the page's actions: `actionData<typeof actions>()` (or `typeof action`) is the data an
 * action returned or passed to `fail()`, or `undefined` before a submission.
 */
export function actionData<A extends ActionsExport>(): ActionData<A> | undefined;
export function actionData(): unknown {
  return dataSignal()();
}

/** Whether a `submit()` is in flight; with a name, one to that named action (`?/name`). Reactive. */
export function isSubmitting(name?: string): boolean {
  const names = inFlight();
  return name === undefined ? names.length > 0 : names.includes(name);
}

/**
 * Posts a form to its page action without a page load, and resolves with the action result:
 * `success` and `failure` (`fail()`) set `actionData()`, `redirect` navigates. On client-routed
 * (SPA) pages, after a `success` it runs `invalidate()` and resolves once the page's data is fresh
 * (opt out with `{ invalidate: false }`). On MPA pages it never reloads: islands update themselves
 * from the result, or call `invalidate()` explicitly. Rejects only for unexpected errors, with a `FetchError`: the action
 * throws, the response is an error, or the network fails (status 0). Pass it the submit event to
 * enhance a form: `<form method="post" action="?/create" onSubmit={submit}>`.
 */
export function submit(target: SubmitTarget, options?: SubmitOptions): Promise<ActionResult>;
/** Typed by the action it posts to: `submit<typeof actions.save>(event)`. */
export function submit<A extends ActionsExport>(
  target: SubmitTarget,
  options?: SubmitOptions,
): Promise<ActionResult<ActionSuccessData<A>, ActionFailureData<A>>>;
export function submit(target: SubmitTarget, options: SubmitOptions = {}): Promise<ActionResult> {
  return post(target, options, true);
}

/** `submit()`; `pageData`: whether its result becomes `actionData()` (not for `submission()`). */
/** Instrumented builds: the `post()` being started is already inside its `submit` wrappers. */
let observed = false;

async function post(
  target: SubmitTarget,
  options: SubmitOptions,
  pageData: boolean,
): Promise<ActionResult> {
  const { form, submitter, body } = readTarget(target);
  const method = (
    options.method ??
    submitter?.getAttribute("formmethod") ??
    form?.method ??
    "post"
  ).toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "DIALOG") {
    throw new TypeError(
      `submit() posts to form actions, so the form needs method="post" (got ${method.toLowerCase()}).`,
    );
  }
  const url = new URL(
    options.action ?? submitter?.getAttribute("formaction") ?? form?.getAttribute("action") ?? "",
    document.baseURI,
  );
  const name = actionName(url) ?? "";
  if (INSTRUMENTED && !observed) {
    // src/instrumentation.client.ts (decision-49): this post again, inside the `submit` wrappers
    // (`observed` until its first await), and `onError` for a rejection other than an abort.
    const sent = instrument("submit", { action: name, url: url.href }, () => {
      observed = true;
      try {
        return post(target, options, pageData);
      } finally {
        observed = false;
      }
    });
    sent.catch((error: unknown) => {
      if ((error as { name?: unknown } | null)?.name !== "AbortError") notify(error, "submit");
    });
    return sent;
  }
  inFlight.update((names) => [...names, name]);
  // Counts toward the app-wide isBusy() summary while in flight (decision-20).
  const endBusy = beginBusy();
  let result: ActionResult;
  try {
    const response = await fetch(url, {
      method,
      body,
      headers: { accept: "application/json", [ACTION_HEADER]: "1" },
      signal: options.signal,
    }).catch((error: unknown) => {
      throw networkError(error, url.href);
    });
    result = await readResult(response, url.href);
    if (result.type === "redirect") await navigation.navigate(result.location);
    else if (pageData) dataSignal().set(result.data);
  } finally {
    endBusy();
    inFlight.update((names) => names.toSpliced(names.indexOf(name), 1));
  }
  // After the submission left isBusy(): invalidate() resolves once nothing is in flight.
  // MPA pages only reload on an explicit invalidate() (decision-20 amendment).
  const targets = options.invalidate;
  if (result.type === "success") {
    if (Array.isArray(targets)) {
      if (targets.length > 0) await invalidate(...targets);
    } else if (navigation.clientRouted && targets !== false) {
      await invalidate();
    }
  }
  return result;
}

/** A settled `success` or `failure` result: what `Submission.result()` holds. */
export type SubmissionResult<Data = unknown, Failure = unknown> = Exclude<
  ActionResult<Data, Failure>,
  { type: "redirect" }
>;

/**
 * The submissions of one component instance to a page action (`submission()`, decision-51): its
 * own pending state, result and error, so rows of a list that post the same action do not share
 * them.
 */
export interface Submission<Data = unknown, Failure = unknown> {
  /**
   * Posts like `submit()`, and returns its promise, after aborting this handle's submission in
   * flight. What it rejects with is also in `error()` (or, for an abort, nowhere): an unawaited
   * call (`onSubmit={handle.submit}`) reports no unhandled rejection.
   */
  submit(target: SubmitTarget, options?: SubmitOptions): Promise<ActionResult<Data, Failure>>;
  /** Whether this handle's submission is in flight. Reactive. */
  isSubmitting(): boolean;
  /** The last settled result, `success` or `failure` (`fail()`); `undefined` before. Reactive. */
  result(): SubmissionResult<Data, Failure> | undefined;
  /** The last unexpected error (a `FetchError`), until the next result or `reset()`. Reactive. */
  error(): FetchError | undefined;
  /** Cancels the submission in flight, if any: the handle is idle at once. */
  abort(): void;
  /** Clears `result()` and `error()`. */
  reset(): void;
}

/**
 * A handle for this component's own submissions to a page action (decision-51): `submit()`,
 * `isSubmitting()`, `result()`, `error()`, `abort()` and `reset()`. Call it during component setup;
 * disposing the component aborts its submission in flight. It does not set `actionData()`, and
 * `isSubmitting(name)` still counts it. Typed by the action: `submission<typeof actions.toggle>()`.
 */
export function submission(): Submission;
export function submission<A extends ActionsExport>(): Submission<
  ActionSuccessData<A>,
  ActionFailureData<A>
>;
export function submission(): Submission {
  const pending = signal(false);
  const result = signal<SubmissionResult | undefined>(undefined);
  const error = signal<FetchError | undefined>(undefined);
  let current: AbortController | undefined;
  const abort = (): void => {
    current?.abort();
    current = undefined;
    pending.set(false);
  };
  onCleanup(abort);
  return {
    submit(target, options = {}) {
      abort();
      const controller = (current = new AbortController());
      pending.set(true);
      const aborts =
        options.signal === undefined
          ? controller.signal
          : AbortSignal.any([controller.signal, options.signal]);
      const promise = post(target, { ...options, signal: aborts }, false);
      // Only the latest submission settles the handle; aborts leave it as abort() did.
      const latest = (): boolean => {
        if (current !== controller) return false;
        current = undefined;
        pending.set(false);
        return true;
      };
      promise.then(
        (outcome) => {
          if (latest() && outcome.type !== "redirect") {
            result.set(outcome);
            error.set(undefined);
          }
        },
        (failure: unknown) => {
          const mine = latest();
          if (failure instanceof FetchError) {
            if (mine) error.set(failure);
          } else if ((failure as { name?: unknown } | null)?.name !== "AbortError") {
            // A mistake (a form that does not post): reported, not swallowed.
            throw failure;
          }
        },
      );
      return promise;
    },
    isSubmitting: () => pending(),
    result: () => result(),
    error: () => error(),
    abort,
    reset() {
      result.set(undefined);
      error.set(undefined);
    },
  };
}

/**
 * A failed `fetch` as a `FetchError` with status 0 (no response), so `submit()` rejects with
 * `FetchError` only (decision-20). Aborts through `options.signal` keep their `AbortError`.
 */
function networkError(error: unknown, url: string): unknown {
  if ((error as { name?: unknown } | null)?.name === "AbortError") return error;
  const message = error instanceof Error ? error.message : String(error);
  const failure = new FetchError(0, `Network error: ${message}`, url, undefined);
  failure.cause = error;
  return failure;
}

/**
 * Refreshes data after a mutation. With targets, refetches only the matching cache entries and
 * re-runs the async components that awaited them: a URL string matches the `fetchJSON()` entry of
 * that URL, a key array the `query()` entries whose key starts with it (`invalidate(["books"])`
 * matches `["books", 1]`). Without targets, refreshes the whole page: client-routed (SPA) pages
 * re-run every async component, MPA pages reload. Resolves once nothing is in flight anymore.
 */
export async function invalidate(...targets: (string | readonly unknown[])[]): Promise<void> {
  if (targets.length > 0) {
    invalidateEntries(targets);
    return settled();
  }
  invalidateEntries(undefined);
  await navigation.invalidate();
}

interface ReadTarget {
  form?: HTMLFormElement;
  submitter?: Element | null;
  body: FormData | URLSearchParams;
}

function readTarget(target: SubmitTarget): ReadTarget {
  if (target instanceof Event) {
    target.preventDefault();
    const form = target.currentTarget ?? target.target;
    if (!(form instanceof HTMLFormElement)) {
      throw new TypeError("submit(event) expects the submit event of a <form>.");
    }
    return fromForm(form, (target as SubmitEvent).submitter ?? null);
  }
  if (target instanceof HTMLFormElement) return fromForm(target, null);
  if (target instanceof FormData || target instanceof URLSearchParams) return { body: target };
  const body = new FormData();
  for (const [key, value] of Object.entries(target)) {
    for (const item of Array.isArray(value) ? value : [value]) body.append(key, item);
  }
  return { body };
}

function fromForm(form: HTMLFormElement, submitter: HTMLElement | null): ReadTarget {
  const body = new FormData(form);
  // A named submit button posts its value, as in a native submission.
  const button = submitter as HTMLButtonElement | HTMLInputElement | null;
  if (button?.name) body.append(button.name, button.value);
  return { form, submitter, body };
}

async function readResult<Data, Failure>(
  response: Response,
  url: string,
): Promise<ActionResult<Data, Failure>> {
  if (!response.headers.has(ACTION_HEADER)) {
    // Not a protocol response: a Response the action returned, a 404/405, a middleware error…
    if (!response.ok) throw await fetchError(response, url);
    return { type: "success", status: response.status, data: (await readBody(response)) as Data };
  }
  const body = (await response.json()) as ActionResponseBody;
  switch (body.type) {
    case "success":
      return { type: "success", status: body.status, data: decodeData(body.data) as Data };
    case "failure":
      return { type: "failure", status: body.status, data: decodeData(body.data) as Failure };
    case "redirect":
      return { type: "redirect", status: body.status, location: body.location };
    case "error":
      throw new FetchError(body.status, body.error.message, url, undefined);
  }
}
