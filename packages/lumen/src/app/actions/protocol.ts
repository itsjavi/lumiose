// Form action protocol (spec §8 Actions, decision-18), shared by the request handler and the
// browser helpers. Isomorphic: no Node or DOM APIs.
//
// Enhanced submissions (`submit()`) send `Accept: application/json` plus the `x-lumen-action`
// header. The handler then answers with an `ActionResponseBody` as JSON (and echoes the header)
// instead of re-rendering the page:
//   { type: "success", status: 200, data? }        the action returned data
//   { type: "failure", status: 4xx/5xx, data? }    the action returned fail(status, data)
//   { type: "redirect", status: 30x, location }    redirect() or a 3xx Response (HTTP status 200)
//   { type: "error", status, error: { message } }  the action threw
// `data` is encoded with lumen/server's `encodeData` (plain JSON plus tagged Date/Map/Set/…).
// Other responses (a Response the action returned, 404/405, middleware errors) pass through.

/** Request header that asks for a JSON action result; the handler echoes it on protocol responses. */
export const ACTION_HEADER = "x-lumen-action";

/** Returned by `fail()`: the page re-renders with this status and `actionData()` set to `data`. */
export class ActionFailure<Data = undefined> {
  readonly status: number;
  readonly data: Data;

  constructor(status: number, data: Data) {
    this.status = status;
    this.data = data;
  }
}

/**
 * Returns a failed action result, usually for validation errors: `return fail(400, { errors })`.
 * Without JavaScript the page re-renders with `status` and `actionData()` returns `data`;
 * `submit()` resolves with `{ type: "failure", status, data }`.
 */
export function fail(status: number): ActionFailure<undefined>;
export function fail<Data>(status: number, data: Data): ActionFailure<Data>;
export function fail(status: number, data?: unknown): ActionFailure<unknown> {
  if (!(Number.isInteger(status) && status >= 400 && status <= 599)) {
    throw new RangeError(`fail(): status must be between 400 and 599, got ${status}.`);
  }
  return new ActionFailure(status, data);
}

export function isActionFailure(value: unknown): value is ActionFailure<unknown> {
  return value instanceof ActionFailure;
}

/** How a `submit()` ended; errors reject with a `FetchError` instead. */
export type ActionResult<Data = unknown, Failure = unknown> =
  | { type: "success"; status: number; data: Data }
  | { type: "failure"; status: number; data: Failure }
  | { type: "redirect"; status: number; location: string };

/** The JSON body of an enhanced action response (see the protocol above). */
export type ActionResponseBody =
  | { type: "success" | "failure"; status: number; data?: unknown }
  | { type: "redirect"; status: number; location: string }
  | { type: "error"; status: number; error: { message: string } };

/** The action a URL targets: `name` for `?/name`, `undefined` for the default action. */
export function actionName(url: URL): string | undefined {
  for (const key of url.searchParams.keys()) {
    if (key.startsWith("/")) return key.length > 1 ? key.slice(1) : undefined;
  }
  return undefined;
}

/** Whether a request asks for a JSON action result instead of HTML. */
export function wantsActionResult(request: Request): boolean {
  return (
    request.headers.has(ACTION_HEADER) &&
    (request.headers.get("accept") ?? "").includes("application/json")
  );
}
