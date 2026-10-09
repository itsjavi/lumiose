// Types inferred from a page's `actions` (or `action`) export (decision-26 §1):
// `actionData<typeof actions>()` and `submit<typeof actions.save>(form)` know what the actions
// return, without casts. Type-only.

import type { ActionFailure } from "./protocol.ts";

/** A form action: any function (its context parameter is typed with `ActionContext<P>`). */
type ActionFunction = (ctx: never) => unknown;

/** What `actionData` and `submit` take: `typeof action`, `typeof actions` or `typeof actions.x`. */
export type ActionsExport = ActionFunction | { readonly [name: string]: ActionFunction };

/** What an action resolves to. */
type Returned<F> = F extends ActionFunction ? Awaited<ReturnType<F>> : never;

/** What the action(s) resolve to, one union member per return (not recursive: one level). */
type Outcome<A> = A extends ActionFunction ? Returned<A> : Returned<A[keyof A]>;

/** An action that returns nothing leaves `actionData()` undefined. */
type Data<R> = R extends void ? undefined : R;

/** The data of the actions' successful results: what they return except `fail()` and a `Response`. */
export type ActionSuccessData<A extends ActionsExport> = Data<
  Exclude<Outcome<A>, ActionFailure<any> | Response>
>;

/** The data the actions pass to `fail(status, data)`. */
export type ActionFailureData<A extends ActionsExport> =
  Outcome<A> extends infer R ? (R extends ActionFailure<infer D> ? D : never) : never;
