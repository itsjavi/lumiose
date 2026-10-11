import { redirect } from "@sveltejs/kit";
import { endSession } from "#lib/server/session.ts";
import type { Actions, PageServerLoad } from "./$types";

// POST only: the layout's logout form posts here. A GET goes back to the dashboard.
export const load: PageServerLoad = () => redirect(307, "/");

export const actions: Actions = {
  default: ({ cookies }) => {
    endSession(cookies);
    redirect(303, "/");
  },
};
