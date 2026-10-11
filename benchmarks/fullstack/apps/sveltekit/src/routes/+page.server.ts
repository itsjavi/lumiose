import { getDashboard } from "@bench/data";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = () => getDashboard();
