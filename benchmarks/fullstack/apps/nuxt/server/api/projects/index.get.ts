import { listProjects } from "@bench/data";

// The sidebar's projects with their open-issue counts.
export default defineEventHandler(() => listProjects());
