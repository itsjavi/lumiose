// Form action helpers for the browser (spec §8 Actions, decision-18). `submit()` posts to a page
// action with the JSON protocol (./protocol.ts); `isSubmitting()` and `actionData()` expose its
// state as signals; `invalidate()` refreshes server data after a mutation. Navigation is MPA (a
// full page load) unless the SPA router (TASK-25) installs its hooks with setClientNavigation().

import { beginBusy } from "../../core/internal.ts";
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
export async function submit(
  target: SubmitTarget,
  options: SubmitOptions = {},
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
    else dataSignal().set(result.data);
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
