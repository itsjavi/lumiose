// Action types inferred from a page's `actions` export (TASK-127, decision-26 §1). Type-level:
// `pnpm typecheck` checks the expectTypeOf assertions; the runtime part only keeps vitest happy.
import { describe, expectTypeOf, it } from "vitest";
import type { ActionContext } from "../server/context.ts";
import { actionData, submit } from "./client.ts";
import { fail, type ActionResult } from "./protocol.ts";
import type { ActionData } from "./types.ts";

interface Review {
  id: number;
  createdAt: Date;
}

// The shape of a page module's exports, never called.
declare const actions: {
  review(ctx: ActionContext): Promise<Review | ReturnType<typeof fail<{ errors: string[] }>>>;
  remove(ctx: ActionContext): Promise<void>;
  publish(ctx: ActionContext): Response | ReturnType<typeof fail<{ reason: "locked" }>>;
};
const action = async (_ctx: ActionContext) => {
  if (Math.random() > 0.5) return fail(400, { email: "required" });
  if (Math.random() > 0.5) return fail(401);
  return { welcome: true as const };
};

describe("actionData<typeof actions>()", () => {
  it("is the union of the actions' data and fail() data, or undefined", () => {
    expectTypeOf(actionData<typeof actions>).returns.toEqualTypeOf<
      Review | undefined | { errors: string[] } | { reason: "locked" }
    >();
  });

  it("is ActionData<typeof actions>, for the props of a component that receives it", () => {
    expectTypeOf<ActionData<typeof actions>>().toEqualTypeOf<
      Review | undefined | { errors: string[] } | { reason: "locked" }
    >();
    expectTypeOf<ActionData<typeof action>>().toEqualTypeOf<
      { welcome: true } | { email: string } | undefined
    >();
  });

  it("infers a single action, with fail() without data as undefined", () => {
    expectTypeOf(actionData<typeof action>).returns.toEqualTypeOf<
      { welcome: true } | { email: string } | undefined
    >();
  });

  it("is unknown without a type argument, and rejects a data type in place of the actions", () => {
    const untyped = () => actionData();
    expectTypeOf(untyped).returns.toEqualTypeOf<unknown>();
    // @ts-expect-error a data type is not an actions export: pass `typeof actions`.
    expectTypeOf(actionData<{ errors: string[] }>).toBeFunction();
  });
});

describe("submit<typeof actions.name>()", () => {
  it("resolves with the action's success and failure data, told apart by type", () => {
    expectTypeOf(submit<typeof actions.review>).returns.resolves.toEqualTypeOf<
      ActionResult<Review, { errors: string[] }>
    >();
    expectTypeOf(submit<typeof actions.remove>).returns.resolves.toEqualTypeOf<
      ActionResult<undefined, never>
    >();
    expectTypeOf(submit<typeof action>).returns.resolves.toEqualTypeOf<
      ActionResult<{ welcome: true }, { email: string } | undefined>
    >();
  });

  it("rejects an unknown action", () => {
    // @ts-expect-error `nope` is not an action of the page.
    expectTypeOf(submit<typeof actions.nope>).toBeFunction();
  });

  it("is untyped without a type argument", () => {
    const untyped = () => submit(new FormData());
    expectTypeOf(untyped).returns.resolves.toEqualTypeOf<ActionResult>();
  });
});
