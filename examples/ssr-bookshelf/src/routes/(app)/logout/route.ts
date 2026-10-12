import { href, redirect, type Endpoint } from "lumiose";
import { auth } from "../../../server/auth.server.ts";

export const POST: Endpoint<"/logout"> = async (ctx) => {
  await auth().logout(ctx.cookies);
  redirect(href("/"));
};
