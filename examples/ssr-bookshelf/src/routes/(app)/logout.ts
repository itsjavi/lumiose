import { href, redirect, type Endpoint } from "lumen";
import { auth } from "../../server/auth.server.ts";

export const POST: Endpoint = async (ctx) => {
  await auth().logout(ctx.cookies);
  redirect(href("/"));
};
