import type { APIRoute } from "astro";
import { signOut } from "../session.ts";

export const POST: APIRoute = ({ cookies, redirect }) => {
  signOut(cookies);
  return redirect("/", 303);
};
