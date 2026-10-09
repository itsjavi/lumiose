import { redirect, type Endpoint } from "lumen";
import { logout } from "../server/session.ts";

export const POST: Endpoint<"/logout"> = (ctx) => {
  logout(ctx);
  redirect("/");
};
