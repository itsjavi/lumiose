import { redirect } from "react-router";
import { clearedSessionCookie } from "../lib/session.server";

export function action() {
  return redirect("/", { headers: { "Set-Cookie": clearedSessionCookie } });
}
