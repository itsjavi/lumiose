// Form actions on the server (spec §8 Actions, decision-18): picks the page action a POST targets,
// runs it with `ctx.formData()`, and builds the JSON results of enhanced submissions. The request
// handler decides between a response and a page re-render with `actionData()`.

import { encodeData } from "../../server/serialize.ts";
import {
  ACTION_HEADER,
  actionName,
  isActionFailure,
  type ActionResponseBody,
} from "../actions/protocol.ts";
import type { Action, ActionContext, RequestContext } from "./context.ts";
import { readFormData } from "./body.ts";
import { HttpError } from "./control.ts";

type ModuleExports = Record<string, unknown>;

/** What a page action returned, when it is not a `Response`. */
export interface ActionOutcome {
  type: "success" | "failure";
  status: number;
  data: unknown;
}

/** Whether a page module exports `action` or `actions`, so it accepts POST. */
export function hasActions(module: ModuleExports): boolean {
  return typeof module.action === "function" || isActionMap(module.actions);
}

/**
 * The action a POST to `url` targets: `actions[name]` for `?/name`, else `action`. Throws a 404
 * `HttpError` when the page does not define it.
 */
export function resolveAction(module: ModuleExports, url: URL): Action {
  const name = actionName(url);
  if (name === undefined) {
    if (typeof module.action === "function") return module.action as Action;
    throw new HttpError(
      404,
      'This page has no default action. Post to "?/name" to run one of its named actions.',
    );
  }
  const actions = isActionMap(module.actions) ? module.actions : {};
  const action = Object.hasOwn(actions, name) ? actions[name] : undefined;
  if (typeof action !== "function") throw new HttpError(404, `This page has no action "${name}".`);
  return action as Action;
}

/** Runs an action with `ctx.formData()`. Throws what the action throws (redirects, errors). */
export async function runAction(
  action: Action,
  ctx: RequestContext,
): Promise<Response | ActionOutcome> {
  let form: Promise<FormData> | undefined;
  // Bounded: 413 beyond the form limits, 400 for a body that is no form (./body.ts).
  const formData = () => (form ??= readFormData(ctx.request));
  const result = await action({ ...ctx, formData } satisfies ActionContext);
  if (result instanceof Response) return result;
  if (isActionFailure(result)) return { type: "failure", status: result.status, data: result.data };
  return { type: "success", status: 200, data: result };
}

function isActionMap(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Encodes action data for the browser; throws a TypeError naming the first non-plain value. */
export function encodeActionData(data: unknown): unknown {
  return encodeData(data, (path, reason) => {
    const where = path === "" ? "" : ` at ${path.replace(/^\./, "")}`;
    throw new TypeError(
      `Action data${where} is ${reason}. Action data is sent to the browser and must be plain data: strings, numbers, booleans, null, arrays, plain objects, Date, Map, Set, BigInt or URL.`,
    );
  });
}

/** The JSON body for an action outcome; `data` is omitted when undefined. */
export function outcomeBody(outcome: ActionOutcome): ActionResponseBody {
  const { type, status, data } = outcome;
  return data === undefined ? { type, status } : { type, status, data: encodeActionData(data) };
}

/**
 * A JSON action result. Redirects travel as HTTP 200 (`fetch()` would follow a 3xx); `headers`
 * carries over the original response's headers, such as `Set-Cookie`.
 */
export function actionResultResponse(body: ActionResponseBody, headers?: Headers): Response {
  const all = new Headers(headers);
  for (const name of ["location", "content-length", "content-encoding"]) all.delete(name);
  all.set("content-type", "application/json");
  all.set(ACTION_HEADER, "1");
  return new Response(JSON.stringify(body), {
    status: body.type === "redirect" ? 200 : body.status,
    headers: all,
  });
}
