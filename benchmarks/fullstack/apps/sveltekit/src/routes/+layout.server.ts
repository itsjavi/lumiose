import { listProjects } from "@bench/data";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals }) => ({
  projects: listProjects(),
  user: locals.user,
});
