// Form action helpers for the browser (spec §8 Actions, decision-18). `submit()` posts to a page
// action with the JSON protocol (./protocol.ts); `submitting()` and `actionData()` expose its
// state as signals; `invalidate()` refreshes server data after a mutation. Navigation is MPA (a
// full page load) unless the SPA router (TASK-25) installs its hooks with setClientNavigation().

import { signal, type Signal } from "../../core/signal.ts";
import { decodeData } from "../../server/serialize.ts";
import { fetchError, FetchError, readBody } from "../fetch-json.ts";
import {
  ACTION_HEADER,
  actionName,
  type ActionResponseBody,
  type ActionResult,
} from "./protocol.ts";

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
}

/** How `submit()` redirects and `invalidate()` refresh. The SPA router replaces the MPA default. */
export interface ClientNavigation {
  navigate(href: string): void | Promise<void>;
  invalidate(): void | Promise<void>;
}

let navigation: ClientNavigation = {
  navigate: (href) => location.assign(href),
  invalidate: () => location.reload(),
};

/** Installs navigation hooks (the SPA router does, TASK-25). Returns a function that undoes it. */
export function setClientNavigation(hooks: ClientNavigation): () => void {
  const previous = navigation;
  navigation = hooks;
  return () => {
    navigation = previous;
  };
}

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
export function actionData<T = unknown>(): T | undefined {
  return dataSignal()() as T | undefined;
}

/** Whether a `submit()` is in flight; with a name, one to that named action (`?/name`). Reactive. */
export function submitting(name?: string): boolean {
  const names = inFlight();
  return name === undefined ? names.length > 0 : names.includes(name);
}

/**
 * Posts a form to its page action without a page load, and resolves with the action result:
 * `success` and `failure` set `actionData()`, `redirect` navigates. Rejects with a `FetchError` when
 * the action throws or the response is an error. Pass it the submit event to enhance a form:
 * `<form method="post" action="?/create" onSubmit={submit}>`.
 */
export async function submit<Data = unknown, Failure = unknown>(
  target: SubmitTarget,
  options: SubmitOptions = {},
): Promise<ActionResult<Data, Failure>> {
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
  try {
    const response = await fetch(url, {
      method,
      body,
      headers: { accept: "application/json", [ACTION_HEADER]: "1" },
      signal: options.signal,
    });
    const result = await readResult<Data, Failure>(response, url.href);
    if (result.type === "redirect") await navigation.navigate(result.location);
    else dataSignal().set(result.data);
    return result;
  } finally {
    inFlight.update((names) => names.toSpliced(names.indexOf(name), 1));
  }
}

/** Refreshes the current page's server data after a mutation. MPA: reloads the page. */
export async function invalidate(): Promise<void> {
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
