// Route-literal type helpers (TASK-127, decision-26 §1), against a typegen-style route table.
import type {
  ActionContext,
  Endpoint,
  LayoutProps,
  PageProps,
  RequestContext,
  RouteParams,
} from "lumiose";

declare module "lumiose" {
  interface RouteMap {
    "/": { kind: "page"; params: {} };
    "/books/[isbn]": { kind: "page"; params: { isbn: string } };
    "/api/books/[isbn]": { kind: "endpoint"; params: { isbn: string } };
  }
  interface LayoutMap {
    "/": { params: {} };
    "/books/[isbn]": { params: { isbn: string } };
  }
}

export function Book(props: PageProps<"/books/[isbn]">) {
  const isbn: string = props.params.isbn;
  return <p>{isbn}</p>;
}

export function Shell(props: LayoutProps<"/books/[isbn]">) {
  return <main data-isbn={props.params.isbn}>{props.children}</main>;
}

export const GET: Endpoint<"/api/books/[isbn]"> = (ctx) => Response.json(ctx.params.isbn);

export const actions = {
  save: async (ctx: ActionContext<"/books/[isbn]">) => ({ saved: ctx.params.isbn }),
};

/** Without a pattern (middleware, shared helpers), params are a string record. */
export function userId(ctx: RequestContext): string | undefined {
  return ctx.params["id"];
}

export const params: RouteParams<"/books/[isbn]"> = { isbn: "1" };

// @ts-expect-error an unknown pattern is a type error.
export type Unknown = PageProps<"/nope">;
// @ts-expect-error PageProps takes page patterns, not endpoints.
export type NotAPage = PageProps<"/api/books/[isbn]">;
// @ts-expect-error Endpoint takes endpoint patterns.
export type NotAnEndpoint = Endpoint<"/books/[isbn]">;
// @ts-expect-error a page without this layout scope.
export type NoLayout = LayoutProps<"/books">;
// @ts-expect-error params of the pattern only.
export const wrong = (props: PageProps<"/books/[isbn]">) => props.params.slug;
// @ts-expect-error the params-object generic form is gone.
export type Old = ActionContext<{ isbn: string }>;
